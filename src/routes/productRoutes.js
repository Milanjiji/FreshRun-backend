const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Public route to get products
router.get('/', productController.getProducts);

// Admin route to create product
router.post('/', productController.createProduct);

module.exports = router;
