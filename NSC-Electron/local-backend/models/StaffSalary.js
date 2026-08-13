const offlineSyncPlugin = require("../middleware/offlineSync");
const mongoose = require("mongoose");

const staffSalarySchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: {
      type: String, // YYYY-MM
      required: true,
    },
    attendance: {
      present: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      halfDay: { type: Number, default: 0 },
      onLeave: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      payableDays: { type: Number, default: 0 },
    },
    amountPerDay: {
      type: Number,
      default: 0,
    },
    baseSalary: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    totalSalary: {
      type: Number,
      default: 0,
    },
    paymentType: {
      type: String,
      enum: ["ADVANCE", "FULL"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK", "CHEQUE"],
      required: true,
    },
    paidAmount: {
      type: Number,
      required: true,
    },
    paidBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

staffSalarySchema.index({ staffId: 1, month: 1 });

staffSalarySchema.plugin(offlineSyncPlugin);
module.exports = mongoose.model("StaffSalary", staffSalarySchema);
