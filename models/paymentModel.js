const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  method: {
    type: String,
    enum: ['cod', 'card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  couponUsed: {
    type: String
  },
  paymentGatewayResponse: {
    type: Object
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);