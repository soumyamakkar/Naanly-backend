const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { 
  sendOtp,
  verifyOtp,
  updateProfile,
  editProfile,
  getProfile,
  getUserPreferences,
  addAddress, 
  getAddresses,
  getDefaultAddress, // Add this
  setDefaultAddress, // Add this
  editAddress,
  deleteAddress,
  getNanoPoints,
  addBonusNanoPoints
} = require('../controllers/userController');

const router = express.Router();

// Auth routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Profile routes
router.get('/profile', protect, getProfile);
router.put('/update-profile', protect, updateProfile);
router.post('/edit-profile', protect, editProfile);
router.get('/preferences', protect, getUserPreferences);

// Address routes
router.post('/add-address', protect, addAddress);
router.get('/addresses', protect, getAddresses);
router.get('/default-address', protect, getDefaultAddress); // New route
router.put('/set-default-address/:addressId', protect, setDefaultAddress); // New route
router.put('/edit-address/:addressId', protect, editAddress);
router.delete('/delete-address/:addressId', protect, deleteAddress);

// Nano points routes
router.get('/nano-points', protect, getNanoPoints);

// Admin routes
router.post('/add-bonus-points', protect, addBonusNanoPoints);

module.exports = router;