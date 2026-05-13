const db = require('../src/config/db');

async function checkStores() {
  try {
    const result = await db.query('SELECT name, city, latitude, longitude FROM stores');
    console.log('Stores in DB:');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkStores();
