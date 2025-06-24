const mongoose = require('mongoose');

const mealBoxSchema = new mongoose.Schema({
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  isVeg: {
    type: Boolean,
    required: true
  },
  dishes: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    }
  }],
  customizationOptions: [{
    name: {
      type: String,
      required: true
    },
    options: [{
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        default: 0
      },
      isVeg: {
        type: Boolean,
        default: true
      }
    }],
    required: {
      type: Boolean,
      default: false
    }
  }],
  servingSize: {
    type: String,
    default: "1 person"
  },
  preparationTime: {
    type: Number, // in minutes
    default: 45
  },
  photo: {
    type: String,
    default: ""
  },
  tags: {
    type: [String],
    default: []
  },
  // Popularity and rating
  popularity: {
    orderCount: {
      type: Number,
      default: 0
    },
    lastOrderedAt: {
      type: Date,
      default: null
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for faster queries
mealBoxSchema.index({ chefId: 1 });
mealBoxSchema.index({ isVeg: 1 });
mealBoxSchema.index({ tags: 1 });
mealBoxSchema.index({ 'popularity.orderCount': -1 });
mealBoxSchema.index({ 'rating.average': -1 });

// Make sure virtuals are included in JSON responses
mealBoxSchema.set('toJSON', { virtuals: true });
mealBoxSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('MealBox', mealBoxSchema);