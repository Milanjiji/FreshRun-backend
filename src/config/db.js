const { Pool } = require('pg');
require('dotenv').config();

console.log('Connecting to DB:', process.env.DATABASE_URL ? 'URL exists' : 'URL MISSING');
const isLocal = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : {
    rejectUnauthorized: false, // Required for Supabase
  },
});

// Verify connection
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('❌ DB connection failed:', err.stack);
  } else {
    console.log('✅ DB connected');
    try {
      // Auto-migration: Ensure fcm_token column exists
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT DEFAULT \'\';');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0.00;');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawable_earnings NUMERIC(10,2) DEFAULT 0.00;');
      await client.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';");
      await client.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS max_discount NUMERIC(5,2) DEFAULT 0.00;");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(30);");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(15);");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(15);");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_rejection_reason TEXT;");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_qr_image TEXT;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS platform_commission NUMERIC(5,2) DEFAULT 10.00;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS global_max_delivery_radius NUMERIC DEFAULT 10;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS base_delivery_radius NUMERIC DEFAULT 5;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS per_km_extra_charge NUMERIC DEFAULT 10;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS is_rainy_condition BOOLEAN DEFAULT false;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rainy_condition_fee NUMERIC DEFAULT 20;");
      await client.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT true;");
      
      // Auto-migration for products columns (quantity units and inline variants)
      await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50);");
      await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';");
      
      // Auto-migration for orders columns
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'cod';");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS rainy_surge_fee NUMERIC(10,2) DEFAULT 0.00;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS handling_fee NUMERIC(10,2) DEFAULT 0.00;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(6);");

      await client.query(`
        CREATE TABLE IF NOT EXISTS earnings_transactions (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(100) REFERENCES users(id),
          amount NUMERIC(10,2) NOT NULL,
          type VARCHAR(20) NOT NULL,
          order_id INTEGER REFERENCES orders(id),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
          amount NUMERIC(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
          phone VARCHAR(20) PRIMARY KEY,
          otp VARCHAR(6) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ Database schema verified (otp_verifications, fcm_token, total_earnings, withdrawable_earnings, store approval_status, max_discount, upi, platform_commission, orders columns, earnings_transactions, withdrawal_requests)');
    } catch (migErr) {
      console.error('⚠️ Auto-migration failed (non-critical):', migErr.message);
    } finally {
      release();
    }
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Exporting pool in case it's needed elsewhere
};

