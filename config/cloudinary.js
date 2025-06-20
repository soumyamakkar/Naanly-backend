const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly-profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Multer upload configuration for profile pictures
const uploadProfilePicture = multer({
  storage: profileStorage,
  limits: {
    fileSize: 1024 * 1024 * 2 // 2MB limit
  }
}).single('profilePicture');

// Configure storage for recipe request media
const recipeMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly-recipe-media',
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    resource_type: 'auto'
  }
});

// Multer upload configuration for recipe media
const uploadRecipeMedia = multer({
  storage: recipeMediaStorage,
  limits: {
    fileSize: 1024 * 1024 * 50, // 50MB limit for videos
    files: 5 // Maximum 5 files
  }
}).array('media', 5);

module.exports = {
  cloudinary,
  uploadProfilePicture,
  uploadRecipeMedia
};