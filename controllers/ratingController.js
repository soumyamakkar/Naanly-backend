const Rating = require('../models/ratingModel');
const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const Chef = require('../models/chefModel');
const { uploadRatingImages } = require('../config/cloudinary');
const mongoose = require('mongoose');

// Submit a new rating
exports.submitRating = async (req, res) => {
  const userId = req.user.id;
  const { 
    orderId, 
    rating, 
    comment, 
    tags = [] 
  } = req.body;

  // Validate required fields
  if (!orderId || !rating) {
    return res.status(400).json({ 
      message: "Order ID and rating are required" 
    });
  }

  // Validate rating range
  const ratingValue = parseInt(rating);
  if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ 
      message: "Rating must be between 1 and 5" 
    });
  }

  try {
    // Get order details to determine if it's for a restaurant or chef
    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      status: 'delivered' // Only allow ratings for delivered orders
    });

    if (!order) {
      return res.status(404).json({ 
        message: "Order not found or not eligible for rating" 
      });
    }

    // Check if user has already rated this order
    const existingRating = await Rating.findOne({
      user: userId,
      orderId: orderId
    });

    if (existingRating) {
      return res.status(400).json({ 
        message: "You have already submitted a rating for this order" 
      });
    }

    // Create the rating object
    const ratingData = {
      user: userId,
      orderId: orderId,
      rating: ratingValue,
      comment: comment,
      tags: tags
    };

    // Add images if uploaded
    if (req.files && req.files.length > 0) {
      ratingData.images = req.files.map(file => file.path);
    }

    // Set either restaurantId or chefId based on order
    if (order.restaurantId) {
      ratingData.restaurantId = order.restaurantId;
    } else if (order.chefId) {
      ratingData.chefId = order.chefId;
    } else {
      return res.status(400).json({ 
        message: "Invalid order: missing restaurant or chef reference" 
      });
    }

    // Create the rating
    const newRating = new Rating(ratingData);
    await newRating.save();

    // Update the restaurant or chef average rating
    if (order.restaurantId) {
      await updateRestaurantRating(order.restaurantId);
    } else {
      await updateChefRating(order.chefId);
    }

    res.status(201).json({
      message: "Rating submitted successfully",
      rating: newRating
    });
  } catch (err) {
    console.error("Submit rating error:", err);
    res.status(500).json({ message: "Failed to submit rating", error: err.message });
  }
};

// Get ratings for a restaurant
exports.getRestaurantRatings = async (req, res) => {
  const { restaurantId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  try {
    // Build query
    const query = { restaurantId: restaurantId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort options
    let sortOption = {};
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'highest') {
      sortOption = { rating: -1 };
    } else if (sort === 'lowest') {
      sortOption = { rating: 1 };
    }

    // Get ratings with pagination
    const ratings = await Rating.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name profilePicture');

    // Get total count for pagination
    const total = await Rating.countDocuments(query);

    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({
      ratings,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + ratings.length < total
      }
    });
  } catch (err) {
    console.error("Get restaurant ratings error:", err);
    res.status(500).json({ message: "Failed to fetch ratings", error: err.message });
  }
};

// Get ratings for a chef
exports.getChefRatings = async (req, res) => {
  const { chefId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  try {
    // Build query
    const query = { chefId: chefId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort options
    let sortOption = {};
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'highest') {
      sortOption = { rating: -1 };
    } else if (sort === 'lowest') {
      sortOption = { rating: 1 };
    }

    // Get ratings with pagination
    const ratings = await Rating.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name profilePicture');

    // Get total count for pagination
    const total = await Rating.countDocuments(query);

    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { chefId: new mongoose.Types.ObjectId(chefId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({
      ratings,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + ratings.length < total
      }
    });
  } catch (err) {
    console.error("Get chef ratings error:", err);
    res.status(500).json({ message: "Failed to fetch ratings", error: err.message });
  }
};

// Get user's ratings
exports.getUserRatings = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get user's ratings with pagination
    const ratings = await Rating.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('restaurantId', 'name')
      .populate('chefId', 'name kitchenName')
      .populate('orderId', 'createdAt items');

    // Get total count for pagination
    const total = await Rating.countDocuments({ user: userId });

    res.status(200).json({
      ratings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + ratings.length < total
      }
    });
  } catch (err) {
    console.error("Get user ratings error:", err);
    res.status(500).json({ message: "Failed to fetch your ratings", error: err.message });
  }
};

