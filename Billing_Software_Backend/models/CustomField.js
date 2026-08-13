const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema(
  {
    labelName: {
      type: String,
      required: true,
      trim: true,
    },
    dataType: {
      type: String,
      required: true,
      enum: ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio', 'currency', 'email', 'boolean', 'array'],
    },
    inputFormat: {
      type: String,
      required: false,
      enum: ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio', 'currency', 'email', 'numbers-only', 'alphanumeric', 'alphabets-without-spaces'],
      set: function(value) {
        // Convert empty string to undefined to avoid enum validation error
        return value === '' ? undefined : value;
      },
    },
    helpText: {
      type: String,
      trim: true,
    },
    defaultValue: {
      type: String,
      trim: true,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    moduleName: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Index for better query performance
customFieldSchema.index({ createdBy: 1, isActive: 1 });
customFieldSchema.index({ labelName: 1 });
customFieldSchema.index({ moduleName: 1 });

module.exports = mongoose.model('CustomField', customFieldSchema);
