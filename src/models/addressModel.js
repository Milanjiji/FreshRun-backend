const db = require('../config/db');

/**
 * Get all saved addresses for a user (excluding the active one in 'users' table)
 */
const findByUserId = async (userId) => {
  const result = await db.query(
    'SELECT id, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, address_type, save_as, latitude, longitude FROM addresses WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
};

/**
 * Add a new saved address
 */
const create = async (userId, addressData) => {
  const { 
    fullName, email, houseNumber, addressLine, landmark, 
    pincode, city, deliveryMessage, addressType, saveAs,
    latitude, longitude
  } = addressData;

  const result = await db.query(
    `INSERT INTO addresses 
      (user_id, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, address_type, save_as, latitude, longitude, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true) 
    RETURNING *`,
    [userId, fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, addressType, saveAs || 'Other', latitude, longitude]
  );
  return result.rows[0];
};

/**
 * Swap active address with a saved one
 * 1. Fetch current active from 'addresses'
 * 2. Update 'users' with new target
 */
const swapAddress = async (userId, targetAddressId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get target address details from 'addresses' (ensure it is active)
    const addrRes = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2 AND is_active = true',
      [targetAddressId, userId]
    );
    const targetAddress = addrRes.rows[0];

    if (!targetAddress) {
      throw new Error('Target address not found or inactive');
    }

    // 2. Update 'users' table with the new pointer and readable address details.
    await client.query(
      `UPDATE users SET 
        current_address_id = $1,
        full_name = $2, 
        email = $3, 
        house_number = $4, 
        address_line = $5, 
        landmark = $6, 
        pincode = $7, 
        city = $8, 
        delivery_message = $9
      WHERE id = $10`,
      [
        targetAddressId,
        targetAddress.full_name, 
        targetAddress.email, 
        targetAddress.house_number, 
        targetAddress.address_line, 
        targetAddress.landmark, 
        targetAddress.pincode, 
        targetAddress.city, 
        targetAddress.delivery_message,
        userId
      ]
    );

    await client.query('COMMIT');
    return targetAddress;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete a saved address (Soft Delete)
 */
const remove = async (id, userId) => {
  const result = await db.query(
    'UPDATE addresses SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  return result.rowCount > 0;
};

module.exports = {
  findByUserId,
  create,
  swapAddress,
  remove,
};
