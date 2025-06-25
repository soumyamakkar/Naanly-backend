const Chef = require('../models/chefModel');
const Restaurant = require('../models/restaurantModel');
const { MenuItem } = require('../models/menuItemModel');
const User = require('../models/userModel');
const MealBox = require('../models/mealBoxModel');
const mongoose = require('mongoose');

// Get Today's Specials
exports.getMenuItems = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      lat, 
      lng, 
      radius = 5,
      filter, // "today-special", "pure-veg", "high-protein", "salads", "thali", "popular"
      limit = 15
    } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location coordinates required" });
    }
    
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const today = new Date();
    
    // Find nearby restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: parseFloat(radius) * 1000 // meters
        }
      }
    }).select('_id name photos');
    
    // Find nearby chefs
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('_id name kitchenName profilePicture');
    
    const restaurantIds = nearbyRestaurants.map(r => r._id);
    const chefIds = nearbyChefs.map(c => c._id);
    
    // Base query conditions - always applied
    const baseQuery = {
      $or: [
        { restaurantId: { $in: restaurantIds } },
        { chefId: { $in: chefIds } }
      ]
    };
    
    // Apply filter-specific conditions
    let filterQuery = { ...baseQuery };
    let sortOptions = {};
    let responseKey = 'menuItems';
    
    if (filter) {
      switch(filter) {
        case 'today-special':
          filterQuery = {
            ...baseQuery,
            'specialOffer.isSpecial': true,
            'specialOffer.validFrom': { $lte: today },
            'specialOffer.validUntil': { $gte: today }
          };
          responseKey = 'todaySpecials';
          break;
          
        case 'pure-veg':
          filterQuery = {
            ...baseQuery,
            isVeg: true
          };
          responseKey = 'pureVegItems';
          break;
          
        case 'high-protein':
          filterQuery = {
            ...baseQuery,
            "nutritionInfo.protein": { $gt: 15 } // Items with more than 15g protein
          };
          sortOptions = { "nutritionInfo.protein": -1 }; // Highest protein first
          responseKey = 'highProteinItems';
          break;
          
        case 'salads':
          filterQuery = {
            ...baseQuery,
            tags: { $in: [/salad/i] } // Case-insensitive search for salad
          };
          responseKey = 'saladItems';
          break;
          
        case 'thali':
          filterQuery = {
            ...baseQuery,
            tags: { $in: [/thali/i] } // Case-insensitive search for thali
          };
          responseKey = 'thaliItems';
          break;
      }
    }
    
    let menuItems;
    
    // Special handling for 'popular' filter as it requires aggregation
    if (filter === 'popular') {
      responseKey = 'popularDishes';
      
      // Get popular dishes using aggregation
      const popularDishes = await MenuItem.aggregate([
        {
          $match: baseQuery
        },
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "menuItemId",
            as: "ratings"
          }
        },
        {
          $addFields: {
            averageRating: { $avg: "$ratings.rating" },
            totalRatings: { $size: "$ratings" },
            popularityScore: {
              $add: [
                { $multiply: [{ $ifNull: ["$popularity.orderCount", 0] }, 1] },
                { $multiply: [{ $ifNull: [{ $avg: "$ratings.rating" }, 0] }, 10] },
                {
                  $cond: {
                    if: { $gt: ["$popularity.lastOrderedAt", null] },
                    then: {
                      $divide: [
                        { $subtract: [new Date(), "$popularity.lastOrderedAt"] },
                        86400000 // milliseconds in a day
                      ]
                    },
                    else: 0
                  }
                }
              ]
            }
          }
        },
        { $sort: { popularityScore: -1 } },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1,
            name: 1,
            isVeg: 1,
            price: 1,
            photo: 1,
            preparationTime: 1,
            nutritionInfo: 1,
            restaurantId: 1,
            chefId: 1,
            averageRating: 1,
            totalRatings: 1
          }
        }
      ]);
      
      // Populate restaurant/chef details
      menuItems = await MenuItem.populate(popularDishes, [
        { path: 'restaurantId', select: 'name location' },
        { path: 'chefId', select: 'name kitchenName location' }
      ]);
    } else {
      // For all other filters, use regular find
      menuItems = await MenuItem.find(filterQuery)
        .sort(sortOptions)
        .populate('restaurantId', 'name location')
        .populate('chefId', 'name kitchenName location')
        .limit(parseInt(limit));
    }
    
    // Get user favorites if userId is provided
    let userFavorites = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId);
        
        if (user && user.favorites && user.favorites.length > 0) {
          userFavorites = user.favorites.map(fav => {
            if (fav.menuItem) {
              return fav.menuItem.toString();
            }
            return null;
          }).filter(id => id !== null);
        }
      } catch (favError) {
        console.error("Error fetching user favorites:", favError);
      }
    }
    
    // Haversine formula for distance calculation
    function haversine(lat1, lon1, lat2, lon2) {
      function toRad(x) { return x * Math.PI / 180; }
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    
    // Format response with only the requested fields
    const formattedItems = menuItems.map(item => {
      let distance = null;
      let kitchenName = null;
      let sourceCoordinates = null;
      
      if (item.restaurantId && item.restaurantId.location) {
        kitchenName = item.restaurantId.name;
        sourceCoordinates = item.restaurantId.location.coordinates;
      } else if (item.chefId) {
        kitchenName = item.chefId.kitchenName;
        sourceCoordinates = item.chefId.location?.coordinates;
      }
      
      if (sourceCoordinates) {
        distance = haversine(userLat, userLng, sourceCoordinates[1], sourceCoordinates[0]);
      }
      
      return {
        menuItemId: item._id,
        name: item.name,
        kitchenName,
        preparationTime: item.preparationTime || 30,
        isVeg: item.isVeg,
        distance: distance !== null ? Number(distance.toFixed(1)) : null,
        nutritionInfo: item.nutritionInfo || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          servingSize: "1 serving"
        },
        rating: {
          average: filter === 'popular' ? item.averageRating || 0 : item.rating?.average || 0,
          count: filter === 'popular' ? item.totalRatings || 0 : item.rating?.count || 0
        },
        photo: item.photo || "",
        isFavorite: userFavorites.includes(item._id.toString())
      };
    });
    
    res.status(200).json({ [responseKey]: formattedItems });
  } catch (err) {
    console.error(`Get menu items error (${req.query.filter || 'all'}):`, err);
    res.status(500).json({ message: "Failed to fetch menu items" });
  }
};

