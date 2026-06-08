const userModel = require('../models/userModel');
const addressModel = require('../models/addressModel');
const storeModel = require('../models/storeModel');
const db = require('../config/db');
const admin = require('../config/firebase');

const updateProfile = async (req, res) => {
  try {
    const { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage, latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!fullName || !email || !addressLine || !pincode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Full name, email, address, and pincode are required' 
      });
    }

    // 1. Create a NEW address entry for this update (Immutability)
    const newAddress = await addressModel.create(userId, {
      fullName, email, houseNumber, addressLine, landmark,
      pincode, city, deliveryMessage, 
      addressType: 'Profile', 
      saveAs: 'Profile Address',
      latitude, longitude
    });

    // 2. Update the user with the new details and the pointer
    const currentUser = await userModel.findById(userId);
    const wasProfileIncomplete = !currentUser?.is_profile_complete;

    const updatedUserResult = await userModel.updateProfileWithAddress(userId, { 
      fullName, 
      email, 
      houseNumber: houseNumber || null, 
      addressLine, 
      landmark: landmark || null,
      pincode, 
      city: city || null,
      deliveryMessage: deliveryMessage || null,
      currentAddressId: newAddress.id
    });

    // --- Notification for Admin (New Customer Registration) ---
    if (wasProfileIncomplete && updatedUserResult?.role === 'customer') {
      try {
        const socketUtils = require('../utils/socket');
        const io = socketUtils.getIO();
        io.to('admin').emit('new_registration', {
          type: 'registration',
          role: 'customer',
          fullName: fullName,
          phone: updatedUserResult.phone,
          timestamp: new Date().toISOString()
        });
      } catch (socketErr) {
        console.warn('[User] Socket notification failed:', socketErr.message);
      }
    }

    if (!updatedUserResult) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found.' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUserResult.id,
        phone: updatedUserResult.phone,
        role: updatedUserResult.role,
        fullName: updatedUserResult.full_name,
        email: updatedUserResult.email,
        houseNumber: updatedUserResult.house_number,
        addressLine: updatedUserResult.address_line,
        landmark: updatedUserResult.landmark,
        pincode: updatedUserResult.pincode,
        city: updatedUserResult.city,
        deliveryMessage: updatedUserResult.delivery_message,
        currentAddressId: updatedUserResult.current_address_id,
        currentAddressLatitude: updatedUserResult.current_address_latitude ? parseFloat(updatedUserResult.current_address_latitude) : null,
        currentAddressLongitude: updatedUserResult.current_address_longitude ? parseFloat(updatedUserResult.current_address_longitude) : null,
        isProfileComplete: updatedUserResult.is_profile_complete,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update profile' });
  }
};

/**
 * Get user profile
 * GET /user/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Calculate today's earnings for delivery partner
    let todayEarnings = 0;
    if (user.role === 'delivery') {
      const todayResult = await db.query(
        `SELECT COALESCE(SUM(delivery_fee + delivery_tip), 0) as today_earnings 
         FROM orders 
         WHERE delivery_partner_id = $1 
           AND is_completed = true 
           AND updated_at >= CURRENT_DATE`,
        [userId]
      );
      todayEarnings = parseFloat(todayResult.rows[0]?.today_earnings) || 0;
    }

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
        razorpay_account_id: user.razorpay_account_id,
        razorpay_kyc_status: process.env.ENABLE_RAZORPAY === 'true' ? user.razorpay_kyc_status : 'activated',
        delivery_preference: user.delivery_preference,
        upiId: user.upi_id,
        upiQrImage: user.upi_qr_image,
        upi_id: user.upi_id,
        upi_qr_image: user.upi_qr_image
      },
    });

  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch profile' 
    });
  }
};

/**
 * Get all users
 * GET /user/all?role=owner
 */
const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const users = await userModel.findAll(role);
    
    res.status(200).json({
      success: true,
      data: users.map(user => ({
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
        isProfileComplete: user.is_profile_complete,
        isActive: user.is_active,
        createdAt: user.created_at,
        approvalStatus: user.approval_status,
        aadharNumber: user.aadhar_number,
        aadharImage: user.aadhar_image,
        upiId: user.upi_id,
        upiQrImage: user.upi_qr_image,
        totalEarnings: user.total_earnings ? parseFloat(user.total_earnings) : 0,
        withdrawableEarnings: user.withdrawable_earnings ? parseFloat(user.withdrawable_earnings) : 0
      })),
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users' 
    });
  }
};

/**
 * Get all delivery partners
 * GET /user/delivery-partners
 */
