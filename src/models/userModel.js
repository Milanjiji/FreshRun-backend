const db = require('../config/db');

/**
 * Find user by their Firebase unique ID
 */
const findByFirebaseUid = async (firebaseUid) => {
  const result = await db.query(
    'SELECT id, firebase_uid, phone, role, is_active, created_at FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows[0];
};

/**
 * Create a new user record
 */
const createUser = async (firebaseUid, phone, role) => {
  const result = await db.query(
    'INSERT INTO users (firebase_uid, phone, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id, firebase_uid, phone, role, is_active, created_at',
    [firebaseUid, phone, role, true]
  );
  return result.rows[0];
};

module.exports = {
  findByFirebaseUid,
  createUser,
};
