const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { protect } = require('../middlewares/authMiddleware');

// Public routes
router.get('/today-specials', homeController.getTodaysSpecials);
router.get('/popular-dishes', homeController.getPopularDishes);
router.get('/top-kitchens', homeController.getTopHomeKitchens);
router.get('/popular-chefs', homeController.getPopularChefs);

// Protected route - needs user's preferences
//router.get('/recommended-chefs', protect, homeController.getRecommendedChefs);

module.exports = router;