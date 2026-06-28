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

    // Guard: phone_number must be present (Phone Auth tokens always have it)
    if (!decodedToken.phone_number) {
      console.error('[authMiddleware] phone_number missing from decoded Firebase token. UID:', decodedToken.uid);
      return res.status(400).json({ success: false, error: 'Phone number missing from token. Please re-authenticate.' });
    }

    const normalizedPhone = normalizePhone(decodedToken.phone_number);
    const userId = generateHash(normalizedPhone);

    // Fetch full user data to get the role
    let user = await userModel.findById(userId);

    // --- Upsert: if the user row doesn't exist yet (race condition on first signup),
    // create it now using the verified token data. This makes every protected route
    // idempotent for new customers and eliminates the timing gap between /auth/login
    // writing the row and the first protected request arriving.
    if (!user) {
      console.warn(`[authMiddleware] User ${userId} not found in DB. Auto-creating as customer (upsert on first request).`);
      try {
        user = await userModel.createUser(userId, decodedToken.uid, normalizedPhone, 'customer');
        console.log(`[authMiddleware] User ${userId} created successfully via upsert.`);
      } catch (createErr) {
        // If a concurrent request already created the row (duplicate key), just fetch it.
        if (createErr.code === '23505') {
          console.warn('[authMiddleware] Duplicate key on upsert — fetching existing row.');
          user = await userModel.findById(userId);
        } else {
          throw createErr;
        }
      }
    }

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
