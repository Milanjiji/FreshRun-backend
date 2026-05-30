const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
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
      console.log('✅ Database schema verified (fcm_token, total_earnings, withdrawable_earnings columns)');
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

