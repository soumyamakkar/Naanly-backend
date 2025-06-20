const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  customizations: {
    type: Object,
    default: {}
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  chef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef'
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' // Cart expires after 7 days of inactivity
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Validator to ensure either restaurant or chef is provided, but not both
cartSchema.pre('validate', function(next) {
  if ((this.restaurant && this.chef) || (!this.restaurant && !this.chef)) {
    next(new Error('Cart must have either a restaurant or chef, but not both'));
  } else {
    next();
  }
});

// Virtual for calculating the total price
cartSchema.virtual('totalPrice').get(function() {
  return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Set to use virtuals when converting to JSON
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;