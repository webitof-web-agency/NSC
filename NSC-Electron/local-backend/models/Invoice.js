const mongoose = require("mongoose");
const offlineSyncPlugin = require('../middleware/offlineSync');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Customer",
      required: false,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    referenceNo: {
      type: String,
      default: "",
    },
    items: [
      {
        // id: {
        //   type: String,
        //   required: true,
        // },
        rowId: {
          type: String,
          required: true,  // UUID from frontend
        },
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: false,  // Made optional for bulk imports without products
        },
        // ✅ ADD THIS
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
          default: null,
        },
        variantName: String,
        variantDesignNo: String,
        variantColor: String,
        variantSize: String,
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },
        name: {
          type: String,
          required: true,
        },
        hsn_code: String,
        unit: String,
        qty: Number,
        rate: {
          type: Number,
          required: true,
        },
        discount: {
          type: Number,
          default: 0,
        },
        tax: {
          type: Number,
          default: 0,
        },
        tax_group_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TaxGroup",
        },
        discount_type: {
          type: String,
          enum: ["Fixed", "Percentage"],
          default: "Fixed",
        },
        discount_value: {
          type: Number,
          default: 0,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    exchangeOriginalItems: [
      {
        rowId: {
          type: String,
          required: false,
        },
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: false,
        },
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
          default: null,
        },
        variantName: String,
        variantDesignNo: String,
        variantColor: String,
        variantSize: String,
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },
        name: {
          type: String,
          required: false,
        },
        hsn_code: String,
        unit: String,
        qty: Number,
        rate: {
          type: Number,
          required: false,
        },
        discount: {
          type: Number,
          default: 0,
        },
        tax: {
          type: Number,
          default: 0,
        },
        tax_group_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TaxGroup",
        },
        discount_type: {
          type: String,
          enum: ["Fixed", "Percentage"],
          default: "Fixed",
        },
        discount_value: {
          type: Number,
          default: 0,
        },
        amount: {
          type: Number,
        },
      },
    ],
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING",
        "UNPAID",
        "SENT",
        "PAID",
        "OVERDUE",
        "CANCELLED",
        "PARTIALLY_PAID",
        "EXCHANGE", // Added EXCHANGE for product exchange feature
      ],
      default: "DRAFT",
    },
    payment_method: {
      type: String,
      enum: ["CASH", "RAZORPAY", "MIXED", "CREDIT", "PHONEPE", "UPI"],
      default: null,
    },
    taxableAmount: {
      type: Number,
      required: true,
    },
    TotalAmount: {
      type: Number,
      required: true,
    },
    vat: {
      type: Number,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    overall_discount: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Boolean,
      default: false,
    },
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankDetail",
    },
    notes: String,
    termsAndCondition: String,
    // isRecurring: {                      // hide the isRecurring logic
    //   type: Boolean,
    //   default: false,
    // },
    // parentInvoice: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Invoice",
    //   default: null,
    // },
    // repeatEvery: {
    //   type: String,
    //   enum: ["day", "week", "month", "year", "custom"],
    //   default: "month",
    // },
    // customIntervalNumber: {
    //   type: Number,
    //   default: null,
    // },
    // customIntervalType: {
    //   type: String,
    //   enum: ["day", "week", "month", "year"],
    //   default: null,
    // },
    // startOn: {
    //   type: Date,
    //   default: null,
    // },
    // endsOn: {
    //   type: Date,
    //   default: null,
    // },
    // neverExpire: {
    //   type: Boolean,
    //   default: false,
    // },
    // stopped: {
    //   type: Boolean,
    //   default: false,
    // },
    // lastRecurringDate: {
    //   type: Date,
    //   default: null,
    // },
    // nextRecurringDate: {
    //   type: Date,
    //   default: null,
    // },
    // sign_type: {                      // hide the signature logic
    //   type: String,
    //   enum: ["none", "digitalSignature", "eSignature"],
    //   default: "none",
    // },
    // signatureName: String,
    // signatureId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Signature",
    // },
    // signatureImage: String,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    billFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    billTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      default: null,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    taxType: {
      type: String,
      enum: ["GST", "Non-GST"],
      default: "GST"
    },
    gstType: {
      type: String,
      enum: ["Inclusive", "Exclusive"],
      default: "Exclusive"
    },
    // ✅ PhonePe Integration Fields
    phonepeTransactionId: { type: String, default: null },
    phonepeQRCode: { type: String, default: null }, // base64 image
    phonepePaymentStatus: { 
      type: String, 
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'], 
      default: null 
    },
    // ✅ UPI Integration Fields
    upiTransactionId: { type: String, default: null },
    upiQRCode: { type: String, default: null }, // base64 image or data URI
    upiPaymentStatus: { 
      type: String, 
      enum: ['PENDING', 'SUCCESS', 'FAILED'], 
      default: null 
    },
    // ✅ Exchange Transaction Fields
    returned_amount: {
      type: Number,
      default: null,
      // Only populated for EXCHANGE status invoices when new amount < old amount
    },
    profit_amount: {
      type: Number,
      default: null,
      // Only populated for EXCHANGE status invoices when new amount > old amount
      // and additional payment is received
    },
    exchangeOldTotal: {
      type: Number,
      default: null,
    },
    exchangeNewTotal: {
      type: Number,
      default: null,
    },
    amountDifference: {
      type: Number,
      default: null,
    },
    isExchange: {
      type: Boolean,
      default: false,
    },
    exchangePending: {
      type: Boolean,
      default: false,
    },
    // ✅ MIXED Payment Fields (Cash + UPI split)
    cashAmount: {
      type: Number,
      default: null,
      // Cash portion for MIXED payment method
    },
    upiAmount: {
      type: Number,
      default: null,
      // UPI portion for MIXED payment method (previously phonePeAmount)
    }
  },
  { timestamps: true }
);

invoiceSchema.pre("save", async function (next) {
  try {
    if (!this.invoiceNumber) {
      const { getNextNumber } = require('../utils/numberAllocator');
      this.invoiceNumber = await getNextNumber('INVOICE');
    }
    next();
  } catch (err) {
    next(err);
  }
});

invoiceSchema.plugin(offlineSyncPlugin);
module.exports = mongoose.model("Invoice", invoiceSchema);
