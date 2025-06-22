const PromoCode = require('../models/promoCodeModel');
const Order = require('../models/orderModel');

// Validate a promo code
exports.validatePromoCode = async (req, res) => {
  const userId = req.user.id;
  const { code, cartId, restaurantId, chefId, subtotal } = req.body;

  if (!code || !subtotal) {
    return res.status(400).json({ message: "Code and subtotal are required" });
  }

  try {
    // Find the promo code
    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    });

    if (!promoCode) {
      return res.status(404).json({ message: "Invalid or expired promo code" });
    }

    // Check if the promo code is valid for this order
    const orderDetails = {
      userId,
      restaurantId,
      chefId,
      subtotal
    };

    const validation = await promoCode.isValidForOrder(orderDetails);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    // Calculate discount
    let discount = 0;
    if (promoCode.discountType === 'percentage') {
      discount = (subtotal * promoCode.discountValue / 100);
      // Apply max discount cap if exists
      if (promoCode.maxDiscount && discount > promoCode.maxDiscount) {
        discount = promoCode.maxDiscount;
      }
    } else {
      discount = promoCode.discountValue;
    }

    // Return promo code details
    res.status(200).json({
      valid: true,
      code: promoCode.code,
      description: promoCode.description,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      discount: Math.round(discount), // Rounded discount amount
      minOrderValue: promoCode.minOrderValue
    });
  } catch (err) {
    console.error("Validate promo code error:", err);
    res.status(500).json({ message: "Failed to validate promo code" });
  }
};