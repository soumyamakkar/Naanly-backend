const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { 
  sendOtp,
  verifyOtp,
  updateProfile,
  getProfile,
  getUserPreferences,
  addAddress, 
  getAddresses, 
  editAddress,
  deleteAddress
} = require('../controllers/userController');

const router = express.Router();

// Auth routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Profile routes
router.get('/profile', protect, getProfile);
router.put('/update-profile', protect, updateProfile);
router.get('/preferences', protect, getUserPreferences);

// Address routes
router.post('/address', protect, addAddress);
router.get('/addresses', protect, getAddresses);
router.put('/edit-address/:addressId', protect, editAddress);
router.delete('/delete-address/:addressId', protect, deleteAddress);

module.exports = router;