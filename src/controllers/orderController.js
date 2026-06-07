const orderModel = require('../models/orderModel');
const socketUtils = require('../utils/socket');
const { sendOrderNotification, broadcastNewOrder } = require('../utils/notification');
const db = require('../config/db');


const createOrder = async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('\n📥 [OrderPlacement] STEP 2: Backend received createOrder request from user:', user_id);

    const {
      store_id,
      items,
      subtotal,
      handling_fee,
      delivery_fee,
      rainy_surge_fee,
      late_night_fee,
      delivery_tip,
      total_amount,
      delivery_address,
      address_id,
      is_pickup
    } = req.body;

    if (!items || !total_amount || !store_id) {
      return res.status(400).json({ success: false, error: 'Items, store_id and total_amount are required' });
    }

    // 1. Fetch Store and Settings for validation
    const storeRes = await db.query('SELECT latitude, longitude, name FROM stores WHERE id = $1', [store_id]);
    const store = storeRes.rows[0];
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

    const settingsRes = await db.query('SELECT * FROM app_settings WHERE id = 1');
    const settings = settingsRes.rows[0];

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

    let finalDeliveryFee = 0;

    if (!is_pickup && userLat && userLng && store.latitude && store.longitude) {
      // Calculate Haversine Distance
      const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };

      const distance = calculateDistance(userLat, userLng, store.latitude, store.longitude);
      console.log(`[OrderPlacement] Calculated distance: ${distance.toFixed(2)}km`);

      // Enforce Max Radius
      const maxRadius = parseFloat(settings.global_max_delivery_radius || 10);
      if (distance > maxRadius) {
        return res.status(400).json({ 
          success: false, 
          error: `Store is too far for delivery (${distance.toFixed(1)}km). Max allowed is ${maxRadius}km.` 
        });
      }

      // Calculate Dynamic Delivery Fee
      if (parseFloat(subtotal) < parseFloat(settings.free_delivery_threshold || 500)) {
        let fee = parseFloat(settings.min_delivery_fee || 30);
        const baseRadius = parseFloat(settings.base_delivery_radius || 5);
        
        if (distance > baseRadius) {
          const extraKm = distance - baseRadius;
          const perKmCharge = parseFloat(settings.per_km_extra_charge || 10);
          fee += extraKm * perKmCharge;
        }

        if (settings.is_rainy_condition) {
          fee += parseFloat(settings.rainy_condition_fee || 0);
        }

        finalDeliveryFee = Math.round(fee);
      }
    }

    // 3. Late Night Fee check (Existing logic but centralized)
    let finalLateNightFee = 0;
    const now = new Date();
    const currentTime = now.getHours() + ":" + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    if (currentTime >= settings.late_night_start || currentTime <= settings.late_night_end) {
      finalLateNightFee = parseFloat(settings.late_night_fee || 0);
    }

    const orderData = {
      user_id,
      store_id,
      items,
      subtotal: subtotal || 0,
      handling_fee: handling_fee || 0,
      delivery_fee: delivery_fee || 0,
      rainy_surge_fee: rainy_surge_fee || 0,
      late_night_fee: late_night_fee || 0,
      delivery_tip: delivery_tip || 0,
      total_amount: total_amount || 0,
      delivery_address: delivery_address || {},
      address_id: address_id || null,
      is_pickup: is_pickup || false,
      payment_mode: payment_mode || 'cod'
    };

    const newOrder = await orderModel.createOrder(orderData);
    console.log('📦 [OrderPlacement] Order created with dynamic fee:', finalDeliveryFee);

    // Emit real-time updates and send push notifications
    if (newOrder) {
      try {
        const io = socketUtils.getIO();
        io.to('admin').emit('new_order', newOrder);
        
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

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getOrderById(id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
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

    const updatedOrder = await orderModel.updateOrderStatus(id, updates);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if the order transitioned to completed status
    const wasCompleted = existingOrder.is_completed;
    const isCompletedNow = updatedOrder.is_completed;

    if (!wasCompleted && isCompletedNow) {
      const partnerId = updatedOrder.delivery_partner_id;
      if (partnerId) {
        const fee = parseFloat(updatedOrder.delivery_fee) || 0;
        const rainySurge = parseFloat(updatedOrder.rainy_surge_fee) || 0;
        const lateNight = parseFloat(updatedOrder.late_night_fee) || 0;
        const tip = parseFloat(updatedOrder.delivery_tip) || 0;
        const earningsToAdd = fee + rainySurge + lateNight + tip;

        if (earningsToAdd > 0) {
          console.log(`[Earnings] Crediting partner ${partnerId} with ₹${earningsToAdd} (fee: ₹${fee}, rainy: ₹${rainySurge}, lateNight: ₹${lateNight}, tip: ₹${tip}) for order #${id}`);
          try {
            await db.query(
              `UPDATE users 
               SET total_earnings = COALESCE(total_earnings, 0) + $1,
                   withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + $1
               WHERE id = $2`,
              [earningsToAdd, partnerId]
            );
          } catch (err) {
            console.error('❌ Failed to update partner earnings in DB:', err.message);
          }
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

module.exports = {
  createOrder,
  getAllOrders,
  getAvailableOrders,
  getPartnerOrders,
  optInToOrder,
  getActiveOrder,
  getOrderById,
  updateOrderStatus,
  getUserOrders
};
