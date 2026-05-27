const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding fcm_token column...');
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT DEFAULT '';`);
    console.log('✅ Column added successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
