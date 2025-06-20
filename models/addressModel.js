const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  label: { 
    type: String 
  },
  flatNumber: { 
    type: String, 
    required: true,
    description: "Flat/House No/Floor" 
  },
  address: { 
    type: String, 
    required: true,
    description: "Complete address text" 
  },
  landmark: { 
    type: String,
    description: "Nearby Landmark (Optional)" 
  },
  city: { 
    type: String, 
    required: true 
  },
  state: { 
    type: String, 
    required: true 
  },
  pincode: { 
    type: String, 
    required: true 
  },
  location: {
    type: { 
      type: String, 
      default: "Point" 
    },
    coordinates: [Number], // [lng, lat]
  }
}, {
  timestamps: true,
});

addressSchema.index({ location: '2dsphere' });

module.exports = { 
  addressSchema,
  Address: mongoose.model('Address', addressSchema)
};