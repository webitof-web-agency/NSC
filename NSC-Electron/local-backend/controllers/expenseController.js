// controllers/Admin/Expense/expenseController.js
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Expense = require('@models/Expense');
const PaymentMode = require('@models/PaymentMode');
const PettyCash = require('@models/PettyCash');
const PettyCashTransaction = require('@models/PettyCashTransaction');
const BankDetail = require('@models/BankDetail');
const BankTransaction = require('@models/BankTransaction');
const ExpenseCategory = require('@models/ExpenseCategory');
const User = require('@models/User');
const ExpenseChangeLog = require('@models/ExpenseChangeLog');
// ---------- CREATE EXPENSE ----------
const createExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      const formattedErrors = {};
      errors.array().forEach((err) => {
        const path = err.path || err.param || 'general';
        formattedErrors[path] = err.msg;
      });
      return res.status(400).json({ errors: formattedErrors });
    }

    const {
      referenceNo,
      amount,
      expenseDate,
      paymentMode,
      paymentStatus,
      description,
      expenseCategoryId,
      sourceType,
      bankId,
    } = req.body;

    const userId = req.user;

    // ===== Validation =====
    if (!["BANK", "PETTY_CASH"].includes(sourceType)) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: { sourceType: 'Invalid source type. Must be BANK or PETTY_CASH.' } });
    }

    if (sourceType === "BANK" && !bankId) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: { bankId: 'Bank ID is required for BANK expenses.' } });
    }

    if (sourceType === "BANK" && !paymentMode) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: { paymentMode: 'Payment mode is required for BANK expenses.' } });
    }

    if (!expenseCategoryId) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: { expenseCategoryId: 'Expense category is required.' } });
    }

    // Ensure valid amount
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      let errorMsg = "Amount must be a valid positive number.";
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: { amount: errorMsg } });
    }

    let attachment = req.file ? req.file.path : null;

    // ===== BALANCE VALIDATION =====
    if (sourceType === "BANK") {
      const bank = await BankDetail.findById(bankId).session(session);
      if (!bank) throw new Error("Bank not found.");

      const currentBalance = parseFloat(bank.currentBalance.toString());
      if (expenseAmount > currentBalance) {
        return res.status(400).json({ success: false, message: 'Validation failed.', errors: { amount: 'Insufficient bank balance for this expense.' } });
      }

    } else if (sourceType === "PETTY_CASH") {
      const pettyCash = await PettyCash.findOne().session(session);
      if (!pettyCash) {
        let errorMsg = "Petty cash not found.";
        return res.status(400).json({ success: false, message: 'Validation failed.', errors: { amount: errorMsg } });
      }

      const currentBalance = parseFloat(pettyCash.currentBalance.toString());
      if (expenseAmount > currentBalance) {
        //through error with currentBalance
        let errorMsg = "Insufficient balance, current balance is " + currentBalance;
        return res.status(400).json({ success: false, message: 'Validation failed.', errors: { amount: errorMsg } });
      }
    }

    // ===== Create Expense =====
    const expense = new Expense({
      referenceNo: referenceNo || "",
      amount: expenseAmount,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMode: sourceType === "BANK" ? paymentMode : null,
      paymentStatus: paymentStatus || "PENDING",
      description: description || "",
      attachment,
      expenseCategoryId,
      sourceType,
      bankId: sourceType === "BANK" ? bankId : null,
      userId,
    });

    await expense.save({ session });

    // ===== Handle Transactions =====
    if (sourceType === "BANK") {
      const paymentModeDetails = await PaymentMode.findById(paymentMode).session(session);
      if (!paymentModeDetails) {
        let errorMsg = "Payment mode not found.";
        return res.status(400).json({ success: false, message: 'Validation failed.', errors: { paymentMode: errorMsg } });
      }
      let transactionType = paymentModeDetails.slug === 'cash' ? 'WITHDRAWAL' : 'TRANSFER_OUT';
      const bank = await BankDetail.findById(bankId).session(session);
      const balanceBefore = parseFloat(bank.currentBalance.toString());
      const balanceAfter = balanceBefore - expenseAmount;

      bank.currentBalance = balanceAfter.toFixed(2);
      await bank.save({ session });

      await BankTransaction.create(
        [
          {
            bankAccountId: bankId,
            transactionDate: new Date(),
            type: transactionType,
            amount: expenseAmount,
            balanceBefore,
            balanceAfter,
            paymentModeId: paymentMode,
            referenceNo: referenceNo || null,
            remarks: description || null,
            relatedType: "EXPENSE",
            relatedId: expense._id,
          },
        ],
        { session }
      );
    } else if (sourceType === "PETTY_CASH") {
      const pettyCash = await PettyCash.findOne().session(session);
      const balanceBefore = parseFloat(pettyCash.currentBalance.toString());
      const balanceAfter = balanceBefore - expenseAmount;

      pettyCash.currentBalance = balanceAfter.toFixed(2);
      await pettyCash.save({ session });

      await PettyCashTransaction.create(
        [
          {
            pettyCashId: pettyCash._id,
            transactionDate: new Date(),
            transactionType: "SPEND",
            amount: expenseAmount,
            balanceBefore,
            balanceAfter,
            remarks: description || null,
            relatedType: "EXPENSE",
            relatedId: expense._id,
          },
        ],
        { session }
      );
    }

    // ===== Create Change Log =====
    await ExpenseChangeLog.create(
      [
        {
          expenseId: expense._id,
          changedBy: userId,
          changes: [
            { field: "create", oldValue: null, newValue: expense.toObject() },
          ],
        },
      ],
      { session }
    );

    // ===== Commit Transaction =====
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Create expense error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error creating expense",
        error: err.message,
      });
  }
};


