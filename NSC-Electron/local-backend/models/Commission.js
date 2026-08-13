const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema({
  commissionId: { type: String, unique: true },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Invoice",
    required: true
  },

  // ✅ NEW: Array of items for this staff in this invoice
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
      designNo: { type: String },
      qty: Number,
      rate: Number,
      amount: Number,            // qt * rate
      commissionPercent: Number,
      commissionAmount: Number   // calculated commission for this line
    }
  ],

  // ✅ NEW: Total commission for this document (sum of all items)
  totalCommissionAmount: Number,

  // kept for backward compatibility if needed, or just for metadata
  month: { type: String },   // "2025-01"
  date: { type: String },    // "2025-12-04"

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isPaidOut: { type: Boolean, default: false },
  paidAt: Date,
}, { timestamps: true });

commissionSchema.pre("save", async function (next) {
  if (!this.commissionId) {
    const count = await this.constructor.countDocuments();
    this.commissionId = `COM-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Commission", commissionSchema);