// Get Popular Dishes
exports.getPopularDishes = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, radius = 5 } = req.query; // radius in km
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location coordinates required" });
    }
    
    // Find nearby restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('_id');
    
    // Find nearby chefs
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('_id');
    
    const restaurantIds = nearbyRestaurants.map(r => r._id);
    const chefIds = nearbyChefs.map(c => c._id);
    
    // Get popular dishes using aggregation
    const popularDishes = await MenuItem.aggregate([
      {
        $match: {
          $or: [
            { restaurantId: { $in: restaurantIds.map(id => new mongoose.Types.ObjectId(id)) } },
            { chefId: { $in: chefIds.map(id => new mongoose.Types.ObjectId(id)) } }
          ]
        }
      },
      {
        $lookup: {
          from: "ratings",
          localField: "_id",
          foreignField: "menuItemId",
          as: "ratings"
        }
      },
      {
        $addFields: {
          averageRating: { $avg: "$ratings.rating" },
          totalRatings: { $size: "$ratings" },
          // Create a popularity score combining order count and ratings
          popularityScore: {
            $add: [
              { $multiply: [{ $ifNull: ["$popularity.orderCount", 0] }, 1] },  // Weight for order count
              { $multiply: [{ $ifNull: [{ $avg: "$ratings.rating" }, 0] }, 10] }, // Weight for ratings
              // Recency factor: more recent = higher score
              {
                $cond: {
                  if: { $gt: ["$popularity.lastOrderedAt", null] },
                  then: {
                    $divide: [
                      { $subtract: [new Date(), "$popularity.lastOrderedAt"] },
                      86400000 // milliseconds in a day
                    ]
                  },
                  else: 0
                }
              }
            ]
          }
        }
      },
      { $sort: { popularityScore: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 1,
          name: 1,
          isVeg: 1,
          price: 1,
          photo: 1,
          preparationTime: 1,
          nutritionInfo: 1,
          restaurantId: 1,
          chefId: 1,
          averageRating: 1,
          totalRatings: 1
        }
      }
    ]);
    
    // Populate restaurant/chef details
    const populatedDishes = await MenuItem.populate(popularDishes, [
      { path: 'restaurantId', select: 'name location' },
      { path: 'chefId', select: 'name kitchenName location' }
    ]);
    
    // Get user favorites if userId is provided
    let userFavorites = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId);
        
        if (user && user.favorites && user.favorites.length > 0) {
          userFavorites = user.favorites.map(fav => {
            if (fav.menuItem) {
              return fav.menuItem.toString();
            }
            return null;
          }).filter(id => id !== null);
        }
      } catch (favError) {
        console.error("Error fetching user favorites:", favError);
      }
    }
    
    // Haversine formula
    function haversine(lat1, lon1, lat2, lon2) {
      function toRad(x) { return x * Math.PI / 180; }
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    
    // Format response to match getTodaysSpecials
    const dishes = populatedDishes.map(item => {
      let distance = null;
      let kitchenName = null;
      let sourceCoordinates = null;
      
      if (item.restaurantId && item.restaurantId.location) {
        kitchenName = item.restaurantId.name;
        sourceCoordinates = item.restaurantId.location.coordinates;
      } else if (item.chefId) {
        kitchenName = item.chefId.kitchenName;
        sourceCoordinates = item.chefId.location?.coordinates;
      }
      
      if (sourceCoordinates) {
        distance = haversine(parseFloat(lat), parseFloat(lng), sourceCoordinates[1], sourceCoordinates[0]);
      }
      
      return {
        menuItemId: item._id,
        name: item.name,
        kitchenName,
        preparationTime: item.preparationTime || 30,
        isVeg: item.isVeg,
        distance: distance !== null ? Number(distance.toFixed(1)) : null, // in km, rounded to 1 decimal
        nutritionInfo: item.nutritionInfo || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          servingSize: "1 serving"
        },
        rating: {
          average: item.averageRating || 0,
          count: item.totalRatings || 0
        },
        photo: item.photo || "",
        isFavorite: userFavorites.includes(item._id.toString())
      };
    });
    
    res.status(200).json({ popularDishes: dishes });
  } catch (err) {
    console.error("Get popular dishes error:", err);
    res.status(500).json({ message: "Failed to fetch popular dishes" });
  }
};

