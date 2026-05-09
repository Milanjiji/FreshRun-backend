const orderModel = require('../models/orderModel');

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
      delivery_address
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
      delivery_address: delivery_address || {}
    };

    const newOrder = await orderModel.createOrder(orderData);
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

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedOrder = await orderModel.updateOrderStatus(id, updates);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
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
  updateOrderStatus
};
