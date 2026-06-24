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

const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Extract public ID from Cloudinary URL
    // e.g. https://res.cloudinary.com/dubgo0vue/image/upload/v171923456/freshrun/banner_name.jpg
    const parts = imageUrl.split('/image/upload/');
    if (parts.length < 2) return false;
    
    const publicIdWithExtension = parts[1].replace(/^v\d+\//, ''); // remove version prefix if exists (e.g. v171923456/)
    const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
    const publicId = lastDotIndex === -1 ? publicIdWithExtension : publicIdWithExtension.substring(0, lastDotIndex);

    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    return false;
  }
};

module.exports = { uploadImage, deleteImage };

