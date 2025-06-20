const mongoose = require('mongoose');
const shortid = require('shortid');

const chefRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    default: () => `REQ${shortid.generate().toUpperCase()}`,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef',
    required: true
  },
  requestType: {
    type: String,
    enum: ['food', 'chef-rental', 'recipe'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  // Fields for food request
  foodRequest: {
    dishName: String,
    cuisineStyle: String,
    description: String,
    dietaryRestrictions: {
      glutenFree: Boolean,
      eggs: Boolean,
      other: [String]
    },
    preferredIngredients: {
      vegetables: [String],
      herbs: [String],
      other: [String]
    },
    portionSize: {
      type: String,
      enum: ['small', 'medium', 'large', 'custom']
    },
    customPortionDetails: String,
    deliveryType: {
      type: String,
      enum: ['standard', 'scheduled']
    },
    scheduledDelivery: {
      date: Date,
      timeSlot: String
    },
    budget: Number
  },
  // Fields for chef rental
  chefRental: {
    scheduledTime: {
      from: Date,
      to: Date
    },
    scheduledDate: {
      from: Date,
      to: Date
    },
    venue: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    numberOfGuests: Number,
    occasion: String,
    specialRequirements: String,
    budget: Number
  },
  // Fields for recipe request
  recipeRequest: {
    foodName: String,
    description: String,
    ingredientsUsed: [String],
    specialItems: [String],
    media: [String] // URLs for photos/videos
  },
  // Common fields
  additionalNotes: String,
  price: {
    estimated: Number,
    final: Number
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  },
  responseTime: {
    type: Number,
    default: 60, // Default response time in minutes
    description: "Estimated time in minutes for chef to respond"
  },
  // Tracking fields
  responseDetails: {
    message: String,
    respondedAt: Date,
    quotedPrice: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
chefRequestSchema.index({ user: 1, status: 1 });
chefRequestSchema.index({ chef: 1, status: 1 });
chefRequestSchema.index({ requestId: 1 }, { unique: true });

module.exports = mongoose.model('ChefRequest', chefRequestSchema);