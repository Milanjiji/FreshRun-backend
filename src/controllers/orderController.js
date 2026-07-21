const orderModel = require('../models/orderModel');
const socketUtils = require('../utils/socket');
const { sendOrderNotification, broadcastNewOrder } = require('../utils/notification');
const db = require('../config/db');
const paymentController = require('./paymentController');
const { calculateBilling, calcSurgeFee } = require('../utils/pricingEngine');


const createOrder = async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('\n📥 [OrderPlacement] STEP 2: Backend received createOrder request from user:', user_id);

    const {
      store_id,
      items,
      delivery_address,
      address_id,
      is_pickup,
      payment_mode,
      // Legacy fee fields from client (kept for reference; server recalculates)
      delivery_tip,
      // New fee fields from client
      coupon_code,
    } = req.body;

    if (!items || !store_id) {
      return res.status(400).json({ success: false, error: 'Items and store_id are required' });
    }

    // 1. Fetch Store, App Settings, and Pricing Config
    const storeRes      = await db.query('SELECT latitude, longitude, name FROM stores WHERE id = $1', [store_id]);
    const store         = storeRes.rows[0];
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

    const settingsRes   = await db.query('SELECT * FROM app_settings WHERE id = 1');
    const appSettings   = settingsRes.rows[0];

    const pricingRes    = await db.query('SELECT * FROM pricing_config WHERE id = 1');
    const pricingConfig = pricingRes.rows[0] || {};

    // 2. Resolve User Address & Calculate Distance
    let userLat, userLng;
    if (address_id) {
      const addrRes = await db.query('SELECT latitude, longitude FROM addresses WHERE id = $1', [address_id]);
      userLat = addrRes.rows[0]?.latitude;
      userLng = addrRes.rows[0]?.longitude;
    } else {
      userLat = delivery_address?.latitude;
      userLng = delivery_address?.longitude;
    }

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    let distanceKm = null;
    if (!is_pickup && userLat && userLng && store.latitude && store.longitude) {
      distanceKm = calculateDistance(userLat, userLng, store.latitude, store.longitude);
      console.log(`[OrderPlacement] Calculated distance: ${distanceKm.toFixed(2)}km`);

      const maxRadius = parseFloat(appSettings.global_max_delivery_radius || 10);
      if (distanceKm > maxRadius) {
        return res.status(400).json({
          success: false,
          error: `Store is too far for delivery (${distanceKm.toFixed(1)}km). Max allowed is ${maxRadius}km.`
        });
      }
    }

    // 3. Calculate subtotal (server-authoritative)
    const activeItems = items.filter(item => item.price && item.quantity);
    const subtotal = activeItems.reduce((sum, item) => {
      const discount = item.discount_percent || 0;
      return sum + (item.price * (1 - discount / 100) * item.quantity);
    }, 0);

    // 4. Late Night Fee
    let lateNightFee = 0;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    if (appSettings.late_night_start && appSettings.late_night_end) {
      const [sh, sm] = appSettings.late_night_start.split(':').map(Number);
      const [eh, em] = appSettings.late_night_end.split(':').map(Number);
      const st = sh * 60 + sm;
      const et = eh * 60 + em;
      const isLate = st > et ? (currentMins >= st || currentMins <= et) : (currentMins >= st && currentMins <= et);
      if (isLate) lateNightFee = parseFloat(appSettings.late_night_fee || 0);
    }

    // 5. Extra store charge
    const storeIds = [...new Set(activeItems.map(i => String(i.store_id || i.storeId)).filter(Boolean))];
    const extraStoreCharge = storeIds.length > 1 ? (storeIds.length - 1) * parseFloat(appSettings.extra_store_charge || 20) : 0;
    const effectiveExtraStore = is_pickup ? 0 : extraStoreCharge;

    // 6. Coupon lookup
    let coupon = null;
    if (coupon_code) {
      const couponRes = await db.query('SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)', [coupon_code]);
      coupon = couponRes.rows[0] || null;
    }

    // 7. Full billing calculation via pricing engine
    const billing = calculateBilling({
      items: activeItems,
      subtotal,
      distanceKm,
      isSelfPickup: !!is_pickup,
      deliveryTip: parseFloat(delivery_tip || 0),
      lateNightFee,
      extraStoreCharge: effectiveExtraStore,
      appSettings,
      pricingConfig,
      coupon,
    });

    console.log('[OrderPlacement] Server-calculated billing:', billing);

    // 8. Increment coupon used_count if a valid coupon was applied
    if (coupon && billing.couponDiscount > 0) {
      await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [coupon.id]);
    }

    const orderData = {
      user_id,
      store_id,
      items: activeItems,
      subtotal:          Math.round(subtotal),
      handling_fee:      billing.handlingFee,
      delivery_fee:      billing.deliveryFee,
      rainy_surge_fee:   0, // legacy field — kept for DB compat; surgeFee covers both
      late_night_fee:    billing.lateNightFee,
      extra_store_charge: billing.extraStoreCharge,
      delivery_tip:      billing.deliveryTip,
      total_amount:      billing.grandTotal,
      delivery_address:  delivery_address || {},
      address_id:        address_id || null,
      is_pickup:         is_pickup || false,
      payment_mode:      payment_mode || 'cod',
      // New fee fields
      platform_fee:      billing.platformFee,
      packaging_fee:     billing.packagingFee,
      surge_fee:         billing.surgeFee,
      gst_amount:        billing.gstAmount,
      coupon_code:       coupon_code || null,
      coupon_discount:   billing.couponDiscount,
      platform_discount: billing.platformDiscount,
    };

    const newOrder = await orderModel.createOrder(orderData);
    console.log('📦 [OrderPlacement] Order created. Grand Total:', billing.grandTotal);

    // Emit real-time updates and send push notifications only for COD orders
    if (newOrder && newOrder.payment_mode === 'cod') {
      try {
        const io = socketUtils.getIO();
        io.to('admin').emit('new_order', newOrder);
        io.to(`store_${newOrder.store_id}`).emit('new_order', newOrder);

        const storeOwnerRes = await db.query('SELECT owner_id, name FROM stores WHERE id = $1', [newOrder.store_id]);
        const ownerId = storeOwnerRes.rows[0]?.owner_id;
        const storeName = storeOwnerRes.rows[0]?.name || 'Your store';
        if (ownerId) {
          await sendOrderNotification(
            ownerId,
            'New Order Received! 🛍️',
            `You have a new order of ₹${newOrder.total_amount} from ${storeName}.`,
            { orderId: String(newOrder.id), type: 'new_order' }
          );
        }

        if (!newOrder.is_pickup) {
          io.to('delivery_partners').emit('new_available_order', newOrder);
          await broadcastNewOrder(newOrder.id, newOrder.store_name || 'a store');
        }
      } catch (err) {
        console.warn('Update triggers failed:', err.message);
      }
    }

    res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
    console.error('❌ [OrderPlacement] Error creating order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await orderModel.getAllOrders();
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getAvailableOrders = async (req, res) => {
  try {
    const orders = await orderModel.getAvailableOrders();
    orders.forEach(order => {
      if (order) delete order.delivery_pin;
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching available orders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getPartnerOrders = async (req, res) => {
  try {
    const partner_id = req.user.id;
    const includeCompleted = req.query.history === 'true';
    const orders = await orderModel.getPartnerOrders(partner_id, includeCompleted);
    orders.forEach(order => {
      if (order) delete order.delivery_pin;
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching partner orders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const optInToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const partner_id = req.user.id;

    const updatedOrder = await orderModel.optInToOrder(id, partner_id);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: 'Order already claimed or not found' });
    }

    // Delete delivery_pin so it is not leaked to the partner or socket listeners
    delete updatedOrder.delivery_pin;

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.to(`order_${id}`).emit('order_status_changed', updatedOrder);
      io.to('admin').emit('order_status_changed', updatedOrder);
    } catch (socketErr) {
      console.warn('Socket emit failed:', socketErr.message);
    }

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error opting in to order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getActiveOrder = async (req, res) => {
  try {
    const user_id = req.user.id;
    const order = await orderModel.getActiveOrderByUserId(user_id);
    res.status(200).json({ success: true, order: order || null });
  } catch (error) {
    console.error('Error fetching active order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getActiveOrders = async (req, res) => {
  try {
    const user_id = req.user.id;
    const orders = await orderModel.getActiveOrdersByUserId(user_id);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching active orders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getOrderById(id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Only allow the customer who placed the order to see the PIN
    if (req.user && req.user.id !== order.user_id) {
      delete order.delivery_pin;
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingOrder = await orderModel.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Verify permissions for transitioning to delivered/completed status
    if (updates.status === 'delivered' || updates.is_completed === true) {
      // Check role authorization: Only assigned delivery partner or admin can complete
      if (req.user.role !== 'admin' && (req.user.role !== 'delivery' || req.user.id !== existingOrder.delivery_partner_id)) {
        return res.status(403).json({ success: false, error: 'Only the assigned delivery partner or an admin can mark this order as delivered.' });
      }

      // Verify Delivery PIN (Admins bypass PIN check)
      if (req.user.role !== 'admin') {
        const { delivery_pin } = updates;
        if (!delivery_pin) {
          return res.status(400).json({ success: false, error: 'Delivery PIN verification is required.' });
        }
        if (String(delivery_pin) !== String(existingOrder.delivery_pin)) {
          return res.status(400).json({ success: false, error: 'Invalid delivery verification PIN. Please try again.' });
        }
      }
      
      // Strip delivery_pin from updates before updating the DB row
      delete updates.delivery_pin;
    } else {
      // Strip delivery_pin from updates if sent by accident on other status updates
      delete updates.delivery_pin;
    }

    // Guard: Only the customer who placed the order can dismiss a declined order (by marking it cancelled)
    if (updates.status === 'cancelled' && existingOrder.status === 'declined') {
      if (req.user.id !== existingOrder.user_id) {
        return res.status(403).json({ success: false, error: 'Only the customer who placed this order can dismiss it.' });
      }
    }

    const updatedOrder = await orderModel.updateOrderStatus(id, updates);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Hide delivery_pin from socket broadcasts and HTTP responses
    delete updatedOrder.delivery_pin;

    // Check if the order transitioned to completed status
    const wasCompleted = existingOrder.is_completed;
    const isCompletedNow = updatedOrder.is_completed;

    if (!wasCompleted && isCompletedNow) {
      // 1. Delivery Partner Earnings
      const partnerId = updatedOrder.delivery_partner_id;
      if (partnerId) {
        const fee = parseFloat(updatedOrder.delivery_fee) || 0;
        const rainySurge = parseFloat(updatedOrder.rainy_surge_fee) || 0;
        const lateNight = parseFloat(updatedOrder.late_night_fee) || 0;
        const extraStore = parseFloat(updatedOrder.extra_store_charge) || 0;
        const tip = parseFloat(updatedOrder.delivery_tip) || 0;
        const earningsToAdd = fee + rainySurge + lateNight + extraStore + tip;

        if (earningsToAdd > 0) {
          console.log(`[Earnings] Crediting partner ${partnerId} with ₹${earningsToAdd} (fee: ₹${fee}, rainy: ₹${rainySurge}, lateNight: ₹${lateNight}, extraStore: ₹${extraStore}, tip: ₹${tip}) for order #${id}`);
          try {
            await db.query(
              `UPDATE users 
               SET total_earnings = COALESCE(total_earnings, 0) + $1,
                   withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + $1
               WHERE id = $2`,
              [earningsToAdd, partnerId]
            );
            
            // Record transaction in ledger
            await db.query(
              `INSERT INTO earnings_transactions (user_id, amount, type, order_id, description) 
               VALUES ($1, $2, 'earning', $3, $4)`,
              [partnerId, earningsToAdd, id, `Earning for delivery of order #${id}`]
            );
            
            // Instantly transfer money to delivery boy via Razorpay Route
            await paymentController.payDeliveryBoy(partnerId, earningsToAdd, id);
            
          } catch (err) {
            console.error('❌ Failed to update partner earnings in DB/ledger:', err.message);
          }
        }
      }

      // 2. Store Owner Earnings
      if (updatedOrder.store_id) {
        try {
          // Fetch store owner ID
          const storeRes = await db.query('SELECT owner_id, name FROM stores WHERE id = $1', [updatedOrder.store_id]);
          const ownerId = storeRes.rows[0]?.owner_id;
          const storeName = storeRes.rows[0]?.name || 'Store';

          if (ownerId) {
            // Fetch platform commission rate
            const settingsRes = await db.query('SELECT platform_commission FROM app_settings WHERE id = 1');
            const commissionPercent = settingsRes.rows[0]?.platform_commission !== null && settingsRes.rows[0]?.platform_commission !== undefined
              ? parseFloat(settingsRes.rows[0].platform_commission)
              : 10.00; // default 10%

            const subtotal = parseFloat(updatedOrder.subtotal) || 0;
            const storeShare = subtotal * (1 - (commissionPercent / 100));

            if (storeShare > 0) {
              console.log(`[Earnings] Crediting store owner ${ownerId} of "${storeName}" with ₹${storeShare.toFixed(2)} (commission: ${commissionPercent}%) for order #${id}`);
              
              await db.query(
                `UPDATE users 
                 SET total_earnings = COALESCE(total_earnings, 0) + $1,
                     withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + $1
                 WHERE id = $2`,
                [storeShare, ownerId]
              );

              // Record transaction in ledger
              await db.query(
                `INSERT INTO earnings_transactions (user_id, amount, type, order_id, description) 
                 VALUES ($1, $2, 'earning', $3, $4)`,
                [ownerId, storeShare, id, `Earning for order #${id} from store "${storeName}"`]
              );
            }
          }
        } catch (err) {
          console.error('❌ Failed to update store owner earnings in DB/ledger:', err.message);
        }
      }
    }

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.to(`order_${id}`).emit('order_status_changed', updatedOrder);
      io.to('admin').emit('order_status_changed', updatedOrder);

      // --- Notification for Admin (Order Delivered) ---
      if (!wasCompleted && isCompletedNow && updatedOrder.status === 'delivered') {
        io.to('admin').emit('order_delivered', {
          id: updatedOrder.id,
          userName: updatedOrder.user_name,
          totalAmount: updatedOrder.total_amount,
          timestamp: new Date().toISOString()
        });
      }

      // Send push notification to partner and customer if status changed
      if (updates.delivery_status || updates.status || updates.is_completed !== undefined) {
        const deliveryStatus = updates.delivery_status || updatedOrder.delivery_status;
        const orderStatus = updates.status || updatedOrder.status;
        const isCompleted = updates.is_completed || updatedOrder.is_completed;

        let partnerTitle = 'Order Update';
        let partnerBody = '';
        let customerTitle = 'Order Update';
        let customerBody = '';

        // Logic for Customer & Partner notifications
        if (isCompleted && orderStatus !== 'declined' && orderStatus !== 'cancelled') {
          customerTitle = 'Order Delivered! 🎁';
          customerBody = `Your order #${updatedOrder.id} has been delivered. Enjoy!`;
        } else if (deliveryStatus === 'assigned') {
          customerTitle = 'Partner Assigned 🛵';
          customerBody = `A delivery partner has been assigned to your order #${updatedOrder.id}.`;
        } else if (deliveryStatus === 'packed' || orderStatus === 'packed') {
          partnerTitle = `Order #${updatedOrder.id} Packed`;
          partnerBody = 'The order is now packed and ready for pickup.';
          customerTitle = 'Order Packed 📦';
          customerBody = `Your order #${updatedOrder.id} is packed and will be picked up soon.`;
        } else if (deliveryStatus === 'ready' || orderStatus === 'ready') {
          partnerTitle = `Order #${updatedOrder.id} Ready for Pickup`;
          partnerBody = 'The order is ready for pickup.';
          customerTitle = 'Ready for Pickup';
          customerBody = `Your order #${updatedOrder.id} is ready at the store.`;
        } else if (deliveryStatus === 'out_for_delivery') {
          partnerTitle = `Order #${updatedOrder.id} Out for Delivery`;
          partnerBody = 'Your order is on the way.';
          customerTitle = 'Out for Delivery 🚀';
          customerBody = `Your order #${updatedOrder.id} is on the way to you!`;
        } else if (orderStatus === 'cancelled' || orderStatus === 'declined') {
          const actionText = orderStatus === 'declined' ? 'Declined' : 'Cancelled';
          partnerTitle = `Order #${updatedOrder.id} ${actionText}`;
          partnerBody = `The order has been ${actionText.toLowerCase()}.`;
          customerTitle = `Order ${actionText} ❌`;
          customerBody = `Your order #${updatedOrder.id} has been ${actionText.toLowerCase()}.`;
        }

        // Send to Partner
        if (partnerBody && updatedOrder.delivery_partner_id) {
          await sendOrderNotification(updatedOrder.delivery_partner_id, partnerTitle, partnerBody, { 
            orderId: String(updatedOrder.id), 
            type: deliveryStatus 
          });
        }

        // Send to Customer
        if (customerBody && updatedOrder.user_id) {
          await sendOrderNotification(updatedOrder.user_id, customerTitle, customerBody, { 
            orderId: String(updatedOrder.id), 
            type: orderStatus || deliveryStatus 
          });
        }
      }
    } catch (socketErr) {
      console.warn('Socket emit failed:', socketErr.message);
    }

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const user_id = req.user.id;
    const orders = await orderModel.getOrdersByUserId(user_id);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const pickupStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { store_id } = req.body;

    const existingOrder = await orderModel.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    let pickedUpStores = existingOrder.picked_up_stores || [];
    if (typeof pickedUpStores === 'string') {
      try {
        pickedUpStores = JSON.parse(pickedUpStores);
      } catch (e) {
        pickedUpStores = [];
      }
    }
    if (!pickedUpStores.includes(store_id)) {
      pickedUpStores.push(store_id);
    }

    const updatedOrder = await orderModel.updateOrderStatus(id, {
      picked_up_stores: JSON.stringify(pickedUpStores)
    });

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.to(`order_${id}`).emit('order_status_changed', updatedOrder);
      io.to('admin').emit('order_status_changed', updatedOrder);
    } catch (socketErr) {
      console.warn('Socket emit failed:', socketErr.message);
    }

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error in pickupStore:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getAvailableOrders,
  getPartnerOrders,
  optInToOrder,
  getActiveOrder,
  getActiveOrders,
  getOrderById,
  updateOrderStatus,
  getUserOrders,
  pickupStore
};
