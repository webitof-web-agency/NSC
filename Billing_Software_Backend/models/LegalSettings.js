const mongoose = require('mongoose');

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

module.exports = mongoose.model('LegalSettings', legalSettingsSchema);
