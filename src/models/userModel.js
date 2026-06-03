const db = require('../config/db');

/**
 * Find user by their hashed ID (Primary Key)
 */
const findById = async (id) => {
  const result = await db.query(
    `SELECT u.id, u.firebase_uid, u.phone, u.role, u.full_name, u.email, u.aadhar_number, u.aadhar_image, u.approval_status, 
            u.house_number, u.address_line, u.landmark, u.pincode, u.city, u.delivery_message, u.current_address_id, u.is_profile_complete, u.is_active, u.created_at,
            a.latitude as current_address_latitude, a.longitude as current_address_longitude,
            u.total_earnings, u.withdrawable_earnings
     FROM users u
     LEFT JOIN addresses a ON u.current_address_id = a.id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * Find user by their Firebase unique ID
 */
const findByFirebaseUid = async (firebaseUid) => {
  const result = await db.query(
    `SELECT u.id, u.firebase_uid, u.phone, u.role, u.full_name, u.email, u.aadhar_number, u.aadhar_image, u.approval_status, 
            u.house_number, u.address_line, u.landmark, u.pincode, u.city, u.delivery_message, u.current_address_id, u.is_profile_complete, u.is_active, u.created_at,
            a.latitude as current_address_latitude, a.longitude as current_address_longitude,
            u.total_earnings, u.withdrawable_earnings
     FROM users u
     LEFT JOIN addresses a ON u.current_address_id = a.id
     WHERE u.firebase_uid = $1`,
    [firebaseUid]
  );
  return result.rows[0];
};

/**
 * Create a new user record with a hashed ID
 */
const createUser = async (id, firebaseUid, phone, role) => {
  const isPendingRole = ['delivery', 'owner'].includes(role);
  await db.query(
    'INSERT INTO users (id, firebase_uid, phone, role, is_active, approval_status) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, firebaseUid, phone, role, true, isPendingRole ? 'pending' : 'approved']
  );
  return findById(id);
};

/**
 * Update user profile details and pointer to address entry
 */
const updateProfileWithAddress = async (id, { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, currentAddressId }) => {
  await db.query(
    'UPDATE users SET full_name = $1, email = $2, house_number = $3, address_line = $4, landmark = $5, pincode = $6, city = $7, delivery_message = $8, current_address_id = $9, is_profile_complete = true WHERE id = $10',
    [fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, currentAddressId, id]
  );
  return findById(id);
};

/**
 * Update user profile details
 */
const updateProfile = async (id, { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage }) => {
  await db.query(
    'UPDATE users SET full_name = $1, email = $2, house_number = $3, address_line = $4, landmark = $5, pincode = $6, city = $7, delivery_message = $8, is_profile_complete = true WHERE id = $9',
    [fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, id]
  );
  return findById(id);
};

/**
 * Get all users, optionally filtered by role
 */
const findAll = async (role) => {
  let query = 'SELECT id, firebase_uid, phone, role, full_name, email, aadhar_number, aadhar_image, approval_status, house_number, address_line, landmark, pincode, city, delivery_message, is_profile_complete, is_active, created_at FROM users';
  const params = [];

  if (role) {
    query += ' WHERE role = $1';
    params.push(role);
  }

  query += ' ORDER BY created_at DESC';
  
  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Update user approval status (Admin Only)
 */
const updateApprovalStatus = async (id, status) => {
  const result = await db.query(
    'UPDATE users SET approval_status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
};

/**
 * Update delivery partner registration details
 */
const updatePartnerRegistration = async (id, { fullName, email, aadharNumber, aadharImage }) => {
  const result = await db.query(
    'UPDATE users SET full_name = $1, email = $2, aadhar_number = $3, aadhar_image = $4, is_profile_complete = true WHERE id = $5 RETURNING *',
    [fullName, email, aadharNumber, aadharImage, id]
  );
  return result.rows[0];
};

/**
 * Get all delivery partners
 */
const findAllDeliveryPartners = async () => {
  const result = await db.query(
    "SELECT id, phone, full_name, email, aadhar_number, aadhar_image, approval_status, created_at FROM users WHERE role = 'delivery' ORDER BY created_at DESC"
  );
  return result.rows;
};

module.exports = {
  findById,
  findByFirebaseUid,
  createUser,
  updateProfile,
  updateProfileWithAddress,
  updateApprovalStatus,
  updatePartnerRegistration,
  findAll,
  findAllDeliveryPartners,
};
