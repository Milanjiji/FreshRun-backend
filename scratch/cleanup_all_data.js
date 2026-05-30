const db = require('../src/config/db');

async function cleanupAll() {
  console.log('⚠️  STARTING COMPLETE DATABASE CLEANUP... ⚠️');
  try {
    // Truncate all tables cascade to reset DB completely
    console.log('Truncating all tables (orders, addresses, products, stores, users)...');
    await db.query(`
      TRUNCATE TABLE 
        orders, 
        addresses, 
        products, 
        stores, 
        users 
      CASCADE;
    `);
    console.log('✅ All users, stores, products, addresses, and orders deleted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

cleanupAll();
