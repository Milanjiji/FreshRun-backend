const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

// Address Management
router.get('/addresses', authenticateToken, addressController.getAddresses);
router.post('/addresses', authenticateToken, addressController.addAddress);
router.post('/addresses/select', authenticateToken, addressController.selectAddress);

module.exports = router;
