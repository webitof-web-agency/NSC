const BankDetail = require('@models/BankDetail');
const BankTransaction = require('@models/BankTransaction');
const PettyCash = require('@models/PettyCash');
const PettyCashTransaction = require('@models/PettyCashTransaction');
const User = require('@models/User');
const mongoose = require('mongoose');
const PaymentMode = require('@models/PaymentMode');
const InvoicePayment = require('@models/InvoicePayment');
const SupplierPayment = require('@models/SupplierPayment');
const Expense = require('@models/Expense');

// const createBankDetail = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       accountHoldername,
//       bankName,
//       branchName,
//       accountNumber,
//       IFSCCode,
//       accountType,
//       openingBalance = 0,
//       currentBalance = openingBalance,
//       userId,
//       status = true,
//     } = req.body;
//     //find payment mode where slug is "bank"
//     const paymentModeId = await PaymentMode.findOne({ slug: 'bank' }).session(session);
//     const user = await User.findById(userId).session(session);
//     if (!user) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     const bankDetail = new BankDetail({
//       accountHoldername,
//       bankName,
//       branchName,
//       accountNumber,
//       IFSCCode,
//       accountType,
//       openingBalance,
//       currentBalance,
//       asOnDate: new Date(),
//       userId,
//       status,
//       isDeleted: false
//     });

//     await bankDetail.save({ session });

//     // Create initial bank transaction (DEPOSIT)
//     if (currentBalance > 0) {
//       const transaction = new BankTransaction({
//         bankAccountId: bankDetail._id,
//         transactionDate: new Date(),
//         type: 'DEPOSIT',
//         amount: currentBalance,
//         balanceBefore: 0,
//         balanceAfter: currentBalance,
//         paymentModeId: paymentModeId, // payment mode required
//         relatedType: 'MANUAL',
//         relatedId: null,
//         remarks: 'Initial deposit'
//       });

//       await transaction.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: 'Bank detail created successfully',
//       data: bankDetail
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error('Bank detail creation error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Error creating bank detail',
//       error: err.message
//     });
//   }
// };

const createBankDetail = async (req, res) => {
  try {
    const {
      accountHoldername,
      bankName,
      branchName,
      accountNumber,
      IFSCCode,
      accountType,
      openingBalance = 0,
      currentBalance = openingBalance,
      userId,
      status = true,
    } = req.body;

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // find payment mode where slug is "bank"
    const paymentModeId = await PaymentMode.findOne({ slug: "bank" });

    const bankDetail = new BankDetail({
      accountHoldername,
      bankName,
      branchName,
      accountNumber,
      IFSCCode,
      accountType,
      openingBalance,
      currentBalance,
      asOnDate: new Date(),
      userId,
      status,
      isDeleted: false
    });

    await bankDetail.save();

    // Create initial bank transaction (DEPOSIT)
    if (currentBalance > 0) {
      const transaction = new BankTransaction({
        bankAccountId: bankDetail._id,
        transactionDate: new Date(),
        type: "DEPOSIT",
        amount: currentBalance,
        balanceBefore: 0,
        balanceAfter: currentBalance,
        paymentModeId: paymentModeId?._id || null,
        relatedType: "MANUAL",
        relatedId: null,
        remarks: "Initial deposit"
      });

      await transaction.save();
    }

    res.status(201).json({
      success: true,
      message: "Bank detail created successfully",
      data: bankDetail
    });

  } catch (err) {
    console.error("Bank detail creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating bank detail",
      error: err.message
    });
  }
};

// const updateBankDetail = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { id } = req.params;
//     const updates = req.body;

//     delete updates._id;
//     delete updates.userId;
//     delete updates.createdAt;
//     delete updates.updatedAt;
//     delete updates.isDeleted;

//     const bankDetail = await BankDetail.findById(id).session(session);
//     if (!bankDetail || bankDetail.isDeleted) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: 'Bank detail not found'
//       });
//     }

