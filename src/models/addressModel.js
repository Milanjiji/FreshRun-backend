const db = require('../config/db');

/**
 * Get all saved addresses for a user (excluding the active one in 'users' table)
 */
const findByUserId = async (userId) => {
  const result = await db.query(
    'SELECT id, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, address_type, save_as FROM addresses WHERE user_id = $1 ORDER BY created_at DESC',
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
    pincode, city, deliveryMessage, addressType, saveAs 
  } = addressData;

  const result = await db.query(
    `INSERT INTO addresses 
      (user_id, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, address_type, save_as) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
    RETURNING *`,
    [userId, fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, addressType, saveAs]
  );
  return result.rows[0];
};

/**
 * Swap active address with a saved one
 * 1. Fetch current active from 'users'
 * 2. Fetch target from 'addresses'
 * 3. Update 'users' with target
 * 4. Update 'addresses' (replace target with previous active)
 */
const swapAddress = async (userId, targetAddressId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get current active address from 'users'
    const userRes = await client.query(
      'SELECT full_name, email, house_number, address_line, landmark, pincode, city, delivery_message FROM users WHERE id = $1',
      [userId]
    );
    const currentActive = userRes.rows[0];

    // 2. Get target address from 'addresses'
    const addrRes = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [targetAddressId, userId]
    );
    const targetAddress = addrRes.rows[0];

    if (!targetAddress) {
      throw new Error('Target address not found');
    }

    // 3. Update 'users' with target details
    await client.query(
      `UPDATE users SET 
        full_name = $1, email = $2, house_number = $3, address_line = $4, 
        landmark = $5, pincode = $6, city = $7, delivery_message = $8 
      WHERE id = $9`,
      [
        targetAddress.full_name, targetAddress.email, targetAddress.house_number, 
        targetAddress.address_line, targetAddress.landmark, targetAddress.pincode, 
        targetAddress.city, targetAddress.delivery_message, userId
      ]
    );

    // 4. Update 'addresses' entry with the old active address
    // We'll also update the 'save_as' and 'address_type' if needed, or just keep them?
    // Let's assume we keep the 'save_as' and 'address_type' of the slot, but update the content.
    await client.query(
      `UPDATE addresses SET 
        full_name = $1, email = $2, house_number = $3, address_line = $4, 
        landmark = $5, pincode = $6, city = $7, delivery_message = $8 
      WHERE id = $9`,
      [
        currentActive.full_name, currentActive.email, currentActive.house_number, 
        currentActive.address_line, currentActive.landmark, currentActive.pincode, 
        currentActive.city, currentActive.delivery_message, targetAddressId
      ]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findByUserId,
  create,
  swapAddress,
};
