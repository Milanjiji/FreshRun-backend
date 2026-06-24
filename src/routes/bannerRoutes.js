const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Public route for Customer App
router.get('/', bannerController.getBanners);

// Admin routes (Removing missing auth middleware for now to match other routes)
router.get('/admin', bannerController.getAllBannersAdmin);
router.post('/', bannerController.createBanner);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
