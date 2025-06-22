const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  submitRating,
  getRestaurantRatings,
  getChefRatings,
  getUserRatings,
  editRating,
  deleteRating,
  checkRatingEligibility
} = require('../controllers/ratingController');

// All routes require authentication
router.use(protect);

// Submit rating route
router.post('/submit', submitRating);

// Get ratings
router.get('/restaurant/:restaurantId', getRestaurantRatings);
router.get('/chef/:chefId', getChefRatings);
router.get('/user', getUserRatings);
router.get('/check/:orderId', checkRatingEligibility);

// Edit rating route
router.put('/edit/:ratingId', editRating);

// Delete rating
router.delete('/delete/:ratingId', deleteRating);

module.exports = router;