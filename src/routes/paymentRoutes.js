const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middleware/authMiddleware');

// Onboarding for Stores/Delivery Partners
router.post('/onboard', authenticateToken, paymentController.onboardPartner);

// Create Razorpay Order with split logic
router.post('/create-order', authenticateToken, paymentController.createOrderWithSplit);

// Verify payment signature
router.post('/verify', authenticateToken, paymentController.verifyPayment);

// Razorpay Webhook (No auth needed, verified by signature)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
