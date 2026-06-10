const productModel = require('../models/productModel');
const { generateHash } = require('../utils/hash');
const socketUtils = require('../utils/socket');

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
      isVeg,
      unit,
      variants
    } = req.body;

    // Basic validation
    if (!name || !category || !storeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Generate unique ID for product (hash of name and store_id)
    const productId = generateHash(`${name}_${storeId}`);

    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const firstVariant = hasVariants ? variants[0] : null;

    const productData = {
      id: productId,
      store_id: storeId,
      name,
      description,
      image_url: imageUrl,
      price: firstVariant ? firstVariant.price : (price || 0),
      discount_percent: firstVariant ? (firstVariant.discount_percent || 0) : (discountPercent || 0),
      stock_quantity: firstVariant ? (firstVariant.stock_quantity || 0) : (stockQuantity || 0),
      is_stock_out: firstVariant ? (firstVariant.is_stock_out || false) : (isStockOut || false),
      category,
      is_veg: isVeg !== undefined ? isVeg : true,
      unit: firstVariant ? firstVariant.unit : (unit || null),
      variants: variants || []
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
    
    // Support complete product edits
    if (updateData.name !== undefined) mappedData.name = updateData.name;
    if (updateData.description !== undefined) mappedData.description = updateData.description;
    if (updateData.imageUrl !== undefined) mappedData.image_url = updateData.imageUrl;
    if (updateData.category !== undefined) mappedData.category = updateData.category;
    if (updateData.isVeg !== undefined) mappedData.is_veg = updateData.isVeg;
    if (updateData.unit !== undefined) mappedData.unit = updateData.unit;
    
    if (updateData.variants !== undefined) {
      const hasVariants = Array.isArray(updateData.variants) && updateData.variants.length > 0;
      mappedData.variants = hasVariants ? JSON.stringify(updateData.variants) : JSON.stringify([]);
      
      // If variants are enabled, sync the main fields to the first variant
      if (hasVariants) {
        const firstVar = updateData.variants[0];
        mappedData.price = firstVar.price;
        mappedData.discount_percent = firstVar.discount_percent || 0;
        mappedData.stock_quantity = firstVar.stock_quantity || 0;
        mappedData.is_stock_out = firstVar.is_stock_out || false;
        mappedData.unit = firstVar.unit;
      }
    }

    const updatedProduct = await productModel.updateProduct(id, mappedData);
    
    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.to(`store_${updatedProduct.store_id}`).emit('product_updated', updatedProduct);
    } catch (socketErr) {
      console.warn('Socket update failed:', socketErr.message);
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

/**
 * Delete a product
 * DELETE /products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await productModel.deleteProduct(id);
    
    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};