//     const updatedBankDetail = await BankDetail.findByIdAndUpdate(
//       id,
//       { $set: updates },
//       { new: true, runValidators: true, session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: 'Bank detail updated successfully',
//       data: updatedBankDetail
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error('Bank detail update error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Error updating bank detail',
//       error: err.message
//     });
//   }
// };

const updateBankDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove protected fields
    delete updates._id;
    delete updates.userId;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.isDeleted;

    const bankDetail = await BankDetail.findById(id);
    if (!bankDetail || bankDetail.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bank detail not found",
      });
    }

    const updatedBankDetail = await BankDetail.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Bank detail updated successfully",
      data: updatedBankDetail,
    });
  } catch (err) {
    console.error("Bank detail update error:", err);
    return res.status(500).json({
      success: false,
      message: "Error updating bank detail",
      error: err.message,
    });
  }
};

const getBankDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const bankDetail = await BankDetail.findOne({
      _id: id,
      isDeleted: false
    });

    if (!bankDetail) {
      return res.status(404).json({
        success: false,
        message: 'Bank detail not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bankDetail
    });
  } catch (err) {
    console.error('Get bank detail error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank detail',
      error: err.message
    });
  }
};

const listBankDetails = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, status, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const baseQuery = { isDeleted: false };

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }
      baseQuery.userId = userId;
    }

    if (status !== undefined) {
      baseQuery.status = status === 'true';
    }

    const searchQuery = search
      ? {
        $or: [
          { accountHoldername: { $regex: search, $options: 'i' } },
          { bankName: { $regex: search, $options: 'i' } },
          { branchName: { $regex: search, $options: 'i' } },
          { accountNumber: { $regex: search, $options: 'i' } },
          { IFSCCode: { $regex: search, $options: 'i' } }
        ]
      }
      : {};

    const query = { ...baseQuery, ...searchQuery };

    const [bankDetails, total] = await Promise.all([
      BankDetail.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BankDetail.countDocuments(query)
    ]);

    const transformedDetails = bankDetails.map(detail => ({
      id: detail._id,
      accountHoldername: detail.accountHoldername,
      bankName: detail.bankName,
      branchName: detail.branchName,
      accountNumber: detail.accountNumber,
      IFSCCode: detail.IFSCCode,
      accountType: detail.accountType,
      openingBalance: parseFloat(detail.openingBalance ? detail.openingBalance.toString() : '0'),
      currentBalance: parseFloat(detail.currentBalance ? detail.currentBalance.toString() : '0'),
      asOnDate: detail.asOnDate,
      status: detail.status,
      userId: detail.userId,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Bank details fetched successfully',
      data: {
        bankDetails: transformedDetails,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('List bank details error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank details',
      error: err.message
    });
  }
};

const listBankTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      bankAccountId,
      type,
      relatedType,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    const baseQuery = { isDeleted: false };

    if (bankAccountId) {
      if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bankAccountId format'
        });
      }
      baseQuery.bankAccountId = bankAccountId;
    }

    if (type) {
      baseQuery.type = type.toUpperCase();
    }

    if (relatedType) {
      baseQuery.relatedType = relatedType.toUpperCase();
    }

    const searchQuery = search
      ? {
        $or: [
          { remarks: { $regex: search, $options: 'i' } },
          { referenceNo: { $regex: search, $options: 'i' } }
        ]
      }
      : {};

    const query = { ...baseQuery, ...searchQuery };

    const [transactions, total] = await Promise.all([
      BankTransaction.find(query)
        .populate('bankAccountId', 'accountHoldername bankName accountNumber')
        .populate('paymentModeId', 'name slug')
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BankTransaction.countDocuments(query)
    ]);

    const transformedTransactions = transactions.map(tx => ({
      id: tx._id,
      bankAccount: tx.bankAccountId
        ? {
          id: tx.bankAccountId._id,
          accountHoldername: tx.bankAccountId.accountHoldername,
          bankName: tx.bankAccountId.bankName,
          accountNumber: tx.bankAccountId.accountNumber
        }
        : null,
      transactionDate: tx.transactionDate,
      type: tx.type,
      amount: parseFloat(tx.amount ? tx.amount.toString() : '0'),
      balanceBefore: parseFloat(tx.balanceBefore ? tx.balanceBefore.toString() : '0'),
      balanceAfter: parseFloat(tx.balanceAfter ? tx.balanceAfter.toString() : '0'),
      paymentMode: tx.paymentModeId
        ? { id: tx.paymentModeId._id, name: tx.paymentModeId.name, slug: tx.paymentModeId.slug }
        : null,
      referenceNo: tx.referenceNo,
      remarks: tx.remarks,
      relatedType: tx.relatedType,
      relatedId: tx.relatedId,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Bank transactions fetched successfully',
      data: {
        transactions: transformedTransactions,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('List bank transactions error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank transactions',
      error: err.message
    });
  }
};

const updateBankDetailStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof status !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Status must be a boolean value'
      });
    }

    const bankDetail = await BankDetail.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!bankDetail || bankDetail.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Bank detail not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bank detail status updated successfully',
      data: {
        id: bankDetail._id,
        status: bankDetail.status
      }
    });
  } catch (err) {
    console.error('Bank detail status update error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating bank detail status',
      error: err.message
    });
  }
};

const deleteBankDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const bankDetail = await BankDetail.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!bankDetail) {
      return res.status(404).json({
        success: false,
        message: 'Bank detail not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bank detail deleted successfully'
    });
  } catch (err) {
    console.error('Delete bank detail error:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting bank detail',
      error: err.message
    });
  }
};

const reconcileTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { isReconciled, reconciliationNote } = req.body;
    const userId = req.user?._id || null;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    }

    const transaction = await BankTransaction.findById(id);
    if (!transaction || transaction.isDeleted) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    transaction.isReconciled = isReconciled;
    transaction.reconciledBy = isReconciled ? userId : null;
    transaction.reconciliationDate = isReconciled ? new Date() : null;
    transaction.reconciliationNote = isReconciled ? reconciliationNote || null : null;

    await transaction.save();

    return res.status(200).json({
      success: true,
      message: `Transaction ${isReconciled ? 'reconciled' : 'unreconciled'} successfully.`,
      data: transaction
    });

  } catch (error) {
    console.error('Error in reconcileTransaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

const listFinancialDetails = async (req, res) => {
  try {
    const { userId, status, search = '' } = req.query;

    // Base query
    const baseQuery = { isDeleted: false };
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }
      baseQuery.userId = mongoose.Types.ObjectId(userId);
    }
    if (status !== undefined) {
      baseQuery.status = status === 'true';
    }

    const searchQuery = search
      ? {
        $or: [
          { accountHoldername: { $regex: search, $options: 'i' } },
          { bankName: { $regex: search, $options: 'i' } },
          { branchName: { $regex: search, $options: 'i' } },
          { accountNumber: { $regex: search, $options: 'i' } },
          { IFSCCode: { $regex: search, $options: 'i' } }
        ]
      }
      : {};

    const query = { ...baseQuery, ...searchQuery };

    // Fetch all bank details
    const bankDetails = await BankDetail.find(query).sort({ createdAt: -1 }).lean();

    // Helper to get totals per day
    const getDailyTotals = async (Model) => {
      const totals = await Model.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: {
              year: { $year: "$updatedAt" },
              month: { $month: "$updatedAt" },
              day: { $dayOfMonth: "$updatedAt" }
            },
            total: { $sum: { $toDouble: "$currentBalance" } }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
      ]);

      const todayTotal = totals.length > 0 ? totals[0].total : 0;
      const lastTotal = totals.length > 1 ? totals[1].total : 0;

      return { todayTotal, lastTotal };
    };

    // Get bank totals
    const { todayTotal: bankCurrentTotal, lastTotal: bankLastTotal } = await getDailyTotals(BankDetail);

    // Get petty cash totals
    const { todayTotal: pettyCurrentTotal, lastTotal: pettyLastTotal } = await getDailyTotals(PettyCash);

    // Determine flags
    const bankFlag = bankCurrentTotal > bankLastTotal ? 'up' : bankCurrentTotal < bankLastTotal ? 'down' : 'equal';
    const pettyFlag = pettyCurrentTotal > pettyLastTotal ? 'up' : pettyCurrentTotal < pettyLastTotal ? 'down' : 'equal';

    // Transform bank details for response
    const transformedDetails = bankDetails.map(detail => ({
      id: detail._id,
      accountHoldername: detail.accountHoldername,
      bankName: detail.bankName,
      branchName: detail.branchName,
      accountNumber: detail.accountNumber,
      IFSCCode: detail.IFSCCode,
      accountType: detail.accountType,
      openingBalance: parseFloat(detail.openingBalance?.toString() || '0'),
      currentBalance: parseFloat(detail.currentBalance?.toString() || '0'),
      asOnDate: detail.asOnDate,
      status: detail.status,
      userId: detail.userId,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Financial details fetched successfully',
      data: {
        totals: {
          bankCurrentTotal,
          bankLastTotal,
          bankFlag,
          pettyCurrentTotal,
          pettyLastTotal,
          pettyFlag
        },
        bankDetails: transformedDetails
      }
    });

  } catch (err) {
    console.error('List financial details error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial details',
      error: err.message
    });
  }
};

