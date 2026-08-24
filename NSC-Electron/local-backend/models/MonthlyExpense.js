const mongoose = require('mongoose');

const monthlyExpenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Expense category (predefined from ExpenseCategory model)
    expenseCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },

    // Basic expense details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    description: {
      type: String,
      default: '',
    },

    // Payment details
    paymentMode: {
      type: String,
      enum: ['Cash', 'Online', 'Cheque', 'RTGS/NEFT', ''],
      default: '',
    },

    // Source tracking (e.g., PURCHASE)
    sourceType: {
      type: String,
      default: '',
      trim: true,
    },
    sourceId: {
      type: String,
      default: '',
      trim: true,
    },

    // Custom fields for flexible data storage
    customFields: [{
      key: {
        type: String,
        required: true,
      },
      value: {
        type: String,
        required: true,
      }
    }],

    paymentDate: {
      type: Date,
      default: null,
    },

    paymentDueDate: {
      type: Date,
      default: null,
    },

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
monthlyExpenseSchema.index({ userId: 1, expenseDate: -1 });
monthlyExpenseSchema.index({ expenseCategory: 1 });
monthlyExpenseSchema.index({ sourceType: 1, sourceId: 1 });
monthlyExpenseSchema.index({ isDeleted: 1 });

const MonthlyExpense = mongoose.model('MonthlyExpense', monthlyExpenseSchema);

module.exports = MonthlyExpense;
