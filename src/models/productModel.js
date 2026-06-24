const db = require('../config/db');

/**
 * Internal helper to update the store's max_discount cache column
 */
const updateStoreMaxDiscount = async (storeId) => {
  if (!storeId) return;
  try {
    await db.query(`
      UPDATE stores 
      SET max_discount = COALESCE((
        SELECT MAX(discount_percent) 
        FROM products 
        WHERE store_id = $1 AND is_active = true
      ), 0)
      WHERE id = $1
    `, [storeId]);
  } catch (err) {
    console.error('Failed to update store max_discount:', err.message);
  }
};

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
    subcategory,
    is_veg,
    unit,
    variants
  } = productData;

  const result = await db.query(
    `INSERT INTO products (
      id, store_id, name, description, image_url, price, 
      discount_percent, stock_quantity, is_stock_out, category, subcategory, is_veg, unit, variants
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
    RETURNING *`,
    [
      id, 
      store_id, 
      name, 
      description, 
      image_url, 
      price, 
      discount_percent, 
      stock_quantity, 
      is_stock_out, 
      category || null, 
      subcategory || null,
      is_veg, 
      unit || null, 
      variants ? JSON.stringify(variants) : JSON.stringify([])
    ]
  );

  // Update store cache
  await updateStoreMaxDiscount(store_id);

  return result.rows[0];
};

/**
 * Get all products
 */
const getAllProducts = async (filters = {}) => {
  let query = `
    SELECT p.*, s.name as store_name, s.handling_fee as store_handling_fee
    FROM products p 
    JOIN stores s ON p.store_id = s.id 
    WHERE 1=1
  `;
  const params = [];

  if (filters.include_inactive !== 'true' && filters.include_inactive !== true) {
    query += ` AND p.is_active = true`;
  }

  if (filters.category) {
    params.push(filters.category);
    query += ` AND p.category = $${params.length}`;
  }

  if (filters.subcategory) {
    params.push(filters.subcategory);
    query += ` AND p.subcategory = $${params.length}`;
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

/**
 * Update product details
 */
const updateProduct = async (id, updateData) => {
  const fields = Object.keys(updateData);
  if (fields.length === 0) return null;

  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
  const values = Object.values(updateData);

  const result = await db.query(
    `UPDATE products SET ${setClause} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  if (result.rows[0]) {
    await updateStoreMaxDiscount(result.rows[0].store_id);
  }

  return result.rows[0];
};

/**
 * Get product by ID
 */
const getProductById = async (id) => {
  const result = await db.query(
    'SELECT * FROM products WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

/**
 * Delete a product
 */
const deleteProduct = async (id) => {
  const result = await db.query(
    'DELETE FROM products WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows[0]) {
    await updateStoreMaxDiscount(result.rows[0].store_id);
  }

  return result.rows[0];
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductsByStore,
  getProductById,
  updateProduct,
  deleteProduct,
};


