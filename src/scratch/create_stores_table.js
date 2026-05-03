const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createStoresTable() {
  const client = await pool.connect();
  try {
    console.log('Creating stores table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(64) PRIMARY KEY, -- Hashed phone number
        owner_id VARCHAR(64) REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL, -- restaurants, street-food, groceries
        image_url TEXT,
        phone_1 VARCHAR(20) NOT NULL,
        phone_2 VARCHAR(20),
        house_number VARCHAR(50),
        address_line TEXT,
        landmark TEXT,
        pincode VARCHAR(10),
        city VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Stores table created successfully.');

  } catch (err) {
    console.error('Error creating stores table:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createStoresTable();
