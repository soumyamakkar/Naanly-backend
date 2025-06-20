const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { uploadRecipeMedia } = require('../config/cloudinary');
const {
  createFoodRequest,
  createChefRentalRequest,
  createRecipeRequest,
  getUserRequests,
  getRequestById,
  cancelRequest
} = require('../controllers/chefRequestController');

// All routes require authentication
router.use(protect);

// Create request routes
router.post('/food', createFoodRequest);
router.post('/chef-rental', createChefRentalRequest);

// Special route for recipe request with file upload middleware
router.post('/recipe', (req, res, next) => {
  uploadRecipeMedia(req, res, (err) => {
    if (err) {
      return res.status(400).json({ 
        message: "Error uploading media", 
        error: err.message 
      });
    }
    next();
  });
}, createRecipeRequest);

// Get user's requests
router.get('/', getUserRequests);
router.get('/:requestId', getRequestById);

// Cancel request
router.put('/cancel/:requestId', cancelRequest);

module.exports = router;