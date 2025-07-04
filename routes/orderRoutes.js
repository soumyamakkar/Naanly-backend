const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  placeOrder,
  getOrderById,
  getUserOrders,
  getUserOngoingOrders,
  getUserPastOrders,
  updateOrderStatus,
  cancelOrder,
  updatePaymentStatus,
  getOrderStatus
} = require('../controllers/orderController');
const promoCodeController = require('../controllers/promoCodeController');

const router = express.Router();

// User routes - require authentication
router.use(protect);
router.post('/place', placeOrder);
router.get('/details/:orderId', getOrderById);
router.get('/user', getUserOrders);
router.get('/ongoing', getUserOngoingOrders);
router.get('/past', getUserPastOrders);
router.get('/status/:orderId', getOrderStatus);
router.put('/cancel/:orderId', cancelOrder);
router.post('/validate-promo', promoCodeController.validatePromoCode);

// Update order status route (admin/restaurant/chef)
// In production, add middleware to verify admin/restaurant/chef permissions
router.put('/edit-status/:orderId', updateOrderStatus);

// Payment gateway webhook (public)
router.post('/payment/webhook', updatePaymentStatus);

module.exports = router;

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