const getDeliveryPartners = async (req, res) => {
  try {
    const partners = await userModel.findAllDeliveryPartners();
    res.status(200).json({ success: true, data: partners });
  } catch (error) {
    console.error('Get Partners Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch partners' });
  }
};

/**
 * Approve or Reject a user (delivery partner or store owner)
 * PATCH /user/:id/approve
 */
const handleApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updatedUser = await userModel.updateApprovalStatus(id, status, status === 'rejected' ? rejectionReason : null);
    
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: `User ${status} successfully`,
      data: updatedUser 
    });
  } catch (error) {
    console.error('Handle Approval Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
};

/**
 * Update user's FCM token
 * POST /user/fcm-token
 */
const updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    await db.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [token, userId]
    );

    res.status(200).json({ success: true, message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Update FCM Token Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update FCM token' });
  }
};

/**
 * Get user by ID
 * GET /user/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        phone_number: user.phone,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        house_number: user.house_number,
        address_line: user.address_line,
        landmark: user.landmark,
        pincode: user.pincode,
        city: user.city,
        is_profile_complete: user.is_profile_complete,
      },
    });
  } catch (error) {
    console.error('Get User By ID Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user' 
    });
  }
};

/**
 * Delete a user account (Anonymize data and delete from Firebase)
 * DELETE /user/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const firebaseUid = req.user.firebase_uid;
    const userRole = req.user.role;

    console.log(`Starting account deletion for user: ${userId}`);

    // 1. Delete user from Firebase Auth
    try {
      await admin.auth().deleteUser(firebaseUid);
      console.log(`Firebase user ${firebaseUid} deleted.`);
    } catch (firebaseError) {
      // If user is already deleted in Firebase, proceed anyway
      if (firebaseError.code !== 'auth/user-not-found') {
        console.error('Firebase deletion error:', firebaseError);
        return res.status(500).json({ success: false, error: 'Failed to delete authentication record.' });
      }
    }

    // 2. If user is an owner, deactivate all their stores
    if (userRole === 'owner') {
      await storeModel.deactivateStoresByOwner(userId);
      console.log(`Stores deactivated for owner ${userId}.`);
    }

    // 3. Anonymize user in database
    await userModel.anonymizeUser(userId);
    console.log(`User ${userId} anonymized in database.`);

    res.status(200).json({ success: true, message: 'Account deleted successfully.' });

  } catch (error) {
    console.error('Account Deletion Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account.' });
  }
};

/**
 * Record manual payout for a partner/owner (deduct from withdrawable_earnings)
 * POST /user/:id/payout
 */
const recordManualPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    const payoutAmount = parseFloat(amount);
    if (!payoutAmount || payoutAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payout amount' });
    }

    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const withdrawable = parseFloat(user.withdrawable_earnings) || 0;
    if (payoutAmount > withdrawable) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient balance. User has only ₹${withdrawable.toFixed(2)} remaining.` 
      });
    }

    // Deduct withdrawable earnings
    await db.query(
      `UPDATE users 
       SET withdrawable_earnings = COALESCE(withdrawable_earnings, 0) - $1 
       WHERE id = $2`,
      [payoutAmount, id]
    );

    // Record transaction in ledger
    await db.query(
      `INSERT INTO earnings_transactions (user_id, amount, type, description) 
       VALUES ($1, $2, 'payout', $3)`,
      [id, payoutAmount, description || 'Manual payout recorded']
    );

    const updatedUser = await userModel.findById(id);

    res.status(200).json({ 
      success: true, 
      message: 'Payout recorded successfully',
      data: {
        id: updatedUser.id,
        totalEarnings: updatedUser.total_earnings ? parseFloat(updatedUser.total_earnings) : 0,
        withdrawableEarnings: updatedUser.withdrawable_earnings ? parseFloat(updatedUser.withdrawable_earnings) : 0
      }
    });

  } catch (error) {
    console.error('Record Payout Error:', error);
    res.status(500).json({ success: false, error: 'Failed to record manual payout' });
  }
};

/**
 * Get user's transaction ledger history
 * GET /user/:id/transactions
 */
const getUserTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, amount, type, order_id, description, created_at 
       FROM earnings_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );

    res.status(200).json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('Get User Transactions Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transaction logs' });
  }
};

module.exports = {
  updateProfile,
  getProfile,
  getAllUsers,
  getDeliveryPartners,
  handleApproval,
  updateFcmToken,
  getUserById,
  deleteAccount,
  recordManualPayout,
  getUserTransactions
};
