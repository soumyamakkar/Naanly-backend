const User = require('../models/userModel');
const { MenuItem } = require('../models/menuItemModel');
const Restaurant = require('../models/restaurantModel');
const mongoose = require('mongoose');

// Add a menu item to favorites
exports.addToFavorites = async (req, res) => {
  const userId = req.user.id;
  const { menuItemId, restaurantId } = req.body;

  if (!menuItemId || !restaurantId) {
    return res.status(400).json({ 
      message: "Menu item ID and restaurant ID are required" 
    });
  }

  try {
    // Verify that the menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Verify that the restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Check if item is already in favorites
    const user = await User.findById(userId);
    const alreadyFavorited = user.favorites.some(
      fav => fav.menuItem.toString() === menuItemId && fav.restaurantId.toString() === restaurantId
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: "Item already in favorites" });
    }

    // Add to favorites
    await User.findByIdAndUpdate(userId, {
      $push: { 
        favorites: { 
          menuItem: menuItemId, 
          restaurantId: restaurantId,
          addedAt: Date.now()
        } 
      }
    });

    res.status(201).json({ message: "Added to favorites" });
  } catch (err) {
    console.error("Add to favorites error:", err);
    res.status(500).json({ message: "Failed to add to favorites" });
  }
};

// Remove from favorites
exports.removeFromFavorites = async (req, res) => {
  const userId = req.user.id;
  const { menuItemId, restaurantId } = req.body;

  if (!menuItemId || !restaurantId) {
    return res.status(400).json({ 
      message: "Menu item ID and restaurant ID are required" 
    });
  }

  try {
    const result = await User.findByIdAndUpdate(userId, {
      $pull: { 
        favorites: { 
          menuItem: menuItemId,
          restaurantId: restaurantId 
        } 
      }
    });

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Removed from favorites" });
  } catch (err) {
    console.error("Remove from favorites error:", err);
    res.status(500).json({ message: "Failed to remove from favorites" });
  }
};

// Get all favorites for a user
exports.getAllFavorites = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId)
      .populate({
        path: 'favorites.menuItem',
        select: 'name description price isVeg category tags'
      })
      .populate({
        path: 'favorites.restaurantId',
        select: 'name cuisines isVegOnly'
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort by most recently added
    const favorites = user.favorites.sort((a, b) => b.addedAt - a.addedAt);

    res.status(200).json({ favorites });
  } catch (err) {
    console.error("Fetch favorites error:", err);
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
};

// Get all favorites from a specific restaurant for a user
exports.getRestaurantFavorites = async (req, res) => {
  const userId = req.user.id;
  const { restaurantId } = req.params;

  if (!restaurantId) {
    return res.status(400).json({ message: "Restaurant ID is required" });
  }

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter favorites by restaurant and populate menu item details
    const restaurantFavorites = await User.findById(userId)
      .populate({
        path: 'favorites.menuItem',
        select: 'name description price isVeg category tags',
        match: { restaurantId: restaurantId }
      })
      .select('favorites')
      .lean();

    // Filter out any null menuItems (happens when populate with match doesn't find matches)
    const filteredFavorites = restaurantFavorites.favorites.filter(fav => 
      fav.restaurantId.toString() === restaurantId && fav.menuItem !== null
    );

    res.status(200).json({ favorites: filteredFavorites });
  } catch (err) {
    console.error("Fetch restaurant favorites error:", err);
    res.status(500).json({ message: "Failed to fetch restaurant favorites" });
  }
};

// Check if a menu item is in favorites
exports.checkFavorite = async (req, res) => {
  const userId = req.user.id;
  const { menuItemId } = req.params;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFavorite = user.favorites.some(fav => 
      fav.menuItem.toString() === menuItemId
    );

    res.status(200).json({ isFavorite });
  } catch (err) {
    console.error("Check favorite error:", err);
    res.status(500).json({ message: "Failed to check favorite status" });
  }
};