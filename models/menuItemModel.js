const mongoose = require('mongoose');

// Global MenuItem schema with restaurantId or chefId reference
const menuItemSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef'
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
  category: {
    type: String,
    required: true
  },
  preparationTime: {
    type: Number, // in minutes
    default: 30
  },
  tags: [String],
  // Nutrition information
  nutritionInfo: {
    calories: {
      type: Number,
      default: 0
    },
    protein: {
      type: Number,  // in grams
      default: 0
    },
    carbs: {
      type: Number,  // in grams
      default: 0
    },
    fat: {
      type: Number,  // in grams
      default: 0
    },
    fiber: {
      type: Number,  // in grams
      default: 0
    },
    servingSize: {
      type: String,
      default: "1 serving"
    }
  }
}, {
  timestamps: true
});

// Validator to ensure either restaurantId or chefId is provided, but not both
menuItemSchema.pre('validate', function(next) {
  if ((this.restaurantId && this.chefId) || (!this.restaurantId && !this.chefId)) {
    next(new Error('MenuItem must have either a restaurantId or chefId, but not both'));
  } else {
    next();
  }
});

// Virtual property to calculate total macros
menuItemSchema.virtual('totalMacros').get(function() {
  const nutrition = this.nutritionInfo || {};
  return (nutrition.protein || 0) + (nutrition.carbs || 0) + (nutrition.fat || 0);
});

// Add index for faster searches
menuItemSchema.index({ restaurantId: 1 });
menuItemSchema.index({ chefId: 1 });
menuItemSchema.index({ isVeg: 1 });
menuItemSchema.index({ category: 1 });

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

module.exports = {
  menuItemSchema,
  MenuItem: mongoose.model('MenuItem', menuItemSchema)
};