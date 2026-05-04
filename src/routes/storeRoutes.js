const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

// Public route to get stores (for mobile app)
router.get('/', storeController.getStores);

// Admin route to create store
router.post('/', storeController.createStore);

// Route to update store (availability toggle, etc)
router.patch('/:id', storeController.updateStore);

module.exports = router;

