const orderModel = require('../models/orderModel');
const socketUtils = require('../utils/socket');
const { sendOrderNotification, broadcastNewOrder } = require('../utils/notification');

const createOrder = async (req, res) => {
  try {
    const {
      store_id,
      items,
      subtotal,
      handling_fee,
      delivery_fee,
      late_night_fee,
      delivery_tip,
      total_amount,
      delivery_address,
      address_id
    } = req.body;

    const user_id = req.user.id;

    if (!items || !total_amount) {
      return res.status(400).json({ success: false, error: 'Items and total_amount are required' });
    }

    const orderData = {
      user_id,
      store_id,
      items,
      subtotal: subtotal || 0,
      handling_fee: handling_fee || 0,
      delivery_fee: delivery_fee || 0,
      late_night_fee: late_night_fee || 0,
      delivery_tip: delivery_tip || 0,
      total_amount,
      delivery_address: delivery_address || {},
      address_id: address_id || null
    };

    const newOrder = await orderModel.createOrder(orderData);

    // Emit real-time updates and send push notifications
    if (newOrder) {
      try {
        const io = socketUtils.getIO();
        io.to('admin').emit('new_order', newOrder);
        io.to('delivery_partners').emit('new_available_order', newOrder);
        
        // Push notification to all delivery partners
        await broadcastNewOrder(newOrder.id, newOrder.store_name || 'a store');
      } catch (err) {
        console.warn('Update triggers failed:', err.message);
      }
    }

    res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
    console.error('Error creating order:', error);
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
    const orders = await orderModel.getPartnerOrders(partner_id);
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

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedOrder = await orderModel.updateOrderStatus(id, updates);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.to(`order_${id}`).emit('order_status_changed', updatedOrder);
      io.to('admin').emit('order_status_changed', updatedOrder);

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
        if (isCompleted) {
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
        } else if (orderStatus === 'cancelled') {
          partnerTitle = `Order #${updatedOrder.id} Cancelled`;
          partnerBody = 'The order has been cancelled.';
          customerTitle = 'Order Cancelled ❌';
          customerBody = `Your order #${updatedOrder.id} has been cancelled.`;
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

module.exports = {
  createOrder,
  getAllOrders,
  getAvailableOrders,
  getPartnerOrders,
  optInToOrder,
  getActiveOrder,
  updateOrderStatus
};
