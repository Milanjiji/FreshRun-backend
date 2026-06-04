const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.get('/all', userController.getAllUsers);
router.get('/delivery-partners', userController.getDeliveryPartners);
router.patch('/:id/approve', userController.handleApproval);
// Address Management
router.get('/addresses', authenticateToken, addressController.getAddresses);
router.post('/addresses', authenticateToken, addressController.addAddress);
router.post('/addresses/select', authenticateToken, addressController.selectAddress);
router.delete('/addresses/:id', authenticateToken, addressController.deleteAddress);

// FCM Token Management
router.post('/fcm-token', authenticateToken, userController.updateFcmToken);

// Account Deletion
router.delete('/account', authenticateToken, userController.deleteAccount);

router.get('/:id', userController.getUserById);

module.exports = router;
