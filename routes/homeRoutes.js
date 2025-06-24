const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { protect } = require('../middlewares/authMiddleware');

// Single endpoint for all menu item queries with filter in query params
router.get('/menu-items', protect, homeController.getMenuItems);

// Keep the chef/kitchen endpoints separate since they're different entities
router.get('/top-kitchens', protect, homeController.getTopHomeKitchens);
router.get('/popular-chefs', protect, homeController.getPopularChefs);

// Add the meal boxes endpoint
router.get('/meal-boxes-for-you', protect, homeController.getMealBoxesForYou);

module.exports = router;