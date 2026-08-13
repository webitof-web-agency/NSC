const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema({
  unitId: {
    type: String,
    required: false,
  },
  quantity: {
    type: Number,
    required: true
  },
  notes: {
    type: String
  },
  type: {
    type: String,
    enum: ['stock_in', 'stock_out', 'adjustment'],
    required: true
  },
  adjustment: {
    type: Number,
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceType: {
    type: String,
    enum: ['purchase', 'invoice', 'return', 'adjustment', 'exchange', 'opening_stock']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {                                    // NEW
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
  },
  quantity: {
    type: Number,
    default: 0,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  inventory_history: [inventoryHistorySchema],
  notes: String
}, {
  timestamps: true
});

// Add unique index to prevent duplicates (per variant, not per product+variant)
inventorySchema.index({ variantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);
