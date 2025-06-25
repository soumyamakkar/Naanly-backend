const Chef = require('../models/chefModel');
const { MenuItem } = require('../models/menuItemModel');
const MealBox = require('../models/mealBoxModel');
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
    const chefData = { ...req.body };
    // If a file is uploaded, set the profilePicture field
    if (req.files && req.files.profilePicture && req.files.profilePicture[0] && req.files.profilePicture[0].path) {
      chefData.profilePicture = req.files.profilePicture[0].path;
    } else if (req.file && req.file.fieldname === 'profilePicture' && req.file.path) {
      chefData.profilePicture = req.file.path;
    }
    // If a file is uploaded, set the coverPhoto field
    if (req.files && req.files.coverPhoto && req.files.coverPhoto[0] && req.files.coverPhoto[0].path) {
      chefData.coverPhoto = req.files.coverPhoto[0].path;
    } else if (req.file && req.file.fieldname === 'coverPhoto' && req.file.path) {
      chefData.coverPhoto = req.file.path;
    }
    // Parse JSON fields if sent as text in form-data
    if (chefData.specialities && typeof chefData.specialities === 'string') {
      try { chefData.specialities = JSON.parse(chefData.specialities); } catch {}
    }
    if (chefData.cuisines && typeof chefData.cuisines === 'string') {
      try { chefData.cuisines = JSON.parse(chefData.cuisines); } catch {}
    }
    if (chefData.filters && typeof chefData.filters === 'string') {
      try { chefData.filters = JSON.parse(chefData.filters); } catch {}
    }
    if (chefData.kitchenImages && typeof chefData.kitchenImages === 'string') {
      try { chefData.kitchenImages = JSON.parse(chefData.kitchenImages); } catch {}
    }
    if (chefData.location && typeof chefData.location === 'string') {
      try { chefData.location = JSON.parse(chefData.location); } catch {}
    }
    if (chefData.availability && typeof chefData.availability === 'string') {
      try { chefData.availability = JSON.parse(chefData.availability); } catch {}
    }
    if (chefData.serviceArea && typeof chefData.serviceArea === 'string') {
      try { chefData.serviceArea = JSON.parse(chefData.serviceArea); } catch {}
    }
    if (chefData.requestSettings && typeof chefData.requestSettings === 'string') {
      try { chefData.requestSettings = JSON.parse(chefData.requestSettings); } catch {}
    }
    if (chefData.contactInfo && typeof chefData.contactInfo === 'string') {
      try { chefData.contactInfo = JSON.parse(chefData.contactInfo); } catch {}
    }
    if (chefData.socialMedia && typeof chefData.socialMedia === 'string') {
      try { chefData.socialMedia = JSON.parse(chefData.socialMedia); } catch {}
    }
    const chef = new Chef(chefData);
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
    // Parse JSON fields if sent as text in form-data
    if (menuItemData.keyIngredients && typeof menuItemData.keyIngredients === 'string') {
      try { menuItemData.keyIngredients = JSON.parse(menuItemData.keyIngredients); } catch {}
    }
    if (menuItemData.allergens && typeof menuItemData.allergens === 'string') {
      try { menuItemData.allergens = JSON.parse(menuItemData.allergens); } catch {}
    }
    if (menuItemData.tags && typeof menuItemData.tags === 'string') {
      try { menuItemData.tags = JSON.parse(menuItemData.tags); } catch {}
    }
    if (menuItemData.customizationOptions && typeof menuItemData.customizationOptions === 'string') {
      try { menuItemData.customizationOptions = JSON.parse(menuItemData.customizationOptions); } catch {}
    }
    if (menuItemData.nutritionInfo && typeof menuItemData.nutritionInfo === 'string') {
      try { menuItemData.nutritionInfo = JSON.parse(menuItemData.nutritionInfo); } catch {}
    }
    if (menuItemData.specialOffer && typeof menuItemData.specialOffer === 'string') {
      try { menuItemData.specialOffer = JSON.parse(menuItemData.specialOffer); } catch {}
    }
    if (menuItemData.popularity && typeof menuItemData.popularity === 'string') {
      try { menuItemData.popularity = JSON.parse(menuItemData.popularity); } catch {}
    }
    // If a file is uploaded, set the photo field
    if (req.file && req.file.path) {
      menuItemData.photo = req.file.path;
    }
    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Create a new meal box
