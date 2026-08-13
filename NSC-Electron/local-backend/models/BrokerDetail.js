const mongoose = require('mongoose');

const brokerDetailSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  commissionType: {
    type: String,
    enum: ['Fixed', 'Percentage'],
    default: 'Percentage',
    required: false
  },
  commissionValue: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  address: {
    type: String,
    trim: true,
    default: ""
  },
  city: {
    type: String,
    trim: true,
    default: ""
  },
  state: {
    type: String,
    trim: true,
    default: ""
  },
  country: {
    type: String,
    trim: true,
    default: ""
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BrokerDetail', brokerDetailSchema);
