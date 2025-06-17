const mongoose = require('mongoose');

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
  tags: [String]
}, {
  timestamps: true
});

module.exports = { 
  menuItemSchema,
  MenuItem: mongoose.model('MenuItem', menuItemSchema)
};