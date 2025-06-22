const Chef = require('../models/chefModel');
const { MenuItem } = require('../models/menuItemModel');
const mongoose = require('mongoose');

// Get all chefs
exports.getAllChefs = async (req, res) => {
  try {
    const chefs = await Chef.find({ isActive: true });
    res.json(chefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chef by ID
exports.getChefById = async (req, res) => {
  try {
    const { id } = req.params;
    const chef = await Chef.findById(id);
    
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    res.json(chef);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chefs by name or kitchen name (case-insensitive, partial match)
exports.getChefsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name query required' });
    
    const chefs = await Chef.find({ 
      $or: [
        { name: { $regex: name, $options: 'i' } },
        { kitchenName: { $regex: name, $options: 'i' } }
      ],
      isActive: true
    });
    
    res.json(chefs);
  } catch (err) {
    console.error('Error searching chefs by name:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get chefs by speciality
exports.getChefsBySpeciality = async (req, res) => {
  try {
    const { speciality } = req.query;
    if (!speciality) return res.status(400).json({ error: 'Speciality query required' });
    
    const chefs = await Chef.find({ 
      specialities: { $regex: speciality, $options: 'i' },
      isActive: true
    });
    
    res.json(chefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chefs nearby (within X km)
exports.getChefsNearby = async (req, res) => {
  try {
    const { lng, lat, distance = 10 } = req.query;
    if (!lng || !lat) return res.status(400).json({ error: 'lng and lat required' });
    
    // Find all chefs within the user-provided distance
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(distance) * 1000 // meters
      }
      }
    });

    // Filter chefs whose serviceArea.radius covers the distance from user to chef
    const userLocation = [parseFloat(lng), parseFloat(lat)];
    const filteredChefs = nearbyChefs.filter(chef => {
      if (!chef.location || !chef.serviceArea || !chef.serviceArea.radius) return false;
      const [chefLng, chefLat] = chef.location.coordinates;
      // Calculate distance in km using Haversine formula
      const toRad = x => x * Math.PI / 180;
      const R = 6371; // Earth radius in km
      const dLat = toRad(chefLat - userLocation[1]);
      const dLng = toRad(chefLng - userLocation[0]);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(toRad(userLocation[1])) * Math.cos(toRad(chefLat)) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceToChef = R * c;
      return distanceToChef <= chef.serviceArea.radius;
    });
    
    res.json(filteredChefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get menu for a chef (by chefId)
exports.getChefMenu = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use MenuItem model to get all menu items for this chef
    const menu = await MenuItem.find({ chefId: id });
    
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chef preferences (eatingPreference, isVegOnly, cuisines)
exports.getChefPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const chef = await Chef.findById(id, 'eatingPreference isVegOnly cuisines specialDiets');
    
    if (!chef) return res.status(404).json({ error: 'Chef not found' });
    
    res.json(chef);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all veg/non-veg items from a chef (filter menu)
exports.getFilteredChefMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVeg } = req.query;
    
    // Check if chef exists
    const chef = await Chef.findById(id);
    if (!chef) return res.status(404).json({ error: 'Chef not found' });
    
    // Build query for menu items
    const query = { chefId: id };
    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }
    
    const menu = await MenuItem.find(query);
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get filters for UI (priceRange, tags, specialDiets)
exports.getChefFilters = async (req, res) => {
  try {
    const { id } = req.params;
    const chef = await Chef.findById(id, 'filters');
    
    if (!chef) return res.status(404).json({ error: 'Chef not found' });
    
    res.json(chef.filters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check chef availability for a date
exports.checkChefAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    
    if (!date) return res.status(400).json({ error: 'Date query required' });
    
    const chef = await Chef.findById(id);
    if (!chef) return res.status(404).json({ error: 'Chef not found' });
    
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
    const availability = chef.availability[dayOfWeek];
    
    res.json({
      available: availability.available,
      hours: availability.hours
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new chef (admin only)
exports.addChef = async (req, res) => {
  try {
    const chef = new Chef(req.body);
    await chef.save();
    res.status(201).json(chef);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Add a menu item for a chef
exports.addChefMenuItem = async (req, res) => {
  try {
    const { id } = req.params; // chefId from URL
    
    // Attach chefId to the menu item
    const menuItemData = { 
      ...req.body, 
      chefId: id,
      restaurantId: null // Ensure this isn't a restaurant item
    };
    
    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();
    
    res.status(201).json(menuItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};