// Edit a rating
exports.editRating = async (req, res) => {
  const userId = req.user.id;
  const { ratingId } = req.params;
  const { rating, comment, tags } = req.body;

  // Validate rating if provided
  if (rating) {
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ 
        message: "Rating must be between 1 and 5" 
      });
    }
  }

  try {
    // Find the rating and verify ownership
    const existingRating = await Rating.findOne({
      _id: ratingId,
      user: userId
    });

    if (!existingRating) {
      return res.status(404).json({ message: "Rating not found or not authorized" });
    }

    // Update the rating
    const updateData = {};
    if (rating) updateData.rating = parseInt(rating);
    if (comment !== undefined) updateData.comment = comment;
    if (tags) updateData.tags = tags;
    
    // Add new images if uploaded
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => file.path);
    }

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      updateData,
      { new: true }
    );

    // Update restaurant or chef average rating
    if (existingRating.restaurantId) {
      await updateRestaurantRating(existingRating.restaurantId);
    } else {
      await updateChefRating(existingRating.chefId);
    }

    res.status(200).json({
      message: "Rating updated successfully",
      rating: updatedRating
    });
  } catch (err) {
    console.error("Edit rating error:", err);
    res.status(500).json({ message: "Failed to update rating", error: err.message });
  }
};

// Delete a rating
exports.deleteRating = async (req, res) => {
  const userId = req.user.id;
  const { ratingId } = req.params;

  try {
    // Find the rating and verify ownership
    const existingRating = await Rating.findOne({
      _id: ratingId,
      user: userId
    });

    if (!existingRating) {
      return res.status(404).json({ message: "Rating not found or not authorized" });
    }

    // Store IDs before deletion
    const restaurantId = existingRating.restaurantId;
    const chefId = existingRating.chefId;

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);

    // Update restaurant or chef average rating
    if (restaurantId) {
      await updateRestaurantRating(restaurantId);
    } else if (chefId) {
      await updateChefRating(chefId);
    }

    res.status(200).json({
      message: "Rating deleted successfully"
    });
  } catch (err) {
    console.error("Delete rating error:", err);
    res.status(500).json({ message: "Failed to delete rating", error: err.message });
  }
};

// Check if an order can be rated
exports.checkRatingEligibility = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    // Check if order exists and is delivered
    const order = await Order.findOne({
      _id: orderId,
      userId: userId
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order is delivered
    const isDelivered = order.status === 'delivered';

    // Check if user has already rated this order
    const existingRating = await Rating.findOne({
      user: userId,
      orderId: orderId
    });

    const hasRated = !!existingRating;

    res.status(200).json({
      canRate: isDelivered && !hasRated,
      isDelivered,
      hasRated,
      ratingId: existingRating ? existingRating._id : null
    });
  } catch (err) {
    console.error("Check rating eligibility error:", err);
    res.status(500).json({ message: "Failed to check rating eligibility", error: err.message });
  }
};

// Get restaurant rating stats only
exports.getRestaurantRatings = async (req, res) => {
  const { restaurantId } = req.params;

  try {
    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({ stats });
  } catch (err) {
    console.error("Get restaurant rating stats error:", err);
    res.status(500).json({ message: "Failed to fetch rating stats", error: err.message });
  }
};

// Get chef rating stats only
exports.getChefRatings = async (req, res) => {
  const { chefId } = req.params;

  try {
    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { chefId: new mongoose.Types.ObjectId(chefId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({ stats });
  } catch (err) {
    console.error("Get chef rating stats error:", err);
    res.status(500).json({ message: "Failed to fetch rating stats", error: err.message });
  }
};

// Helper function to update restaurant rating
async function updateRestaurantRating(restaurantId) {
  try {
    const aggregateResult = await Rating.aggregate([
      { 
        $match: { 
          restaurantId: new mongoose.Types.ObjectId(restaurantId) 
        } 
      },
      { 
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    if (aggregateResult.length > 0) {
      await Restaurant.findByIdAndUpdate(restaurantId, {
        rating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
        totalRatings: aggregateResult[0].totalRatings
      });
    } else {
      await Restaurant.findByIdAndUpdate(restaurantId, {
        rating: 0,
        totalRatings: 0
      });
    }
  } catch (err) {
    console.error("Update restaurant rating error:", err);
    throw err;
  }
}

// Helper function to update chef rating
async function updateChefRating(chefId) {
  try {
    const aggregateResult = await Rating.aggregate([
      { 
        $match: { 
          chefId: new mongoose.Types.ObjectId(chefId) 
        } 
      },
      { 
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    if (aggregateResult.length > 0) {
      await Chef.findByIdAndUpdate(chefId, {
        rating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
        totalRatings: aggregateResult[0].totalRatings
      });
    } else {
      await Chef.findByIdAndUpdate(chefId, {
        rating: 0,
        totalRatings: 0
      });
    }
  } catch (err) {
    console.error("Update chef rating error:", err);
    throw err;
  }
}