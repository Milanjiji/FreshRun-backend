const Razorpay = require('razorpay');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const storeModel = require('../models/storeModel');
const orderModel = require('../models/orderModel');
const db = require('../config/db');
const { sendOrderNotification } = require('../utils/notification');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Onboard a store or delivery partner to Razorpay Route
 */
const onboardPartner = async (req, res) => {
  const { role, bankDetails, pan, name, email, phone, businessName } = req.body;
  const userId = req.user.id;

  try {
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

    // 2. Update Database with Razorpay Account ID
    if (role === 'owner') {
      const store = await storeModel.getStoreById(req.body.storeId);
      if (store) {
        await storeModel.updateStore(store.id, { 
          razorpay_account_id: account.id,
          razorpay_kyc_status: 'created' // In test mode, it might become 'activated' immediately
        });
      }
    } else if (role === 'delivery') {
      await userModel.updateRazorpayDetails(userId, { 
        razorpay_account_id: account.id,
        razorpay_kyc_status: 'created'
      });
    }

    res.json({ 
      success: true, 
      account_id: account.id, 
      message: 'Onboarding initiated successfully' 
    });
  } catch (error) {
    console.error('Razorpay Onboarding Error:', error);
    res.status(500).json({ error: error.message || 'Failed to onboard partner' });
  }
};

/**
 * Create a Razorpay Order with Transfers (Splits)
 */
const createOrderWithSplit = async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await orderModel.getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const store = await storeModel.getStoreById(order.store_id);
    const platformCommission = 0.10; // 10% example
    const storeShare = order.subtotal * (1 - platformCommission);
    
    // Note: Delivery share would be added here if you want to split to delivery boy too
    // For now, let's split to the Store.
    
    const options = {
      amount: Math.round(order.total_amount * 100), // in paise
      currency: "INR",
      receipt: `receipt_${order.id}`,
      transfers: [
        {
          account: store.razorpay_account_id,
          amount: Math.round(storeShare * 100),
          currency: "INR",
          notes: { order_id: order.id },
          on_hold: false
        }
      ]
    };

    const rzpOrder = await razorpay.orders.create(options);

    // Update order with Razorpay Order ID
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
 * Verify Razorpay Payment Signature
 */
const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    await orderModel.updateOrderStatus(order_id, {
      razorpay_payment_id,
      razorpay_signature,
      payment_status: 'paid',
      delivery_status: 'placed' // Move from 'pending' or 'draft' to 'placed'
    });
    res.json({ success: true, message: 'Payment verified successfully' });
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
      else if (event === 'account.instantly_activated' || event === 'account.activated_kyc_pending') {
        const accountId = payload.account.entity.id;
        const status = event === 'account.instantly_activated' ? 'activated' : 'kyc_pending';
        
        // Find if it's a store
        const storeRes = await db.query('SELECT id FROM stores WHERE razorpay_account_id = $1', [accountId]);
        if (storeRes.rows.length > 0) {
          await storeModel.updateStore(storeRes.rows[0].id, { razorpay_kyc_status: status });
        } else {
          // Check if it's a delivery partner
          const userRes = await db.query('SELECT id FROM users WHERE razorpay_account_id = $1', [accountId]);
          if (userRes.rows.length > 0) {
            await userModel.updateRazorpayDetails(userRes.rows[0].id, { razorpay_kyc_status: status });
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
  verifyPayment,
  handleWebhook,
  payDeliveryBoy
};