// Get Top Home Kitchens
exports.getTopHomeKitchens = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, radius = 5, limit = 10 } = req.query; // radius in km
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location coordinates required" });
    }

    // Find top-rated chefs nearby
    const topKitchens = await Chef.find({
      isActive: true,
      // Only include chefs with at least 3 ratings
      rating: { $gt: 3 },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000 // meters
        }
      }
    })
    .sort({ rating: -1 }) // Sort by highest rating first
    .limit(parseInt(limit))
    .select('name kitchenName bio responseTime profilePicture coverPhoto location rating totalRatings isVegOnly');
    
    // Get user favorite chefs if userId is provided
    let userFavoriteChefs = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId)
          .select('favoriteChefs');
        
        if (user && user.favoriteChefs && user.favoriteChefs.length > 0) {
          userFavoriteChefs = user.favoriteChefs.map(chefId => chefId.toString());
        }
      } catch (favError) {
        console.error("Error fetching user favorite chefs:", favError);
      }
    }

    // Haversine formula
    function haversine(lat1, lon1, lat2, lon2) {
      function toRad(x) { return x * Math.PI / 180; }
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    
    // Format response with requested fields
    const kitchens = topKitchens.map(chef => {
      let distance = null;
      if (chef.location && chef.location.coordinates) {
        distance = haversine(parseFloat(lat), parseFloat(lng), chef.location.coordinates[1], chef.location.coordinates[0]);
      }
      return {
        chefId: chef._id,
        kitchenName: chef.kitchenName,
        chefName: chef.name,
        description: chef.bio || null,
        rating: {
          average: chef.rating || 0,
          count: chef.totalRatings || 0
        },
        isVeg: chef.isVegOnly || false,
        profilePicture: chef.profilePicture || "",
        coverPhoto: chef.coverPhoto || "",
        distance: distance !== null ? Number(distance.toFixed(1)) : null, // in km
        preparationTime: chef.responseTime || 30,
        isFavorite: userFavoriteChefs.includes(chef._id.toString())
      };
    });
    res.status(200).json({ topKitchens: kitchens });
  } catch (err) {
    console.error("Get top home kitchens error:", err);
    res.status(500).json({ message: "Failed to fetch top home kitchens" });
  }
};

