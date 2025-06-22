const express = require('express');
const router = express.Router();
const chefController = require('../controllers/chefController');
const {protect}= require('../middlewares/authMiddleware');


router.use(protect);

// Get all chefs
router.get('/', chefController.getAllChefs);

// Get chef by ID
router.get('/:id', chefController.getChefById);

// Get chefs by name
router.get('/search/name', chefController.getChefsByName);

// Get chefs by speciality
router.get('/search/speciality', chefController.getChefsBySpeciality);

// Get chefs nearby
router.get('/nearby', chefController.getChefsNearby);

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
router.post('/add', chefController.addChef);
router.post('/:id/menu', chefController.addChefMenuItem);

module.exports = router;