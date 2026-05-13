const db = require('./src/config/db');

const migrate = async () => {
  try {
    console.log('Adding latitude and longitude columns to addresses table...');
    await db.query(`
      ALTER TABLE addresses
        ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
        ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7)
    `);

    console.log('Adding latitude and longitude columns to users table...');
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
        ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7)
    `);

    console.log('Migration successful! ✅');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed: ❌', err);
    process.exit(1);
  }
};

migrate();
