const express = require('express');
const router = express.Router();
const {
  sendOtp,verifyOtp, updateProfile, getProfile, addAddress, getAddresses, editAddress
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
// Public routes
//router.post('/register', registerUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.patch('/update-profile',protect,updateProfile);
router.get('/profile', protect, getProfile);
router.post('/add-address',protect,addAddress);
router.get('/get-addressses',protect,getAddresses);
router.put('/edit-address/:addressId',protect,editAddress);


// Protected route (example: to view profile after login)
//router.get('/profile', protect, getUserProfile);

module.exports = router;
