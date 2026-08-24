const offlineSyncPlugin = require('../middleware/offlineSync');
const mongoose = require("mongoose");

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
        costPriceSnapshot: {
          type: Number,
          default: 0,
        },
        totalCostSnapshot: {
          type: Number,
          default: 0,
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
        costPriceSnapshot: {
          type: Number,
          default: 0,
        },
        totalCostSnapshot: {
          type: Number,
          default: 0,
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
      enum: ["CASH", "CARD", "RAZORPAY", "MIXED", "CREDIT", "PHONEPE", "UPI"],
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
    customerGstin: {
      type: String,
      trim: true,
      default: "",
    },
    ewayBillNumber: {
      type: String,
      trim: true,
      default: "",
    },
    shippingAddress: {
      name: { type: String, trim: true, default: "" },
      addressLine1: { type: String, trim: true, default: "" },
      addressLine2: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      pincode: { type: String, trim: true, default: "" },
    },
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
    },
    profit_amount: {
      type: Number,
      default: null,
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
    cardAmount: {
      type: Number,
      default: null,
      // Card portion for MIXED payment method
    },
    upiAmount: {
      type: Number,
      default: null,
      // UPI portion for MIXED payment method (previously phonePeAmount)
    },
    publicShareId: {
      type: String,
      unique: true,
      sparse: true,
    },
    publicShareEnabled: {
      type: Boolean,
      default: true,
    },
    publicShareCreatedAt: Date,
    publicShareRegeneratedAt: Date
  },
  { timestamps: true }
);

invoiceSchema.pre("save", async function (next) {
  try {
    if (!this.invoiceNumber) {
      const count = await this.constructor.countDocuments();
      this.invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

invoiceSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model("Invoice", invoiceSchema);
