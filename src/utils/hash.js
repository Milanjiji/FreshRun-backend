const crypto = require('crypto');

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
};
