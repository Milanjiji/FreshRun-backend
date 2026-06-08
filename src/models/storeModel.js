const db = require('../config/db');

/**
 * Create a new store
 */
const createStore = async (storeData) => {
  const result = await db.query(
    `INSERT INTO stores (
      id, owner_id, name, description, category, image_url, 
      phone_1, phone_2, house_number, address_line, landmark, pincode, city,
      latitude, longitude, maps_link, veg_type, handling_fee, max_delivery_distance,
      approval_status, is_active, gst_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
    RETURNING *`,
    [
      storeData.id, 
      storeData.owner_id, 
      storeData.name, 
      storeData.description, 
      storeData.category, 
      storeData.image_url, 
      storeData.phone_1, 
      storeData.phone_2, 
      storeData.house_number, 
      storeData.address_line, 
      storeData.landmark, 
      storeData.pincode, 
      storeData.city, 
      storeData.latitude, 
      storeData.longitude, 
      storeData.maps_link, 
      storeData.veg_type, 
      storeData.handling_fee, 
      storeData.max_delivery_distance,
      storeData.approval_status || 'pending',
      true,
      storeData.gst_number || null
    ]
  );
  return result.rows[0];
};

/**
 * Get all stores, optionally filtered by category
 */
const getAllStores = async (filters = {}) => {
  const { category, is_veg, include_inactive, include_pending } = filters;

  let query = `
    SELECT s.*, 
           u.approval_status as owner_approval_status
    FROM stores s 
    LEFT JOIN users u ON s.owner_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (include_inactive !== 'true' && include_inactive !== true) {
    query += ` AND s.is_active = true`;
  }

  // Filter by approval status: Both store and owner must be approved for customers
  if (include_pending !== 'true' && include_pending !== true) {
    query += ` AND s.approval_status = 'approved' AND u.approval_status = 'approved'`;
    if (process.env.ENABLE_RAZORPAY === 'true') {
      query += ` AND s.razorpay_kyc_status = 'activated'`;
    }
    
    // Only show stores with at least one product for customers
    query += ` AND EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id AND p.is_active = true)`;
  } else {
    // For Admin: allow showing stores even if they don't have products yet
    // No extra product check here
  }

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

/**
 * Update store details
 */
const updateStore = async (id, updateData) => {
  const fields = Object.keys(updateData);
  if (fields.length === 0) return null;

  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
  const values = Object.values(updateData);

  const result = await db.query(
    `UPDATE stores SET ${setClause} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
};

/**
 * Delete a store
 */
const deleteStore = async (id) => {
  // We should probably delete products associated with the store first
  // if the DB doesn't have CASCADE. For simplicity and safety,
  // we'll try to delete the store and let the DB throw if there are constraints.
  const result = await db.query(
    'DELETE FROM stores WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

/**
 * Deactivate all stores owned by a specific user
 */
const deactivateStoresByOwner = async (ownerId) => {
  const result = await db.query(
    'UPDATE stores SET is_active = false WHERE owner_id = $1 RETURNING *',
    [ownerId]
  );
  return result.rows;
};

module.exports = {
  createStore,
  getAllStores,
  getStoreById,
  updateStore,
  deleteStore,
  deactivateStoresByOwner,
};

