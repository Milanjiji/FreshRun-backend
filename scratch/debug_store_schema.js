const db = require('../src/config/db');

async function checkStoreSchema() {
  try {
    console.log('--- Stores Table Schema ---');
    const storesSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stores'
    `);
    console.table(storesSchema.rows);
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    process.exit();
  }
}

checkStoreSchema();
