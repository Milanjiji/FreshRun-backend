const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

// Public route to get stores (for mobile app)
router.get('/', storeController.getStores);

// Admin route to create store (In production, this should be protected by admin auth)
router.post('/', storeController.createStore);

module.exports = router;
