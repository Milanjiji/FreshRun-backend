const storeModel = require('../models/storeModel');
const userModel = require('../models/userModel');
const { generateHash } = require('../utils/hash');

/**
 * Create a new store and its owner
 * POST /stores
 */
const createStore = async (req, res) => {
  console.log('--- Create Store Request Received ---');
  try {
    const {
      storeName,
      description,
      category,
      imageUrl,
      storePhone1,
      storePhone2,
      storeHouseNumber,
      storeAddressLine,
      storeLandmark,
      storePincode,
      storeCity,
      latitude,
      longitude,
      mapsLink,
      vegType,
      ownerFullName,
      ownerEmail,
      ownerPhone1,
      ownerPhone2
    } = req.body;

    // 1. Basic validation
    if (!storeName || !category || !storePhone1 || !ownerPhone1 || !ownerFullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // 2. Generate Deterministic ID for Store from its primary phone
    const storeId = generateHash(storePhone1);
    
    // 3. Generate Deterministic ID for Owner from their primary phone
    const ownerId = generateHash(ownerPhone1);

    // 4. Check if owner exists, if not create them
    let owner = await userModel.findById(ownerId);
    if (!owner) {
      console.log('Creating new owner user...');
      // Note: We use a placeholder for firebase_uid as the admin is creating this
      const placeholderFirebaseUid = `OWNER_PENDING_${ownerPhone1}`;
      owner = await userModel.createUser(ownerId, placeholderFirebaseUid, ownerPhone1, 'owner');
      
      // Update owner profile with full details
      await userModel.updateProfile(ownerId, {
        fullName: ownerFullName,
        email: ownerEmail,
        houseNumber: '', // Store owner might have different home address, but for now we focus on store
        addressLine: '',
        landmark: '',
        pincode: '',
        city: '',
        deliveryMessage: ''
      });
    }

    // 5. Create the Store
    const storeData = {
      id: storeId,
      owner_id: ownerId,
      name: storeName,
      description,
      category,
      image_url: imageUrl,
      phone_1: storePhone1,
      phone_2: storePhone2 || ownerPhone2, // Fallback to owner phone 2 if store phone 2 not provided
      house_number: storeHouseNumber,
      address_line: storeAddressLine,
      landmark: storeLandmark,
      pincode: storePincode,
      city: storeCity,
      latitude,
      longitude,
      maps_link: mapsLink,
      veg_type: vegType || 'both'
    };

    const newStore = await storeModel.createStore(storeData);

    res.status(201).json({
      success: true,
      message: 'Store created successfully',
      data: newStore
    });

  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create store'
    });
  }
};

/**
 * Get all stores
 * GET /stores
 */
const getStores = async (req, res) => {
  try {
    const { category, is_veg, include_inactive } = req.query;
    const stores = await storeModel.getAllStores({ category, is_veg, include_inactive });
    res.status(200).json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
};

/**
 * Update store details
 * PATCH /stores/:id
 */
const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedStore = await storeModel.updateStore(id, updateData);
    
    if (!updatedStore) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Store updated successfully',
      data: updatedStore
    });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store'
    });
  }
};

module.exports = {
  createStore,
  getStores,
  updateStore,
};

