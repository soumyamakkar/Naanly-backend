const redis = require('../config/redisClient');
const twilio = require('twilio');
const User = require('../models/userModel');
const { Address } = require('../models/addressModel');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Add this to your imports at the top

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

  const storedOtp = await redis.get(`otp:${phone}`);
  console.log(storedOtp);
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
    city, 
    state, 
    pincode 
  } = req.body;

  // Validate required fields
  if (!flatNumber || !address || !city || !state || !pincode) {
    return res.status(400).json({ 
      message: "Required fields missing: label, flatNumber, address, city, state, and pincode are required" 
    });
  }

  try {
    // Get coordinates from address
    const coordinates = await geocodeAddress(flatNumber, address, city, state, pincode);
    
    // Create the address object
    const addressData = { 
      user: userId, 
      //label, 
      flatNumber, 
      address, 
      city, 
      state, 
      pincode 
    };
    
    // Add landmark if provided
    if (landmark) {
      addressData.landmark = landmark;
    }
    
    // Add coordinates if geocoding was successful
    if (coordinates) {
      addressData.location = {
        type: "Point",
        coordinates: coordinates
      };
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
    label, 
    flatNumber, 
    address, 
    landmark, 
    city, 
    state, 
    pincode 
  } = req.body;

  try {
    // Build the update object
    const updateData = {};
    if (label) updateData.label = label;
    if (flatNumber) updateData.flatNumber = flatNumber;
    if (address) updateData.address = address;
    if (landmark !== undefined) updateData.landmark = landmark; // Allow empty string to remove landmark
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (pincode) updateData.pincode = pincode;
    
    // If address-related fields changed, recalculate coordinates
    if (flatNumber || address || city || state || pincode) {
      // Get the existing address to fill in any missing fields for geocoding
      const existingAddress = await Address.findOne({ _id: addressId, user: userId });
      
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found or unauthorized" });
      }
      
      // Use provided values or fall back to existing values
      const addressToGeocode = {
        flatNumber: flatNumber || existingAddress.flatNumber,
        address: address || existingAddress.address,
        city: city || existingAddress.city,
        state: state || existingAddress.state,
        pincode: pincode || existingAddress.pincode
      };
      
      // Get new coordinates
      const coordinates = await geocodeAddress(
        addressToGeocode.flatNumber,
        addressToGeocode.address,
        addressToGeocode.city,
        addressToGeocode.state,
        addressToGeocode.pincode
      );
      
      // Update location if geocoding was successful
      if (coordinates) {
        updateData.location = {
          type: "Point",
          coordinates: coordinates
        };
      }
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

