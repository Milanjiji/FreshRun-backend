const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function addGeoColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding latitude and longitude columns to stores table...');
    await client.query(`
      ALTER TABLE stores 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS maps_link TEXT;
    `);
    console.log('Columns added successfully.');

  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addGeoColumns();
