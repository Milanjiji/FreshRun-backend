const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.registerPartner);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);


module.exports = router;
