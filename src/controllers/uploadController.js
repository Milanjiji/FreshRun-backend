const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables.
// Credentials never leave the server — the client only receives a short-lived signature.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /upload/sign
 *
 * Generates a signed upload authorisation for the client to upload
 * an image directly to Cloudinary without exposing the API secret.
 *
 * Protected by authenticateToken — only signed-in users can get a signature.
 *
 * Request body (optional):
 *   { folder: 'help-tickets' }   — Cloudinary folder to place the file in
 *
 * Response:
 *   { signature, timestamp, api_key, cloud_name, folder }
 */
const signUpload = (req, res) => {
  try {
    const folder = (req.body && req.body.folder) ? String(req.body.folder) : 'support';

    // Signatures are valid for 1 hour; using Unix timestamp in seconds.
    const timestamp = Math.round(Date.now() / 1000);

    // Build the params object that will be signed.
    // Must match exactly what the client will send to Cloudinary.
    const paramsToSign = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );

    return res.status(200).json({
      success:    true,
      signature,
      timestamp,
      api_key:    process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (err) {
    console.error('[uploadController] signUpload error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to generate upload signature.' });
  }
};

module.exports = { signUpload };
