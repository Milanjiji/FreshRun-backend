const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Disable SSL for this migration attempt
});

async function runMigration() {
  console.log('--- Starting DB Migration (No SSL) ---');
  try {
    await pool.query(`
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
