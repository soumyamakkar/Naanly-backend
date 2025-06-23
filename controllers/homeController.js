const Chef = require('../models/chefModel');
const Restaurant = require('../models/restaurantModel');
const { MenuItem } = require('../models/menuItemModel');
const mongoose = require('mongoose');

// Get Today's Specials
exports.getTodaysSpecials = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query; // radius in km
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
    }).select('_id name location');
    // Find nearby chefs
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('_id name kitchenName location');
    const restaurantIds = nearbyRestaurants.map(r => r._id);
    const chefIds = nearbyChefs.map(c => c._id);
    // Find daily specials from those restaurants and chefs
    const todaySpecials = await MenuItem.find({
      $or: [
        { restaurantId: { $in: restaurantIds } },
        { chefId: { $in: chefIds } }
      ],
      'specialOffer.isSpecial': true,
      'specialOffer.validFrom': { $lte: today },
      'specialOffer.validUntil': { $gte: today }
    })
      .populate('restaurantId', 'name location')
      .populate('chefId', 'kitchenName location')
      .limit(15);
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
    // Format response
    const specials = todaySpecials.map(item => {
      let source = null;
      let sourceType = null;
      if (item.restaurantId && item.restaurantId.location) {
        source = item.restaurantId.location;
        sourceType = 'restaurant';
      } else if (item.chefId && item.chefId.location) {
        source = item.chefId.location;
        sourceType = 'chef';
      }
      let distance = null;
      if (source && source.coordinates) {
        distance = haversine(userLat, userLng, source.coordinates[1], source.coordinates[0]);
      }
      return {
        menuItemId: item._id,
        name: item.name,
        kitchenName: item.chefId && item.chefId.kitchenName ? item.chefId.kitchenName : null,
        preparationTime: item.preparationTime,
        isVeg: item.isVeg,
        distance: distance !== null ? Number(distance.toFixed(2)) : null, // in km
        nutritionInfo: item.nutritionInfo || null,
        rating: item.rating || { average: 0, count: 0 }
      };
    });
    res.status(200).json({ todaySpecials: specials });
  } catch (err) {
    console.error("Get today's specials error:", err);
    res.status(500).json({ message: "Failed to fetch today's specials" });
  }
};

// Get Popular Dishes
exports.getPopularDishes = async (req, res) => {
  try {
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
              { $multiply: ["$popularity.orderCount", 1] },  // Weight for order count
              { $multiply: [{ $avg: "$ratings.rating" }, 10] }, // Weight for ratings
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
      { $limit: 15 }
    ]);
    
    // Populate restaurant/chef details
    const populatedDishes = await MenuItem.populate(popularDishes, [
      { path: 'restaurantId', select: 'name location' },
      { path: 'chefId', select: 'name kitchenName location' }
    ]);
    
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
    // Format response
    const dishes = populatedDishes.map(item => {
      let sourceName = null;
      let source = null;
      if (item.restaurantId && item.restaurantId.name) {
        sourceName = item.restaurantId.name;
        if (item.restaurantId.location && item.restaurantId.location.coordinates) {
          source = item.restaurantId.location.coordinates;
        }
      } else if (item.chefId && item.chefId.kitchenName) {
        sourceName = item.chefId.kitchenName;
        if (item.chefId.location && item.chefId.location.coordinates) {
          source = item.chefId.location.coordinates;
        }
      }
      let distance = null;
      if (source && Array.isArray(source)) {
        distance = haversine(parseFloat(lat), parseFloat(lng), source[1], source[0]);
      }
      return {
        menuItemId: item._id,
        name: item.name,
        sourceName,
        preparationTime: item.preparationTime,
        isVeg: item.isVeg,
        price: item.price,
        distance: distance !== null ? Number(distance.toFixed(2)) : null, // in km
        rating: item.rating || { average: 0, count: 0 }
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
    .select('name kitchenName bio responseTime profilePicture location rating totalRatings cuisines specialities isVegOnly');
    
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
    // Format response
    const kitchens = topKitchens.map(chef => {
      let distance = null;
      if (chef.location && chef.location.coordinates) {
        distance = haversine(parseFloat(lat), parseFloat(lng), chef.location.coordinates[1], chef.location.coordinates[0]);
      }
      return {
        chefId: chef._id,
        kitchenName: chef.kitchenName,
        chefName: chef.name,
        bio: chef.bio || null,
        rating: chef.rating,
        isVeg: chef.isVegOnly,
        distance: distance !== null ? Number(distance.toFixed(2)) : null, // in km
        responseTime: chef.responseTime || null
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
              { $multiply: ["$sales.totalOrders", 0.5] }, // Orders weight
              { $divide: ["$sales.totalRevenue", 100] } // Revenue weight (÷100 to normalize)
            ]
          }
        }
      },
      { $sort: { popularityScore: -1 } },
      { $limit: parseInt(limit) },
      { 
        $project: {
          name: 1,
          kitchenName: 1,
          bio: 1,
          rating: 1,
          location: 1,
          responseTime: 1,
          isVegOnly: 1
        } 
      }
    ]);

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

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    res.status(200).json({ 
      popularChefs: popularChefs.map(chef => {
        let distance = null;
        if (chef.location && chef.location.coordinates) {
          distance = haversine(userLat, userLng, chef.location.coordinates[1], chef.location.coordinates[0]);
        }
        return {
          chefName: chef.name,
          kitchenName: chef.kitchenName,
          bio: chef.bio || null,
          rating: chef.rating,
          distance: distance !== null ? Number(distance.toFixed(2)) : null, // in km
          preparationTime: chef.responseTime || null,
          isVeg: chef.isVegOnly || false
        };
      })
    });
  } catch (err) {
    console.error("Get popular chefs error:", err);
    res.status(500).json({ message: "Failed to fetch popular chefs" });
  }
};