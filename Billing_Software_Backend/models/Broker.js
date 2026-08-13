const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  purchaseNumber: {
    type: String,
    default: null
  },
  commissionType: {
    type: String,
    enum: ['Fixed', 'Percentage'],
    required: true
  },
  commissionValue: {
    type: Number,
    required: true,
    min: 0
  },
  commissionAmount: {
    type: Number,
    required: true,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true }); // Each deal gets its own _id for deletion

const brokerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    unique: true // One document per broker
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deals: [dealSchema], // Array of deals
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Broker', brokerSchema);
