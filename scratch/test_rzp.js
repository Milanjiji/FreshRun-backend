require('dotenv').config();
const Razorpay = require('razorpay');

console.log("RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET ? "DEFINED" : "UNDEFINED");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const options = {
  amount: 10000,
  currency: "INR",
  receipt: `receipt_sess_${Date.now()}`
};

console.log("ORDER_CREATE_OPTIONS", options);

razorpay.orders.create(options)
  .then(order => {
    console.log("CREATED_ORDER", order);
  })
  .catch(err => {
    console.error("ORDER_CREATE_ERROR", err);
  });
