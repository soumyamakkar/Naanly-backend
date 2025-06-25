const express = require('express');
const router = express.Router();
const chefController = require('../controllers/chefController');
const {protect}= require('../middlewares/authMiddleware');
const { uploadChefProfilePicture, uploadChefCoverPhoto, uploadMenuItemPhoto, uploadMealBoxPhoto, uploadComboPhoto } = require('../config/cloudinary'); // Import cover photo middleware


router.use(protect);

// Get all chefs


// Get chefs by name
router.get('/search/name', chefController.getChefsByName);

// Get chefs by speciality
router.get('/search/speciality', chefController.getChefsBySpeciality);

// Get chefs nearby
router.get('/nearby', chefController.getChefsNearby);

router.get('/', chefController.getAllChefs);

// Get chef by ID
router.get('/:id', chefController.getChefById);

// Get menu for a chef
router.get('/:id/menu', chefController.getChefMenu);

// Get chef preferences
router.get('/:id/preferences', chefController.getChefPreferences);

// Get all veg/non-veg items from a chef (filter menu)
router.get('/:id/menu/filter', chefController.getFilteredChefMenu);

// Get filters for UI
router.get('/:id/filters', chefController.getChefFilters);

// Check chef availability
router.get('/:id/availability', chefController.checkChefAvailability);

// Admin routes - will be protected in production
router.post(
  '/add',
  uploadChefProfilePicture.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 }
  ]),
  chefController.addChef
);
router.post('/:id/menu', uploadMenuItemPhoto.single('photo'), chefController.addChefMenuItem);

// Get all meal boxes for a chef
router.get('/:id/meal-boxes', chefController.getChefMealBoxes);

// Add a new meal box
router.post('/:id/meal-boxes', uploadMealBoxPhoto.single('photo'), chefController.addMealBox);

// Get all combos for a chef
router.get('/:id/combos', chefController.getCombos);

// Add a new combo
router.post('/:id/combos', uploadComboPhoto.single('photo'), chefController.addCombo);

// Update a combo
router.put('/:id/combos/:comboId', uploadComboPhoto.single('photo'), chefController.updateCombo);

// Delete a combo
router.delete('/:id/combos/:comboId', chefController.deleteCombo);

module.exports = router;