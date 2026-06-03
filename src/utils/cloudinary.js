const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImage = async (imagePath, folder = 'freshrun') => {
  try {
    if (!imagePath) return null;
    
    // If it's already a URL, return it
    if (imagePath.startsWith('http')) return imagePath;

    const result = await cloudinary.uploader.upload(imagePath, {
      folder: folder,
      resource_type: 'auto'
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
};

module.exports = { uploadImage };
