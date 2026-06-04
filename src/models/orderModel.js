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

const orderDetailsSelect = `
  SELECT o.*,
         u.full_name as user_name,
         u.phone as user_phone,
         a.latitude as user_lat,
         a.longitude as user_lng,
         s.latitude as store_lat,
         s.longitude as store_lng,
         s.name as store_name,
         s.address_line as store_address,
         json_build_object(
           'line1', COALESCE(
             CASE WHEN a.house_number IS NOT NULL AND a.house_number <> '' 
                  THEN a.house_number || ', ' ELSE '' END || a.address_line, 
             o.delivery_address->>'line1', 
             ''
           ),
           'line2', COALESCE(a.landmark, o.delivery_address->>'line2', ''),
           'city', COALESCE(a.city, o.delivery_address->>'city', ''),
           'pincode', COALESCE(a.pincode, o.delivery_address->>'pincode', ''),
           'latitude', a.latitude,
           'longitude', a.longitude,
           'saveAs', COALESCE(a.save_as, o.delivery_address->>'saveAs', 'Home')
         ) as delivery_address
  FROM orders o
  LEFT JOIN users u ON o.user_id = u.id
  ${orderAddressJoin}
  LEFT JOIN stores s ON o.store_id = s.id
`;

const getOrderDetailsById = async (id) => {
  const result = await db.query(
    `${orderDetailsSelect}
     WHERE o.id = $1`,
    [id]
  );
  return result.rows[0];
};

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
      address_id,
      is_pickup
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
        let finalLat = selectedAddress.latitude;
        let finalLng = selectedAddress.longitude;
        const clientLat = delivery_address?.latitude || delivery_address?.lat;
        const clientLng = delivery_address?.longitude || delivery_address?.lng;
        
        if ((finalLat === null || finalLng === null) && clientLat && clientLng) {
          finalLat = parseFloat(clientLat);
          finalLng = parseFloat(clientLng);
          try {
            await db.query(
              'UPDATE addresses SET latitude = $1, longitude = $2 WHERE id = $3',
              [finalLat, finalLng, resolvedAddressId]
            );
            selectedAddress.latitude = finalLat;
            selectedAddress.longitude = finalLng;
          } catch (err) {
            console.error('⚠️ Failed to auto-heal coordinates:', err.message);
          }
        }

        resolvedDeliveryAddress = {
          ...resolvedDeliveryAddress,
          ...toDeliveryAddress(selectedAddress),
        };
      }
    }

    const query = `
      INSERT INTO orders (
        user_id, store_id, items, subtotal, handling_fee, delivery_fee, 
        late_night_fee, delivery_tip, total_amount, delivery_address, address_id, is_pickup
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      resolvedAddressId,
      is_pickup || false
    ];

    const result = await db.query(query, values);
    const newOrder = result.rows[0];
    return getOrderDetailsById(newOrder.id);
  },

  getAllOrders: async () => {
    const query = `
      ${orderDetailsSelect}
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  },

  getAvailableOrders: async () => {
    const query = `
      ${orderDetailsSelect}
      WHERE o.delivery_boy_opted = false AND o.is_completed = false
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  },

  getPartnerOrders: async (partner_id, includeCompleted = false) => {
    const query = `
      ${orderDetailsSelect}
      WHERE o.delivery_partner_id = $1 ${includeCompleted ? '' : 'AND o.is_completed = false'}
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
      RETURNING id;
    `;
    const result = await db.query(query, [partner_id, order_id]);
    const updatedOrder = result.rows[0];
    if (!updatedOrder) return null;
    return getOrderDetailsById(updatedOrder.id);
  },

  getOrderById: async (id) => {
    return getOrderDetailsById(id);
  },

  getActiveOrderByUserId: async (user_id) => {
    const query = `
      ${orderDetailsSelect}
      WHERE o.user_id = $1 AND o.is_completed = false 
      ORDER BY o.created_at DESC 
      LIMIT 1;
    `;
    const result = await db.query(query, [user_id]);
    return result.rows[0];
  },

  getOrdersByUserId: async (user_id) => {
    const query = `
      ${orderDetailsSelect}
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC;
    `;
    const result = await db.query(query, [user_id]);
    return result.rows;
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
    return getOrderDetailsById(updatedOrder.id);
  }
};

module.exports = orderModel;
