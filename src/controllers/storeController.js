const storeModel = require('../models/storeModel');
const userModel = require('../models/userModel');
const { generateHash, normalizePhone } = require('../utils/hash');
const socketUtils = require('../utils/socket');

/**
 * Create a new store and owner user
 */
const createStore = async (req, res) => {
  console.log('--- Create Store Request Received ---');
  try {
    const {
      storeName,
      description,
      category,
      imageUrl, // This is the store image
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
      handlingFee,
      ownerFullName,
      ownerEmail,
      ownerPhone1,
      ownerPhone2,
      ownerAadharNumber,
      ownerAadharImage,
      maxDeliveryDistance,
      gstNumber,
      approvalStatus
    } = req.body;

    // 1. Basic validation
    if (!storeName || !category || !storePhone1 || !ownerPhone1 || !ownerFullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // 2. Generate Deterministic ID for Store from its primary phone
    const normalizedStorePhone = normalizePhone(storePhone1);
    const storeId = generateHash(normalizedStorePhone);
    
    // 4. Generate Deterministic ID for Owner from their primary phone
    const normalizedOwnerPhone = normalizePhone(ownerPhone1);
    const ownerId = generateHash(normalizedOwnerPhone);

    // 4. Check if owner exists, if not create them
    let owner = await userModel.findById(ownerId);
    if (!owner) {
      console.log('Creating new owner user...');
      const placeholderFirebaseUid = `OWNER_PENDING_${normalizedOwnerPhone}`;
      owner = await userModel.createUser(ownerId, placeholderFirebaseUid, normalizedOwnerPhone, 'owner');
    }

    // Update owner profile with full details (Safely handle missing Aadhar info from web)
    await userModel.updatePartnerRegistration(ownerId, {
      fullName: ownerFullName,
      email: ownerEmail || null,
      aadharNumber: ownerAadharNumber || null,
      aadharImage: ownerAadharImage || null
    });

    // 5. Create the Store
    const storeData = {
      id: storeId,
      owner_id: ownerId,
      name: storeName,
      description: description || null,
      category,
      image_url: imageUrl || null,
      phone_1: normalizedStorePhone,
      phone_2: storePhone2 ? normalizePhone(storePhone2) : (ownerPhone2 ? normalizePhone(ownerPhone2) : null),
      house_number: storeHouseNumber || null,
      address_line: storeAddressLine || null,
      landmark: storeLandmark || null,
      pincode: storePincode || null,
      city: storeCity || 'Calicut',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      maps_link: mapsLink || null,
      veg_type: vegType || 'both',
      handling_fee: handlingFee ? parseFloat(handlingFee) : 0,
      max_delivery_distance: maxDeliveryDistance ? parseFloat(maxDeliveryDistance) : 5.0,
      gst_number: gstNumber || null,
      approval_status: approvalStatus || 'pending'
    };


    const newStore = await storeModel.createStore(storeData);

    res.status(201).json({
      success: true,
      message: 'Store registration submitted for approval',
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
    const { category, is_veg, include_inactive, include_pending } = req.query;
    const stores = await storeModel.getAllStores({ category, is_veg, include_inactive, include_pending });
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
 * Get a single store by ID
 * GET /stores/:id
 */
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await storeModel.getStoreById(id);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Error fetching store by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
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

    // Emit real-time update
    try {
      const io = socketUtils.getIO();
      io.emit('store_updated', updatedStore);
    } catch (socketErr) {
      console.warn('Socket update failed:', socketErr.message);
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

/**
 * Delete a store
 * DELETE /stores/:id
 */
const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedStore = await storeModel.deleteStore(id);
    
    if (!deletedStore) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete store. Make sure all products in this store are deleted first.'
    });
  }
};

module.exports = {
  createStore,
  getStores,
  getStoreById,
  updateStore,
  deleteStore,
};
