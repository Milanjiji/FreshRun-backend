const db = require('./src/config/db');

async function runMigration() {
  console.log('--- Starting OTPS Table Migration ---');
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create an index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone_number);
    `);
    console.log('✅ Migration successful: otps table created');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

runMigration();