// Get Popular Chefs
exports.getPopularChefs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, radius = 5, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location coordinates required" });
    }

    // Use aggregation to calculate chef popularity score
    const popularChefs = await Chef.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: "distance", // This will contain the calculated distance
          maxDistance: parseFloat(radius) * 1000, // Convert km to meters
          spherical: true
        }
      },
      {
        $match: { 
          isActive: true,
          // Must have some ratings
          totalRatings: { $gt: 0 } 
        }
      },
      {
        $addFields: {
          // Calculate popularity score
          popularityScore: {
            $add: [
              { $multiply: ["$rating", 20] }, // Rating weight
              { $multiply: [{ $ifNull: ["$sales.totalOrders", 0] }, 0.5] }, // Orders weight
              { $divide: [{ $ifNull: ["$sales.totalRevenue", 0] }, 100] } // Revenue weight (÷100 to normalize)
            ]
          }
        }
      },
      { $sort: { popularityScore: -1 } },
      { $limit: parseInt(limit) },
      { 
        $project: {
          _id: 1,
          name: 1,
          kitchenName: 1,
          bio: 1,
          rating: 1,
          totalRatings: 1,
          location: 1,
          responseTime: 1,
          isVegOnly: 1,
          profilePicture: 1,
          coverPhoto: 1,
          distance: 1
        } 
      }
    ]);
    
    // Get user favorite chefs if userId is provided
    let userFavoriteChefs = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId)
          .select('favoriteChefs');
        
        if (user && user.favoriteChefs && user.favoriteChefs.length > 0) {
          userFavoriteChefs = user.favoriteChefs.map(chefId => chefId.toString());
        }
      } catch (favError) {
        console.error("Error fetching user favorite chefs:", favError);
      }
    }

    // Format response with requested fields
    const formattedChefs = popularChefs.map(chef => {
      return {
        chefId: chef._id,
        kitchenName: chef.kitchenName,
        chefName: chef.name,
        description: chef.bio || null,
        rating: {
          average: chef.rating || 0,
          count: chef.totalRatings || 0
        },
        isVeg: chef.isVegOnly || false,
        profilePicture: chef.profilePicture || "",
        coverPhoto: chef.coverPhoto || "",
        distance: chef.distance ? Number((chef.distance / 1000).toFixed(1)) : null, // Convert meters to km
        preparationTime: chef.responseTime || 30,
        isFavorite: userFavoriteChefs.includes(chef._id.toString())
      };
    });

    res.status(200).json({ 
      popularChefs: formattedChefs
    });
  } catch (err) {
    console.error("Get popular chefs error:", err);
    res.status(500).json({ message: "Failed to fetch popular chefs" });
  }
};

