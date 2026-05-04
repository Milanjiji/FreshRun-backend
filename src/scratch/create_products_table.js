const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createProductsTable() {
  const client = await pool.connect();
  try {
    console.log('Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        image_url TEXT,
        price DECIMAL(10, 2) NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        stock_quantity INTEGER DEFAULT 0,
        is_stock_out BOOLEAN DEFAULT FALSE,
        category VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Products table created successfully.');

  } catch (err) {
    console.error('Error creating products table:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createProductsTable();
