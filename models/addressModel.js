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
  location: {
    type: { 
      type: String, 
      default: "Point" 
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});

addressSchema.index({ location: '2dsphere' });
addressSchema.index({ user: 1, isDefault: 1 }); // For efficient querying of user's default address

module.exports = { 
  addressSchema,
  Address: mongoose.model('Address', addressSchema)
};