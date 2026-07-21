const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/pricingController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── Pricing Config (admin only) ───────────────────────────────────────────────
router.get('/config',         authenticateToken, isAdmin, ctrl.getPricingConfig);
router.patch('/config',       authenticateToken, isAdmin, ctrl.updatePricingConfig);

// ── Coupons (admin CRUD) ──────────────────────────────────────────────────────
router.get('/coupons',        authenticateToken, isAdmin, ctrl.listCoupons);
router.post('/coupons',       authenticateToken, isAdmin, ctrl.createCoupon);
router.patch('/coupons/:id',  authenticateToken, isAdmin, ctrl.updateCoupon);
router.delete('/coupons/:id', authenticateToken, isAdmin, ctrl.deleteCoupon);

// ── Coupon Validation (public — called by mobile before checkout) ─────────────
router.post('/validate-coupon', authenticateToken, ctrl.validateCoupon);

// ── Public pricing config (needed by mobile on startup) ──────────────────────
router.get('/config/public',  ctrl.getPricingConfig);

module.exports = router;
