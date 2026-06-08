const db = require('../config/db');
const { generateHash, normalizePhone } = require('../utils/hash');

async function migrate() {
  try {
    console.log('Starting DB phone number and ID normalization migration...');
    await db.query('BEGIN');

    // 1. Fetch all users
    const usersResult = await db.query('SELECT * FROM users');
    const users = usersResult.rows;
    console.log(`Found ${users.length} users to inspect.`);

    for (const user of users) {
      const normalizedPhone = normalizePhone(user.phone);
      const newId = generateHash(normalizedPhone);

      if (user.id !== newId) {
        console.log(`Migrating user ${user.phone} (${user.id}) -> ${normalizedPhone} (${newId})`);

        // Check if new user record already exists (to avoid duplicate key violations)
        const checkNewUser = await db.query('SELECT id FROM users WHERE id = $1', [newId]);
        if (checkNewUser.rows.length === 0) {
          // A. Insert duplicate user with the new ID
          await db.query(`
            INSERT INTO users (
              id, firebase_uid, phone, role, full_name, email, 
              house_number, address_line, landmark, pincode, city, 
              delivery_message, is_profile_complete, is_active, created_at,
              total_earnings, withdrawable_earnings, razorpay_account_id, 
              razorpay_kyc_status, delivery_preference, rejection_reason
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
          `, [
            newId, user.firebase_uid, normalizedPhone, user.role, user.full_name, user.email,
            user.house_number, user.address_line, user.landmark, user.pincode, user.city,
            user.delivery_message, user.is_profile_complete, user.is_active, user.created_at,
            user.total_earnings || 0, user.withdrawable_earnings || 0, user.razorpay_account_id || null,
            user.razorpay_kyc_status || 'created', user.delivery_preference || 'wait_for_online', user.rejection_reason || null
          ]);
        } else {
          console.log(`User with new ID ${newId} already exists. Skipping insertion.`);
        }

        // B. Update referencing tables
        // Update stores.owner_id
        const storesUpdate = await db.query('UPDATE stores SET owner_id = $1 WHERE owner_id = $2', [newId, user.id]);
        console.log(`Updated ${storesUpdate.rowCount} store owner references.`);

        // Update addresses.user_id
        const addressesUpdate = await db.query('UPDATE addresses SET user_id = $1 WHERE user_id = $2', [newId, user.id]);
        console.log(`Updated ${addressesUpdate.rowCount} address references.`);

        // Update orders.user_id
        const ordersUserUpdate = await db.query('UPDATE orders SET user_id = $1 WHERE user_id = $2', [newId, user.id]);
        console.log(`Updated ${ordersUserUpdate.rowCount} order user references.`);

        // Update orders.delivery_partner_id (if column exists)
        try {
          const ordersDriverUpdate = await db.query('UPDATE orders SET delivery_partner_id = $1 WHERE delivery_partner_id = $2', [newId, user.id]);
          console.log(`Updated ${ordersDriverUpdate.rowCount} order delivery partner references.`);
        } catch (err) {
          console.log('orders.delivery_partner_id column update skipped or not present:', err.message);
        }

        // C. Delete old user record
        await db.query('DELETE FROM users WHERE id = $1', [user.id]);
        console.log(`Deleted old user record: ${user.id}`);
      } else {
        // Just update phone to normalized if it's different
        if (user.phone !== normalizedPhone) {
          await db.query('UPDATE users SET phone = $1 WHERE id = $2', [normalizedPhone, user.id]);
          console.log(`Normalized phone number for user ${user.id} to ${normalizedPhone}`);
        }
      }
    }

    // 2. Also normalize store phone numbers
    const storesResult = await db.query('SELECT id, phone_1, phone_2 FROM stores');
    for (const store of storesResult.rows) {
      const normalizedP1 = normalizePhone(store.phone_1);
      const normalizedP2 = store.phone_2 ? normalizePhone(store.phone_2) : null;
      if (store.phone_1 !== normalizedP1 || store.phone_2 !== normalizedP2) {
        await db.query('UPDATE stores SET phone_1 = $1, phone_2 = $2 WHERE id = $3', [normalizedP1, normalizedP2, store.id]);
        console.log(`Normalized phone numbers for store ${store.id}`);
      }
    }

    await db.query('COMMIT');
    console.log('✅ DB phone number and ID normalization migration completed successfully.');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
