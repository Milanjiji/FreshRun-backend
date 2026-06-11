const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Starting migration to add extra store charge columns...');
    
    // 1. Add extra_store_charge to app_settings
    console.log('Adding extra_store_charge to app_settings table...');
    await db.query(`
      ALTER TABLE app_settings 
      ADD COLUMN IF NOT EXISTS extra_store_charge NUMERIC(10,2) DEFAULT 20.00;
    `);
    console.log('✅ Column extra_store_charge added to app_settings');

    // 2. Add extra_store_charge to orders
    console.log('Adding extra_store_charge to orders table...');
    await db.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS extra_store_charge NUMERIC(10,2) DEFAULT 0.00;
    `);
    console.log('✅ Column extra_store_charge added to orders');

    // 3. Add picked_up_stores to orders
    console.log('Adding picked_up_stores to orders table...');
    await db.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS picked_up_stores JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('✅ Column picked_up_stores added to orders');

    console.log('🎉 Migration successful!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
