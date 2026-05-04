const db = require('../config/db');

/**
 * Create a new product
 */
const createProduct = async (productData) => {
  const {
    id,
    store_id,
    name,
    description,
    image_url,
    price,
    discount_percent,
    stock_quantity,
    is_stock_out,
    category,
    is_veg
  } = productData;

  const result = await db.query(
    `INSERT INTO products (
      id, store_id, name, description, image_url, price, 
      discount_percent, stock_quantity, is_stock_out, category, is_veg
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
    RETURNING *`,
    [id, store_id, name, description, image_url, price, discount_percent, stock_quantity, is_stock_out, category, is_veg]
  );
  return result.rows[0];
};

/**
 * Get all products
 */
const getAllProducts = async (filters = {}) => {
  let query = `
    SELECT p.*, s.name as store_name 
    FROM products p 
    JOIN stores s ON p.store_id = s.id 
    WHERE p.is_active = true
  `;
  const params = [];

  if (filters.category) {
    params.push(filters.category);
    query += ` AND p.category = $${params.length}`;
  }

  if (filters.store_id) {
    params.push(filters.store_id);
    query += ` AND p.store_id = $${params.length}`;
  }

  if (filters.is_veg === 'true' || filters.is_veg === true) {
    query += ` AND p.is_veg = true`;
  }

  query += ' ORDER BY p.created_at DESC';
  
  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Get products by store ID
 */
const getProductsByStore = async (storeId) => {
  const result = await db.query(
    'SELECT * FROM products WHERE store_id = $1 AND is_active = true ORDER BY name ASC',
    [storeId]
  );
  return result.rows;
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductsByStore,
};
