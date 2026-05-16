const { pool } = require('../config/db');

const migrate = async () => {
  try {
    console.log('🚀 Migrating orders table to add delivery partner fields...');
    
    // Add delivery_partner_id column
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_partner_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Add delivery_status if it doesn't exist (pending, assigned, picked_up, out_for_delivery, delivered)
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_status') THEN
          ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'pending';
        END IF;
      END $$;
    `);

    console.log('✅ Migration successful.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
