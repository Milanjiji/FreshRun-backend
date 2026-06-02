const admin = require('../config/firebase');
const { generateHash } = require('../utils/hash');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token missing' });
  }

  try {
    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Generate deterministic userId from verified phone number
    const userId = generateHash(decodedToken.phone_number);
    
    req.user = { 
      id: userId, 
      firebase_uid: decodedToken.uid, 
      phone: decodedToken.phone_number 
    };
    
    next();
  } catch (err) {
    console.error('Firebase Token Verification Error:', err.message);
    return res.status(403).json({ success: false, error: 'Invalid or expired session' });
  }
};

module.exports = authenticateToken;
