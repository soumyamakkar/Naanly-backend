const ChefRequest = require('../models/chefRequestModel');
const User = require('../models/userModel');
const Chef = require('../models/chefModel');
const { createNotificationUtil } = require('./notificationController');

// Create a food request
exports.createFoodRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    dishName, 
    cuisineStyle, 
    description,
    dietaryRestrictions, 
    preferredIngredients,
    portionSize,
    customPortionDetails,
    deliveryType,
    scheduledDelivery,
    budget,
    additionalNotes,
    deliveryAddressId
  } = req.body;

  // Validate required fields
  if (!chefId || !dishName) {
    return res.status(400).json({ 
      message: "Chef ID and dish name are required" 
    });
  }

  if (deliveryType === 'scheduled' && (!scheduledDelivery || !scheduledDelivery.date)) {
    return res.status(400).json({ 
      message: "Scheduled delivery requires date and time" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'food',
      foodRequest: {
        dishName,
        cuisineStyle,
        description,
        dietaryRestrictions,
        preferredIngredients,
        portionSize,
        customPortionDetails,
        deliveryType,
        scheduledDelivery,
        budget
      },
      additionalNotes,
      deliveryAddress: deliveryAddressId,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New food request: ${dishName}`, 
      userId
    );

    res.status(201).json({
      message: "Food request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create food request error:", err);
    res.status(500).json({ message: "Failed to create food request" });
  }
};

// Create a chef rental request
exports.createChefRentalRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    scheduledTime,
    scheduledDate,
    venue,
    numberOfGuests,
    occasion,
    specialRequirements,
    budget,
    additionalNotes
  } = req.body;

  // Validate required fields
  if (!chefId || !scheduledDate || !scheduledTime || !venue) {
    return res.status(400).json({ 
      message: "Chef ID, scheduled date, scheduled time, and venue are required" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'chef-rental',
      chefRental: {
        scheduledTime,
        scheduledDate,
        venue,
        numberOfGuests,
        occasion,
        specialRequirements,
        budget
      },
      additionalNotes,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New chef rental request for ${scheduledDate.from ? new Date(scheduledDate.from).toLocaleDateString() : 'unknown date'}`, 
      userId
    );

    res.status(201).json({
      message: "Chef rental request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create chef rental request error:", err);
    res.status(500).json({ message: "Failed to create chef rental request" });
  }
};

// Create a recipe request
exports.createRecipeRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    foodName, 
    description, 
    ingredientsUsed,
    specialItems,
    additionalNotes
  } = req.body;

  // Process uploaded media files
  let media = [];
  if (req.files && req.files.length > 0) {
    media = req.files.map(file => file.path);
  }

  // Validate required fields
  if (!chefId || !foodName) {
    return res.status(400).json({ 
      message: "Chef ID and food name are required" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'recipe',
      recipeRequest: {
        foodName,
        description,
        ingredientsUsed,
        specialItems,
        media
      },
      additionalNotes,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New recipe request for ${foodName}`, 
      userId
    );

    res.status(201).json({
      message: "Recipe request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create recipe request error:", err);
    res.status(500).json({ message: "Failed to create recipe request" });
  }
};

// Get all requests for a user
exports.getUserRequests = async (req, res) => {
  const userId = req.user.id;
  const { status, type, page = 1, limit = 10 } = req.query;

  try {
    // Build query
    const query = { user: userId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by request type if provided
    if (type) {
      query.requestType = type;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get requests with pagination
    const requests = await ChefRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('chef', 'name kitchenName profilePicture responseTime');

    // Get total count for pagination info
    const total = await ChefRequest.countDocuments(query);

    res.status(200).json({
      requests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + requests.length < total
      }
    });
  } catch (err) {
    console.error("Get user requests error:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
};

// Get request details by ID
exports.getRequestById = async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;

  try {
    let request;
    
    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(requestId)) {
      request = await ChefRequest.findOne({
        _id: requestId,
        user: userId
      });
    }
    
    // If not found, try to find by requestId (string)
    if (!request) {
      request = await ChefRequest.findOne({
        requestId: requestId,
        user: userId
      });
    }
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Populate chef details
    await request.populate('chef', 'name kitchenName profilePicture responseTime verification');
    
    // Populate address if present
    if (request.deliveryAddress) {
      await request.populate('deliveryAddress');
    }

    res.status(200).json({ request });
  } catch (err) {
    console.error("Get request error:", err);
    res.status(500).json({ message: "Failed to fetch request details" });
  }
};

// Cancel a request
exports.cancelRequest = async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;
  const { reason } = req.body;

  try {
    let request;
    
    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(requestId)) {
      request = await ChefRequest.findOne({
        _id: requestId,
        user: userId
      });
    }
    
    // If not found, try to find by requestId (string)
    if (!request) {
      request = await ChefRequest.findOne({
        requestId: requestId,
        user: userId
      });
    }
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Check if request can be cancelled
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot cancel a request that is already ${request.status}` 
      });
    }
    
    // Update request status
    request.status = 'cancelled';
    request.additionalNotes = request.additionalNotes 
      ? `${request.additionalNotes}\nCancellation reason: ${reason}` 
      : `Cancellation reason: ${reason}`;
    request.updatedAt = Date.now();
    
    await request.save();

    // Notify chef about cancellation
    await createNotificationUtil(
      request.chef, 
      `Request ${request.requestId} has been cancelled by the user`, 
      userId
    );

    res.status(200).json({
      message: "Request cancelled successfully",
      requestId: request.requestId
    });
  } catch (err) {
    console.error("Cancel request error:", err);
    res.status(500).json({ message: "Failed to cancel request" });
  }
};