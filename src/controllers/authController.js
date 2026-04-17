const admin = require('../config/firebase');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');

/**
 * Handle user login via Firebase ID Token
 * POST /auth/login
 * Body: { idToken, role }
 */
const login = async (req, res) => {
  console.log('--- Login Request Received ---');
  try {
    const { idToken, role } = req.body;

    if (!idToken || !role) {
      console.log('Error: Missing idToken or role');
      return res.status(400).json({ 
        success: false, 
        error: 'idToken and role are required' 
      });
    }

    if (!['customer', 'delivery'].includes(role)) {
      console.log('Error: Invalid role provided:', role);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid role' 
      });
    }

    // 1. Verify Firebase ID Token
    console.log('Debug: Verifying Firebase ID Token...');
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseError) {
      console.error('Firebase Verification Error:', firebaseError.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired Firebase token' 
      });
    }

    const { uid: firebase_uid, phone_number: phone } = decodedToken;
    console.log('Debug: Token verified successfully. UID:', firebase_uid);

    if (!phone) {
       console.log('Error: Phone number not found in token');
       return res.status(400).json({
         success: false,
         error: 'Phone number missing in token. Ensure you use Phone Auth.'
       });
    }

    // 2. Check if user exists in DB or create one
    let user;
    try {
      user = await userModel.findByFirebaseUid(firebase_uid);

      if (!user) {
        console.log('Debug: User not found in DB. Creating new user...');
        user = await userModel.createUser(firebase_uid, phone, role);
      } else {
        console.log('Debug: Existing user found in DB');
      }
    } catch (dbError) {
      console.error('Database Error:', dbError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Database operation failed' 
      });
    }

    // 3. Generate custom JWT (7 days expiration)
    const token = jwt.sign(
      { id: user.id, firebase_uid: user.firebase_uid, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Debug: Sending successful response');
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Unexpected Auth Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred' 
    });
  }
};

module.exports = {
  login,
};
