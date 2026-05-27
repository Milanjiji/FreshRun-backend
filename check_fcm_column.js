const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
  let poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };

  let pool = new Pool(poolConfig);

  try {
    // Try to connect
    await pool.connect();
  } catch (err) {
    if (err.message.includes('SSL connections')) {
      console.log('⚠️ SSL not supported, retrying without SSL...');
      poolConfig.ssl = false;
      pool = new Pool(poolConfig);
    } else {
      console.error('❌ Connection failed:', err.message);
      process.exit(1);
    }
  }

  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'fcm_token';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column fcm_token exists');
    } else {
      console.log('❌ Column fcm_token does NOT exist');
      
      console.log('Attempting to add column...');
      await pool.query(`ALTER TABLE users ADD COLUMN fcm_token TEXT DEFAULT '';`);
      console.log('✅ Column fcm_token added successfully');
    }
  } catch (err) {
    console.error('❌ Error checking/updating schema:', err.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkSchema();