exports.addMealBox = async (req, res) => {
  try {
    const { id: chefId } = req.params; // Chef ID from URL
    
    // Check if chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Parse the request body
    let mealBoxData = {
      ...req.body,
      chefId
    };
    
    // Handle nested JSON objects if they're sent as strings
    if (mealBoxData.dishes && typeof mealBoxData.dishes === 'string') {
      try { mealBoxData.dishes = JSON.parse(mealBoxData.dishes); } catch {}
    }
    
    if (mealBoxData.customizationOptions && typeof mealBoxData.customizationOptions === 'string') {
      try { mealBoxData.customizationOptions = JSON.parse(mealBoxData.customizationOptions); } catch {}
    }
    
    if (mealBoxData.tags && typeof mealBoxData.tags === 'string') {
      try { mealBoxData.tags = JSON.parse(mealBoxData.tags); } catch {}
    }
    
    // If a photo was uploaded
    if (req.file && req.file.path) {
      mealBoxData.photo = req.file.path;
    }
    
    // Validate that all menu items exist and belong to this chef
    if (mealBoxData.dishes && Array.isArray(mealBoxData.dishes)) {
      const menuItemIds = mealBoxData.dishes.map(dish => dish.menuItem);
      const menuItems = await MenuItem.find({
        _id: { $in: menuItemIds },
        chefId
      });
      
      if (menuItems.length !== menuItemIds.length) {
        return res.status(400).json({ 
          message: "One or more menu items don't exist or don't belong to this chef"
        });
      }
      
      // Determine if the meal box is vegetarian based on the menu items
      const allVeg = menuItems.every(item => item.isVeg === true);
      mealBoxData.isVeg = allVeg;
    }
    
    const mealBox = new MealBox(mealBoxData);
    await mealBox.save();
    
    // Populate the dishes with full menu item details for the response
    const populatedMealBox = await MealBox.findById(mealBox._id)
      .populate('dishes.menuItem', 'name description price isVeg photo');
    
    res.status(201).json(populatedMealBox);
  } catch (err) {
    console.error("Error creating meal box:", err);
    res.status(400).json({ message: "Failed to create meal box", error: err.message });
  }
};

// Get all meal boxes for a chef
exports.getChefMealBoxes = async (req, res) => {
  try {
    const { id: chefId } = req.params;
    
    const mealBoxes = await MealBox.find({ chefId, isActive: true })
      .populate('dishes.menuItem', 'name description price isVeg photo');
    
    res.status(200).json(mealBoxes);
  } catch (err) {
    console.error("Error fetching chef's meal boxes:", err);
    res.status(500).json({ message: "Failed to fetch meal boxes", error: err.message });
  }
};

// Add a combo to chef's menu
exports.addCombo = async (req, res) => {
  try {
    const { id: chefId } = req.params;
    
    // Check if chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Parse the request body
    let comboData = { ...req.body };
    
    // Handle nested JSON objects if they're sent as strings
    if (comboData.items && typeof comboData.items === 'string') {
      try { comboData.items = JSON.parse(comboData.items); } catch {}
    }
    
    // If a photo was uploaded
    if (req.file && req.file.path) {
      comboData.photo = req.file.path;
    }
    
    // Validate that all menu items exist and belong to this chef
    if (comboData.items && Array.isArray(comboData.items)) {
      const menuItemIds = comboData.items.map(item => item.menuItemId);
      const menuItems = await MenuItem.find({
        _id: { $in: menuItemIds },
        chefId
      });
      
      if (menuItems.length !== menuItemIds.length) {
        return res.status(400).json({ 
          message: "One or more menu items don't exist or don't belong to this chef"
        });
      }
      
      // Determine if the combo is vegetarian based on the menu items
      const allVeg = menuItems.every(item => item.isVeg === true);
      comboData.isVeg = allVeg;
    }
    
    // Add combo to chef
    chef.combos.push(comboData);
    await chef.save();
    
    // Get the newly added combo
    const newCombo = chef.combos[chef.combos.length - 1];
    
    res.status(201).json({
      message: "Combo added successfully",
      combo: {
        id: newCombo._id,
        name: newCombo.name,
        price: newCombo.price,
        isVeg: newCombo.isVeg,
        photo: newCombo.photo || "",
        items: newCombo.items
      }
    });
  } catch (err) {
    console.error("Error adding combo:", err);
    res.status(500).json({ message: "Failed to add combo", error: err.message });
  }
};

