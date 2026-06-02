require('dotenv').config();

/**
 * Sends an OTP via Fast2SMS
 * @param {string} phoneNumber - The destination phone number
 * @param {string} otp - The 6-digit OTP code
 */
const sendOTP = async (phoneNumber, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  
  if (!apiKey) {
    throw new Error('FAST2SMS_API_KEY is not defined in .env');
  }

  // We use the 'q' (Quick) route which is less restrictive than 'otp'
  // Documentation: https://www.fast2sms.com/help/fast2sms-api-documentation
  const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=Your FreshRun OTP is ${otp}&numbers=${phoneNumber}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    const result = await response.json();

    if (result.return === true) {
      console.log(`✅ OTP sent successfully to ${phoneNumber}`);
      return result;
    } else {
      console.error('❌ Fast2SMS Error:', result.message);
      throw new Error(result.message || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('❌ Error calling Fast2SMS API:', error.message);
    throw error;
  }
};

module.exports = { sendOTP };
