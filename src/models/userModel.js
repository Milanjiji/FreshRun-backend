const db = require('../config/db');

/**
 * Find user by their hashed ID (Primary Key)
 */
const findById = async (id) => {
  const result = await db.query(
    `SELECT u.id, u.firebase_uid, u.phone, u.role, u.full_name, u.email, u.aadhar_number, u.aadhar_image, u.approval_status, 
            u.house_number, u.address_line, u.landmark, u.pincode, u.city, u.delivery_message, u.current_address_id, u.is_profile_complete, u.is_active, u.created_at,
            a.latitude as current_address_latitude, a.longitude as current_address_longitude,
            u.total_earnings, u.withdrawable_earnings,
            u.razorpay_account_id, u.razorpay_kyc_status, u.delivery_preference, u.rejection_reason,
            u.bank_account_number, u.bank_ifsc, u.pan_number, u.razorpay_rejection_reason,
            u.upi_id, u.upi_qr_image
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
            u.total_earnings, u.withdrawable_earnings,
            u.razorpay_account_id, u.razorpay_kyc_status, u.delivery_preference, u.rejection_reason,
            u.bank_account_number, u.bank_ifsc, u.pan_number, u.razorpay_rejection_reason,
            u.upi_id, u.upi_qr_image
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
  let query = 'SELECT id, firebase_uid, phone, role, full_name, email, aadhar_number, aadhar_image, approval_status, house_number, address_line, landmark, pincode, city, delivery_message, is_profile_complete, is_active, created_at, razorpay_account_id, razorpay_kyc_status, bank_account_number, bank_ifsc, pan_number, razorpay_rejection_reason, upi_id, upi_qr_image, total_earnings, withdrawable_earnings FROM users';
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
const updateApprovalStatus = async (id, status, rejectionReason = null) => {
  const result = await db.query(
    'UPDATE users SET approval_status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *',
    [status, rejectionReason, id]
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
    "SELECT id, phone, full_name, email, aadhar_number, aadhar_image, approval_status, created_at, razorpay_account_id, razorpay_kyc_status, bank_account_number, bank_ifsc, pan_number, razorpay_rejection_reason, upi_id, upi_qr_image, total_earnings, withdrawable_earnings FROM users WHERE role = 'delivery' ORDER BY created_at DESC"
  );
  return result.rows;
};

/**
 * Update Razorpay details for a user
 */
const updateRazorpayDetails = async (id, { razorpay_account_id, razorpay_kyc_status, delivery_preference, bank_account_number, bank_ifsc, pan_number, razorpay_rejection_reason, upi_id, upi_qr_image }) => {
  const fields = [];
  const values = [];
  let index = 1;

  if (razorpay_account_id !== undefined) {
    fields.push(`razorpay_account_id = $${index++}`);
    values.push(razorpay_account_id);
  }
  if (razorpay_kyc_status !== undefined) {
    fields.push(`razorpay_kyc_status = $${index++}`);
    values.push(razorpay_kyc_status);
  }
  if (delivery_preference !== undefined) {
    fields.push(`delivery_preference = $${index++}`);
    values.push(delivery_preference);
  }
  if (bank_account_number !== undefined) {
    fields.push(`bank_account_number = $${index++}`);
    values.push(bank_account_number);
  }
  if (bank_ifsc !== undefined) {
    fields.push(`bank_ifsc = $${index++}`);
    values.push(bank_ifsc);
  }
  if (pan_number !== undefined) {
    fields.push(`pan_number = $${index++}`);
    values.push(pan_number);
  }
  if (razorpay_rejection_reason !== undefined) {
    fields.push(`razorpay_rejection_reason = $${index++}`);
    values.push(razorpay_rejection_reason);
  }
  if (upi_id !== undefined) {
    fields.push(`upi_id = $${index++}`);
    values.push(upi_id);
  }
  if (upi_qr_image !== undefined) {
    fields.push(`upi_qr_image = $${index++}`);
    values.push(upi_qr_image);
  }

  if (fields.length === 0) return null;

  values.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
};

/**
 * Soft delete a user by anonymizing their personal data
 */
const anonymizeUser = async (id) => {
  const result = await db.query(
    `UPDATE users 
     SET full_name = 'Deleted User', 
         email = NULL, 
         phone = LEFT('DEL_' || id::text, 15), 
         firebase_uid = 'DELETED_' || id::text,
         aadhar_number = NULL, 
         aadhar_image = NULL, 
         fcm_token = NULL,
         house_number = NULL,
         address_line = NULL,
         landmark = NULL,
         delivery_message = NULL,
         current_address_id = NULL,
         is_active = false 
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
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
  anonymizeUser,
  updateRazorpayDetails,
};
