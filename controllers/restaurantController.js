const Restaurant = require('../models/restaurantModel');
const { MenuItem } = require('../models/menuItemModel');
const mongoose = require('mongoose');

// Get all restaurants
exports.getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get restaurant by name (case-insensitive, partial match)
exports.getRestaurantsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name query required' });
    const restaurants = await Restaurant.find({ name: { $regex: name, $options: 'i' } });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get restaurants nearby (within X km)
exports.getRestaurantsNearby = async (req, res) => {
  try {
    const { lng, lat, distance = 5 } = req.query;
    if (!lng || !lat) return res.status(400).json({ error: 'lng and lat required' });
    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(distance) * 1000 // meters
        }
      }
    });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get menu for a restaurant (by restaurantId)
exports.getRestaurantMenu = async (req, res) => {
  try {
    const { id } = req.params;
    // Use MenuItem model to get all menu items for this restaurant
    const menu = await MenuItem.find({ restaurantId: id });
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get restaurant preferences (eatingPreference, isVegOnly, cuisines)
exports.getRestaurantPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id, 'eatingPreference isVegOnly cuisines');
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all veg/non-veg items in a restaurant (filter menu)
exports.getFilteredMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVeg } = req.query;
    // Check if restaurant exists
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    // Build query for menu items
    const query = { restaurantId: id };
    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }
    const menu = await MenuItem.find(query);
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get filters for UI (priceRange, tags)
exports.getRestaurantFilters = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id, 'filters');
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant.filters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new restaurant
exports.addRestaurant = async (req, res) => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Add a menu item to a restaurant (global MenuItem collection)
exports.addMenuItem = async (req, res) => {
  try {
    const { id } = req.params; // restaurantId from URL
    // Attach restaurantId to the menu item
    const menuItemData = { ...req.body, restaurantId: id };
    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
