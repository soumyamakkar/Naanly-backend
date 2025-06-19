const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  addToCart,
  removeFromCart,
  getUserCarts,
  getCartById,
  updateCartItem,
  clearCart
} = require('../controllers/cartController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Cart routes
router.post('/add', addToCart);
router.delete('/remove', removeFromCart);
router.get('/', getUserCarts);
router.get('/:cartId', getCartById);
router.put('/update', updateCartItem);
router.delete('/clear/:cartId', clearCart);

module.exports = router;