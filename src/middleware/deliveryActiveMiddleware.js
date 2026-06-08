const userModel = require('../models/userModel');

const verifyDeliveryActive = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'delivery') {
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const isApproved = user.approval_status === 'approved';
      const isKycActive = process.env.ENABLE_RAZORPAY === 'true' 
        ? user.razorpay_kyc_status === 'activated'
        : true;

      if (!isApproved || !isKycActive) {
        return res.status(403).json({ 
          success: false, 
          error: process.env.ENABLE_RAZORPAY === 'true'
            ? 'Access denied: Your account is pending admin approval or Razorpay KYC activation.'
            : 'Access denied: Your account is pending admin approval.'
        });
      }
    }
    next();
  } catch (error) {
    console.error('Error verifying delivery status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = verifyDeliveryActive;
