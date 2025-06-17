const mongoose = require('mongoose');
const { menuItemSchema } = require('./menuItemModel');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
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
    enum: ['pure-veg-only', 'veg-from-anywhere'],
    required: true
  },
  location: {
    type: {
      type: String,
      default: "Point"
    },
    coordinates: [Number] // [lng, lat]
  },
  filters: {
    priceRange: [Number],
    tags: [String]
  },
  menu: [menuItemSchema]
}, {
  timestamps: true
});

restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);