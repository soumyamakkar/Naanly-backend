const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true // for fast name search
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
    enum: ['pure-veg-only', 'veg-from-anywhere','vegetarian', 'non-vegetarian','vegetarian-fried'],
    required: true
  },
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
    }
  },
  filters: {
    priceRange: [Number],
    tags: [String]
  },
  photos: {
    type: [String],  // Array of photo URLs
    default: []
  }
}, {
  timestamps: true
});

restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ name: 1 }); // for name search

module.exports = mongoose.model('Restaurant', restaurantSchema);