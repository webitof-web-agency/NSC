// local-backend/models/LocalConfig.js
'use strict';

const mongoose = require('mongoose');

const localConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.models.LocalConfig || mongoose.model('LocalConfig', localConfigSchema);
