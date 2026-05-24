const db = require('../config/db');

/**
 * Find user by their hashed ID (Primary Key)
 */
const findById = async (id) => {
  const result = await db.query(
    'SELECT id, firebase_uid, phone, role, full_name, email, aadhar_number, aadhar_image, approval_status, house_number, address_line, landmark, pincode, city, delivery_message, current_address_id, is_profile_complete, is_active, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

/**
 * Find user by their Firebase unique ID
 */
const findByFirebaseUid = async (firebaseUid) => {
  const result = await db.query(
    'SELECT id, firebase_uid, phone, role, full_name, email, aadhar_number, aadhar_image, approval_status, house_number, address_line, landmark, pincode, city, delivery_message, current_address_id, is_profile_complete, is_active, created_at FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows[0];
};

/**
 * Create a new user record with a hashed ID
 */
const createUser = async (id, firebaseUid, phone, role) => {
  const result = await db.query(
    'INSERT INTO users (id, firebase_uid, phone, role, is_active, approval_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, firebase_uid, phone, role, full_name, email, aadhar_number, aadhar_image, approval_status, house_number, address_line, landmark, pincode, city, delivery_message, current_address_id, is_profile_complete, is_active, created_at',
    [id, firebaseUid, phone, role, true, role === 'delivery' ? 'pending' : 'approved']
  );
  return result.rows[0];
};

/**
 * Update user profile details and pointer to address entry
 */
const updateProfileWithAddress = async (id, { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, currentAddressId }) => {
  const result = await db.query(
    'UPDATE users SET full_name = $1, email = $2, house_number = $3, address_line = $4, landmark = $5, pincode = $6, city = $7, delivery_message = $8, current_address_id = $9, is_profile_complete = true WHERE id = $10 RETURNING id, firebase_uid, phone, role, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, current_address_id, is_profile_complete, is_active, created_at',
    [fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, currentAddressId, id]
  );
  return result.rows[0];
};

/**
 * Update user profile details
 */
const updateProfile = async (id, { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage }) => {
  const result = await db.query(
    'UPDATE users SET full_name = $1, email = $2, house_number = $3, address_line = $4, landmark = $5, pincode = $6, city = $7, delivery_message = $8, is_profile_complete = true WHERE id = $9 RETURNING id, firebase_uid, phone, role, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, current_address_id, is_profile_complete, is_active, created_at',
    [fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, id]
  );
  return result.rows[0];
};

/**
 * Get all users
 */
const findAll = async () => {
  const result = await db.query(
    'SELECT id, firebase_uid, phone, role, full_name, email, house_number, address_line, landmark, pincode, city, delivery_message, is_profile_complete, is_active, created_at FROM users ORDER BY created_at DESC'
  );
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
