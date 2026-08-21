const mongoose = require("mongoose");
const offlineSyncPlugin = require('../middleware/offlineSync');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["invoice_credit_pending", "quotation_expiry_pending", "purchase_due_pending"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    entityType: {
      type: String,
      enum: ["invoice", "quotation", "purchase"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityTypeRef",
    },
    entityTypeRef: {
      type: String,
      default: "Invoice",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "resolved"],
      default: "active",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    actionUrl: {
      type: String,
      default: "",
    },
    meta: {
      invoiceNumber: { type: String, default: "" },
      quotationId: { type: String, default: "" },
      purchaseId: { type: String, default: "" },
      customerName: { type: String, default: "" },
      customerPhone: { type: String, default: "N/A" },
      supplierName: { type: String, default: "" },
      supplierBillNumber: { type: String, default: "" },
      balanceAmount: { type: Number, default: 0 },
      pendingDays: { type: Number, default: 0 },
      dueDate: { type: Date, default: null },
      invoiceDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      statusLabel: { type: String, default: "" },
    },
    notificationDate: {
      type: String,
      required: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, status: 1, isRead: 1 });
notificationSchema.index({ type: 1, entityId: 1, status: 1 });
notificationSchema.index({ dedupeKey: 1, status: 1 }, { unique: true });

notificationSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model("Notification", notificationSchema);
