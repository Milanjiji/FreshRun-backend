const express = require('express');
const { createOrder, getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, createOrder);
router.get('/', getAllOrders); // In production, add authMiddleware and restrict to admin or user's own orders
router.patch('/:id', updateOrderStatus);

module.exports = router;
