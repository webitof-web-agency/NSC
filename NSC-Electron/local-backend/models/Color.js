const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true, trim: true },
    hexCode: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

colorSchema.pre('validate', function (next) {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Color', colorSchema);
