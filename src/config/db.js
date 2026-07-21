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

      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(20),
          ip_address VARCHAR(50),
          device_info TEXT,
          action_type VARCHAR(50),
          status VARCHAR(20),
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ── Pricing Config ─────────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS pricing_config (
          id INTEGER PRIMARY KEY DEFAULT 1,

          -- Platform Fee (per product × quantity, slab on selling price)
          platform_fee_enabled              BOOLEAN  DEFAULT true,
          platform_fee_slabs                JSONB    DEFAULT '[
            {"min":1,    "max":300,  "fee":5},
            {"min":301,  "max":1000, "fee":10},
            {"min":1001, "max":2000, "fee":20},
            {"min":2001, "max":3000, "fee":30},
            {"min":3001, "max":4000, "fee":40},
            {"min":4001, "max":5000, "fee":50}
          ]',
          platform_fee_step_amount          INTEGER  DEFAULT 1000,
          platform_fee_step_fee             INTEGER  DEFAULT 10,

          -- Handling Fee (slab on cart subtotal)
          handling_fee_enabled              BOOLEAN  DEFAULT true,
          handling_fee_slabs                JSONB    DEFAULT '[
            {"min":0,    "max":500,  "fee":5},
            {"min":501,  "max":1000, "fee":10},
            {"min":1001, "max":1500, "fee":15},
            {"min":1501, "max":2000, "fee":20}
          ]',
          handling_fee_step_amount          INTEGER  DEFAULT 500,
          handling_fee_step_fee             INTEGER  DEFAULT 5,

          -- Packaging Fee (restaurant-wise, one fee per order)
          packaging_fee_enabled             BOOLEAN  DEFAULT false,
          packaging_fee_type                VARCHAR(20) DEFAULT 'fixed',
          packaging_fee_value               NUMERIC  DEFAULT 10,

          -- GST (inclusive display only — does NOT add to total)
          gst_enabled                       BOOLEAN  DEFAULT false,
          gst_percentage                    NUMERIC  DEFAULT 5,
          gst_applies_on                    VARCHAR(30) DEFAULT 'product_only',

          -- Surge
          rain_surge_enabled                BOOLEAN  DEFAULT false,
          rain_surge_amount                 NUMERIC  DEFAULT 20,
          peak_surge_enabled                BOOLEAN  DEFAULT false,
          peak_surge_amount                 NUMERIC  DEFAULT 15,
          peak_surge_start                  VARCHAR(10) DEFAULT '12:00',
          peak_surge_end                    VARCHAR(10) DEFAULT '14:00',

          -- Platform-wide discount
          platform_discount_enabled         BOOLEAN  DEFAULT false,
          platform_discount_type            VARCHAR(20) DEFAULT 'flat',
          platform_discount_value           NUMERIC  DEFAULT 0
        );
      `);
      await client.query(`INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT DO NOTHING;`);

      // ── Coupons ────────────────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(30) UNIQUE NOT NULL,
          description TEXT,
          discount_type VARCHAR(20) NOT NULL DEFAULT 'flat',
          discount_value NUMERIC NOT NULL DEFAULT 0,
          min_order_value NUMERIC DEFAULT 0,
          max_discount_cap NUMERIC DEFAULT NULL,
          is_active BOOLEAN DEFAULT true,
          usage_limit INTEGER DEFAULT NULL,
          used_count INTEGER DEFAULT 0,
          valid_from TIMESTAMP DEFAULT NOW(),
          valid_until TIMESTAMP DEFAULT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // ── New order fee columns ──────────────────────────────────────────────
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee      NUMERIC(10,2) DEFAULT 0;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS packaging_fee     NUMERIC(10,2) DEFAULT 0;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS surge_fee         NUMERIC(10,2) DEFAULT 0;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_amount        NUMERIC(10,2) DEFAULT 0;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code       VARCHAR(30);");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount   NUMERIC(10,2) DEFAULT 0;");
      await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_discount NUMERIC(10,2) DEFAULT 0;");

      console.log('✅ Database schema verified (pricing_config, coupons, new order columns, activity_logs, otp_verifications, fcm_token, total_earnings, withdrawable_earnings, store approval_status, max_discount, upi, platform_commission, orders columns, earnings_transactions, withdrawal_requests)');
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

