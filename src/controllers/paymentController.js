const Razorpay = require('razorpay');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const storeModel = require('../models/storeModel');
const orderModel = require('../models/orderModel');
const db = require('../config/db');
const { sendOrderNotification, broadcastNewOrder } = require('../utils/notification');
const socketUtils = require('../utils/socket');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Onboard a store or delivery partner to Razorpay Route
 */
const onboardPartner = async (req, res) => {
  const { role, bankDetails, pan, name, email, phone, businessName, upiId, upiQrImage } = req.body;
  const userId = req.user.id;

  try {
    let accountId;
    let kycStatus = 'activated'; // Default to activated when Razorpay is disabled

    if (process.env.ENABLE_RAZORPAY === 'true') {
      // 1. Create Linked Account on Razorpay
      // Note: For Test Mode, this is simplified. In Live, more details are needed.
      const account = await razorpay.accounts.create({
        type: 'route',
        email: email,
        phone: phone,
        legal_business_name: businessName || name,
        contact_name: name,
        profile: {
          category: role === 'owner' ? 'food_beverage' : 'logistics',
          subcategory: role === 'owner' ? 'restaurants' : 'delivery_services',
          addresses: {
            registered: {
              street1: 'Test Street',
              city: 'Test City',
              state: 'KA',
              postal_code: '560001',
              country: 'IN'
            }
          }
        },
        legal_entity_type: 'individual',
        notes: {
          user_id: userId,
          role: role
        }
      });
      accountId = account.id;
      kycStatus = 'created'; // Undergoes webhook validation in live Razorpay mode
    } else {
      accountId = `mock_upi_${userId}`;
    }

    // 2. Update Database with UPI and Razorpay Account ID details
    if (role === 'owner') {
      const store = await storeModel.getStoreById(req.body.storeId);
      if (store) {
        await storeModel.updateStore(store.id, { 
          razorpay_account_id: accountId,
          razorpay_kyc_status: kycStatus
        });
        // Save owner's UPI details in users table
        await userModel.updateRazorpayDetails(store.owner_id, {
          upi_id: upiId || null,
          upi_qr_image: upiQrImage || null
        });
      }
    } else if (role === 'delivery') {
      await userModel.updateRazorpayDetails(userId, { 
        razorpay_account_id: accountId,
        razorpay_kyc_status: kycStatus,
        bank_account_number: bankDetails?.accountNumber || null,
        bank_ifsc: bankDetails?.ifscCode || null,
        pan_number: pan || null,
        delivery_preference: req.body.delivery_preference || 'wait_for_online',
        upi_id: upiId || null,
        upi_qr_image: upiQrImage || null
      });
    }

    res.json({ 
      success: true, 
      account_id: accountId, 
      message: process.env.ENABLE_RAZORPAY === 'true' 
        ? 'Onboarding initiated successfully' 
        : 'Onboarding completed successfully (Razorpay bypassed, UPI details saved)' 
    });
  } catch (error) {
    console.error('Razorpay Onboarding Error:', error);
    const errorDetails = error.error?.description || error.description || error.message || 'Failed to onboard partner';
    res.status(500).json({ error: errorDetails });
  }
};

/**
 * Create a Razorpay Order with split logic
 */
const createOrderWithSplit = async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await orderModel.getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const options = {
      amount: Math.round(order.total_amount * 100), // in paise
      currency: "INR",
      receipt: `receipt_${order.id}`
    };

    const rzpOrder = await razorpay.orders.create(options);

    await orderModel.updateOrderStatus(order.id, { 
      razorpay_order_id: rzpOrder.id,
      payment_mode: 'online'
    });

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      order_id: rzpOrder.id,
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment order' });
  }
};

/**
 * Create a Razorpay Checkout Session (without creating database order first)
 */
