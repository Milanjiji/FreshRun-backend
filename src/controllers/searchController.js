const db = require('../config/db');

/**
 * Global search for stores and products matching query
 * GET /search
 */
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: { stores: [], products: [] }
      });
    }

    const searchTerm = `%${q.trim()}%`;

    // 1. Fetch matching stores (must be approved and active)
    const storesResult = await db.query(
      `SELECT id, name, description, image_url, is_active, city, handling_fee, latitude, longitude
       FROM stores 
       WHERE name ILIKE $1 AND approval_status = 'approved' AND is_active = true
       LIMIT 5`,
      [searchTerm]
    );

    // 2. Fetch matching products (must be active and associated store must be approved and active)
    const productsResult = await db.query(
      `SELECT p.id, p.name, p.price, p.store_id, p.image_url,
              s.name as store_name, s.image_url as store_image_url, s.is_active as store_is_active,
              s.latitude as store_latitude, s.longitude as store_longitude
       FROM products p
       JOIN stores s ON p.store_id = s.id
       WHERE p.name ILIKE $1 AND p.is_active = true 
         AND s.approval_status = 'approved' AND s.is_active = true
       LIMIT 10`,
      [searchTerm]
    );

    res.status(200).json({
      success: true,
      data: {
        stores: storesResult.rows,
        products: productsResult.rows
      }
    });

  } catch (error) {
    console.error('Global Search Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search'
    });
  }
};

module.exports = {
  globalSearch
};
