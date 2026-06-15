const express = require('express');
const { 
  createOrder, 
  getAllOrders, 
  getAvailableOrders,
  getPartnerOrders,
  optInToOrder,
  getActiveOrder, 
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  pickupStore
} = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const deliveryActiveMiddleware = require('../middleware/deliveryActiveMiddleware');

const router = express.Router();

router.post('/', authMiddleware, createOrder);
router.get('/active', authMiddleware, getActiveOrder);
router.get('/available', authMiddleware, deliveryActiveMiddleware, getAvailableOrders);
router.get('/partner', authMiddleware, deliveryActiveMiddleware, getPartnerOrders);
router.get('/user', authMiddleware, getUserOrders);
router.get('/:id', authMiddleware, getOrderById);
router.post('/:id/opt-in', authMiddleware, deliveryActiveMiddleware, optInToOrder);
router.post('/:id/pickup-store', authMiddleware, deliveryActiveMiddleware, pickupStore);
router.get('/', getAllOrders); // In production, add authMiddleware and restrict to admin or user's own orders
router.patch('/:id', authMiddleware, updateOrderStatus);

module.exports = router;
