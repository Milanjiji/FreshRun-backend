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
      console.log('✅ Database schema verified (fcm_token column)');
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

