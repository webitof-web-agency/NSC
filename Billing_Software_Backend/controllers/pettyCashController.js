const mongoose = require('mongoose');
const PettyCash = require('@models/PettyCash');
const PettyCashTransaction = require('@models/PettyCashTransaction');
const BankDetail = require('@models/BankDetail');
const BankTransaction = require('@models/BankTransaction');
const PaymentMode = require('@models/PaymentMode');
const dayjs = require('dayjs');

const createPettyCash = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { bankAccountId, amount, paymentModeId } = req.body;

    // Convert amount from string to number
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!bankAccountId || !paymentModeId) {
      return res.status(400).json({
        success: false,
        message: 'bankAccountId and paymentModeId are required'
      });
    }

    // Find payment mode first
    const paymentMode = await PaymentMode.findById(paymentModeId).session(session);
    if (!paymentMode || paymentMode.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Payment mode not found' });
    }

    const bankAccount = await BankDetail.findById(bankAccountId).session(session);
    if (!bankAccount || bankAccount.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // Convert bankAccount.currentBalance to float for comparison
    const bankBalance = parseFloat(bankAccount.currentBalance.toString());
    if (bankBalance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Insufficient bank balance' });
    }

    // Determine bank transaction type based on payment mode slug
    let bankTransactionType;
    if (paymentMode.slug === 'cash') {
      bankTransactionType = 'WITHDRAWAL';
    } else {
      bankTransactionType = 'TRANSFER_OUT';
    }

    // Check if petty cash exists
    let pettyCash = await PettyCash.findOne({}).session(session);

    // Calculate petty cash balances
    const pettyBalanceBefore = pettyCash ? parseFloat(pettyCash.currentBalance.toString()) : 0;
    const pettyBalanceAfter = pettyBalanceBefore + amount;

    if (!pettyCash) {
      pettyCash = new PettyCash({
        openingBalance: amount,
        currentBalance: amount,
        asOnDate: new Date()
      });
      await pettyCash.save({ session });
    } else {
      pettyCash.currentBalance = pettyBalanceAfter;
      pettyCash.asOnDate = new Date();
      await pettyCash.save({ session });
    }

    // Create bank transaction
    const bankTransaction = new BankTransaction({
      bankAccountId: bankAccount._id,
      transactionDate: new Date(),
      type: bankTransactionType,
      amount: mongoose.Types.Decimal128.fromString(amount.toString()),
      balanceBefore: bankAccount.currentBalance,
      balanceAfter: mongoose.Types.Decimal128.fromString((bankBalance - amount).toString()),
      paymentModeId: paymentModeId,
      relatedType: 'PETTYCASH',
      relatedId: pettyCash._id,
      remarks: 'Transfer to petty cash'
    });
    await bankTransaction.save({ session });

    // Update bank account balance
    bankAccount.currentBalance = mongoose.Types.Decimal128.fromString((bankBalance - amount).toString());
    bankAccount.asOnDate = new Date();
    await bankAccount.save({ session });

    // Create petty cash transaction (ADD)
    const pettyTransaction = new PettyCashTransaction({
      pettyCashId: pettyCash._id,
      transactionDate: new Date(),
      transactionType: 'ADD',
      amount: mongoose.Types.Decimal128.fromString(amount.toString()),
      balanceBefore: mongoose.Types.Decimal128.fromString(pettyBalanceBefore.toString()),
      balanceAfter: mongoose.Types.Decimal128.fromString(pettyBalanceAfter.toString()),
      remarks: 'Transferred from bank account',
      relatedType: 'BANK', // Changed from 'PETTY_CASH' to 'BANK'
      relatedId: bankTransaction._id
    });
    await pettyTransaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Petty cash created/updated successfully with bank transfer',
      data: {
        pettyCash,
        bankTransaction: {
          ...bankTransaction.toObject(),
          type: bankTransactionType,
          paymentMode: paymentMode.name
        },
        pettyTransaction
      }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Petty cash creation error:', err);
    res.status(500).json({ success: false, message: 'Error creating petty cash', error: err.message });
  }
};

