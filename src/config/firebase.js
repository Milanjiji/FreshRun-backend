const admin = require('firebase-admin');

// Destructure environment variables
const {
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_CLIENT_EMAIL: clientEmail,
  FIREBASE_PRIVATE_KEY: privateKeyRaw
} = process.env;

// Validate that all required environment variables are present
if (!projectId || !clientEmail || !privateKeyRaw) {
  console.error('❌ Firebase Admin initialization failed: Missing environment variables.');
  if (!projectId) console.error('   - Missing FIREBASE_PROJECT_ID');
  if (!clientEmail) console.error('   - Missing FIREBASE_CLIENT_EMAIL');
  if (!privateKeyRaw) console.error('   - Missing FIREBASE_PRIVATE_KEY');
} else {
  try {
    // Replace literal \n with actual newlines in the private key
    // Note: Using /\\n/g to catch the literal string sequence
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      console.log('Firebase Admin initialized (ENV)');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
  }
}

module.exports = admin;

