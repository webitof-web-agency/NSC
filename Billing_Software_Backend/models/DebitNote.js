const mongoose = require('mongoose');

const debitNoteItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true
  },
  hsn_code: String,
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    default: null,
  },
  variantName: String,
  variantDesignNo: String,
  variantColor: String,
  variantSize: String,
  unit: {
    type: String,
    required: false
  },
  qty: {
    type: Number,
    required: false
  },
  rate: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
}, { _id: false });

const debitNoteSchema = new mongoose.Schema({
  debitNoteId: {
    type: String,
    unique: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  debitNoteDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: false
  },
  referenceNo: {
    type: String,
    default: ''
  },
  items: {
    type: [debitNoteItemSchema],
    default: []
  },
  replacementItems: {
    type: [debitNoteItemSchema],
    default: []
  },
  status: {
    type: String,
    enum: ['new', 'pending', 'completed', 'cancelled', 'partially_paid', 'paid', 'return', 'replaced'],
    default: 'draft'
  },
  paymentMode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMode',
    default: null,
  },
  totalAmount: {
    type: Number,
    required: true
  },
  replacementAmount: {
    type: Number,
    default: 0
  },
  netAdjustment: {
    type: Number,
    default: 0
  },
  adjustmentType: {
    type: String,
    enum: ['supplier_credit', 'supplier_payable', 'even_exchange'],
    default: 'even_exchange'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankDetail',
  },
  notes: String,
  termsAndCondition: String,
  checkNumber: {
    type: String,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  billFrom: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  billTo: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, {
  timestamps: true
});

debitNoteSchema.pre('save', async function (next) {
  if (!this.debitNoteId) {
    try {
      const count = await this.constructor.countDocuments();
      this.debitNoteId = `DN-${String(count + 1).padStart(6, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('DebitNote', debitNoteSchema);
