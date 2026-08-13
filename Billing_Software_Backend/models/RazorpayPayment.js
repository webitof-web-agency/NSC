const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    referenceType: {
      type: String,
      enum: ["invoice", "purchase"],
      required: true,
    },

    // ✅ INVOICE NUMBER (STRING)
    referenceNumber: {
      type: String,
      required: true,
    },

    // ✅ ACTUAL MONGO ID (LINK LATER)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    gateway: {
      type: String,
      default: "razorpay",
    },

    orderId: {
      type: String,
      required: true,
    },

    paymentId: String,

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
