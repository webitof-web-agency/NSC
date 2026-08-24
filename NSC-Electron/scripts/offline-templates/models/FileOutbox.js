const mongoose = require('mongoose');

const fileOutboxSchema = new mongoose.Schema({
  filePath: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'SYNCED', 'FAILED'],
    default: 'PENDING'
  },
  attempts: {
    type: Number,
    default: 0
  },
  error: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('FileOutbox', fileOutboxSchema);
