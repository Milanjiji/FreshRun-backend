const db = require('../config/db');
const socketUtils = require('../utils/socket');

// ─── Pricing Config ───────────────────────────────────────────────────────────

const getPricingConfig = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pricing_config WHERE id = 1');
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Pricing] Error fetching pricing config:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const updatePricingConfig = async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values    = Object.values(req.body);

    const result = await db.query(
      `UPDATE pricing_config SET ${setClause} WHERE id = 1 RETURNING *`,
      values
    );

    // Broadcast to all connected apps so CartScreen updates instantly
    try {
      const io = socketUtils.getIO();
      io.emit('pricing_updated', result.rows[0]);
    } catch (socketErr) {
      console.warn('[Pricing] Socket emission failed:', socketErr.message);
    }

    res.status(200).json({ success: true, data: result.rows[0], message: 'Pricing config updated' });
  } catch (err) {
    console.error('[Pricing] Error updating pricing config:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// ─── Coupons ──────────────────────────────────────────────────────────────────

const listCoupons = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Pricing] Error listing coupons:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const createCoupon = async (req, res) => {
  try {
    const {
      code, description, discount_type, discount_value,
      min_order_value, max_discount_cap, usage_limit, valid_from, valid_until,
    } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      return res.status(400).json({ success: false, error: 'code, discount_type, and discount_value are required' });
    }

    const result = await db.query(
      `INSERT INTO coupons
         (code, description, discount_type, discount_value, min_order_value, max_discount_cap, usage_limit, valid_from, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        code.toUpperCase().trim(),
        description || null,
        discount_type,
        discount_value,
        min_order_value || 0,
        max_discount_cap || null,
        usage_limit || null,
        valid_from || new Date(),
        valid_until || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ success: false, error: 'Coupon code already exists' });
    }
    console.error('[Pricing] Error creating coupon:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body);
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values    = [...Object.values(req.body), id];

    const result = await db.query(
      `UPDATE coupons SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Coupon not found' });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Pricing] Error updating coupon:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM coupons WHERE id = $1', [id]);
    res.status(200).json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    console.error('[Pricing] Error deleting coupon:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

/**
 * POST /pricing/validate-coupon
 * Public endpoint — called by mobile to validate a coupon code.
 * Returns discount amount and any error message.
 */
const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Coupon code is required' });

    const result = await db.query(
      'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)',
      [code]
    );
    const coupon = result.rows[0];
    if (!coupon) return res.status(404).json({ success: false, error: 'Invalid coupon code.' });
    if (!coupon.is_active) return res.status(400).json({ success: false, error: 'Coupon is not active.' });

    const now = new Date();
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({ success: false, error: 'Coupon has expired.' });
    }
    if (new Date(coupon.valid_from) > now) {
      return res.status(400).json({ success: false, error: 'Coupon is not yet valid.' });
    }
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, error: 'Coupon usage limit reached.' });
    }
    if (parseFloat(subtotal || 0) < parseFloat(coupon.min_order_value)) {
      return res.status(400).json({
        success: false,
        error: `Minimum order value ₹${coupon.min_order_value} required.`
      });
    }

    res.status(200).json({ success: true, data: coupon, message: 'Coupon is valid!' });
  } catch (err) {
    console.error('[Pricing] Error validating coupon:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = {
  getPricingConfig,
  updatePricingConfig,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
};
