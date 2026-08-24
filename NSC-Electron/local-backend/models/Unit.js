const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const unitSchema = new mongoose.Schema({
  unit_name: {
    type: String,
    required: true,
    trim: true
  },
  short_name: {
    type: String,
    required: true,
    trim: true,
    default: ""
  },
  status: {
    type: Boolean,
    default: true // true = active, false = inactive
  }
}, {
  timestamps: true
});

unitSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('Unit', unitSchema);
