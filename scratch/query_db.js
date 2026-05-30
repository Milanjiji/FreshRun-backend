const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function queryDB() {
  const client = await pool.connect();
  try {
    console.log('Querying latest users...');
    const users = await client.query('SELECT id, phone, full_name, email, current_address_id, is_profile_complete FROM users ORDER BY created_at DESC LIMIT 5');
    console.log('Users:', JSON.stringify(users.rows, null, 2));

    console.log('Querying latest addresses...');
    const addresses = await client.query('SELECT id, user_id, full_name, address_line, pincode, latitude, longitude FROM addresses ORDER BY created_at DESC LIMIT 5');
    console.log('Addresses:', JSON.stringify(addresses.rows, null, 2));

    console.log('Querying latest orders...');
    const orders = await client.query('SELECT id, user_id, store_id, address_id, delivery_address FROM orders ORDER BY created_at DESC LIMIT 5');
    console.log('Orders:', JSON.stringify(orders.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

queryDB();
