const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    designNo: { type: String, trim: true },
    color: { type: String, trim: true },
    size: { type: String, trim: true },
    // hsn_code: { type: String, trim: true },
    purchase_price: { type: Number, default: 0 },
    sale_price: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    min_sale_price: { type: Number, default: 0 },
    reorder_limit: { type: Number, default: 0 },
    // opening_qty: { type: Number, default: 0 }, // initial stock for this variant
    discount_value: { type: Number, default: 0 },
    barcode: { type: String, required: true, trim: true }, // deterministic; duplicates allowed for same pricing config
    barcodeKey: { type: String, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // status: { type: Boolean, default: true }
}, {
    timestamps: true,
});

productVariantSchema.index({ barcode: 1 });

module.exports = mongoose.model('ProductVariant', productVariantSchema);
