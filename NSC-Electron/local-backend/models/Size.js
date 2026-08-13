const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

sizeSchema.pre('validate', function (next) {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Size', sizeSchema);
