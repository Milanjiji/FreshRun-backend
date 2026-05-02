const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function resetDB() {
  const client = await pool.connect();
  try {
    console.log('Fetching table list...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Existing tables:', tables.rows.map(r => r.table_name));

    console.log('Dropping users table...');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    console.log('Creating users table with new schema...');
    await client.query(`
      CREATE TABLE users (
        id VARCHAR(64) PRIMARY KEY,
        firebase_uid VARCHAR(128) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        role VARCHAR(20) NOT NULL,
        full_name VARCHAR(100),
        email VARCHAR(100),
        is_profile_complete BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Users table created successfully.');

  } catch (err) {
    console.error('Error resetting DB:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDB();
