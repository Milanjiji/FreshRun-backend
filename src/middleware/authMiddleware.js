const admin = require('../config/firebase');
const { generateHash, normalizePhone } = require('../utils/hash');
const userModel = require('../models/userModel');

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://fresh-run-admin.vercel.app',
  'http://fresh-run-admin.vercel.app',
  'https://freshrun.in',
  'http://freshrun.in'
];

const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const origin = req.headers['origin'];
    if (origin && allowedOrigins.includes(origin)) {
      // Auto-assign mock admin details for requests from verified admin origins
      req.user = { 
        id: 'admin_bypass', 
        firebase_uid: 'admin_bypass_uid', 
        phone: '+919999999999',
        role: 'admin'
      };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Authorization token missing' });
  }

  try {
    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Generate deterministic userId from verified phone number
    const userId = generateHash(normalizePhone(decodedToken.phone_number));
    
    // Fetch full user data to get the role
    const user = await userModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User record not found' });
    }
    
    req.user = { 
      id: user.id, 
      firebase_uid: decodedToken.uid, 
      phone: decodedToken.phone_number,
      role: user.role
    };
    
    next();
  } catch (err) {
    console.error('Firebase Token Verification Error:', err.message);
    return res.status(403).json({ success: false, error: 'Invalid or expired session' });
  }
};

module.exports = authenticateToken;
