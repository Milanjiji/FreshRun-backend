const { pool } = require('../config/db');

const setupTable = async () => {
  try {
    console.log('🚀 Creating addresses table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255),
        email VARCHAR(255),
        house_number VARCHAR(255),
        address_line TEXT NOT NULL,
        landmark VARCHAR(255),
        pincode VARCHAR(20) NOT NULL,
        city VARCHAR(255),
        delivery_message TEXT,
        address_type VARCHAR(50) DEFAULT 'Other', -- House, Office, Other
        save_as VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Addresses table created or already exists.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating addresses table:', error);
    process.exit(1);
  }
};

setupTable();
