const db = require('./src/config/db');

const migrate = async () => {
  try {
    console.log('Dropping deprecated latitude and longitude columns from users table...');
    await db.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS latitude,
        DROP COLUMN IF EXISTS longitude;
    `);

    console.log('Migration successful! ✅');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed: ❌', err);
    process.exit(1);
  }
};

migrate();
