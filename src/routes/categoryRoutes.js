const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public route to fetch all active categories & subcategories
router.get('/', categoryController.getCategories);

// Admin-facing routes to manage categories & subcategories
router.get('/admin', categoryController.getCategoriesAdmin);
router.post('/admin', categoryController.createCategory);
router.delete('/admin/:id', categoryController.deleteCategory);
router.post('/admin/subcategories', categoryController.createSubcategory);
router.delete('/admin/subcategories/:id', categoryController.deleteSubcategory);

module.exports = router;
