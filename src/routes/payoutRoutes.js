const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const authenticateToken = require('../middleware/authMiddleware');

// Delivery Partner Endpoints
router.post('/request', authenticateToken, payoutController.requestWithdrawal);
router.get('/my-requests', authenticateToken, payoutController.getMyRequests);

// Admin Dashboard Endpoints
router.get('/admin/requests', payoutController.getAllRequests);
router.patch('/admin/requests/:id/approve', payoutController.approveWithdrawal);
router.patch('/admin/requests/:id/reject', payoutController.rejectWithdrawal);

module.exports = router;
