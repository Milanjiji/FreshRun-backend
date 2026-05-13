const db = require('../src/config/db');
const orderModel = require('../src/models/orderModel');

async function testActiveOrder() {
  try {
    // Let's find any user ID first
    const usersResult = await db.query('SELECT id FROM users LIMIT 1');
    if (usersResult.rows.length === 0) {
      console.log('No users found to test with.');
      process.exit(0);
    }
    const userId = usersResult.rows[0].id;
    console.log(`Testing with user ID: ${userId}`);

    const activeOrder = await orderModel.getActiveOrderByUserId(userId);
    if (activeOrder) {
      console.log('Active Order found:');
      console.log({
        id: activeOrder.id,
        store_id: activeOrder.store_id,
        store_lat: activeOrder.store_lat,
        store_lng: activeOrder.store_lng,
        store_name: activeOrder.store_name,
        user_lat: activeOrder.delivery_address?.latitude,
        user_lng: activeOrder.delivery_address?.longitude
      });
    } else {
      console.log('No active order found for this user. Checking all orders...');
      const allOrders = await orderModel.getAllOrders();
      if (allOrders.length > 0) {
          console.log('Latest Order sample:');
          console.log({
            id: allOrders[0].id,
            store_lat: allOrders[0].store_lat,
            store_lng: allOrders[0].store_lng,
            store_name: allOrders[0].store_name
          });
      } else {
          console.log('No orders found in DB.');
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testActiveOrder();
