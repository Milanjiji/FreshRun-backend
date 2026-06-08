const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding rejection_reason column to users table...');
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
    console.log('✅ Users table updated');

    console.log('Adding rejection_reason column to stores table...');
    await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
    console.log('✅ Stores table updated with rejection_reason');

    console.log('Adding gst_number column to stores table...');
    await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15);`);
    console.log('✅ Stores table updated with gst_number');

    console.log('Setting default approval_status to pending in stores table...');
    await db.query(`ALTER TABLE stores ALTER COLUMN approval_status SET DEFAULT 'pending';`);
    console.log('✅ Stores default approval status updated');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