// ---------- GET ALL EXPENSES ----------
const getAllExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      paymentStatus,
      search = "",
      startDate,
      endDate,
      paymentMode,
      sourceType,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isDeleted: false };

    // Filter by Payment Status
    if (paymentStatus && ["PAID", "CANCELLED", "PENDING"].includes(paymentStatus.toUpperCase())) {
      query.paymentStatus = paymentStatus.toUpperCase();
    }

    // Filter by Payment Mode
    if (paymentMode && mongoose.Types.ObjectId.isValid(paymentMode)) {
      query.paymentMode = paymentMode;
    }

    // Filter by Source Type
    if (sourceType && ["BANK", "PETTY_CASH"].includes(sourceType.toUpperCase())) {
      query.sourceType = sourceType.toUpperCase();
    }

    // Filter by Date Range
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) query.expenseDate.$lte = new Date(endDate);
    }

    // Search by text
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { expenseId: searchRegex },
        { referenceNo: searchRegex },
        { description: searchRegex },
      ];
    }

    // Count total
    const total = await Expense.countDocuments(query);

    // Query with population
    const expenses = await Expense.find(query)
      .populate("paymentMode", "name slug")
      .populate("expenseCategoryId", "name")
      .populate("bankId", "bankName accountNumber")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    // Format response
    const formattedExpenses = expenses.map((exp) => ({
      id: exp._id,
      expenseId: exp.expenseId,
      referenceNo: exp.referenceNo,
      amount: exp.amount,
      expenseDate: exp.expenseDate
        ? exp.expenseDate.toISOString().split("T")[0]
        : null,
      sourceType: exp.sourceType,
      expenseCategory: exp.expenseCategoryId
        ? { id: exp.expenseCategoryId._id, name: exp.expenseCategoryId.name }
        : null,
      paymentMode: exp.paymentMode
        ? { id: exp.paymentMode._id, name: exp.paymentMode.name }
        : null,
      bank: exp.bankId
        ? {
          id: exp.bankId._id,
          bankName: exp.bankId.bankName,
          accountNumber: exp.bankId.accountNumber,
        }
        : null,
      paymentStatus: exp.paymentStatus,
      description: exp.description,
      attachment: exp.attachment
        ? `${baseUrl}${exp.attachment.replace(/\\/g, "/")}`
        : null,
      createdBy: exp.userId
        ? { id: exp.userId._id, name: exp.userId.name, email: exp.userId.email }
        : null,
      createdAt: exp.createdAt?.toISOString(),
      updatedAt: exp.updatedAt?.toISOString(),
    }));

    res.status(200).json({
      success: true,
      message: "Expenses retrieved successfully",
      data: {
        expenses: formattedExpenses,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("List expenses error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching expenses",
      error: err.message,
    });
  }
};

