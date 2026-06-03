const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding approval_status column to stores table...');
    await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';`);
    console.log('✅ Column added successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
