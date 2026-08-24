const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const taxRateSchema = new mongoose.Schema(
    {
        tax_name: {
            type: String,
            required: true,
            trim: true,
        },
        tax_rate: {
            type: Number,
            required: true,
        },
        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

taxRateSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('TaxRate', taxRateSchema);
