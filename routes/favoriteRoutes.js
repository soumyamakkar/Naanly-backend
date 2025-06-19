const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { 
  addToFavorites,
  removeFromFavorites,
  getAllFavorites,
  getRestaurantFavorites,
  checkFavorite
} = require('../controllers/favoriteController');

const router = express.Router();

router.use(protect);

// Add and remove favorites
router.post('/add', addToFavorites);
router.delete('/remove', removeFromFavorites);

// Get favorites
router.get('/', getAllFavorites);
router.get('/restaurant/:restaurantId', getRestaurantFavorites);
router.get('/check/:menuItemId', checkFavorite);

module.exports = router;