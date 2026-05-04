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
    city,
    latitude,
    longitude,
    maps_link,
    veg_type
  } = storeData;

  const result = await db.query(
    `INSERT INTO stores (
      id, owner_id, name, description, category, image_url, 
      phone_1, phone_2, house_number, address_line, landmark, pincode, city,
      latitude, longitude, maps_link, veg_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
    RETURNING *`,
    [id, owner_id, name, description, category, image_url, phone_1, phone_2, house_number, address_line, landmark, pincode, city, latitude, longitude, maps_link, veg_type]
  );
  return result.rows[0];
};

/**
 * Get all stores, optionally filtered by category
 */
const getAllStores = async (filters = {}) => {
  const { category, is_veg } = filters;
  
  let query = `
    SELECT s.*, 
           (SELECT COALESCE(MAX(discount_percent), 0) FROM products p WHERE p.store_id = s.id) as max_discount
    FROM stores s 
    WHERE s.is_active = true
  `;
  const params = [];

  if (category) {
    params.push(category);
    query += ` AND s.category = $${params.length}`;
  }

  if (is_veg === 'true' || is_veg === true) {
    // Show only 'veg' or 'both' stores
    query += ` AND (s.veg_type = 'veg' OR s.veg_type = 'both')`;
  }

  query += ' ORDER BY s.created_at DESC';
  
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
