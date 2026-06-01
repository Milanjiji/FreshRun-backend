const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log('✅ Firebase Admin Initialized');
} catch (error) {
  console.error('❌ Firebase Admin Initialization Error:', error.message);
}

module.exports = admin;
