const redis = require('../config/redisClient');
const twilio = require('twilio');
const User = require('../models/userModel');
const { Address } = require('../models/addressModel');
const jwt = require('jsonwebtoken');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;


exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.setEx(`otp:${phone}`, 300, otp); // store OTP for 5 mins

  try {
    await client.messages.create({
      body: `Your OTP code is ${otp}`,
      from: twilioPhoneNumber,
      to: phone
    });
    console.log(`OTP sent to ${phone}`);
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }

  res.status(200).json({ message: "OTP sent" });
};


exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ message: "Phone and OTP required" });

  const storedOtp = await redis.get(`otp:${phone}`);
  if (!storedOtp || storedOtp !== otp) {
    return res.status(401).json({ message: "Invalid or expired OTP" });
  }

  let user = await User.findOne({ phone });
  let isNewUser = false;

  if (!user) {
    // Create a "stub" user with just phone, app will collect rest later
    user = await User.create({
      phone,
      name: "",
      email: "",
      password: "otp-login", // dummy, will never be used
    });
    isNewUser = true;
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log(token);
  await redis.del(`otp:${phone}`);

  res.status(user.name ? 200 : 201).json({
    message: isNewUser ? "User created, complete your profile" : "Login successful",
    token,
    user,
    isNewUser,
  });
};


exports.updateProfile = async (req, res) => {
  const userId = req.user.id || req.body; // from JWT middleware
  const { name, email, dietPreference, eatingPreference } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, dietPreference, eatingPreference },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "User profile fetched successfully",
      user,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



exports.addAddress = async (req, res) => {
  const userId = req.user.id;
  const data = req.body;

  try {
    const address = await Address.create({ ...data, user: userId });

    await User.findByIdAndUpdate(userId, {
      $push: { addresses: address._id }
    });

    res.status(201).json({ message: "Address added", address });
  } catch (err) {
    console.error("Add address error:", err);
    res.status(500).json({ message: "Failed to add address" });
  }
};


exports.getAddresses = async (req, res) => {
  const userId = req.user.id;

  try {
    const addresses = await Address.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({ addresses });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch addresses" });
  }
};


exports.editAddress = async (req, res) => {
  const userId = req.user.id;
  const { addressId } = req.params;
  const updateData = req.body;

  try {
    const address = await Address.findOneAndUpdate(
      { _id: addressId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!address) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    res.status(200).json({
      message: "Address updated",
      address
    });
  } catch (err) {
    console.error("Edit address error:", err);
    res.status(500).json({ message: "Failed to update address" });
  }
};

