const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'freshrun',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function test() {
  try {
    const res = await pool.query('SELECT id, full_name, phone, latitude, longitude FROM users LIMIT 5');
    console.log('Users Data:', JSON.stringify(res.rows, null, 2));

    const res2 = await pool.query('SELECT * FROM addresses LIMIT 5');
    console.log('Addresses Data:', JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
