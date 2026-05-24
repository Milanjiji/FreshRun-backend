const admin = require('../config/firebase');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { generateHash } = require('../utils/hash');

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

    // 2. Generate Deterministic ID from Phone
    const userId = generateHash(phone);
    console.log('Debug: Generated User ID from phone:', userId);

    // 3. Check if user exists in DB or create one
    let user;
    try {
      user = await userModel.findById(userId);

      if (!user) {
        console.log('Debug: User not found in DB. Creating new user...');
        user = await userModel.createUser(userId, firebase_uid, phone, role);
      } else {
        console.log('Debug: Existing user found in DB');
        // Update firebase_uid in case it changed (rare but possible if re-linked)
        if (user.firebase_uid !== firebase_uid) {
           console.log('Debug: Updating firebase_uid for existing user');
           // Optional: userModel.updateFirebaseUid(userId, firebase_uid);
        }
      }
    } catch (dbError) {
      console.error('Database Error:', dbError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Database operation failed' 
      });
    }

    // 4. Generate custom JWT (7 days expiration)
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
        fullName: user.full_name,
        email: user.email,
        houseNumber: user.house_number,
        addressLine: user.address_line,
        landmark: user.landmark,
        pincode: user.pincode,
        city: user.city,
        deliveryMessage: user.delivery_message,
        currentAddressId: user.current_address_id,
        isProfileComplete: user.is_profile_complete,
        approvalStatus: user.approval_status,
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

/**
 * Handle delivery partner registration
 * POST /auth/register
 */
const registerPartner = async (req, res) => {
  try {
    const { fullName, email, phone, role, aadharNumber, aadharImage } = req.body;
    
    console.log('--- Partner Registration Request ---');
    console.log('Phone:', phone, '| Role:', role);

    if (!fullName || !email || !phone || !aadharNumber || !aadharImage) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    if (role !== 'delivery') {
      return res.status(400).json({ success: false, error: 'Only delivery partners can register here' });
    }

    const userId = generateHash(phone);
    console.log('Generated userId:', userId);

    let user = await userModel.findById(userId);

    if (!user) {
      // New partner — create a fresh user record with approval_status = 'pending'
      // We use phone as the firebase_uid placeholder since they haven't done OTP yet.
      // When they first login via Firebase OTP, the uid will be updated.
      console.log('New partner — creating user record');
      user = await userModel.createUser(userId, `phone_${userId}`, phone, 'delivery');
      console.log('User created:', user.id);
    } else {
      console.log('Existing user found, updating registration details');
    }

    // Save their registration details (name, email, aadhar)
    const updatedUser = await userModel.updatePartnerRegistration(userId, {
      fullName,
      email,
      aadharNumber,
      aadharImage
    });

    console.log('Registration details saved. Approval status:', updatedUser.approval_status);

    // Generate JWT so the app can track their status without re-login
    const token = jwt.sign(
      { id: updatedUser.id, firebase_uid: updatedUser.firebase_uid, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Registration submitted. Waiting for admin approval.',
      token,
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        role: updatedUser.role,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        approvalStatus: updatedUser.approval_status,
      }
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    console.error(error.stack);
    res.status(500).json({ success: false, error: 'Registration failed: ' + error.message });
  }
};

module.exports = {
  login,
  registerPartner,
};
