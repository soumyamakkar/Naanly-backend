const mongoose = require('mongoose');
const shortid = require('shortid'); // For generating short IDs

const chefSchema = new mongoose.Schema({
  chefId: {
    type: String,
    default: () => `CHEF${shortid.generate().toUpperCase()}`,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true // for fast name search
  },
  kitchenName: {
    type: String,
    required: true,
    index: true
  },
  bio: {
    type: String,
    required: true
  },
  specialities: {
    type: [String],
    required: true
  },
  cuisines: {
    type: [String],
    required: true
  },
  isVegOnly: {
    type: Boolean,
    required: true
  },
  eatingPreference: {
    type: String,
    enum: ['pure-veg-only', 'veg-from-anywhere', 'vegetarian', 'non-vegetarian', 'vegetarian-fried'],
    required: true
  },
  experience: {
    type: Number, // years of experience
    required: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  sales: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    weeklyOrders: {
      type: Number,
      default: 0
    },
    weeklyRevenue: {
      type: Number,
      default: 0
    },
    monthlyOrders: {
      type: Number,
      default: 0
    },
    monthlyRevenue: {
      type: Number,
      default: 0
    }
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    documents: {
      identityProof: String,
      addressProof: String,
      certifications: [String],
      foodHandlingLicense: String
    }
  },
  profilePicture: {
    type: String,
    default: ""
  },
  kitchenImages: [String],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: function (v) {
          return v.length === 2 && v.every(Number.isFinite);
        },
        message: 'Coordinates must be an array of [lng, lat]'
      }
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    }
  },
  serviceArea: {
    radius: {
      type: Number, // in kilometers
      default: 5
    }
  },
  availability: {
    monday: { available: Boolean, hours: [String] },
    tuesday: { available: Boolean, hours: [String] },
    wednesday: { available: Boolean, hours: [String] },
    thursday: { available: Boolean, hours: [String] },
    friday: { available: Boolean, hours: [String] },
    saturday: { available: Boolean, hours: [String] },
    sunday: { available: Boolean, hours: [String] }
  },
  filters: {
    priceRange: [Number],
    tags: [String],
    specialDiets: [String] // e.g., keto, gluten-free, low-carb
  },
  isActive: {
    type: Boolean,
    default: true
  },
  leadTime: {
    type: Number, // preparation time in minutes
    default: 60
  },
  joinedOn: {
    type: Date,
    default: Date.now
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    whatsapp: String
  },
  socialMedia: {
    instagram: String,
    facebook: String,
    website: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
chefSchema.index({ location: '2dsphere' });
chefSchema.index({ name: 1 }); // for name search
chefSchema.index({ kitchenName: 1 }); // for kitchen name search
chefSchema.index({ specialities: 1 }); // for specialities search
chefSchema.index({ 'verification.isVerified': 1 }); // for verified chef filtering
chefSchema.index({ rating: -1 }); // for sorting by rating

// Install shortid as a dependency
// npm install shortid

module.exports = mongoose.model('Chef', chefSchema);