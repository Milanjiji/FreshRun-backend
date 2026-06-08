const crypto = require('crypto');

/**
 * Normalize phone numbers to E.164 format with +91 prefix for 10-digit Indian numbers.
 * @param {string} phone 
 * @returns {string} Normalized phone number
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  // Remove all non-digits except leading '+'
  let cleaned = phone.toString().replace(/[^\d+]/g, '');
  
  // If it starts with '+91', it's already fully qualified
  if (cleaned.startsWith('+91')) {
    return cleaned;
  }
  
  // If it starts with '+', keep it as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If it starts with '91' and is 12 digits, prepend '+'
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // If it's a 10 digit number, prepend '+91'
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  // Fallback: prepend '+' if missing, or just return as is
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

/**
 * Generate a SHA-256 hash from a string.
 * Used for creating deterministic user IDs from phone numbers.
 * @param {string} input 
 * @returns {string} 64-character hex hash
 */
const generateHash = (input) => {
  if (!input) return null;
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
};

module.exports = {
  generateHash,
  normalizePhone,
};
