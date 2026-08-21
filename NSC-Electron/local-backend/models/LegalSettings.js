const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const legalSettingsSchema = new mongoose.Schema({
  privacyPolicy: {
    type: String,
    default: ''
  },
  termsAndConditions: {
    type: String,
    default: ''
  },
  dataDeletion: {
    type: String,
    default: ''
  }
}, { timestamps: true });

legalSettingsSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('LegalSettings', legalSettingsSchema);
