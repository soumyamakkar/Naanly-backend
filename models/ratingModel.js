const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Either restaurantId or chefId must be provided, but not both
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
}, {
  timestamps: true
});

// Validator to ensure either restaurant or chef is provided, but not both
ratingSchema.pre('validate', function(next) {
  if ((this.restaurantId && this.chefId) || (!this.restaurantId && !this.chefId)) {
    next(new Error('Rating must have either a restaurantId or chefId, but not both'));
  } else {
    next();
  }
});

// Compound index to ensure a user can only review a menu item once per order
ratingSchema.index({ user: 1, orderId: 1, menuItemId: 1 }, { unique: true });
// Indexes for efficient querying
ratingSchema.index({ restaurantId: 1, createdAt: -1 });
ratingSchema.index({ chefId: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', ratingSchema);