const { pool } = require('./src/config/db');

const addHandlingFeeColumn = async () => {
  try {
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS handling_fee DECIMAL DEFAULT 0');
    console.log('✅ Column handling_fee added to stores table');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to add column:', err);
    process.exit(1);
  }
};

addHandlingFeeColumn();
