const db = require('./src/config/db');

async function cleanupAndMigrate() {
  console.log('--- Database Cleanup and Migration Started ---');
  
  try {
    // 1. Delete all dummy data from products and stores
    console.log('Deleting all existing stores and products...');
    await db.query('DELETE FROM products');
    await db.query('DELETE FROM stores');
    console.log('✅ All dummy stores and products deleted.');

    // 2. Add max_delivery_distance column to stores table
    console.log('Adding max_delivery_distance column to stores table...');
    await db.query(`
      ALTER TABLE stores 
      ADD COLUMN IF NOT EXISTS max_delivery_distance NUMERIC DEFAULT 5.0
    `);
    console.log('✅ Column max_delivery_distance added.');

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

cleanupAndMigrate();
