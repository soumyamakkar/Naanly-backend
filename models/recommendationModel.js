const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topPicks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  trending: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  combos: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);