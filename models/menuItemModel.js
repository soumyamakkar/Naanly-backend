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
  category:{
    type:String,
    required:true
  },
  tags: {
    type: [String],
    required: true
  },
  // New fields for ingredients, allergens, and oil type
  keyIngredients: {
    type: [String],
    default: []
  },
  allergens: {
    type: [String],
    //enum: ["Milk", "Eggs", "Fish", "Shellfish", "Tree nuts", "Peanuts", "Wheat", "Soybeans", "Sesame", "Mustard", "Celery", "Sulphites", "Lupin", "Molluscs"],
    default: []
  },
  oilType: {
    type: String,
    //enum: ["Sunflower", "Olive", "Mustard", "Coconut", "Groundnut", "Sesame", "Rice bran", "Soybean", "Canola", "Ghee", "Butter", "No oil used"],
    default: "No oil used"
  },
  // Customization options
  customizationOptions: {
    spiceLevel: {
      type: String,
      enum: ["Classic", "Spicy"],
      default: "Classic"
    },
    addOns: [{
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true,
        default: 0
      },
      isVeg: {
        type: Boolean,
        default: true
      }
    }],
    needsCutlery: {
      type: Boolean,
      default: true
    }
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
  },
  specialOffer: {
    isSpecial: {
      type: Boolean,
      default: false
    },
    validFrom: {
      type: Date
    },
    validUntil: {
      type: Date
    },
    specialPrice: {
      type: Number
    },
    description: {
      type: String
    }
  },
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
  photos: {
  main: {
    type: String,  // URL to the main photo
    default: ""
  },
  additional: [String]  // Array of additional photo URLs
},
  // Rating information
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
  pairingSuggestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }]
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
menuItemSchema.index({ allergens: 1 }); // Index for allergen searches
menuItemSchema.index({ keyIngredients: 1 }); // Index for ingredient searches

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

module.exports = {
  menuItemSchema,
  MenuItem: mongoose.model('MenuItem', menuItemSchema)
};