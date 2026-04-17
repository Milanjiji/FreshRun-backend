const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to serviceAccountKey.json in the project root
// Path from src/config/firebase.js to root is ../../serviceAccountKey.json
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  // Read the file using fs (Node.js file system)
  const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
  
  // Parse the JSON content
  const serviceAccount = JSON.parse(fileContent);

  // Initialize Firebase Admin SDK using the certificate
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  console.log('Firebase Admin initialized successfully (CommonJS)');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
}

// Export the initialized admin instance using module.exports
module.exports = admin;
