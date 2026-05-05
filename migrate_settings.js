const db = require('./src/config/db');

const migrate = async () => {
  try {
    console.log('Creating app_settings table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        late_night_fee NUMERIC DEFAULT 10,
        late_night_start VARCHAR(10) DEFAULT '23:00',
        late_night_end VARCHAR(10) DEFAULT '05:00',
        min_delivery_fee NUMERIC DEFAULT 30,
        free_delivery_threshold NUMERIC DEFAULT 500,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings if not exists
    await db.query(`
      INSERT INTO app_settings (id, late_night_fee, late_night_start, late_night_end, min_delivery_fee, free_delivery_threshold)
      VALUES (1, 10, '23:00', '05:00', 30, 500)
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('Migration successful! ✅');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed: ❌', err);
    process.exit(1);
  }
};

migrate();
