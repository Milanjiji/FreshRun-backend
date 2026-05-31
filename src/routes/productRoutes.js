const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Public route to get products
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);


// Admin route to create product
router.post('/', productController.createProduct);

// Route to update product (availability, stock, etc)
router.patch('/:id', productController.updateProduct);

// Route to delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;

