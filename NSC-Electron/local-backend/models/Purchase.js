const offlineSyncPlugin = require("../middleware/offlineSync");
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchaseId: {
    type: String,
    unique: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  purchaseBillDate: {
    type: Date,
    required: false
  },
  dueDate: {
    type: Date,
    required: true
  },
  dueDays: {
    type: Number,
    default: null
  },
  referenceNo: {
    type: String,
    default: ""
  },
  supplier_bill_number: {
    type: String,
    default: ""
  },
  items: [{
   id: {
      type: String,      
      required: true
    },
    name: {
      type: String,
      required: true
    },
    hsn_code: String,
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    variantName: String,
    variantDesignNo: String,
    variantColor: String,
    variantSize: String,
    // hsn_code: {
    //   type: String,
    //   ref: "ProductVariant",
    //   trim: true
    // },
    // variantHsn_code: String,
    unit: {
      type: String,
      required: false
    },
    qty: {  // Changed from 'qty' to 'quantity' for consistency
      type: Number,
      required: false
    },
    rate: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    tax_group_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxGroup',
      default: null
    },
    discount_type: {
      type: String,
      enum: ['Fixed', 'Percentage'],
      default: 'Fixed'
    },
    discount_value: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      required: true
    }
  }],
  status: {
    type: String,
    enum: ['new', 'draft', 'pending', 'completed', 'cancelled', 'partially_paid', 'paid', 'return'],
    default: 'pending'
  },
  paymentMode: {
    // type: String,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMode',
    required: false
  },
  // taxableAmount: {
  //   type: Number,
  //   required: true
  // },
  totalDiscount: {
    type: Number,
    default: 0
  },
  overall_discount: {
    type: Number,
    default: 0
  },
  totalTax: {
    type: Number,
    default: 0
  },
  taxType: {
    type: String,
    enum: ['GST', 'Non-GST'],
    default: 'GST'
  },
  gstType: {
    type: String,
    enum: ['Inclusive', 'Exclusive'],
    default: 'Exclusive'
  },
  roundOff: {
    type: Boolean,
    default: false
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankDetail',
  },
  notes: String,
  termsAndCondition: String,
  // sign_type: {
  //   type: String,
  //   enum: ['none', 'digitalSignature', 'eSignature'],
  //   default: 'none'
  // },
  // signatureId: {
  //   type: String,
  //   default: null
  // },
  // signatureImage: {
  //   type: String,
  //   default: null
  // },
  // signatureName: {
  //   type: String,
  //   default: null
  // },
  checkNumber: {
    type: String,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  supplierName: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  billFrom: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  billTo: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  broker: {
    brokerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerDetail',
      default: null
    },
    name: { type: String, default: null },
    phone: { type: String, default: null },
    commissionType: {
      type: String,
      enum: ['Fixed', 'Percentage'],
      default: 'Percentage'
    },
    commissionValue: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 }
  },

  // expenses: {
  //   garageCharges: { type: Number, default: 0 },
  //   loadingCharges: { type: Number, default: 0 },
  //   unloadingCharges: { type: Number, default: 0 },
  //   transportCharges: { type: Number, default: 0 },
  //   otherCharges: { type: Number, default: 0 },
  //   expenseNotes: { type: String, default: "" },
  //   totalExpenses: { type: Number, default: 0 }
  // },

  finalAmount: {
    type: Number,
    required: true
  },
}, {
  timestamps: true
});

purchaseSchema.statics.generateNextPurchaseId = async function () {
  const lastPurchase = await this.findOne({ purchaseId: /^PUR-\d+$/ })
    .sort({ purchaseId: -1 })
    .select('purchaseId')
    .lean();

  const lastNumber = lastPurchase?.purchaseId
    ? parseInt(lastPurchase.purchaseId.split('-')[1], 10)
    : 0;
  const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `PUR-${String(nextNumber).padStart(6, '0')}`;
};

// Pre-save hook to generate purchase ID
purchaseSchema.pre('save', async function (next) {
  if (!this.purchaseId) {
    try {
      this.purchaseId = await this.constructor.generateNextPurchaseId();
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

purchaseSchema.plugin(offlineSyncPlugin);
module.exports = mongoose.model('Purchase', purchaseSchema);
