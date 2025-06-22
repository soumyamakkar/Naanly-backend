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
    
    const today = new Date();
    
    // First find nearby restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000 // convert to meters
        }
      }
    }).select('_id name');
    
    // Find nearby chefs
    const nearbyChefs = await Chef.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000 
        }
      }
    }).select('_id name kitchenName');
    
    // Get restaurant IDs and chef IDs
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
    .populate('restaurantId', 'name')
    .populate('chefId', 'name kitchenName')
    .limit(15);
    
    res.status(200).json({ todaySpecials });
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
      { path: 'restaurantId', select: 'name' },
      { path: 'chefId', select: 'name kitchenName' }
    ]);
    
    res.status(200).json({ popularDishes: populatedDishes });
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
    .select('name kitchenName profilePicture location.address rating totalRatings cuisines specialities');
    
    res.status(200).json({ topKitchens });
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
          profilePicture: 1,
          rating: 1,
          totalRatings: 1,
          distance: 1, // Distance in meters
          cuisines: 1,
          specialities: 1,
          "location.address": 1,
          popularityScore: 1
        } 
      }
    ]);
    
    res.status(200).json({ 
      popularChefs: popularChefs.map(chef => ({
        ...chef,
        distance: (chef.distance / 1000).toFixed(1) // Convert to km for display
      })) 
    });
  } catch (err) {
    console.error("Get popular chefs error:", err);
    res.status(500).json({ message: "Failed to fetch popular chefs" });
  }
};