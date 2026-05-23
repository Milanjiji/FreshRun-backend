const { pool } = require('../config/db');

const setupTable = async () => {
  try {
    console.log('🚀 Creating orders table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id VARCHAR(255) REFERENCES stores(id) ON DELETE SET NULL,
        items JSONB NOT NULL,
        subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
        handling_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
        delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
        late_night_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
        delivery_tip NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        delivery_address JSONB,
        address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, packed, out_for_delivery, delivered, cancelled
        is_completed BOOLEAN DEFAULT false,
        delivery_boy_opted BOOLEAN DEFAULT false,
        is_packed BOOLEAN DEFAULT false,
        is_given_to_delivery_boy BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Orders table created or already exists.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating orders table:', error);
    process.exit(1);
  }
};

setupTable();
