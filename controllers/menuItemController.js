const { MenuItem } = require('../models/menuItemModel');
const mongoose = require('mongoose');
const Chef = require('../models/chefModel');

// Get menu item by ID
exports.getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    const menuItem = await MenuItem.findById(id)
      .populate('restaurantId', 'name location rating profilePicture')
      .populate('chefId', 'name kitchenName location rating profilePicture');
    
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    // Determine source type (restaurant or chef)
    let sourceType = null;
    let source = null;
    
    if (menuItem.restaurantId) {
      sourceType = 'restaurant';
      source = menuItem.restaurantId;
    } else if (menuItem.chefId) {
      sourceType = 'chef';
      source = menuItem.chefId;
    }
    
    // Format response
    const response = {
      ...menuItem.toObject(),
      sourceType,
      source
    };
    
    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching menu item:', err);
    res.status(500).json({ message: "Failed to fetch menu item details", error: err.message });
  }
};

// Get menu items by source (restaurant or chef)
exports.getMenuItemsBySource = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const sourceType = req.path.includes('/restaurant/') ? 'restaurant' : 'chef';
    
    if (!mongoose.Types.ObjectId.isValid(sourceId)) {
      return res.status(400).json({ message: `Invalid ${sourceType} ID format` });
    }
    
    // Determine which field to filter on based on source type
    const filterField = sourceType === 'restaurant' ? 'restaurantId' : 'chefId';
    
    // Find all menu items for this source
    const menuItems = await MenuItem.aggregate([
      { $match: { [filterField]: new mongoose.Types.ObjectId(sourceId) } },
      { $sort: { category: 1, name: 1 } }, // Sort by category, then name
      {
        $group: {
          _id: "$category",
          items: { $push: "$$ROOT" }
        }
      },
      { $sort: { _id: 1 } } // Sort categories alphabetically
    ]);
    
    if (menuItems.length === 0) {
      return res.status(200).json({ 
        message: `No menu items found for this ${sourceType}`,
        menuItems: []
      });
    }
    
    // Get source details
    const sourceModel = sourceType === 'restaurant' ? Restaurant : Chef;
    const source = await sourceModel.findById(sourceId).select('name kitchenName profilePicture rating');
    const sourceName = sourceType === 'restaurant' ? source.name : `${source.name} (${source.kitchenName})`;
    
    res.status(200).json({ 
      source: {
        _id: sourceId,
        name: sourceName,
        profilePicture: source.profilePicture,
        rating: source.rating,
        type: sourceType
      },
      menuItems,
      totalCategories: menuItems.length,
      totalItems: menuItems.reduce((acc, category) => acc + category.items.length, 0)
    });
  } catch (err) {
    console.error(`Error fetching menu items:`, err);
    res.status(500).json({ message: `Failed to fetch menu items`, error: err.message });
  }
};

// Get similar menu items
exports.getSimilarMenuItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    // Get the reference menu item
    const menuItem = await MenuItem.findById(id);
    
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    // Build query for similar items
    const query = {
      _id: { $ne: id }, // Exclude the current item
      $or: [
        // Same category
        { category: menuItem.category },
        // Similar price range (±20%)
        {
          price: {
            $gte: menuItem.price * 0.8,
            $lte: menuItem.price * 1.2
          }
        }
      ]
    };
    
    // Add source filter (either same restaurant or same chef)
    if (menuItem.restaurantId) {
      query.restaurantId = menuItem.restaurantId;
    } else if (menuItem.chefId) {
      query.chefId = menuItem.chefId;
    }
    
    // Find similar items
    const similarItems = await MenuItem.find(query)
      .limit(parseInt(limit))
      .populate('restaurantId', 'name')
      .populate('chefId', 'name kitchenName');
    
    res.status(200).json(similarItems);
  } catch (err) {
    console.error('Error fetching similar menu items:', err);
    res.status(500).json({ message: "Failed to fetch similar menu items", error: err.message });
  }
};