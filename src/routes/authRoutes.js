const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.registerPartner);
router.get('/check-owner/:phone', authController.checkOwner);
router.get('/check-partner/:phone', authController.checkPartner);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