const createCheckoutSession = async (req, res) => {
  const { total_amount } = req.body;

  try {
    if (!total_amount) {
      return res.status(400).json({ success: false, error: 'total_amount is required' });
    }

    const options = {
      amount: Math.round(total_amount * 100), // in paise
      currency: "INR",
      receipt: `receipt_sess_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    console.log("RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID);
    console.log("ORDER_CREATE_OPTIONS", options);
    console.log("CREATED_ORDER", order);

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
    });
  } catch (error) {
    console.error('Create Checkout Session Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create payment session' });
  }
};

/**
 * Verify Razorpay Payment Signature and Create Database Order
 */
const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    try {
      if (!orderData) {
        return res.status(400).json({ success: false, message: 'orderData is required for verification' });
      }

      // 1. Create order in database with explicit online payment mode
      const finalOrderData = {
        ...orderData,
        user_id: req.user.id,
        payment_mode: 'online'
      };
      
      const newOrder = await orderModel.createOrder(finalOrderData);

      if (!newOrder) {
        return res.status(500).json({ success: false, message: 'Failed to create database order' });
      }

      // 2. Update order with payment details
      const updatedOrder = await orderModel.updateOrderStatus(newOrder.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_status: 'paid',
        delivery_status: 'placed'
      });

      if (!updatedOrder) {
        return res.status(500).json({ success: false, message: 'Failed to update payment status' });
      }

      // 3. Emit sockets and trigger push notifications
      try {
        const io = socketUtils.getIO();
        io.to('admin').emit('new_order', updatedOrder);
        
        if (!updatedOrder.is_pickup) {
          io.to('delivery_partners').emit('new_available_order', updatedOrder);
          await broadcastNewOrder(updatedOrder.id, updatedOrder.store_name || 'a store');
        }
      } catch (err) {
        console.warn('Update triggers failed during verification:', err.message);
      }

      res.json({ success: true, message: 'Payment verified successfully', order: updatedOrder });
    } catch (createErr) {
      console.error('Error creating order post-payment:', createErr);
      res.status(500).json({ success: false, message: createErr.message || 'Error completing order' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Invalid signature' });
  }
};

/**
 * Razorpay Webhook Listener
 */
const handleWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature === expectedSignature) {
    const event = req.body.event;
    const payload = req.body.payload;

    try {
      if (event === 'order.paid') {
        const orderIdStr = payload.order.entity.receipt; // e.g. receipt_123
        const orderId = orderIdStr ? orderIdStr.replace('receipt_', '') : null;
        
        if (orderId) {
          // Update Order Status to paid and trigger socket/FCM inside your model/controller flow
          await orderModel.updateOrderStatus(orderId, {
            payment_status: 'paid',
            delivery_status: 'placed'
          });
          
          const order = await orderModel.getOrderById(orderId);
          if (order && order.user_id) {
             await sendOrderNotification(order.user_id, 'Payment Successful', `Your order #${orderId} has been paid and placed successfully.`, { type: 'order' });
          }
        }
      } 
      else if (
        event === 'account.instantly_activated' || 
        event === 'account.activated' ||
        event === 'account.activated_kyc_pending' ||
        event === 'account.needs_clarification' ||
        event === 'account.under_review' ||
        event === 'account.suspended' ||
        event === 'account.rejected'
      ) {
        const accountId = payload.account.entity.id;
        let status = 'kyc_pending';
        if (event === 'account.instantly_activated' || event === 'account.activated') {
          status = 'activated';
        } else if (event === 'account.needs_clarification') {
          status = 'needs_clarification';
        } else if (event === 'account.under_review') {
          status = 'under_review';
        } else if (event === 'account.suspended') {
          status = 'suspended';
        } else if (event === 'account.rejected') {
          status = 'rejected';
        }

        const statusDetails = payload.account.entity.status_details || {};
        const reason = statusDetails.description || statusDetails.reason || statusDetails.message || null;
        
        // Find if it's a store
        const storeRes = await db.query('SELECT id FROM stores WHERE razorpay_account_id = $1', [accountId]);
        if (storeRes.rows.length > 0) {
          const updateData = { razorpay_kyc_status: status };
          if (reason) {
            updateData.rejection_reason = `Razorpay: ${reason}`;
          }
          await storeModel.updateStore(storeRes.rows[0].id, updateData);
        } else {
          // Check if it's a delivery partner
          const userRes = await db.query('SELECT id FROM users WHERE razorpay_account_id = $1', [accountId]);
          if (userRes.rows.length > 0) {
            const updateData = { razorpay_kyc_status: status };
            if (reason) {
              updateData.razorpay_rejection_reason = reason;
            }
            await userModel.updateRazorpayDetails(userRes.rows[0].id, updateData);
          }
        }
      }
    } catch (err) {
      console.error('Webhook Processing Error:', err);
    }

    res.status(200).send('ok');
  } else {
    res.status(400).send('invalid signature');
  }
};

/**
 * Pay Delivery Boy (Delayed Transfer)
 */
const payDeliveryBoy = async (partnerId, amount, orderId) => {
  try {
    if (process.env.ENABLE_RAZORPAY !== 'true') {
      console.log(`[Bypassed Payout] Mock transfer of ₹${amount} to Delivery Boy ${partnerId} for order ${orderId}`);
      return true;
    }

    const userRes = await db.query('SELECT razorpay_account_id FROM users WHERE id = $1', [partnerId]);
    const partner = userRes.rows[0];

    if (!partner || !partner.razorpay_account_id) {
       console.error(`Cannot pay partner ${partnerId} - No Razorpay Linked Account`);
       return false;
    }

    // Amount needs to be in paise
    const amountInPaise = Math.round(amount * 100);

    const transfer = await razorpay.transfers.create({
      account: partner.razorpay_account_id,
      amount: amountInPaise,
      currency: "INR",
      notes: {
        order_id: orderId,
        payout_type: "delivery_fee"
      }
    });

    console.log(`Successfully transferred ₹${amount} to Delivery Boy ${partnerId}`);
    return true;
  } catch (error) {
    console.error('Pay Delivery Boy Error:', error);
    return false;
  }
};

module.exports = {
  onboardPartner,
  createOrderWithSplit,
  createCheckoutSession,
  verifyPayment,
  handleWebhook,
  payDeliveryBoy
};
