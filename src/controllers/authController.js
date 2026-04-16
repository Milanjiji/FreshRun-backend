const admin = require('../config/firebase');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || !role) {
      return res.status(400).json({ error: 'idToken and role are required' });
    }

    if (!['customer', 'delivery'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // 1. Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebase_uid, phone_number: phone } = decodedToken;

    // 2. Check if user exists in DB
    let user = await userModel.findByFirebaseUid(firebase_uid);

    if (!user) {
      // 3. Create new user if not exists
      user = await userModel.createUser(firebase_uid, phone, role);
    }

    // 4. Generate custom JWT (7 days expiration)
    const token = jwt.sign(
      { id: user.id, firebase_uid: user.firebase_uid, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = {
  login,
};
