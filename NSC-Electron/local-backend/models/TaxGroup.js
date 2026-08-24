const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const taxGroupSchema = new mongoose.Schema(
    {
        tax_name: {
            type: String,
            required: true,
            trim: true,
        },
        tax_rate_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'TaxRate'
            }
        ],
        status: {
            type: Boolean,
            default: true,
        },
        created_on: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);
taxGroupSchema.methods.calculateTotalTaxRate = async function () {
    await this.populate('tax_rate_ids');
    return this.tax_rate_ids.reduce((total, rate) => total + (rate.tax_rate || 0), 0);
};


taxGroupSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('TaxGroup', taxGroupSchema);
