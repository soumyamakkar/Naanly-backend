const mongoose = require('mongoose');
const { addressSchema } = require('./addressModel');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  phone: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  dietPreference: {
    type: String,
    enum: ['veg', 'non-veg'],
    required: true,
  },

  eatingPreference: {
    type: String,
    enum: ['pure-veg-only', 'veg-from-anywhere'],
    required: true,
  },
  addresses: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Address'
  }]
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
