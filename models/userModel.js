const mongoose = require('mongoose');
const { addressSchema } = require('./addressModel');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    sparse: true, // Allow multiple null values but enforce uniqueness when provided
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  dietPreference: {
    type: String,
    enum: ['veg', 'non-veg', ''],
    default: "", // Empty string as default instead of "null"
    validate: {
      validator: function(v) {
        // Only enforce enum validation when the value is provided
        // This allows the value to be empty on creation
        return !v || ['veg', 'non-veg'].includes(v);
      },
      message: props => `${props.value} is not a valid diet preference`
    }
  },
  eatingPreference: {
    type: String,
    enum: ['pure-veg-only', 'veg-from-anywhere', ''],
    default: "", // Empty string as default instead of "null"
    validate: {
      validator: function(v) {
        // Only enforce enum validation when the value is provided
        return !v || ['pure-veg-only', 'veg-from-anywhere'].includes(v);
      },
      message: props => `${props.value} is not a valid eating preference`
    }
  },
  profilePicture: {
    type: String,
    default: "" // Default empty string for users without a profile picture
  },
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  }],
  favorites: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    },
    chefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chef'
    },
    sourceType: {
      type: String,
      enum: ['restaurant', 'chef'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeCarts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  }],
  nanoPoints: {
    type: Number,
    default: 0
  },
  nanoPointsHistory: [{
    points: Number,
    type: {
      type: String,
      enum: ['earned', 'redeemed', 'expired', 'bonus']
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
