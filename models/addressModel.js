const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  label: { 
    type: String, 
    required: true 
  },
  line1: { 
    type: String, 
    required: true 
  },
  line2: { 
    type: String 
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