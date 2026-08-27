const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const invoicePaymentSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  payment_method: {
    type: String,
    enum: ["CASH", "CARD", "BANK", "CHEQUE", "PHONEPE", "MIXED", "CREDIT", "UPI"],
    required: true
  },

  // For MIXED payments only
  cashAmount: {
    type: Number,
    min: 0,
    required: function () {
      return this.payment_method === "MIXED";
    }
  },
  cardAmount: {
    type: Number,
    min: 0,
  },
  creditAmount: {
    type: Number,
    min: 0,
  },
  upiAmount: {
    type: Number,
    min: 0,
    required: function () {
      return this.payment_method === "MIXED";
    }
  },

  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BankDetail",
    required: function () {
      return this.payment_method === "BANK" || this.payment_method === "CHEQUE";
    },
  },
  received_on: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  received_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

invoicePaymentSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('InvoicePayment', invoicePaymentSchema);
