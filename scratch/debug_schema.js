const db = require('../src/config/db');

async function checkSchema() {
  try {
    console.log('--- Orders Table Schema ---');
    const ordersSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `);
    console.table(ordersSchema.rows);

    console.log('\n--- Addresses Table Schema ---');
    const addrSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'addresses'
    `);
    console.table(addrSchema.rows);

  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    process.exit();
  }
}

checkSchema();
