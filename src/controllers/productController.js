const productModel = require('../models/productModel');
const { generateHash } = require('../utils/hash');

/**
 * Create a new product
 * POST /products
 */
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      imageUrl,
      price,
      discountPercent,
      stockQuantity,
      isStockOut,
      category,
      storeId,
      isVeg
    } = req.body;

    // Basic validation
    if (!name || !price || !category || !storeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Generate unique ID for product (hash of name and store_id)
    const productId = generateHash(`${name}_${storeId}`);

    const productData = {
      id: productId,
      store_id: storeId,
      name,
      description,
      image_url: imageUrl,
      price,
      discount_percent: discountPercent || 0,
      stock_quantity: stockQuantity || 0,
      is_stock_out: isStockOut || false,
      category,
      is_veg: isVeg !== undefined ? isVeg : true
    };

    const newProduct = await productModel.createProduct(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
};

/**
 * Get all products
 * GET /products
 */
const getProducts = async (req, res) => {
  try {
    const { category, store_id, is_veg, include_inactive } = req.query;
    const products = await productModel.getAllProducts({ category, store_id, is_veg, include_inactive });
    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
};

/**
 * Update product details
 * PATCH /products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Map camelCase to snake_case if needed
    const mappedData = {};
    if (updateData.isStockOut !== undefined) mappedData.is_stock_out = updateData.isStockOut;
    if (updateData.stockQuantity !== undefined) mappedData.stock_quantity = updateData.stockQuantity;
    if (updateData.isActive !== undefined) mappedData.is_active = updateData.isActive;
    if (updateData.price !== undefined) mappedData.price = updateData.price;
    if (updateData.discountPercent !== undefined) mappedData.discount_percent = updateData.discountPercent;

    const updatedProduct = await productModel.updateProduct(id, mappedData);
    
    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
};

/**
 * Get product by ID
 * GET /products/:id
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productModel.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
};


