const db = require('../src/config/db');
const { generateHash } = require('../src/utils/hash');

async function diagnostic() {
  const storePhone1 = "9876543210";
  const ownerPhone1 = "9988776655";
  const storeId = generateHash(storePhone1);
  const ownerId = generateHash(ownerPhone1);

  console.log('--- DIAGNOSTIC START ---');
  console.log('Store ID:', storeId);
  console.log('Owner ID:', ownerId);

  try {
    // 1. Test User Creation
    console.log('\n1. Testing User (Owner) Creation...');
    try {
      const placeholderFirebaseUid = `DIAGNOSTIC_${Date.now()}`;
      await db.query(
        'INSERT INTO users (id, firebase_uid, phone, role, is_active, approval_status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [ownerId, placeholderFirebaseUid, ownerPhone1, 'owner', true, 'approved']
      );
      console.log('   ✅ User table insert/check passed.');
    } catch (err) {
      console.error('   ❌ User table insert FAILED:', err.message);
    }

    // 2. Test Store Creation
    console.log('\n2. Testing Store Table Insert...');
    const storeData = {
      id: storeId,
      owner_id: ownerId,
      name: "Diagnostic Store",
      description: "Test",
      category: "restaurants",
      image_url: null,
      phone_1: storePhone1,
      phone_2: null,
      house_number: "123",
      address_line: "Test St",
      landmark: null,
      pincode: "123456",
      city: "Test City",
      latitude: 11.0,
      longitude: 75.0,
      maps_link: null,
      veg_type: 'both',
      handling_fee: 0,
      max_delivery_distance: 5.0,
      approval_status: 'approved',
      is_active: true
    };

    try {
      const result = await db.query(
        `INSERT INTO stores (
          id, owner_id, name, description, category, image_url, 
          phone_1, phone_2, house_number, address_line, landmark, pincode, city,
          latitude, longitude, maps_link, veg_type, handling_fee, max_delivery_distance,
          approval_status, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
        RETURNING *`,
        [
          storeData.id, storeData.owner_id, storeData.name, storeData.description, storeData.category, storeData.image_url, 
          storeData.phone_1, storeData.phone_2, storeData.house_number, storeData.address_line, storeData.landmark, storeData.pincode, storeData.city, 
          storeData.latitude, storeData.longitude, storeData.maps_link, storeData.veg_type, storeData.handling_fee, storeData.max_delivery_distance,
          storeData.approval_status, storeData.is_active
        ]
      );
      console.log('   ✅ Store table insert passed.');
    } catch (err) {
      console.error('   ❌ Store table insert FAILED:', err.message);
      
      if (err.message.includes('column') && err.message.includes('does not exist')) {
         console.log('\n💡 SUGGESTION: You are missing a column in the "stores" table. Check the SQL migration guide I provided.');
      }
    }

  } catch (globalErr) {
    console.error('Global Error:', globalErr);
  } finally {
    process.exit();
  }
}

diagnostic();
