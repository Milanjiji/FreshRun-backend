const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');

// Get all activity logs (restricted to admin)
router.get('/', authMiddleware, activityController.getActivityLogs);

module.exports = router;
