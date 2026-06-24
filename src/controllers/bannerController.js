const db = require('../config/db');

exports.getBanners = async (req, res) => {
  try {
    const query = `
      SELECT id, image_url, action_type, action_payload, is_active, sort_order 
      FROM banners 
      WHERE is_active = true 
      ORDER BY sort_order ASC, created_at DESC;
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getAllBannersAdmin = async (req, res) => {
  try {
    const query = `
      SELECT id, image_url, action_type, action_payload, is_active, sort_order, created_at 
      FROM banners 
      ORDER BY sort_order ASC, created_at DESC;
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching all banners:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const { image_url, action_type, action_payload, is_active = true, sort_order = 0 } = req.body;
    
    if (!image_url || !action_type) {
      return res.status(400).json({ success: false, error: 'image_url and action_type are required' });
    }

    const query = `
      INSERT INTO banners (image_url, action_type, action_payload, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.query(query, [image_url, action_type, action_payload || {}, is_active, sort_order]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_url, action_type, action_payload, is_active, sort_order } = req.body;

    const query = `
      UPDATE banners 
      SET 
        image_url = COALESCE($1, image_url),
        action_type = COALESCE($2, action_type),
        action_payload = COALESCE($3, action_payload),
        is_active = COALESCE($4, is_active),
        sort_order = COALESCE($5, sort_order)
      WHERE id = $6
      RETURNING *;
    `;
    const result = await db.query(query, [image_url, action_type, action_payload, is_active, sort_order, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM banners WHERE id = $1 RETURNING id;';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }

    res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
