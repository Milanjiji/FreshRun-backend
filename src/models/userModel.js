const db = require('../config/db');

const findByFirebaseUid = async (firebaseUid) => {
  const result = await db.query(
    'SELECT * FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows[0];
};

const createUser = async (firebaseUid, phone, role) => {
  const result = await db.query(
    'INSERT INTO users (firebase_uid, phone, role) VALUES ($1, $2, $3) RETURNING *',
    [firebaseUid, phone, role]
  );
  return result.rows[0];
};

module.exports = {
  findByFirebaseUid,
  createUser,
};
