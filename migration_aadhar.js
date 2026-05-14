const db = require('./src/config/db');

async function runMigration() {
  console.log('--- Starting DB Migration ---');
  try {
    // Try without explicit SSL first, since db.js has it configured
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aadhar_image TEXT,
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
    `);
    console.log('✅ Migration successful');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

runMigration();