// Get all combos for a chef
exports.getCombos = async (req, res) => {
  try {
    const { id: chefId } = req.params;
    
    const chef = await Chef.findById(chefId)
      .select('combos')
      .populate('combos.items.menuItemId', 'name photo price isVeg');
    
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Filter active combos and format response
    const combos = chef.combos
      .filter(combo => combo.isActive)
      .map(combo => ({
        id: combo._id,
        name: combo.name,
        description: combo.description,
        price: combo.price,
        isVeg: combo.isVeg,
        photo: combo.photo || "",
        items: combo.items.map(item => ({
          menuItemId: item.menuItemId._id,
          name: item.menuItemId.name,
          quantity: item.quantity,
          price: item.menuItemId.price,
          isVeg: item.menuItemId.isVeg,
          photo: item.menuItemId.photo || ""
        }))
      }));
    
    res.status(200).json({ combos });
  } catch (err) {
    console.error("Error fetching combos:", err);
    res.status(500).json({ message: "Failed to fetch combos", error: err.message });
  }
};

// Update a combo
exports.updateCombo = async (req, res) => {
  try {
    const { id: chefId, comboId } = req.params;
    const updateData = { ...req.body };
    
    // If a photo was uploaded
    if (req.file && req.file.path) {
      updateData.photo = req.file.path;
    }
    
    // Handle nested JSON objects if they're sent as strings
    if (updateData.items && typeof updateData.items === 'string') {
      try { updateData.items = JSON.parse(updateData.items); } catch {}
    }
    
    // Find the chef
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Find combo index
    const comboIndex = chef.combos.findIndex(combo => combo._id.toString() === comboId);
    if (comboIndex === -1) {
      return res.status(404).json({ message: "Combo not found" });
    }
    
    // Update combo fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'items') { // Handle items separately
        chef.combos[comboIndex][key] = updateData[key];
      }
    });
    
    // Update items if provided
    if (updateData.items && Array.isArray(updateData.items)) {
      // Validate items
      const menuItemIds = updateData.items.map(item => item.menuItemId);
      const menuItems = await MenuItem.find({
        _id: { $in: menuItemIds },
        chefId
      });
      
      if (menuItems.length !== menuItemIds.length) {
        return res.status(400).json({ 
          message: "One or more menu items don't exist or don't belong to this chef"
        });
      }
      
      // Update items
      chef.combos[comboIndex].items = updateData.items;
      
      // Update vegetarian status based on items
      const allVeg = menuItems.every(item => item.isVeg === true);
      chef.combos[comboIndex].isVeg = allVeg;
    }
    
    await chef.save();
    
    res.status(200).json({
      message: "Combo updated successfully",
      combo: chef.combos[comboIndex]
    });
  } catch (err) {
    console.error("Error updating combo:", err);
    res.status(500).json({ message: "Failed to update combo", error: err.message });
  }
};

// Delete a combo (soft delete by setting isActive to false)
exports.deleteCombo = async (req, res) => {
  try {
    const { id: chefId, comboId } = req.params;
    
    const result = await Chef.updateOne(
      { _id: chefId, "combos._id": comboId },
      { $set: { "combos.$.isActive": false } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Chef or combo not found" });
    }
    
    res.status(200).json({ message: "Combo deleted successfully" });
  } catch (err) {
    console.error("Error deleting combo:", err);
    res.status(500).json({ message: "Failed to delete combo", error: err.message });
  }
};