const mongoose = require('mongoose');

// Global MenuItem schema with restaurantId reference
const menuItemSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
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
  category: {
    type: String,
    required: true
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

// Virtual property to calculate total macros (could be useful for filtering)
menuItemSchema.virtual('totalMacros').get(function() {
  const nutrition = this.nutritionInfo || {};
  return (nutrition.protein || 0) + (nutrition.carbs || 0) + (nutrition.fat || 0);
});

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

module.exports = {
  menuItemSchema,
  MenuItem: mongoose.model('MenuItem', menuItemSchema)
};