const listBankTransactionsReconciled = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      bankAccountId,
      isReconciled, // true or false
      type,
      relatedType,
      search = '',
      startDate, // new: start of date range
      endDate    // new: end of date range
    } = req.query;

    const skip = (page - 1) * limit;
    const baseQuery = { isDeleted: false };

    // Filter by bank account
    if (bankAccountId) {
      if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bankAccountId format'
        });
      }
      baseQuery.bankAccountId = bankAccountId;
    }

    // Filter by reconciled status
    if (isReconciled !== undefined) {
      baseQuery.isReconciled = isReconciled === 'true';
    }

    // Filter by transaction type
    if (type) {
      baseQuery.type = type.toUpperCase();
    }

    // Filter by related type
    if (relatedType) {
      baseQuery.relatedType = relatedType.toUpperCase();
    }

    // Filter by date range
    if (startDate || endDate) {
      baseQuery.transactionDate = {};
      if (startDate) baseQuery.transactionDate.$gte = new Date(startDate);
      if (endDate) baseQuery.transactionDate.$lte = new Date(endDate);
    }

    // Search by remarks or referenceNo
    const searchQuery = search
      ? {
        $or: [
          { remarks: { $regex: search, $options: 'i' } },
          { referenceNo: { $regex: search, $options: 'i' } }
        ]
      }
      : {};

    const query = { ...baseQuery, ...searchQuery };

    // Fetch transactions with pagination
    const [transactions, total] = await Promise.all([
      BankTransaction.find(query)
        .populate('bankAccountId', 'accountHoldername bankName accountNumber')
        .populate('paymentModeId', 'name slug')
        .populate('reconciledBy', 'firstName lastName email')
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BankTransaction.countDocuments(query)
    ]);

    // Transform the response
    const transformedTransactions = transactions.map(tx => ({
      id: tx._id,
      bankAccount: tx.bankAccountId
        ? {
          id: tx.bankAccountId._id,
          accountHoldername: tx.bankAccountId.accountHoldername,
          bankName: tx.bankAccountId.bankName,
          accountNumber: tx.bankAccountId.accountNumber
        }
        : null,
      transactionDate: tx.transactionDate,
      type: tx.type,
      amount: parseFloat(tx.amount ? tx.amount.toString() : '0'),
      balanceBefore: parseFloat(tx.balanceBefore ? tx.balanceBefore.toString() : '0'),
      balanceAfter: parseFloat(tx.balanceAfter ? tx.balanceAfter.toString() : '0'),
      paymentMode: tx.paymentModeId
        ? { id: tx.paymentModeId._id, name: tx.paymentModeId.name, slug: tx.paymentModeId.slug }
        : null,
      referenceNo: tx.referenceNo,
      remarks: tx.remarks,
      relatedType: tx.relatedType,
      relatedId: tx.relatedId,
      isReconciled: tx.isReconciled ?? false,
      reconciledBy: tx.reconciledBy
        ? {
          id: tx.reconciledBy._id,
          name: `${tx.reconciledBy.firstName || ''} ${tx.reconciledBy.lastName || ''}`.trim(),
          email: tx.reconciledBy.email
        }
        : null,
      reconciliationDate: tx.reconciliationDate ?? null,
      reconciliationNote: tx.reconciliationNote ?? null,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Bank transactions fetched successfully',
      data: {
        transactions: transformedTransactions,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('List bank transactions with reconciled filter error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank transactions',
      error: err.message
    });
  }
};

const getBankTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await BankTransaction.findById(id)
      .populate("bankAccountId", "bankName accountNumber")
      .populate("paymentModeId", "modeName")
      .populate("reconciledBy", "name email")
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found",
      });
    }

    let relatedData = null;

    switch (transaction.relatedType) {
      case "EXPENSE":
        if (transaction.relatedId) {
          const expense = await Expense.findById(transaction.relatedId)
            .populate("expenseCategoryId", "title")
            .populate("paymentMode", "name")
            .populate("bankId", "bankName accountNumber")
            .populate("userId", "firstName lastName email phone profileImage")
            .lean();

          if (expense) {
            const user = expense.userId
              ? {
                firstName: expense.userId.firstName || "",
                lastName: expense.userId.lastName || "",
                email: expense.userId.email || "",
                phone: expense.userId.phone || "",
                profileImage: expense.userId.profileImage
                  ? `${process.env.BASE_URL}/${expense.userId.profileImage}`
                  : "",
              }
              : null;

            const category = expense.expenseCategoryId
              ? expense.expenseCategoryId.title
              : "";

            const paymentMode = expense.paymentMode
              ? expense.paymentMode.name
              : "";

            relatedData = {
              id: expense._id,
              expenseId: expense.expenseId,
              referenceNo: expense.referenceNo || "",
              amount: parseFloat(expense.amount || 0),
              expenseDate: expense.expenseDate
                ? expense.expenseDate.toISOString().split("T")[0]
                : null,
              paymentMode,
              category,
              description: expense.description || "",
              attachment: expense.attachment
                ? `${process.env.BASE_URL}/${expense.attachment}`
                : "",
              sourceType: expense.sourceType,
              bank: expense.bankId
                ? {
                  name: expense.bankId.bankName,
                  accountNumber: expense.bankId.accountNumber,
                }
                : null,
              createdBy: user,
            };
          }
        }
        break;

      case "SUPPLIER_PAYMENT":
        if (transaction.relatedId) {
          relatedData = await SupplierPayment.findById(transaction.relatedId)
            .populate("purchaseId", "purchaseId totalAmount")
            .populate("supplierId", "name email phone profileImage")
            .populate("paymentMode", "name")
            .populate("bankId", "bankName accountNumber")
            .populate("createdBy", "name email")
            .lean();

          //formatting supplier profile image
          if (relatedData.supplierId) {
            relatedData.supplierId.profileImage = relatedData.supplierId.profileImage
              ? `${process.env.BASE_URL}/${relatedData.supplierId.profileImage}`
              : "";
          }
        }
        break;

      case "INVOICE_PAYMENT":
        if (transaction.relatedId) {
          relatedData = await InvoicePayment.findById(transaction.relatedId)
            .populate("invoiceId", "invoiceNumber totalAmount")
            .populate("payment_method", "name")
            .populate("bankId", "bankName accountNumber")
            .populate("received_by", "name email")
            .lean();
        }
        break;

      default:
        relatedData = null;
        break;
    }

    return res.status(200).json({
      success: true,
      data: relatedData
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createBankDetail,
  updateBankDetail,
  getBankDetail,
  listBankDetails,
  updateBankDetailStatus,
  listBankTransactions,
  deleteBankDetail,
  reconcileTransaction,
  listFinancialDetails,
  listBankTransactionsReconciled,
  getBankTransactionDetails
};