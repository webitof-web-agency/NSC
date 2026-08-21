const mongoose = require('mongoose');

const numberSequenceSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true }, // 'INVOICE', 'QUOTATION'
    prefix: { type: String, required: true }, // e.g., 'INV-'
    currentValue: { type: Number, default: 0 },
    padding: { type: Number, default: 6 }, // e.g., 6 -> 'INV-000001'
  },
  { timestamps: true }
);

module.exports = mongoose.model('NumberSequence', numberSequenceSchema);
