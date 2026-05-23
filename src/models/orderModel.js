const db = require('../config/db');

const toDeliveryAddress = (address) => ({
  line1: `${address.house_number ? address.house_number + ', ' : ''}${address.address_line || ''}`,
  line2: address.landmark || '',
  city: address.city || '',
  pincode: address.pincode || '',
  latitude: address.latitude || null,
  longitude: address.longitude || null,
});

const orderAddressJoin = `
  LEFT JOIN LATERAL (
    SELECT a.*
    FROM addresses a
    WHERE a.user_id = o.user_id
      AND (
        a.id = o.address_id
        OR (
          o.address_id IS NULL
          AND COALESCE(a.pincode, '') = COALESCE(o.delivery_address->>'pincode', '')
          AND CONCAT(
            CASE WHEN a.house_number IS NOT NULL AND a.house_number <> '' THEN a.house_number || ', ' ELSE '' END,
            COALESCE(a.address_line, '')
          ) = COALESCE(o.delivery_address->>'line1', '')
        )
      )
    ORDER BY CASE WHEN a.id = o.address_id THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT 1
  ) a ON true
`;

const orderModel = {
  createOrder: async (orderData) => {
    let {
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

    let resolvedAddressId = address_id;
    let resolvedDeliveryAddress = delivery_address || {};

    if (!resolvedAddressId) {
      const userResult = await db.query(
        'SELECT current_address_id FROM users WHERE id = $1',
        [user_id]
      );
      resolvedAddressId = userResult.rows[0]?.current_address_id || null;
    }

    if (resolvedAddressId) {
      const addressResult = await db.query(
        'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
        [resolvedAddressId, user_id]
      );
      const selectedAddress = addressResult.rows[0];

      if (selectedAddress) {
        resolvedDeliveryAddress = {
          ...resolvedDeliveryAddress,
          ...toDeliveryAddress(selectedAddress),
        };
      }
    }

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
      JSON.stringify(resolvedDeliveryAddress),
      resolvedAddressId
    ];

    const result = await db.query(query, values);
    const newOrder = result.rows[0];

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
             COALESCE(NULLIF(o.delivery_address->>'latitude', '')::numeric, a.latitude, u.latitude) as user_lat,
             COALESCE(NULLIF(o.delivery_address->>'longitude', '')::numeric, a.longitude, u.longitude) as user_lng,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${orderAddressJoin}
      LEFT JOIN stores s ON o.store_id = s.id
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  },

  getAvailableOrders: async () => {
    const query = `
      SELECT o.*, u.full_name as user_name, u.phone as user_phone,
             COALESCE(NULLIF(o.delivery_address->>'latitude', '')::numeric, a.latitude, u.latitude) as user_lat,
             COALESCE(NULLIF(o.delivery_address->>'longitude', '')::numeric, a.longitude, u.longitude) as user_lng,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name, s.address_line as store_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${orderAddressJoin}
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.delivery_boy_opted = false AND o.is_completed = false
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  },

  getPartnerOrders: async (partner_id) => {
    const query = `
      SELECT o.*, u.full_name as user_name, u.phone as user_phone,
             COALESCE(NULLIF(o.delivery_address->>'latitude', '')::numeric, a.latitude, u.latitude) as user_lat,
             COALESCE(NULLIF(o.delivery_address->>'longitude', '')::numeric, a.longitude, u.longitude) as user_lng,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name, s.address_line as store_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${orderAddressJoin}
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.delivery_partner_id = $1 AND o.is_completed = false
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query, [partner_id]);
    return result.rows;
  },

  optInToOrder: async (order_id, partner_id) => {
    const query = `
      UPDATE orders
      SET delivery_boy_opted = true, 
          delivery_partner_id = $1, 
          delivery_status = 'assigned',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND delivery_boy_opted = false
      RETURNING *;
    `;
    const result = await db.query(query, [partner_id, order_id]);
    return result.rows[0];
  },

  getOrderById: async (id) => {
    const query = `
      SELECT o.*,
             COALESCE(NULLIF(o.delivery_address->>'latitude', '')::numeric, a.latitude, u.latitude) as user_lat,
             COALESCE(NULLIF(o.delivery_address->>'longitude', '')::numeric, a.longitude, u.longitude) as user_lng,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${orderAddressJoin}
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.id = $1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  getActiveOrderByUserId: async (user_id) => {
    const query = `
      SELECT o.*,
             COALESCE(NULLIF(o.delivery_address->>'latitude', '')::numeric, a.latitude, u.latitude) as user_lat,
             COALESCE(NULLIF(o.delivery_address->>'longitude', '')::numeric, a.longitude, u.longitude) as user_lng,
             s.latitude as store_lat, s.longitude as store_lng, s.name as store_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${orderAddressJoin}
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.user_id = $1 AND o.is_completed = false 
      ORDER BY o.created_at DESC 
      LIMIT 1;
    `;
    const result = await db.query(query, [user_id]);
    return result.rows[0];
  },

  updateOrderStatus: async (id, updates) => {
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
