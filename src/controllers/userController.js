const userModel = require('../models/userModel');
const addressModel = require('../models/addressModel');

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
    const updatedUser = await userModel.updateProfileWithAddress(userId, { 
      fullName, 
      email, 
      houseNumber: houseNumber || null, 
      addressLine, 
      landmark: landmark || null,
      pincode, 
      city: city || null,
      deliveryMessage: deliveryMessage || null,
      currentAddressId: newAddress.id,
      latitude,
      longitude
    });

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found.' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        role: updatedUser.role,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        houseNumber: updatedUser.house_number,
        addressLine: updatedUser.address_line,
        landmark: updatedUser.landmark,
        pincode: updatedUser.pincode,
        city: updatedUser.city,
        deliveryMessage: updatedUser.delivery_message,
        currentAddressId: updatedUser.current_address_id,
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        isProfileComplete: updatedUser.is_profile_complete,
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
        latitude: user.latitude,
        longitude: user.longitude,
        isProfileComplete: user.is_profile_complete,
        approvalStatus: user.approval_status,
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
 * GET /user/all
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.findAll();
    
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
        latitude: user.latitude,
        longitude: user.longitude,
        isProfileComplete: user.is_profile_complete,
        isActive: user.is_active,
        createdAt: user.created_at
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
 * Approve or Reject a delivery partner
 * PUT /user/approve-partner/:id
 */
const approvePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updatedUser = await userModel.updateApprovalStatus(id, status);
    
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: `Partner ${status} successfully`,
      data: updatedUser 
    });
  } catch (error) {
    console.error('Approve Partner Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update partner status' });
  }
};

module.exports = {
  updateProfile,
  getProfile,
  getAllUsers,
  getDeliveryPartners,
  approvePartner,
};
