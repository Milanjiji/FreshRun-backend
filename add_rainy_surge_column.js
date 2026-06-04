const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding rainy_surge_fee column to orders table...');
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rainy_surge_fee DECIMAL(10,2) DEFAULT 0.00;`);
    console.log('✅ Column added successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
