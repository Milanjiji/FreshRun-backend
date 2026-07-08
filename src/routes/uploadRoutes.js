const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { signUpload } = require('../controllers/uploadController');

// POST /upload/sign
// Authenticated users only — generates a signed Cloudinary upload authorisation.
router.post('/sign', authenticateToken, signUpload);

module.exports = router;
