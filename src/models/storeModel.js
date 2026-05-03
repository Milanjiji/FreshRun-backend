const db = require('../config/db');

/**
 * Create a new store
 */
const createStore = async (storeData) => {
  const {
    id,
    owner_id,
    name,
    description,
    category,
    image_url,
    phone_1,
    phone_2,
    house_number,
    address_line,
    landmark,
    pincode,
    city
  } = storeData;

  const result = await db.query(
    `INSERT INTO stores (
      id, owner_id, name, description, category, image_url, 
      phone_1, phone_2, house_number, address_line, landmark, pincode, city
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
    RETURNING *`,
    [id, owner_id, name, description, category, image_url, phone_1, phone_2, house_number, address_line, landmark, pincode, city]
  );
  return result.rows[0];
};

/**
 * Get all stores, optionally filtered by category
 */
const getAllStores = async (category = null) => {
  let query = 'SELECT * FROM stores WHERE is_active = true';
  const params = [];

  if (category) {
    query += ' AND category = $1';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';
  
  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Get store by ID
 */
const getStoreById = async (id) => {
  const result = await db.query('SELECT * FROM stores WHERE id = $1', [id]);
  return result.rows[0];
};

module.exports = {
  createStore,
  getAllStores,
  getStoreById,
};
