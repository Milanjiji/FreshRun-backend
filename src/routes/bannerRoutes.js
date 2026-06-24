const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public route for Customer App
router.get('/', bannerController.getBanners);

// Admin routes
router.get('/admin', verifyToken, isAdmin, bannerController.getAllBannersAdmin);
router.post('/', verifyToken, isAdmin, bannerController.createBanner);
router.put('/:id', verifyToken, isAdmin, bannerController.updateBanner);
router.delete('/:id', verifyToken, isAdmin, bannerController.deleteBanner);

module.exports = router;