// ---------- GET EXPENSE BY ID ----------
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Expense ID" });
    }

    const expense = await Expense.findById(id)
      .populate("paymentMode", "name slug")
      .populate("expenseCategoryId", "name")
      .populate("bankId", "bankName accountNumber")
      .populate("userId", "name email")
      .lean();

    if (!expense || expense.isDeleted) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    res.status(200).json({
      success: true,
      message: "Expense retrieved successfully",
      data: {
        id: expense._id,
        expenseId: expense.expenseId,
        referenceNo: expense.referenceNo,
        amount: expense.amount,
        expenseDate: expense.expenseDate
          ? expense.expenseDate.toISOString().split("T")[0]
          : null,
        sourceType: expense.sourceType,
        expenseCategory: expense.expenseCategoryId
          ? {
            id: expense.expenseCategoryId._id,
            name: expense.expenseCategoryId.name,
          }
          : null,
        paymentMode: expense.paymentMode
          ? {
            id: expense.paymentMode._id,
            name: expense.paymentMode.name,
            slug: expense.paymentMode.slug,
          }
          : null,
        bank: expense.bankId
          ? {
            id: expense.bankId._id,
            bankName: expense.bankId.bankName,
            accountNumber: expense.bankId.accountNumber,
          }
          : null,
        paymentStatus: expense.paymentStatus,
        description: expense.description,
        attachment: expense.attachment
          ? `${baseUrl}${expense.attachment.replace(/\\/g, "/")}`
          : null,
        createdBy: expense.userId
          ? { id: expense.userId._id, name: expense.userId.name, email: expense.userId.email }
          : null,
        createdAt: expense.createdAt?.toISOString(),
        updatedAt: expense.updatedAt?.toISOString(),
      },
    });
  } catch (err) {
    console.error("Get expense by ID error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching expense",
      error: err.message,
    });
  }
};


