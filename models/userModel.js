const mongoose = require('mongoose');
const { addressSchema } = require('./addressModel');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
    enum: ['veg', 'non-veg'],
    required: true,
    default:"null"
  },
  eatingPreference: {
    type: String,
    enum: ['pure-veg-only', 'veg-from-anywhere'],
    required: true,
    default:"null"
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
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeCarts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
