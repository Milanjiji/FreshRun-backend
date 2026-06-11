const categoryModel = require('../models/categoryModel');

/**
 * GET /categories
 * Public endpoint to fetch active categories and nested subcategories
 */
const getCategories = async (req, res) => {
  try {
    const categories = await categoryModel.getAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

/**
 * GET /categories/admin
 * Admin endpoint to fetch all categories and nested subcategories (includes inactive)
 */
const getCategoriesAdmin = async (req, res) => {
  try {
    const categories = await categoryModel.getAllCategoriesAdmin();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories for admin:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

/**
 * POST /categories/admin
 * Admin endpoint to create a new category
 */
const createCategory = async (req, res) => {
  try {
    const { name, slug, icon } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }
    const category = await categoryModel.createCategory(name, slug, icon);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
};

/**
 * DELETE /categories/admin/:id
 * Admin endpoint to delete a category
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await categoryModel.deleteCategory(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully', data: deleted });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
};

/**
 * POST /categories/admin/subcategories
 * Admin endpoint to create a new subcategory
 */
const createSubcategory = async (req, res) => {
  try {
    const { category_id, name } = req.body;
    if (!category_id || !name) {
      return res.status(400).json({ success: false, error: 'Category ID and subcategory name are required' });
    }
    const subcategory = await categoryModel.createSubcategory(category_id, name);
    res.status(201).json({ success: true, data: subcategory });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ success: false, error: 'Failed to create subcategory' });
  }
};

/**
 * DELETE /categories/admin/subcategories/:id
 * Admin endpoint to delete a subcategory
 */
const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await categoryModel.deleteSubcategory(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Subcategory not found' });
    }
    res.status(200).json({ success: true, message: 'Subcategory deleted successfully', data: deleted });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ success: false, error: 'Failed to delete subcategory' });
  }
};

module.exports = {
  getCategories,
  getCategoriesAdmin,
  createCategory,
  deleteCategory,
  createSubcategory,
  deleteSubcategory
};
