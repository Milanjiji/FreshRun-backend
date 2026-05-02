const userModel = require('../models/userModel');

/**
 * Update user profile
 * PUT /user/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, houseNumber, addressLine, landmark, pincode, city, deliveryMessage } = req.body;
    const userId = req.user.id;

    if (!fullName || !email || !addressLine || !pincode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Full name, email, address, and pincode are required' 
      });
    }

    const updatedUser = await userModel.updateProfile(userId, { 
      fullName, 
      email, 
      houseNumber, 
      addressLine, 
      landmark,
      pincode, 
      city,
      deliveryMessage
    });

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
        isProfileComplete: updatedUser.is_profile_complete,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
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
        isProfileComplete: user.is_profile_complete,
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

module.exports = {
  updateProfile,
  getProfile,
};
