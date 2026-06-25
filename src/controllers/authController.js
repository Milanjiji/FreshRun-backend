const admin = require('../config/firebase');
const userModel = require('../models/userModel');
const { generateHash, normalizePhone } = require('../utils/hash');
const db = require('../config/db');

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
      return res.status(400).json({ 
        success: false, 
        error: 'idToken and role are required' 
      });
    }

    if (!['customer', 'delivery', 'store'].includes(role)) {
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
        error: 'Invalid or expired session' 
      });
    }

    const { uid: firebase_uid, phone_number: phone } = decodedToken;

    if (!phone) {
       return res.status(400).json({
         success: false,
         error: 'Phone number missing in token. Ensure you use Phone Auth.'
       });
    }

    // 2. Generate Deterministic ID from Phone
    const normalizedPhone = normalizePhone(phone);
    const userId = generateHash(normalizedPhone);

    // 3. Check if user exists in DB or create one
    let user = await userModel.findById(userId);

    if (!user) {
      console.log('Debug: User not found in DB. Creating new user...');
      user = await userModel.createUser(userId, firebase_uid, normalizedPhone, role);
    } else if (!user.is_active) {
      // User row exists but was previously deleted/anonymized.
      // Re-activate it as a fresh account — same phone re-registered.
      console.log('Debug: Found deleted user row. Re-activating as fresh account...');
      const isPendingRole = ['delivery', 'owner'].includes(role);
      await db.query(
        `UPDATE users SET 
          phone = $1, firebase_uid = $2, role = $3,
          is_active = true, approval_status = $4,
          is_profile_complete = false,
          full_name = NULL, email = NULL,
          house_number = NULL, address_line = NULL,
          landmark = NULL, pincode = NULL, city = NULL,
          delivery_message = NULL, current_address_id = NULL,
          fcm_token = NULL, aadhar_number = NULL, aadhar_image = NULL
        WHERE id = $5`,
        [normalizedPhone, firebase_uid, role, isPendingRole ? 'pending' : 'approved', userId]
      );
      user = await userModel.findById(userId);
    }

    // 4. Calculate today's earnings if delivery partner
    let todayEarnings = 0;
    if (user.role === 'delivery') {
      try {
        const todayResult = await db.query(
          `SELECT COALESCE(SUM(delivery_fee + delivery_tip), 0) as today_earnings 
           FROM orders 
           WHERE delivery_partner_id = $1 
             AND is_completed = true 
             AND updated_at >= CURRENT_DATE`,
          [user.id]
        );
        todayEarnings = parseFloat(todayResult.rows[0]?.today_earnings) || 0;
      } catch (err) {
        console.error('Failed to compute today earnings on login:', err.message);
      }
    }

    console.log('Debug: Login successful for user:', user.id);
    
    // NOTE: We no longer issue a custom JWT. The mobile app uses the Firebase idToken.
    res.status(200).json({
      success: true,
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
        currentAddressLatitude: user.current_address_latitude ? parseFloat(user.current_address_latitude) : null,
        currentAddressLongitude: user.current_address_longitude ? parseFloat(user.current_address_longitude) : null,
        isProfileComplete: user.is_profile_complete,
        approvalStatus: user.approval_status,
        totalEarnings: user.total_earnings ? parseFloat(user.total_earnings) : 0,
        withdrawableEarnings: user.withdrawable_earnings ? parseFloat(user.withdrawable_earnings) : 0,
        todayEarnings: todayEarnings,
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
 * Requires a verified Firebase ID Token
 * POST /auth/register
 */
const registerPartner = async (req, res) => {
  try {
    const { idToken, fullName, email, aadharNumber, aadharImage } = req.body;
    
    console.log('--- Partner Registration Request ---');

    if (!idToken || !fullName || !email || !aadharNumber || !aadharImage) {
      return res.status(400).json({ success: false, error: 'All fields including idToken are required' });
    }

    // 1. Verify Firebase Token first
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseError) {
      console.error('Registration Firebase Error:', firebaseError.message);
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    const { uid: firebase_uid, phone_number: phone } = decodedToken;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number missing in token' });
    }

    const normalizedPhone = normalizePhone(phone);
    const userId = generateHash(normalizedPhone);
    console.log('Registering userId:', userId);

    let user = await userModel.findById(userId);

    if (!user) {
      console.log('New partner — creating user record');
      user = await userModel.createUser(userId, firebase_uid, normalizedPhone, 'delivery');

      // --- Notification for Admin ---
      try {
        const socketUtils = require('../utils/socket');
        const io = socketUtils.getIO();
        io.to('admin').emit('new_registration', {
          type: 'registration',
          role: 'delivery',
          fullName,
          phone,
          timestamp: new Date().toISOString()
        });
      } catch (socketErr) {
        console.warn('[Auth] Socket notification failed:', socketErr.message);
      }
    }

    // Save their registration details (name, email, aadhar)
    const updatedUser = await userModel.updatePartnerRegistration(userId, {
      fullName,
      email,
      aadharNumber,
      aadharImage
    });

    console.log('Registration details saved. Approval status:', updatedUser.approval_status);

    res.status(200).json({
      success: true,
      message: 'Registration submitted. Waiting for admin approval.',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        role: updatedUser.role,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        approvalStatus: updatedUser.approval_status,
        totalEarnings: updatedUser.total_earnings ? parseFloat(updatedUser.total_earnings) : 0,
        withdrawableEarnings: updatedUser.withdrawable_earnings ? parseFloat(updatedUser.withdrawable_earnings) : 0,
        todayEarnings: 0,
      }
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ success: false, error: 'Registration failed: ' + error.message });
  }
};

/**
 * Check if a store owner exists by phone number
 * GET /auth/check-owner/:phone
 */
const checkOwner = async (req, res) => {
  try {
    const { phone } = req.params;
    const normalizedPhone = normalizePhone(phone);
    const userId = generateHash(normalizedPhone);
    const user = await userModel.findById(userId);

    if (user && user.role === 'owner') {
      return res.status(200).json({
        success: true,
        exists: true,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          approvalStatus: user.approval_status,
          isProfileComplete: user.is_profile_complete,
          aadharNumber: user.aadhar_number,
          aadharImage: user.aadhar_image
        }
      });
    }

    res.status(200).json({
      success: true,
      exists: false
    });
  } catch (error) {
    console.error('Check Owner Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Check if a delivery partner exists and their status by phone number
 * GET /auth/check-partner/:phone
 */
const checkPartner = async (req, res) => {
  try {
    const { phone } = req.params;
    const normalizedPhone = normalizePhone(phone);
    const userId = generateHash(normalizedPhone);
    const user = await userModel.findById(userId);

    if (user) {
      return res.status(200).json({
        success: true,
        exists: true,
        role: user.role,
        approvalStatus: user.approval_status,
        isProfileComplete: user.is_profile_complete
      });
    }

    res.status(200).json({
      success: true,
      exists: false
    });
  } catch (error) {
    console.error('Check Partner Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  login,
  registerPartner,
  checkOwner,
  checkPartner,
};