// Get meal boxes for you
exports.getMealBoxesForYou = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, radius = 5, limit = 20 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location coordinates required" });
    }
    
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    
    // Find nearby chefs first
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: parseFloat(radius) * 1000 // meters
        }
      }
    }).select('_id name kitchenName location');
    
    const chefIds = nearbyChefs.map(chef => chef._id);
    
    // Find top meal boxes from these chefs
    const mealBoxes = await MealBox.find({
      chefId: { $in: chefIds },
      isActive: true
    })
    .sort({ 'rating.average': -1, 'popularity.orderCount': -1 })
    .limit(parseInt(limit))
    .populate('dishes.menuItem', 'name') // Just get the menu item names
    .populate('chefId', 'name kitchenName profilePicture'); // Get chef details
    
    // Get user favorites if userId is provided
    let userFavorites = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId);
        
        if (user && user.favoriteMealBoxes && user.favoriteMealBoxes.length > 0) {
          userFavorites = user.favoriteMealBoxes.map(mealBox => mealBox.toString());
        }
      } catch (favError) {
        console.error("Error fetching user favorite meal boxes:", favError);
      }
    }
    
    // Calculate distance using Haversine formula
    function haversine(lat1, lon1, lat2, lon2) {
      function toRad(x) { return x * Math.PI / 180; }
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    
    // Format response with only the requested fields
    const formattedMealBoxes = mealBoxes.map(mealBox => {
      let distance = null;
      if (mealBox.chefId && mealBox.chefId.location && mealBox.chefId.location.coordinates) {
        const coords = mealBox.chefId.location.coordinates;
        distance = haversine(userLat, userLng, coords[1], coords[0]);
      }
      
      return {
        mealBoxId: mealBox._id,
        name: mealBox.name,
        kitchenName: mealBox.chefId ? mealBox.chefId.kitchenName : null,
        photo: mealBox.photo || "",
        isVeg: mealBox.isVeg,
        distance: distance !== null ? Number(distance.toFixed(1)) : null,
        dishes: mealBox.dishes.map(dish => dish.menuItem.name),
        rating: {
          average: mealBox.rating?.average || 0,
          count: mealBox.rating?.count || 0
        },
        isFavorite: userFavorites.includes(mealBox._id.toString())
      };
    });
    
    res.status(200).json({ mealBoxesForYou: formattedMealBoxes });
  } catch (err) {
    console.error("Get meal boxes for you error:", err);
    res.status(500).json({ message: "Failed to fetch meal boxes", error: err.message });
  }
};

