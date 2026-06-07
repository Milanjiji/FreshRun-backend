const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding Razorpay columns to stores table...');
    await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT;`);
    await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS razorpay_kyc_status TEXT DEFAULT 'created';`);
    console.log('✅ Stores table updated');

    console.log('Adding Razorpay columns to users table...');
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_kyc_status TEXT DEFAULT 'created';`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'wait_for_online';`);
    console.log('✅ Users table updated');

    console.log('Adding Razorpay columns to orders table...');
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cod';`);
    console.log('✅ Orders table updated');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
