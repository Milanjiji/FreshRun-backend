const db = require('../config/db');

const orderModel = {
  createOrder: async (orderData) => {
    const {
      user_id,
      store_id,
      items,
      subtotal,
      handling_fee,
      delivery_fee,
      late_night_fee,
      delivery_tip,
      total_amount,
      delivery_address,
      address_id
    } = orderData;

    const query = `
      INSERT INTO orders (
        user_id, store_id, items, subtotal, handling_fee, delivery_fee, 
        late_night_fee, delivery_tip, total_amount, delivery_address, address_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
      user_id,
      store_id,
      JSON.stringify(items),
      subtotal,
      handling_fee,
      delivery_fee,
      late_night_fee,
      delivery_tip,
      total_amount,
      JSON.stringify(delivery_address),
      address_id
    ];

    const result = await db.query(query, values);
    const newOrder = result.rows[0];

    // Fetch the store location to include in the returned order object
    const storeQuery = `SELECT latitude as store_lat, longitude as store_lng, name as store_name FROM stores WHERE id = $1`;
    const storeResult = await db.query(storeQuery, [newOrder.store_id]);
    
    if (storeResult.rows.length > 0) {
      return {
        ...newOrder,
        store_lat: storeResult.rows[0].store_lat,
        store_lng: storeResult.rows[0].store_lng,
        store_name: storeResult.rows[0].store_name
      };
    }

    return newOrder;
  },

  getAllOrders: async () => {
    const query = `
      SELECT o.*, u.full_name as user_name, u.phone as user_phone,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN stores s ON o.store_id = s.id
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  },

  getOrderById: async (id) => {
    const query = `
      SELECT o.*, s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.id = $1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  getActiveOrderByUserId: async (user_id) => {
    const query = `
      SELECT o.*, s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.user_id = $1 AND o.is_completed = false 
      ORDER BY o.created_at DESC 
      LIMIT 1;
    `;
    const result = await db.query(query, [user_id]);
    return result.rows[0];
  },

  updateOrderStatus: async (id, updates) => {
    // updates is an object with fields to update, e.g. { status: 'confirmed', is_completed: true }
    const setCols = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setCols.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (setCols.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE orders
      SET ${setCols.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await db.query(query, values);
    const updatedOrder = result.rows[0];

    if (!updatedOrder) return null;

    // Fetch the store location to include in the returned order object
    const storeQuery = `SELECT latitude as store_lat, longitude as store_lng, name as store_name FROM stores WHERE id = $1`;
    const storeResult = await db.query(storeQuery, [updatedOrder.store_id]);
    
    if (storeResult.rows.length > 0) {
      return {
        ...updatedOrder,
        store_lat: storeResult.rows[0].store_lat,
        store_lng: storeResult.rows[0].store_lng,
        store_name: storeResult.rows[0].store_name
      };
    }

    return updatedOrder;
  }
};

module.exports = orderModel;
