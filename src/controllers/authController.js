const admin = require('../config/firebase');
const userModel = require('../models/userModel');
const { generateHash, normalizePhone } = require('../utils/hash');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

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
      // Log failed login due to invalid session/token
      await logActivity(req, 'unknown', 'login_firebase', 'failed', 'Invalid or expired Firebase ID token: ' + firebaseError.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired session' 
      });
    }

    const { uid: firebase_uid, phone_number: phone, email } = decodedToken;

    let normalizedPhone;
    let userId;

    if (phone) {
      normalizedPhone = normalizePhone(phone);
      userId = generateHash(normalizedPhone);
    } else if (email) {
      // Google Sign-In user
      normalizedPhone = 'G-' + generateHash(firebase_uid).substring(0, 13);
      userId = generateHash(firebase_uid);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number or email missing in token.' 
      });
    }

    // 3. Check if user exists in DB or create one
    let user = await userModel.findById(userId);

    if (!user) {
      console.log('Debug: User not found in DB. Creating new user...');
      user = await userModel.createUser(userId, firebase_uid, normalizedPhone, role);
      if (email || decodedToken.name) {
        await db.query(
          'UPDATE users SET email = COALESCE($1, email), full_name = COALESCE($2, full_name) WHERE id = $3',
          [email || null, decodedToken.name || null, userId]
        );
        user = await userModel.findById(userId);
      }
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
          full_name = $5, email = $6,
          house_number = NULL, address_line = NULL,
          landmark = NULL, pincode = NULL, city = NULL,
          delivery_message = NULL, current_address_id = NULL,
          fcm_token = NULL, aadhar_number = NULL, aadhar_image = NULL
        WHERE id = $7`,
        [
          normalizedPhone,
          firebase_uid,
          role,
          isPendingRole ? 'pending' : 'approved',
          decodedToken.name || null,
          email || null,
          userId
        ]
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
    
    // Log successful Firebase login
    await logActivity(req, user.phone, 'login_firebase', 'success');

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
    await logActivity(req, 'unknown', 'login_firebase', 'failed', 'Unexpected system login error: ' + error.message);
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

const sendOtp = async (req, res) => {
  console.log('--- Send OTP Request Received ---');
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const normalized = normalizePhone(phoneNumber);
    // Generate a 6-digit OTP
    let otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Test numbers check for App Store review / Dev testing
    const isTestNumber = ['+919999999999', '+918888888888', '+917777777777'].includes(normalized);
    if (isTestNumber) {
      otp = '123456';
    }

    // Upsert into database
    await db.query(`
      INSERT INTO otp_verifications (phone, otp, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (phone)
      DO UPDATE SET otp = EXCLUDED.otp, created_at = EXCLUDED.created_at;
    `, [normalized, otp]);

    if (isTestNumber) {
      console.log(`[Test Mode] Bypassing APITxT SMS delivery for test number: ${normalized}. OTP is: ${otp}`);
      await logActivity(req, normalized, 'otp_requested', 'success', 'Test Mode Bypass');
      return res.status(200).json({ success: true, message: 'OTP sent successfully (Test Mode)' });
    }

    // Prepare request body for APITxT
    // Strip '+' from E.164 phone number as standard for many gateways (e.g. +919999999999 -> 919999999999)
    const apiMobile = normalized.startsWith('+') ? normalized.substring(1) : normalized;
    const authKey = process.env.APITXT_API_KEY;

    if (!authKey) {
      console.warn('WARNING: APITXT_API_KEY environment variable is not set. Bypassing delivery...');
      await logActivity(req, normalized, 'otp_requested', 'success', 'Bypass: API key missing');
      return res.status(200).json({ success: true, message: 'OTP generated (Warning: API key missing)' });
    }

    const params = new URLSearchParams();
    params.append('authkey', authKey);
    params.append('mobile', apiMobile);
    params.append('otp', otp);
    
    console.log(`Sending OTP via APITxT to ${apiMobile}...`);
    const apiResponse = await fetch('https://apitxt.com/api/sendOTP', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const responseText = await apiResponse.text();
    console.log('APITxT response:', responseText);

    await logActivity(req, normalized, 'otp_requested', 'success');
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Send OTP Error:', error);
    const normalized = req.body.phoneNumber ? normalizePhone(req.body.phoneNumber) : 'unknown';
    await logActivity(req, normalized, 'otp_requested', 'failed', 'Error requesting OTP: ' + error.message);
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
};

const verifyOtp = async (req, res) => {
  console.log('--- Verify OTP Request Received ---');
  try {
    const { phoneNumber, code, role } = req.body;

    if (!phoneNumber || !code || !role) {
      return res.status(400).json({ success: false, error: 'phoneNumber, code, and role are required' });
    }

    if (!['customer', 'delivery', 'store'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const normalized = normalizePhone(phoneNumber);

    // Query database for OTP
    const result = await db.query('SELECT otp, created_at FROM otp_verifications WHERE phone = $1', [normalized]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No OTP requested for this phone number' });
    }

    const { otp, created_at } = result.rows[0];

    // Check if OTP matches
    if (otp !== code) {
      await logActivity(req, normalized, 'otp_failed_code', 'failed', 'Invalid OTP code entered');
      return res.status(400).json({ success: false, error: 'Invalid OTP code' });
    }

    // Check expiry (e.g., 5 minutes = 300000 ms)
    const otpAgeMs = Date.now() - new Date(created_at).getTime();
    if (otpAgeMs > 5 * 60 * 1000) {
      await logActivity(req, normalized, 'otp_failed_expired', 'failed', 'OTP expired');
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }

    // Delete the verified OTP so it cannot be reused
    await db.query('DELETE FROM otp_verifications WHERE phone = $1', [normalized]);

    // 1. Get or Create Firebase User by phone number using Firebase Admin SDK
    let firebaseUser;
    try {
      console.log(`Looking up Firebase user by phone: ${normalized}`);
      firebaseUser = await admin.auth().getUserByPhoneNumber(normalized);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`Firebase user not found. Creating user for phone: ${normalized}`);
        firebaseUser = await admin.auth().createUser({
          phoneNumber: normalized,
        });
      } else {
        throw err;
      }
    }

    const firebase_uid = firebaseUser.uid;
    const userId = generateHash(normalized);

    // 2. Fetch or create user in local database
    let user = await userModel.findById(userId);

    if (!user) {
      console.log('Creating new user in local DB...');
      user = await userModel.createUser(userId, firebase_uid, normalized, role);
    } else if (!user.is_active) {
      console.log('Re-activating deleted user row...');
      const isPendingRole = ['delivery', 'owner'].includes(role);
      await db.query(
        `UPDATE users SET 
          phone = $1, firebase_uid = $2, role = $3,
          is_active = true, approval_status = $4,
          is_profile_complete = false,
          house_number = NULL, address_line = NULL,
          landmark = NULL, pincode = NULL, city = NULL,
          delivery_message = NULL, current_address_id = NULL,
          fcm_token = NULL, aadhar_number = NULL, aadhar_image = NULL
        WHERE id = $5`,
        [
          normalized,
          firebase_uid,
          role,
          isPendingRole ? 'pending' : 'approved',
          userId
        ]
      );
      user = await userModel.findById(userId);
    }

    // 3. Generate Custom Token
    console.log(`Generating Custom Token for UID: ${firebase_uid}`);
    const customToken = await admin.auth().createCustomToken(firebase_uid, { role });

    // 4. Calculate today's earnings if delivery partner (identical to standard login flow)
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
        console.error('Failed to compute today earnings on OTP verification:', err.message);
      }
    }

    await logActivity(req, normalized, 'otp_verified', 'success', `LoggedIn as ${role}`);

    res.status(200).json({
      success: true,
      customToken,
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
    console.error('Verify OTP Error:', error);
    const normalized = req.body.phoneNumber ? normalizePhone(req.body.phoneNumber) : 'unknown';
    await logActivity(req, normalized, 'otp_verified', 'failed', 'Error verifying OTP: ' + error.message);
    res.status(500).json({ success: false, error: error.message || 'Verification failed' });
  }
};

module.exports = {
  login,
  registerPartner,
  checkOwner,
  checkPartner,
  sendOtp,
  verifyOtp,
};
