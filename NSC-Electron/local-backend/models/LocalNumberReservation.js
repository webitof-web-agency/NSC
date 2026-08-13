const mongoose = require('mongoose');

const localNumberReservationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true }, // 'INVOICE', 'QUOTATION'
    prefix: { type: String, required: true },
    currentValue: { type: Number, required: true },
    endValue: { type: Number, required: true },
    padding: { type: Number, default: 6 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LocalNumberReservation', localNumberReservationSchema);