const listPettyCash = async (req, res) => {
  try {
    // Fetch the petty cash record (only one)
    const pettyCash = await PettyCash.findOne({ isDeleted: false });
    if (!pettyCash) {
      return res.status(200).json({
        success: true,
        message: 'No petty cash found',
        data: { pettyCash: null }
      });
    }

    // Transform petty cash data
    const pettyCashData = {
      id: pettyCash._id,
      openingBalance: parseFloat(pettyCash.openingBalance?.toString() || '0'),
      currentBalance: parseFloat(pettyCash.currentBalance?.toString() || '0'),
      asOnDate: pettyCash.asOnDate,
      createdAt: pettyCash.createdAt,
      updatedAt: pettyCash.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Petty cash details fetched successfully',
      data: {
        pettyCash: pettyCashData
      }
    });

  } catch (err) {
    console.error('List petty cash error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching petty cash details',
      error: err.message
    });
  }
};

const returnPettyCash = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bankAccountId, amount, paymentModeId, remarks } = req.body;

    if (!bankAccountId || !amount || !paymentModeId) {
      return res.status(400).json({
        success: false,
        message: 'bankAccountId, amount, and paymentModeId are required',
      });
    }

    // Find payment mode first
    const paymentMode = await PaymentMode.findById(paymentModeId).session(session);
    if (!paymentMode || paymentMode.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Payment mode not found' });
    }

    // Fetch petty cash (only one record)
    const pettyCash = await PettyCash.findOne({}).session(session);
    if (!pettyCash) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Petty cash not found' });
    }

    const pettyBalanceBefore = parseFloat(pettyCash.currentBalance.toString());
    const returnAmount = parseFloat(amount);

    if (pettyBalanceBefore < returnAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Insufficient petty cash balance',
      });
    }

    // Fetch bank account
    const bankAccount = await BankDetail.findById(bankAccountId).session(session);
    if (!bankAccount || bankAccount.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // Calculate balances before/after
    const pettyBalanceAfter = pettyBalanceBefore - returnAmount;
    const bankBalanceBefore = parseFloat(bankAccount.currentBalance.toString());
    const bankBalanceAfter = bankBalanceBefore + returnAmount;

    // Determine bank transaction type based on payment mode slug
    let bankTransactionType;
    if (paymentMode.slug === 'cash') {
      bankTransactionType = 'DEPOSIT';
    } else {
      bankTransactionType = 'TRANSFER_IN';
    }

    // Create bank transaction FIRST to get its ID
    const bankTransaction = new BankTransaction({
      bankAccountId: bankAccount._id,
      transactionDate: new Date(),
      type: bankTransactionType,
      amount: mongoose.Types.Decimal128.fromString(returnAmount.toString()),
      balanceBefore: mongoose.Types.Decimal128.fromString(bankBalanceBefore.toString()),
      balanceAfter: mongoose.Types.Decimal128.fromString(bankBalanceAfter.toString()),
      paymentModeId: paymentModeId,
      relatedType: 'PETTYCASH',
      relatedId: pettyCash._id,
      remarks: remarks || 'Returned petty cash deposit',
    });
    await bankTransaction.save({ session });

    // Create petty cash transaction (RETURN) with bankTransaction ID as relatedId
    const pettyTransaction = new PettyCashTransaction({
      pettyCashId: pettyCash._id,
      transactionDate: new Date(),
      transactionType: 'RETURN',
      amount: mongoose.Types.Decimal128.fromString(returnAmount.toString()),
      balanceBefore: mongoose.Types.Decimal128.fromString(pettyBalanceBefore.toString()),
      balanceAfter: mongoose.Types.Decimal128.fromString(pettyBalanceAfter.toString()),
      remarks: remarks || 'Returned to bank',
      relatedType: 'BANK',
      relatedId: bankTransaction._id, // Store bankTransaction ID here
    });
    await pettyTransaction.save({ session });

    // Update petty cash balance
    pettyCash.currentBalance = mongoose.Types.Decimal128.fromString(pettyBalanceAfter.toString());
    pettyCash.asOnDate = new Date();
    await pettyCash.save({ session });

    // Update bank balance
    bankAccount.currentBalance = mongoose.Types.Decimal128.fromString(bankBalanceAfter.toString());
    bankAccount.asOnDate = new Date();
    await bankAccount.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Petty cash successfully returned to bank',
      data: {
        pettyCash,
        bankAccount,
        pettyTransaction,
        bankTransaction: {
          ...bankTransaction.toObject(),
          type: bankTransactionType,
          paymentMode: paymentMode.name
        },
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Petty cash return error:', err);
    res.status(500).json({
      success: false,
      message: 'Error returning petty cash',
      error: err.message,
    });
  }
};

const listPettyCashTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      transactionType,
      relatedType,
      startDate,
      endDate,
    } = req.query;

    const skip = (page - 1) * limit;

    // Base match query
    const matchQuery = { isDeleted: false };

    if (transactionType && ["ADD", "SPEND", "RETURN"].includes(transactionType)) {
      matchQuery.transactionType = transactionType;
    }

    if (relatedType && ["BANK", "SUPPLIER_PAYMENT", "EXPENSE"].includes(relatedType)) {
      matchQuery.relatedType = relatedType;
    }

    if (startDate || endDate) {
      matchQuery.transactionDate = {};
      if (startDate) matchQuery.transactionDate.$gte = new Date(startDate);
      if (endDate) matchQuery.transactionDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      matchQuery.$or = [
        { remarks: { $regex: search, $options: "i" } },
      ];
    }

    // Count total for pagination
    const total = await PettyCashTransaction.countDocuments(matchQuery);

    // Aggregation pipeline - Simplified
    const transactions = await PettyCashTransaction.aggregate([
      { $match: matchQuery },
      { $sort: { transactionDate: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },

      // Lookup BankTransaction only for BANK relatedType
      {
        $lookup: {
          from: "banktransactions",
          let: { relatedId: "$relatedId", relatedType: "$relatedType" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$relatedId"] },
                    { $eq: ["$$relatedType", "BANK"] }
                  ]
                }
              }
            }
          ],
          as: "bankTransaction",
        },
      },
      { $unwind: { path: "$bankTransaction", preserveNullAndEmptyArrays: true } },

      // Lookup BankDetail only for BANK transactions
      {
        $lookup: {
          from: "bankdetails",
          let: { bankAccountId: "$bankTransaction.bankAccountId", relatedType: "$relatedType" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$bankAccountId"] },
                    { $eq: ["$$relatedType", "BANK"] }
                  ]
                },
                isDeleted: false
              }
            }
          ],
          as: "bankDetail",
        },
      },
      { $unwind: { path: "$bankDetail", preserveNullAndEmptyArrays: true } },

      // Lookup PaymentMode only for BANK transactions
      {
        $lookup: {
          from: "paymentmodes",
          localField: "bankTransaction.paymentModeId",
          foreignField: "_id",
          as: "paymentMode",
        },
      },
      { $unwind: { path: "$paymentMode", preserveNullAndEmptyArrays: true } },

      // Project final fields with simplified logic
      {
        $project: {
          _id: 1,
          pettyCashId: 1,
          transactionDate: 1,
          transactionType: 1,
          amount: { $toDouble: "$amount" },
          balanceBefore: { $toDouble: "$balanceBefore" },
          balanceAfter: { $toDouble: "$balanceAfter" },
          remarks: 1,
          relatedType: 1,
          relatedId: 1,
          createdAt: 1,
          updatedAt: 1,

          // Determine payment mode based on relatedType
          displayPaymentMode: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$relatedType", "BANK"] },
                  then: {
                    _id: "$paymentMode._id",
                    name: "$paymentMode.name",
                    slug: "$paymentMode.slug"
                  }
                },
                {
                  case: { $eq: ["$relatedType", "EXPENSE"] },
                  then: {
                    name: "Petty Cash",
                    slug: "petty_cash"
                  }
                },
                {
                  case: { $eq: ["$relatedType", "SUPPLIER_PAYMENT"] },
                  then: {
                    name: "Petty Cash",
                    slug: "petty_cash"
                  }
                }
              ],
              default: {
                name: "Unknown",
                slug: "unknown"
              }
            }
          },

          // Determine transaction source/details
          transactionSource: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$relatedType", "BANK"] },
                  then: {
                    type: "$bankTransaction.type",
                    bankInfo: {
                      bankName: "$bankDetail.bankName",
                      accountHolderName: "$bankDetail.accountHoldername",
                      accountNumber: "$bankDetail.accountNumber",
                      ifscCode: "$bankDetail.IFSCCode"
                    }
                  }
                },
                {
                  case: { $eq: ["$relatedType", "EXPENSE"] },
                  then: {
                    type: "EXPENSE_PAYMENT",
                    description: "Expense Payment"
                  }
                },
                {
                  case: { $eq: ["$relatedType", "SUPPLIER_PAYMENT"] },
                  then: {
                    type: "SUPPLIER_PAYMENT",
                    description: "Supplier Payment"
                  }
                }
              ],
              default: {
                type: "OTHER",
                description: "Other Transaction"
              }
            }
          }
        },
      },
    ]);

    // Format response
    const formatted = transactions.map((txn) => ({
      id: txn._id,
      transactionDate: txn.transactionDate,
      transactionType: txn.transactionType,
      relatedType: txn.relatedType,
      amount: txn.amount,
      balanceBefore: txn.balanceBefore,
      balanceAfter: txn.balanceAfter,
      remarks: txn.remarks,
      paymentMode: txn.displayPaymentMode,
      transactionSource: txn.transactionSource,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: "Petty cash transactions fetched successfully",
      data: {
        transactions: formatted,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("List petty cash transactions error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching petty cash transactions",
      error: err.message,
    });
  }
};

const getFinancialSummary = async (req, res) => {
  try {
    // 1️⃣ Get total current balances
    const bankTotals = await BankDetail.aggregate([
      { $match: { isDeleted: false, status: true } },
      { $group: { _id: null, total: { $sum: { $toDecimal: "$currentBalance" } } } }
    ]);

    const pettyTotals = await PettyCash.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: { $toDecimal: "$currentBalance" } } } }
    ]);

    const bankCurrentBalance = bankTotals.length ? Number(bankTotals[0].total) : 0;
    const pettyCashCurrentBalance = pettyTotals.length ? Number(pettyTotals[0].total) : 0;

    // 2️⃣ Chart Data: last 30 days
    const today = dayjs();
    const start30 = today.subtract(29, 'day').startOf('day').toDate();

    const bankTx30 = await BankTransaction.aggregate([
      { $match: { isDeleted: false, transactionDate: { $gte: start30 } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
          lastBalance: { $last: "$balanceAfter" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const pettyTx30 = await PettyCashTransaction.aggregate([
      { $match: { isDeleted: false, transactionDate: { $gte: start30 } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
          lastBalance: { $last: "$balanceAfter" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const last30Days = [];
    for (let i = 0; i < 30; i++) {
      const dateObj = today.subtract(29 - i, 'day');
      const dateLabel = dateObj.format('D MMM'); // <-- 25 Sep format
      const bank = bankTx30.find(d => d._id === dateObj.format('YYYY-MM-DD'))?.lastBalance ?? bankCurrentBalance;
      const petty = pettyTx30.find(d => d._id === dateObj.format('YYYY-MM-DD'))?.lastBalance ?? pettyCashCurrentBalance;

      last30Days.push({
        label: dateLabel,
        bank: Number(bank),
        pettyCash: Number(petty)
      });
    }

    // 3️⃣ Chart Data: last 12 months
    const start12 = today.subtract(11, 'month').startOf('month').toDate();

    const bankTx12 = await BankTransaction.aggregate([
      { $match: { isDeleted: false, transactionDate: { $gte: start12 } } },
      {
        $group: {
          _id: {
            year: { $year: "$transactionDate" },
            month: { $month: "$transactionDate" }
          },
          lastBalance: { $last: "$balanceAfter" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const pettyTx12 = await PettyCashTransaction.aggregate([
      { $match: { isDeleted: false, transactionDate: { $gte: start12 } } },
      {
        $group: {
          _id: {
            year: { $year: "$transactionDate" },
            month: { $month: "$transactionDate" }
          },
          lastBalance: { $last: "$balanceAfter" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const last12Months = [];
    for (let i = 0; i < 12; i++) {
      const date = today.subtract(11 - i, 'month');
      const label = date.format('MMM YYYY');
      const month = date.month() + 1;
      const year = date.year();

      const bank = bankTx12.find(d => d._id.year === year && d._id.month === month)?.lastBalance ?? bankCurrentBalance;
      const petty = pettyTx12.find(d => d._id.year === year && d._id.month === month)?.lastBalance ?? pettyCashCurrentBalance;

      last12Months.push({
        label,
        bank: Number(bank),
        pettyCash: Number(petty)
      });
    }

    // ✅ Final Response
    return res.status(200).json({
      success: true,
      data: {
        totals: {
          bankCurrentBalance,
          pettyCashCurrentBalance
        },
        chartData: {
          last30Days,
          last12Months
        }
      }
    });

  } catch (error) {
    console.error('Error in getFinancialSummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

module.exports = {
  createPettyCash,
  listPettyCash,
  returnPettyCash,
  listPettyCashTransactions,
  getFinancialSummary
};
