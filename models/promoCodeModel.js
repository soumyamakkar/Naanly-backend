const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    default: null  // Maximum discount amount (for percentage discounts)
  },
  minOrderValue: {
    type: Number,
    default: 0  // Minimum order value to apply this promo
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: null  // null means unlimited
  },
  usageCount: {
    type: Number,
    default: 0
  },
  applicableFor: {
    firstOrder: {
      type: Boolean,
      default: false
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    specificRestaurants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    }],
    specificChefs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chef'
    }]
  }
}, {
  timestamps: true
});

// Check if promo code is valid for a specific order
promoCodeSchema.methods.isValidForOrder = async function(orderDetails) {
  // Check if active and not expired
  if (!this.isActive || new Date() > this.expiryDate) {
    return { valid: false, reason: 'Promo code expired or inactive' };
  }

  // Check usage limit
  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) {
    return { valid: false, reason: 'Promo code usage limit reached' };
  }

  // Check minimum order value
  if (orderDetails.subtotal < this.minOrderValue) {
    return { 
      valid: false, 
      reason: `Minimum order value of ₹${this.minOrderValue} required` 
    };
  }

  // Check first order restriction
  if (this.applicableFor.firstOrder) {
    const orderCount = await mongoose.model('Order').countDocuments({ 
      userId: orderDetails.userId 
    });
    if (orderCount > 0) {
      return { valid: false, reason: 'Promo valid for first order only' };
    }
  }

  // Check user restriction
  if (this.applicableFor.specificUsers.length > 0) {
    if (!this.applicableFor.specificUsers.includes(orderDetails.userId)) {
      return { valid: false, reason: 'Promo not applicable for this user' };
    }
  }

  // Check restaurant/chef restriction
  if (orderDetails.restaurantId && 
      this.applicableFor.specificRestaurants.length > 0 &&
      !this.applicableFor.specificRestaurants.includes(orderDetails.restaurantId)) {
    return { valid: false, reason: 'Promo not applicable for this restaurant' };
  }

  if (orderDetails.chefId && 
      this.applicableFor.specificChefs.length > 0 &&
      !this.applicableFor.specificChefs.includes(orderDetails.chefId)) {
    return { valid: false, reason: 'Promo not applicable for this chef' };
  }

  return { valid: true };
};

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
module.exports = PromoCode;