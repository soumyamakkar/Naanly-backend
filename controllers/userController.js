const redis = require('../config/redisClient');
const twilio = require('twilio');
const User = require('../models/userModel');
const { Address } = require('../models/addressModel');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Add this to your imports at the top
const { uploadProfilePicture } = require('../config/cloudinary');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;


// Helper function for geocoding
async function geocodeAddress(flatNumber, address, city, state, pincode) {
  try {
    const formattedAddress = encodeURIComponent(`${flatNumber}, ${address}, ${city}, ${state}, ${pincode}, India`);
    
    // Using OpenStreetMap/Nominatim API for geocoding (free, no API key needed)
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${formattedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'Naanly-App/1.0' // Required by Nominatim policy
        }
      }
    );
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return [
        parseFloat(result.lon), // longitude first in GeoJSON format
        parseFloat(result.lat)  // latitude second
      ];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

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

  // For testing: Just check if the OTP is 6 digits
  if (!/^\d{6}$/.test(otp)) {
    return res.status(401).json({ message: "Invalid OTP format. Must be 6 digits." });
  }
  
  // Comment out Redis verification for testing
  // const storedOtp = await redis.get(`otp:${phone}`);
  // console.log(storedOtp);
  // if (!storedOtp || storedOtp !== otp) {
  //   return res.status(401).json({ message: "Invalid or expired OTP" });
  // }

  let user = await User.findOne({ phone });
  let isNewUser = false;

  if (!user) {
    // Create a "stub" user with just phone, app will collect rest later
    user = await User.create({
      phone,
      name: "",
      email: ""
      // Removed dietPreference and eatingPreference as they'll use default values
    });
    isNewUser = true;
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log(token);
  
  // Comment out Redis deletion for testing
  // await redis.del(`otp:${phone}`);

  // If it's a new user, don't send the user object
  if (isNewUser) {
    return res.status(201).json({
      message: "User created, complete your profile",
      token,
      isNewUser: true
    });
  } 
  
  // If returning user, include the user object
  return res.status(200).json({
    message: "Login successful",
    token,
    isNewUser: false,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      dietPreference: user.dietPreference,
      eatingPreference: user.eatingPreference
    }
  });
};


exports.updateProfile = async (req, res) => {
  const userId = req.user.id || req.body; // from JWT middleware
  const { name, dietPreference, eatingPreference } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, dietPreference, eatingPreference },
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
  const { 
    flatNumber, 
    address, 
    landmark, 
    coordinates // Now accepting coordinates directly from the body
  } = req.body;

  // Validate required fields
  if (!flatNumber || !address || !coordinates) {
    return res.status(400).json({ 
      message: "Required fields missing: flatNumber, address, and coordinates are required" 
    });
  }

  // Validate coordinates
  if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
      typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return res.status(400).json({ 
      message: "Valid coordinates are required as an array [longitude, latitude]" 
    });
  }

  try {
    // Create the address object with provided coordinates
    const addressData = { 
      user: userId, 
      flatNumber, 
      address, 
      location: {
        type: "Point",
        coordinates: coordinates // Use coordinates from request body
      }
    };
    
    // Add landmark if provided
    if (landmark) {
      addressData.landmark = landmark;
    }
    
    // Create the address
    const newAddress = await Address.create(addressData);

    // Add address to user's addresses array
    await User.findByIdAndUpdate(userId, {
      $push: { addresses: newAddress._id }
    });

    res.status(201).json({ 
      message: "Address added successfully", 
      address: newAddress 
    });
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
  const { 
    flatNumber, 
    address, 
    landmark, 
    coordinates // Now accepting coordinates directly from the body 
  } = req.body;

  try {
    // Build the update object
    const updateData = {};
    if (flatNumber) updateData.flatNumber = flatNumber;
    if (address) updateData.address = address;
    if (landmark !== undefined) updateData.landmark = landmark; // Allow empty string to remove landmark
    
    // Update coordinates if provided
    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2 &&
        typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      updateData.location = {
        type: "Point",
        coordinates: coordinates
      };
    }

    // Update the address
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    res.status(200).json({
      message: "Address updated successfully",
      address: updatedAddress
    });
  } catch (err) {
    console.error("Edit address error:", err);
    res.status(500).json({ message: "Failed to update address" });
  }
};


exports.deleteAddress = async (req, res) => {
  const userId = req.user.id;
  const { addressId } = req.params;

  try {
    // Find and delete the address document
    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      user: userId
    });

    if (!deletedAddress) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    // Also remove the reference from the user's addresses array
    await User.findByIdAndUpdate(userId, {
      $pull: { addresses: addressId }
    });

    res.status(200).json({
      message: "Address deleted successfully",
      addressId
    });
  } catch (err) {
    console.error("Delete address error:", err);
    res.status(500).json({ message: "Failed to delete address" });
  }
};


exports.getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('dietPreference eatingPreference');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User preferences fetched successfully",
      preferences: {
        dietPreference: user.dietPreference,        // 'veg' or 'non-veg'
        eatingPreference: user.eatingPreference     // 'pure-veg-only' or 'veg-from-anywhere'
      }
    });
  } catch (err) {
    console.error("Error fetching user preferences:", err);
    res.status(500).json({ message: "Failed to fetch user preferences" });
  }
};

// Add this new controller function
exports.editProfile = (req, res) => {
  // Use multer middleware to handle file upload
  uploadProfilePicture(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ 
        message: "Error uploading image", 
        error: err.message 
      });
    }
    
    const userId = req.user.id;
    const { name, email } = req.body;
    
    try {
      // Build the update object with profile fields
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      
      // If a file was uploaded, add the profilePicture field
      if (req.file) {
        updateData.profilePicture = req.file.path;
      }
      
      // Only update if there's something to update
      if (Object.keys(updateData).length === 0 && !req.file) {
        return res.status(400).json({ message: "No update data provided" });
      }
      
      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select("-password");
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({
        message: "Profile edited successfully",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          phone: updatedUser.phone,
          email: updatedUser.email,
          profilePicture: updatedUser.profilePicture,
          dietPreference: updatedUser.dietPreference,
          eatingPreference: updatedUser.eatingPreference
        }
      });
    } catch (err) {
      console.error("Profile edit error:", err);
      res.status(500).json({ message: "Failed to edit profile" });
    }
  });
};

