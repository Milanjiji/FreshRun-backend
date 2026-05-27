const express = require('express');
const { 
  createOrder, 
  getAllOrders, 
  getAvailableOrders,
  getPartnerOrders,
  optInToOrder,
  getActiveOrder, 
  getOrderById,
  updateOrderStatus 
} = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, createOrder);
router.get('/active', authMiddleware, getActiveOrder);
router.get('/available', authMiddleware, getAvailableOrders);
router.get('/partner', authMiddleware, getPartnerOrders);
router.get('/:id', authMiddleware, getOrderById);
router.post('/:id/opt-in', authMiddleware, optInToOrder);
router.get('/', getAllOrders); // In production, add authMiddleware and restrict to admin or user's own orders
router.patch('/:id', updateOrderStatus);

module.exports = router;
