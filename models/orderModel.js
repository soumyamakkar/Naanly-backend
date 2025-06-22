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
    },
    // Added item customizations to preserve order details
    customizations: {
      spiceLevel: String,
      cookingInstructions: String, // Specific cooking instructions for this item
      addOns: [{
        name: String,
        price: Number,
        isVeg: Boolean
      }],
      needsCutlery: Boolean
    }
  }],
  // Special instructions
  cookingInstructions: {
    type: String,
    maxlength: 500,
    default: ''  // Optional general cooking instructions
  },
  deliveryInstructions: {
    type: String,
    maxlength: 500,
    default: ''  // Instructions for the delivery person
  },
  // Tip details
  tip: {
    amount: {
      type: Number,
      enum: [0, 10, 15, 20, 25, 'custom'],
      default: 0  // Amount in rupees
    }
  },
  // Bill details
  billing: {
    subtotal: {
      type: Number,
      required: true  // Sum of all items before discounts, taxes, fees
    },
    discounts: {
      promoCode: {
        code: String,
        amount: {
          type: Number,
          default: 0
        }
      },
      nanoPointsRedemption: {
        points: {
          type: Number,
          default: 0
        },
        amount: {
          type: Number,
          default: 0
        }
      },
      totalDiscount: {
        type: Number,
        default: 0
      }
    },
    deliveryFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    packagingFee: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    }
  },
  // Original fields
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
  },
  // New field for nano points earned from this order
  nanoPointsEarned: {
    type: Number,
    default: 0
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