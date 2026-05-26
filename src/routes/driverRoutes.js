const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

// Update driver FCM token
router.post('/:driverId/fcm-token', driverController.updateFcmToken);

module.exports = router;
