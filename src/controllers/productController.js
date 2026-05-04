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
    const { category, store_id, is_veg } = req.query;
    const products = await productModel.getAllProducts({ category, store_id, is_veg });
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

module.exports = {
  createProduct,
  getProducts,
};
