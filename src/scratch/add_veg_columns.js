const db = require('../config/db');

async function addVegColumns() {
  try {
    console.log('🚀 Starting migration: Adding veg columns...');

    // 1. Add is_veg to products
    console.log('Adding is_veg to products table...');
    await db.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS is_veg BOOLEAN DEFAULT true
    `);

    // 2. Add veg_type to stores
    // veg_type: 'veg' (pure veg), 'non-veg' (pure non-veg), 'both' (mixed)
    console.log('Adding veg_type to stores table...');
    await db.query(`
      ALTER TABLE stores 
      ADD COLUMN IF NOT EXISTS veg_type VARCHAR(20) DEFAULT 'both'
    `);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit();
  }
}

addVegColumns();
