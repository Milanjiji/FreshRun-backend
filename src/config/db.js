const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
});

// Verify connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB connection failed:', err.stack);
  } else {
    console.log('✅ DB connected');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Exporting pool in case it's needed elsewhere
};

