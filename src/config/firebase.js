const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. Check environment variable first (absolute or relative)
// 2. Check root of the project (common for Render)
// 3. Check local config folder (common for local dev)
const getServiceAccountPath = () => {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  const rootPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const localConfigPath = path.join(__dirname, 'serviceAccountKey.json');

  if (envPath && fs.existsSync(envPath)) return envPath;
  if (fs.existsSync(rootPath)) return rootPath;
  if (fs.existsSync(localConfigPath)) return localConfigPath;
  
  return localConfigPath; // Fallback
};

const serviceAccountPath = getServiceAccountPath();
console.log('Debug: Using Firebase Service Account from:', serviceAccountPath);

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log('✅ Firebase Admin Initialized');
} catch (error) {
  console.error('❌ Firebase Admin Initialization Error:', error.message);
}

module.exports = admin;