// Get detailed menu item information for home page
exports.getMenuItemDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;
    const { lat, lng } = req.query; // For calculating distance to kitchen
    
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    
    // Fetch the menu item with all necessary populated fields
    const menuItem = await MenuItem.findById(itemId)
      .populate('restaurantId', 'name location rating coverPhoto')
      .populate('chefId', 'name kitchenName location rating profilePicture coverPhoto')
      .populate('pairingSuggestions');
    
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    // Determine source (restaurant or chef)
    const sourceType = menuItem.restaurantId ? 'restaurant' : 'chef';
    const source = menuItem.restaurantId || menuItem.chefId;
    
    // Check if user has favorited this item
    let isFavorite = false;
    if (userId) {
      const user = await User.findById(userId).select('favorites');
      if (user && user.favorites) {
        isFavorite = user.favorites.some(fav => fav.menuItem && fav.menuItem.toString() === itemId);
      }
    }
    
    // Calculate distance if coordinates provided
    let distance = null;
    if (lat && lng && source && source.location && source.location.coordinates) {
      distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lng), 
        source.location.coordinates[1], 
        source.location.coordinates[0]
      );
    }
    
    // Get more dishes from the same kitchen (top 5)
    let moreDishes = [];
    const query = sourceType === 'restaurant' 
      ? { restaurantId: source._id, _id: { $ne: itemId } }
      : { chefId: source._id, _id: { $ne: itemId } };
    
    moreDishes = await MenuItem.find(query)
      .sort({ 'rating.average': -1 })
      .limit(5)
      .lean();
    
    // Check if these dishes are favorited
    if (userId && moreDishes.length > 0) {
      const user = await User.findById(userId).select('favorites');
      if (user && user.favorites) {
        const favoritedItems = user.favorites.map(fav => fav.menuItem && fav.menuItem.toString());
        moreDishes = moreDishes.map(dish => ({
          ...dish,
          isFavorite: favoritedItems.includes(dish._id.toString())
        }));
      }
    }
    
    // Format more dishes
    const formattedMoreDishes = moreDishes.map(dish => ({
      itemId: dish._id,
      name: dish.name,
      kitchenName: sourceType === 'restaurant' ? source.name : source.kitchenName,
      isVeg: dish.isVeg,
      isFavorite: dish.isFavorite || false,
      rating: {
        average: dish.rating?.average || 0,
        count: dish.rating?.count || 0
      },
      distance: distance,
      preparationTime: dish.preparationTime || 30
    }));
    
    // Get pairing suggestions - first check if explicitly defined in model
    let pairingSuggestions = [];
    
    if (menuItem.pairingSuggestions && menuItem.pairingSuggestions.length > 0) {
      // Use explicitly defined pairing suggestions
      pairingSuggestions = menuItem.pairingSuggestions.map(item => ({
        itemId: item._id,
        name: item.name,
        category: item.category,
        isVeg: item.isVeg,
        photo: item.photo || ""
      }));
    } 
    // If not enough explicit suggestions, try to generate some
    else if (menuItem.tags && menuItem.tags.length > 0) {
      // Define complementary categories based on the current item
      let complementaryCategories = [];
      
      if (menuItem.category === 'Main Course') {
        complementaryCategories = ['Sides', 'Rice', 'Bread', 'Dessert', 'Beverages'];
      } else if (menuItem.category === 'Appetizer') {
        complementaryCategories = ['Main Course', 'Beverages'];
      } else if (menuItem.category === 'Beverages') {
        complementaryCategories = ['Snacks', 'Dessert', 'Appetizer'];
      } else if (menuItem.category === 'Dessert') {
        complementaryCategories = ['Beverages', 'Main Course'];
      } else {
        complementaryCategories = ['Main Course', 'Beverages', 'Dessert'];
      }
      
      // Find items from the same kitchen with complementary categories
      const suggestedItems = await MenuItem.find({
        ...query,
        category: { $in: complementaryCategories }
      })
      .sort({ 'rating.average': -1 })
      .limit(3)
      .select('_id name category isVeg photo')
      .lean();
      
      // If we don't have enough items, try finding items with similar tags
      if (suggestedItems.length < 3) {
        const additionalItems = await MenuItem.find({
          ...query,
          tags: { $in: menuItem.tags },
          _id: { $nin: suggestedItems.map(item => item._id) }
        })
        .sort({ 'rating.average': -1 })
        .limit(3 - suggestedItems.length)
        .select('_id name category isVeg photo')
        .lean();
        
        pairingSuggestions = [...suggestedItems, ...additionalItems].map(item => ({
          itemId: item._id,
          name: item.name,
          category: item.category,
          isVeg: item.isVeg,
          photo: item.photo || ""
        }));
      } else {
        pairingSuggestions = suggestedItems.map(item => ({
          itemId: item._id,
          name: item.name,
          category: item.category,
          isVeg: item.isVeg,
          photo: item.photo || ""
        }));
      }
    }
    
    // Determine if the item is "Highly Popular" using internal logic
    // Criteria: 
    // 1. At least 10 ratings
    // 2. Average rating at least 4.2
    // 3. Been ordered at least 50 times OR top 10% of ordered items
    const isHighlyPopular = (
      (menuItem.rating?.count >= 10) && 
      (menuItem.rating?.average >= 4.2) && 
      (menuItem.popularity?.orderCount >= 50)
    );
    
    // Format the final response
    const response = {
      itemDetails: {
        name: menuItem.name,
        madeBy: sourceType === 'restaurant' ? source.name : source.kitchenName,
        price: menuItem.price,
        isVeg: menuItem.isVeg,
        isFavorite: isFavorite,
        preparationTime: menuItem.preparationTime || 30,
        rating: {
          average: menuItem.rating?.average || 0,
          count: menuItem.rating?.count || 0
        },
        description: menuItem.description || "",
        keyIngredients: menuItem.keyIngredients || [],
        allergens: menuItem.allergens || [],
        oilType: menuItem.oilType || "Not specified",
        pairingSuggestions: pairingSuggestions,
        isHighlyPopular: isHighlyPopular,
        distance: distance // Added distance to kitchen
      },
      preparedBy: {
        name: sourceType === 'restaurant' ? source.name : source.kitchenName,
        chefName: sourceType === 'chef' ? source.name : null,
        profilePicture: sourceType === 'chef' ? source.profilePicture : null,
        coverPhoto: sourceType === 'chef' ? source.coverPhoto : 
                   (sourceType === 'restaurant' ? source.coverPhoto : null), // Added cover photo
        rating: source.rating || 0
      },
      moreDishes: formattedMoreDishes
    };
    
    res.status(200).json(response);
  } catch (err) {
    console.error("Get menu item details error:", err);
    res.status(500).json({ message: "Failed to fetch menu item details" });
  }
};

// Helper function to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1)); // Distance in km rounded to 1 decimal
}