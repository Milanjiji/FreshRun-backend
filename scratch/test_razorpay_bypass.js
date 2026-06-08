const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const paymentController = require('../src/controllers/paymentController');
const userController = require('../src/controllers/userController');
const storeController = require('../src/controllers/storeController');
const verifyDeliveryActive = require('../src/middleware/deliveryActiveMiddleware');
const db = require('../src/config/db');

// Ensure ENABLE_RAZORPAY is false (which is our target condition)
process.env.ENABLE_RAZORPAY = 'false';

async function runTests() {
  console.log('--- STARTING BYPASS TESTS ---');
  console.log('ENABLE_RAZORPAY status:', process.env.ENABLE_RAZORPAY);

  try {
    // 1. Test userController.getProfile override
    console.log('\n1. Testing user profile KYC status override...');
    const mockUser = {
      id: 'test_delivery_id',
      phone: '9999999999',
      role: 'delivery',
      full_name: 'Test Delivery Boy',
      razorpay_kyc_status: 'created' // Under review normally
    };

    // Mock findById to return our user
    const userModel = require('../src/models/userModel');
    const originalFindById = userModel.findById;
    userModel.findById = async () => mockUser;

    let profileResult = null;
    const mockResProfile = {
      status: (code) => {
        return {
          json: (data) => {
            profileResult = data;
          }
        };
      }
    };

    await userController.getProfile({ user: { id: 'test_delivery_id' } }, mockResProfile);
    console.log('Profile response kyc status:', profileResult?.user?.razorpay_kyc_status);
    if (profileResult?.user?.razorpay_kyc_status === 'activated') {
      console.log('✅ Success: User KYC status overridden to activated.');
    } else {
      console.error('❌ Failure: User KYC status not overridden.');
    }
    userModel.findById = originalFindById;

    // 2. Test delivery active middleware
    console.log('\n2. Testing delivery active middleware bypass...');
    let nextCalled = false;
    const mockReqMiddleware = {
      user: { id: 'test_delivery_id', role: 'delivery' }
    };
    userModel.findById = async () => ({
      approval_status: 'approved',
      razorpay_kyc_status: 'kyc_pending' // KYC not activated
    });

    await verifyDeliveryActive(mockReqMiddleware, {
      status: (code) => ({
        json: (data) => {
          console.log('Middleware returned status:', code, data);
        }
      })
    }, () => {
      nextCalled = true;
    });

    if (nextCalled) {
      console.log('✅ Success: Delivery active middleware bypassed Razorpay check and allowed next().');
    } else {
      console.error('❌ Failure: Delivery active middleware blocked due to Razorpay KYC.');
    }
    userModel.findById = originalFindById;

    // 3. Test storeController.getStoreById override
    console.log('\n3. Testing store getStoreById override...');
    const storeModel = require('../src/models/storeModel');
    const originalGetStoreById = storeModel.getStoreById;
    storeModel.getStoreById = async () => ({
      id: 'test_store_id',
      name: 'Test Store',
      razorpay_kyc_status: 'created'
    });

    let storeResult = null;
    const mockResStore = {
      status: (code) => ({
        json: (data) => {
          storeResult = data;
        }
      })
    };

    await storeController.getStoreById({ params: { id: 'test_store_id' } }, mockResStore);
    console.log('Store response kyc status:', storeResult?.data?.razorpay_kyc_status);
    if (storeResult?.data?.razorpay_kyc_status === 'activated') {
      console.log('✅ Success: Store KYC status overridden to activated.');
    } else {
      console.error('❌ Failure: Store KYC status not overridden.');
    }
    storeModel.getStoreById = originalGetStoreById;

    // 4. Test paymentController.payDeliveryBoy bypass
    console.log('\n4. Testing payDeliveryBoy payout bypass...');
    const payoutResult = await paymentController.payDeliveryBoy('delivery_id', 150, 'order_id');
    if (payoutResult === true) {
      console.log('✅ Success: Payout bypassed and returned true without Razorpay call.');
    } else {
      console.error('❌ Failure: Payout failed or tried to call Razorpay.');
    }

  } catch (err) {
    console.error('Test Execution Error:', err);
  } finally {
    // Close DB pool just in case it was opened
    try {
      await db.end();
    } catch (_) {}
    console.log('\n--- TESTS COMPLETED ---');
  }
}

runTests();
