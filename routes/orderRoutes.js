const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  placeOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
  updatePaymentStatus,
  getOrderStatus
} = require('../controllers/orderController');

const router = express.Router();

// User routes - require authentication
router.use(protect);
router.post('/place', placeOrder);
router.get('/details/:orderId', getOrderById);
router.get('/user', getUserOrders);
router.get('/status/:orderId', getOrderStatus);
router.put('/cancel/:orderId', cancelOrder);

// Admin/Restaurant routes
// Note: In a production app, you would add additional middleware to check if user is admin
// router.put('/status/:orderId', updateOrderStatus);

// Payment gateway webhook (public)
router.post('/payment/webhook', updatePaymentStatus);

module.exports = router;