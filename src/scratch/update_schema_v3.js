const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function updateSchemaV3() {
  const client = await pool.connect();
  try {
    console.log('Updating users table with landmark and delivery message...');
    
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
        landmark VARCHAR(100),
        pincode VARCHAR(10),
        city VARCHAR(50),
        delivery_message TEXT,
        is_profile_complete BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Users table updated successfully with landmark and delivery message.');

  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateSchemaV3();
