const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage for menu item photos
const menuItemPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/menu-items',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Configure storage for restaurant photos
const restaurantPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/restaurants',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Configure storage for chef profile pictures
const chefProfileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/chefs/profile',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Configure storage for chef cover photos
const chefCoverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/chefs/cover',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1200, height: 400, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Configure storage for meal box photos
const mealBoxPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/meal-boxes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// General Cloudinary storage for combo photos
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'naanly/combo-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

module.exports = {
  cloudinary,
  uploadMenuItemPhoto: multer({ 
    storage: menuItemPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }),
  uploadRestaurantPhotos: multer({ 
    storage: restaurantPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }),
  uploadChefProfilePicture: multer({ 
    storage: chefProfileStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }),
  uploadChefCoverPhoto: multer({ 
    storage: chefCoverStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }),
  uploadMealBoxPhoto: multer({
    storage: mealBoxPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, JPG and PNG file formats are allowed'));
      }
    }
  }),
  uploadComboPhoto: multer({
    storage: cloudinaryStorage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, JPG and PNG file formats are allowed'));
      }
    }
  })
};