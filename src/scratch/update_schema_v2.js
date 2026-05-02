const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function updateSchema() {
  const client = await pool.connect();
  try {
    console.log('Updating users table with address fields...');
    
    // We can add columns if they don't exist, but since we are in early dev and just reset, 
    // let's just drop and recreate to be clean and consistent with the user's "clear data" request.
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    await client.query(`
      CREATE TABLE users (
        id VARCHAR(64) PRIMARY KEY,
        firebase_uid VARCHAR(128) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        role VARCHAR(20) NOT NULL,
        full_name VARCHAR(100),
        email VARCHAR(100),
        house_number VARCHAR(50),
        address_line TEXT,
        pincode VARCHAR(10),
        city VARCHAR(50),
        is_profile_complete BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Users table updated successfully with address fields.');

  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateSchema();
