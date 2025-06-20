const mongoose = require('mongoose');
const { addressSchema } = require('./addressModel');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  dietPreference: {
    type: String,
    enum: ['veg', 'non-veg'],
    required: true,
  },

  eatingPreference: {
    type: String,
    enum: ['pure-veg-only', 'veg-from-anywhere'],
    required: true,
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
