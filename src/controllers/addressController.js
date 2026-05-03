const addressModel = require('../models/addressModel');
const userModel = require('../models/userModel');

/**
 * Get all saved addresses for the authenticated user
 */
const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await addressModel.findByUserId(userId);

    res.status(200).json({
      success: true,
      addresses: addresses.map(addr => ({
        id: addr.id,
        fullName: addr.full_name,
        email: addr.email,
        houseNumber: addr.house_number,
        addressLine: addr.address_line,
        landmark: addr.landmark,
        pincode: addr.pincode,
        city: addr.city,
        deliveryMessage: addr.delivery_message,
        addressType: addr.address_type,
        saveAs: addr.save_as
      }))
    });
  } catch (error) {
    console.error('Get Addresses Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
  }
};

/**
 * Add a new address to the saved addresses pool
 */
const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      fullName, email, houseNumber, addressLine, landmark, 
      pincode, city, deliveryMessage, addressType, saveAs 
    } = req.body;

    if (!addressLine || !pincode) {
      return res.status(400).json({ success: false, error: 'Address and pincode are required' });
    }

    const newAddress = await addressModel.create(userId, {
      fullName, email, houseNumber, addressLine, landmark,
      pincode, city, deliveryMessage, addressType, saveAs
    });

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress
    });
  } catch (error) {
    console.error('Add Address Error:', error);
    res.status(500).json({ success: false, error: 'Failed to add address' });
  }
};

/**
 * Swap the current active address with a saved one
 */
const selectAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.body;

    if (!addressId) {
      return res.status(400).json({ success: false, error: 'Address ID is required' });
    }

    await addressModel.swapAddress(userId, addressId);

    // Fetch updated profile to return
    const user = await userModel.findById(userId);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.full_name,
        email: user.email,
        houseNumber: user.house_number,
        addressLine: user.address_line,
        landmark: user.landmark,
        pincode: user.pincode,
        city: user.city,
        deliveryMessage: user.delivery_message,
        isProfileComplete: user.is_profile_complete,
      }
    });
  } catch (error) {
    console.error('Select Address Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update address' });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  selectAddress,
};
