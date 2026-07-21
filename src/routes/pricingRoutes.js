const express           = require('express');
const router            = express.Router();
const ctrl              = require('../controllers/pricingController');
const authenticateToken = require('../middleware/authMiddleware');

// ── Pricing Config ────────────────────────────────────────────────────────────
router.get('/config',         authenticateToken, ctrl.getPricingConfig);
router.patch('/config',       authenticateToken, ctrl.updatePricingConfig);

// ── Coupons (CRUD) ────────────────────────────────────────────────────────────
router.get('/coupons',        authenticateToken, ctrl.listCoupons);
router.post('/coupons',       authenticateToken, ctrl.createCoupon);
router.patch('/coupons/:id',  authenticateToken, ctrl.updateCoupon);
router.delete('/coupons/:id', authenticateToken, ctrl.deleteCoupon);

// ── Coupon Validation (called by mobile before checkout) ──────────────────────
router.post('/validate-coupon', authenticateToken, ctrl.validateCoupon);

// ── Public pricing config (needed by mobile on startup) ──────────────────────
router.get('/config/public',  ctrl.getPricingConfig);

module.exports = router;