// ---------- UPDATE EXPENSE ----------
const updateExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Expense ID' });
    }

    const expense = await Expense.findById(id).session(session);
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      referenceNo,
      amount,
      expenseDate,
      paymentMode,
      paymentStatus,
      description,
      expenseCategoryId,
      sourceType,
      bankId
    } = req.body;

    let attachment = req.file ? req.file.path : expense.attachment;

    // Track changes for changelog
    const changes = [];
    const fields = [
      'referenceNo', 'amount', 'expenseDate', 'paymentMode', 'paymentStatus',
      'description', 'expenseCategoryId', 'sourceType', 'bankId', 'attachment'
    ];

    const oldSourceType = expense.sourceType;
    const oldBankId = expense.bankId;
    const oldAmount = parseFloat(expense.amount);

    fields.forEach(field => {
      const newValue = field === 'attachment' ? attachment : req.body[field] ?? expense[field];
      if (expense[field] !== newValue) {
        changes.push({ field, oldValue: expense[field], newValue });
        expense[field] = newValue;
      }
    });

    await expense.save({ session });

    // --------------------------
    // TRANSACTIONS
    // --------------------------

    if (oldSourceType !== sourceType) {
      // Source changed → remove old transactions and add new
      if (oldSourceType === 'BANK' && oldBankId) {
        await BankTransaction.deleteMany({ relatedType: 'EXPENSE', relatedId: expense._id }).session(session);
        const bank = await BankDetail.findById(oldBankId).session(session);
        if (bank) bank.currentBalance = (parseFloat(bank.currentBalance.toString()) + oldAmount).toFixed(2);
        await bank.save({ session });
      } else if (oldSourceType === 'PETTY_CASH') {
        const pettyCash = await PettyCash.findOne().session(session);
        await PettyCashTransaction.deleteMany({ relatedType: 'EXPENSE', relatedId: expense._id }).session(session);
        if (pettyCash) pettyCash.currentBalance = (parseFloat(pettyCash.currentBalance.toString()) + oldAmount).toFixed(2);
        await pettyCash.save({ session });
      }

      // Create new transaction for new source
      if (sourceType === 'BANK') {
        const bank = await BankDetail.findById(bankId).session(session);
        if (!bank) throw new Error('Bank not found');
        const balanceBefore = bank.currentBalance;
        bank.currentBalance = (parseFloat(bank.currentBalance.toString()) - parseFloat(amount)).toFixed(2);
        await bank.save({ session });

        await BankTransaction.create([{
          bankAccountId: bankId,
          transactionDate: new Date(),
          type: 'PAYMENT',
          amount,
          balanceBefore,
          balanceAfter: bank.currentBalance,
          paymentModeId: paymentMode,
          relatedType: 'EXPENSE',
          relatedId: expense._id,
          remarks: description || null,
        }], { session });
      } else if (sourceType === 'PETTY_CASH') {
        const pettyCash = await PettyCash.findOne().session(session);
        if (!pettyCash) throw new Error('Petty cash not found');
        const balanceBefore = pettyCash.currentBalance;
        pettyCash.currentBalance = (parseFloat(pettyCash.currentBalance.toString()) - parseFloat(amount)).toFixed(2);
        await pettyCash.save({ session });

        await PettyCashTransaction.create([{
          pettyCashId: pettyCash._id,
          transactionDate: new Date(),
          transactionType: 'SPEND',
          amount,
          balanceBefore,
          balanceAfter: pettyCash.currentBalance,
          relatedType: 'EXPENSE',
          relatedId: expense._id,
          remarks: description || null
        }], { session });
      }

    } else {
      // Source same → create a new transaction for the difference
      const diff = parseFloat(amount) - oldAmount;
      if (diff !== 0) {
        if (sourceType === 'BANK' && bankId) {
          const bank = await BankDetail.findById(bankId).session(session);
          if (!bank) throw new Error('Bank not found');
          const balanceBefore = bank.currentBalance;
          bank.currentBalance = (parseFloat(bank.currentBalance.toString()) - diff).toFixed(2);
          await bank.save({ session });

          await BankTransaction.create([{
            bankAccountId: bankId,
            transactionDate: new Date(),
            type: diff > 0 ? 'TRANSFER_OUT' : 'TRANSFER_IN',
            amount: Math.abs(diff),
            balanceBefore,
            balanceAfter: bank.currentBalance,
            paymentModeId: paymentMode,
            relatedType: 'EXPENSE',
            relatedId: expense._id,
            remarks: description || null,
          }], { session });

        } else if (sourceType === 'PETTY_CASH') {
          const pettyCash = await PettyCash.findOne().session(session);
          if (!pettyCash) throw new Error('Petty cash not found');
          const balanceBefore = pettyCash.currentBalance;
          pettyCash.currentBalance = (parseFloat(pettyCash.currentBalance.toString()) - diff).toFixed(2);
          await pettyCash.save({ session });

          await PettyCashTransaction.create([{
            pettyCashId: pettyCash._id,
            transactionDate: new Date(),
            transactionType: diff > 0 ? 'SPEND' : 'ADD',
            amount: Math.abs(diff),
            balanceBefore,
            balanceAfter: pettyCash.currentBalance,
            relatedType: 'EXPENSE',
            relatedId: expense._id,
            remarks: description || null
          }], { session });
        }
      }
    }

    // Save ChangeLog
    if (changes.length > 0) {
      await ExpenseChangeLog.create([{
        expenseId: expense._id,
        changedBy: req.user,
        changes,
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update expense error:', err);
    res.status(500).json({ success: false, message: 'Error updating expense', error: err.message });
  }
};

// ---------- DELETE EXPENSE ----------
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Expense ID' });
    }

    const expense = await Expense.findByIdAndDelete(id);
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ success: false, message: 'Error deleting expense', error: err.message });
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
};
