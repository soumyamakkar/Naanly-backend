const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const authMiddleware = require('../middlewares/authMiddleware');

// Get all restaurants
router.get('/', restaurantController.getRestaurants);

// Get restaurants by name
router.get('/search', restaurantController.getRestaurantsByName);

// Get restaurants nearby
router.get('/nearby', restaurantController.getRestaurantsNearby);

// Get menu for a restaurant
router.get('/:id/menu', restaurantController.getRestaurantMenu);

// Get restaurant preferences
router.get('/:id/preferences', restaurantController.getRestaurantPreferences);

// Get all veg/non-veg items in a restaurant (filter menu)
router.get('/:id/menu/filter', restaurantController.getFilteredMenu);

// Get filters for UI
router.get('/:id/filters', restaurantController.getRestaurantFilters);



//admin routes made just for populating the db...NOT FINAL
// Add a new restaurant
router.post('/', restaurantController.addRestaurant);

// Add a menu item to a restaurant (embedded menu)
router.post('/:id/menu', restaurantController.addMenuItem);

module.exports = router;
