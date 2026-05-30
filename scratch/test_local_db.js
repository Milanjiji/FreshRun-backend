const { Pool } = require('pg');

async function test() {
  const connectionStrings = [
    'postgres://postgres@localhost:5432/postgres',
    'postgres://postgres:postgres@localhost:5432/postgres',
    'postgres://milan@localhost:5432/postgres',
    'postgres://milan@localhost:5432/milan'
  ];

  for (const conn of connectionStrings) {
    try {
      const pool = new Pool({ connectionString: conn, ssl: false, connectionTimeoutMillis: 2000 });
      const res = await pool.query('SELECT now()');
      console.log(`Success with: ${conn}`);
      console.log('Result:', res.rows[0]);
      await pool.end();
      return;
    } catch (e) {
      console.log(`Failed with: ${conn} - ${e.message}`);
    }
  }
}

test();
