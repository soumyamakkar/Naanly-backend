const mongoose = require('mongoose');
const { addressSchema } = require('./addressModel');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef'
  },
  items: [{
    itemId: {
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
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['placed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'],
    default: 'placed',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
    required: true
  },
  deliveryAddress: {
    type: addressSchema,
    required: true
  },
  scheduledFor: {
    type: Date,
    default: null // For chef orders with scheduled delivery
  }
}, {
  timestamps: true
});

// Validator to ensure either restaurant or chef is provided, but not both
orderSchema.pre('validate', function(next) {
  if ((this.restaurantId && this.chefId) || (!this.restaurantId && !this.chefId)) {
    next(new Error('Order must have either a restaurantId or chefId, but not both'));
  } else {
    next();
  }
});

// Indexes for faster queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1 });
orderSchema.index({ chefId: 1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);