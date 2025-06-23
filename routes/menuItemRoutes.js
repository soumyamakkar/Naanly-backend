const express = require('express');
const router = express.Router();
const menuItemController = require('../controllers/menuItemController');

// Get filtered menu items
//router.get('/', menuItemController.getMenuItems);

// Get menu items by restaurant or chef (using same controller)
router.get('/restaurant/:sourceId', menuItemController.getMenuItemsBySource);
router.get('/chef/:sourceId', menuItemController.getMenuItemsBySource);

// Get menu item details by ID
router.get('/:id', menuItemController.getMenuItemById);

// Get similar menu items
router.get('/:id/similar', menuItemController.getSimilarMenuItems);

// Rate a menu item
router.post('/rate', menuItemController.rateMenuItem);

module.exports = router;