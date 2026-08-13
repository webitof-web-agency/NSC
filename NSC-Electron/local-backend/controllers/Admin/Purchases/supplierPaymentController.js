const path = require('path');
const { validationResult } = require('express-validator');
const SupplierPayment = require('@models/SupplierPayment');
const Purchase = require('@models/Purchase');
const PettyCash = require('@models/PettyCash');
const PaymentMode = require('@models/PaymentMode');
const PettyCashTransaction = require('@models/PettyCashTransaction');
const BankDetail = require('@models/BankDetail');
const BankTransaction = require('@models/BankTransaction');
const User = require('@models/User');
const mongoose = require('mongoose');
const Inventory = require('@models/Inventory');
const Product = require('@models/Product');

const recalcPurchasePayment = async (purchaseId, latestPaymentMode, latestReferenceNumber) => {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return null;

  const payments = await SupplierPayment.find({ purchaseId, isDeleted: false });
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const balanceAmount = Math.max(Number(purchase.totalAmount || 0) - totalPaid, 0);
  let status = "pending";
  if (totalPaid === 0) status = "pending";
  else if (balanceAmount === 0) status = "paid";
  else status = "partially_paid";

  const update = {
    paidAmount: totalPaid,
    balanceAmount,
    status,
  };

  if (latestPaymentMode) {
    update.paymentMode = latestPaymentMode;
  }
  if (latestReferenceNumber !== undefined) {
    update.referenceNo = latestReferenceNumber || "";
  }

  return Purchase.findByIdAndUpdate(purchaseId, update, { new: true });
};

// const createSupplierPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(422).json({
//         success: false,
//         message: 'Validation failed.',
//         errors: errors.array()
//       });
//     }

//     const userId = req.user;
//     const {
//       purchaseId,
//       supplierId,
//       referenceNumber,
//       paymentDate,
//       paymentMode,
//       amount,
//       paidAmount,
//       dueAmount,
//       notes,
//       sourceType,
//       bankId
//     } = req.body;

//     let attachment = req.file ? `uploads/${req.file.filename}` : null;

//     if (!['BANK', 'PETTY_CASH'].includes(sourceType)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Validation failed.',
//         errors: { sourceType: 'Invalid source type. Must be BANK or PETTY_CASH.' }
//       });
//     }

//     // BANK requires bankId and paymentMode
//     if (sourceType === 'BANK') {
//       if (!bankId) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { bankId: 'Bank ID is required for BANK payments.' }
//         });
//       }
//       if (!paymentMode) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { paymentMode: 'Payment mode is required for BANK payments.' }
//         });
//       }

//       const bank = await BankDetail.findById(bankId).session(session);
//       if (!bank) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { bankId: 'Bank not found.' }
//         });
//       }

//       const currentBalance = parseFloat(bank.currentBalance.toString());
//       if (parseFloat(paidAmount) > currentBalance) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { bankId: `Insufficient balance, current balance is ${currentBalance}` }
//         });
//       }
//     }

//     // PETTY_CASH balance check
//     if (sourceType === 'PETTY_CASH') {
//       const pettyCash = await PettyCash.findOne().session(session);
//       if (!pettyCash) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { sourceType: 'Petty cash not found.' }
//         });
//       }

//       const currentBalance = parseFloat(pettyCash.currentBalance.toString());
//       if (parseFloat(paidAmount) > currentBalance) {
//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed.',
//           errors: { sourceType: `Insufficient balance, current balance is ${currentBalance}` }
//         });
//       }
//     }

//     const newPayment = new SupplierPayment({
//       purchaseId,
//       supplierId,
//       referenceNumber,
//       paymentDate,
//       paymentMode: sourceType === 'BANK' ? paymentMode : null,
//       amount,
//       paidAmount,
//       dueAmount,
//       notes,
//       attachment,
//       createdBy: userId,
//       sourceType,
//       bankId: sourceType === 'BANK' ? bankId : null
//     });

//     const savedPayment = await newPayment.save({ session });

//     if (sourceType === 'BANK') {
//       const bank = await BankDetail.findById(bankId).session(session);
//       const balanceBefore = parseFloat(bank.currentBalance.toString());
//       const balanceAfter = (balanceBefore - parseFloat(paidAmount)).toFixed(2);

//       bank.currentBalance = balanceAfter;
//       await bank.save({ session });

//       await BankTransaction.create([{
//         bankAccountId: bankId,
//         transactionDate: new Date(),
//         type: 'TRANSFER_OUT',
//         amount: paidAmount,
//         balanceBefore,
//         balanceAfter,
//         paymentModeId: paymentMode,
//         referenceNo: referenceNumber || null,
//         remarks: notes || `Supplier payment to ${supplierId}`,
//         relatedType: 'SUPPLIER_PAYMENT',
//         relatedId: savedPayment._id
//       }], { session });

//     } else if (sourceType === 'PETTY_CASH') {
//       const pettyCash = await PettyCash.findOne().session(session);
//       const balanceBefore = parseFloat(pettyCash.currentBalance.toString());
//       const balanceAfter = (balanceBefore - parseFloat(paidAmount)).toFixed(2);

//       pettyCash.currentBalance = balanceAfter;
//       await pettyCash.save({ session });

//       await PettyCashTransaction.create([{
//         pettyCashId: pettyCash._id,
//         transactionDate: new Date(),
//         transactionType: 'SPEND',
//         amount: paidAmount,
//         balanceBefore,
//         balanceAfter,
//         remarks: notes || `Supplier payment to ${supplierId}`,
//         relatedType: 'SUPPLIER_PAYMENT',
//         relatedId: savedPayment._id
//       }], { session });
//     }


//     const existingPayments = await SupplierPayment.findOne({
//       purchaseId,
//       _id: { $ne: savedPayment._id }
//     }).session(session);

//     if (!existingPayments) {
//       const purchase = await Purchase.findById(purchaseId).session(session);
//       if (!purchase) throw new Error('Purchase not found for creating inventory.');

//       for (const item of purchase.items) {
//         if (!mongoose.Types.ObjectId.isValid(item.id)) {
//           console.warn(`Skipping custom product with non-ObjectId: ${item.id}`);
//           continue;
//         }

//         const productExists = await Product.exists({ _id: item.id }).session(session);
//         if (!productExists) {
//           console.warn(`Product not found for item ID: ${item.id}, skipping inventory update.`);
//           continue;
//         }

//         await Inventory.findOneAndUpdate(
//           { productId: item.id, userId },
//           {
//             $inc: { quantity: item.qty },
//             $push: {
//               inventory_history: {
//                 unitId: item.unit || null,
//                 quantity: item.qty,
//                 notes: `Stock added from Purchase ${purchase.purchaseId}`,
//                 type: 'stock_in',
//                 adjustment: item.qty,
//                 referenceId: purchase._id,
//                 referenceType: 'purchase',
//                 createdBy: userId
//               }
//             }
//           },
//           { upsert: true, new: true, session }
//         );
//       }
//     }

//     const purchaseStatus = dueAmount == 0 ? 'paid' : 'partially_paid';
//     await Purchase.findByIdAndUpdate(
//       purchaseId,
//       { $set: { status: purchaseStatus } },
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       message: 'Supplier payment created successfully',
//       data: {
//         payment: savedPayment,
//         updatedPurchaseStatus: purchaseStatus
//       }
//     });

//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error('Error creating supplier payment:', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Error creating supplier payment',
//       error: err.message
//     });
//   }
// };

const createSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array(),
      });
    }

    const userId = req.user;
    const {
      purchaseId,
      supplierId,
      referenceNumber,
      paymentDate,
      paymentMode,
      amount,
      paidAmount,
      dueAmount,
      sourceType,
      bankId,
    } = req.body;

    const effectiveSourceType = sourceType || "ON_ACCOUNT";

    const paymentModeDoc = paymentMode ? await PaymentMode.findById(paymentMode) : null;

    // BANK validation
    if (effectiveSourceType === "BANK" && paymentModeDoc) {
      if (!bankId) {
        return res.status(400).json({
          success: false,
          message: "Bank ID is required for BANK payments.",
        });
      }
      if (!paymentMode) {
        return res.status(400).json({
          success: false,
          message: "Payment mode is required for BANK payments.",
        });
      }

      // console.log("checking bank:", bankId);     // Debug here
      const bank = await BankDetail.findById(bankId);
      // console.log("BANK RESULT:", bank);          // Debug here
      if (!bank) {
        return res.status(400).json({
          success: false,
          message: "Bank not found.",
        });
      }

      const currentBalance = Number(bank.currentBalance);
      if (Number(paidAmount) > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance, current balance is ${currentBalance}`,
        });
      }
    }

    // PETTY CASH validation
    if (sourceType === "PETTY_CASH") {
      const pettyCash = await PettyCash.findOne();
      if (!pettyCash) {
        return res.status(400).json({
          success: false,
          message: "Petty cash not found.",
        });
      }

      const currentBalance = Number(pettyCash.currentBalance);
      if (Number(paidAmount) > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance, current balance is ${currentBalance}`,
        });
      }
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found.",
      });
    }
    if (Number(paidAmount) > Number(purchase.balanceAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed outstanding balance.",
      });
    }

    const newPayment = new SupplierPayment({
      purchaseId,
      supplierId,
      referenceNumber,
      paymentDate,
      paymentMode: paymentMode || null,
      amount,
      paidAmount,
      dueAmount,
      createdBy: userId,
      sourceType: effectiveSourceType,
      bankId: effectiveSourceType === "BANK" ? bankId : null,
    });

    const savedPayment = await newPayment.save();

    // Update BANK balance & log transaction
    if (effectiveSourceType === "BANK") {
      const bank = await BankDetail.findById(bankId);
      const balanceBefore = Number(bank.currentBalance);
      const balanceAfter = balanceBefore - Number(paidAmount);

      bank.currentBalance = balanceAfter;
      await bank.save();

      await BankTransaction.create({
        bankAccountId: bankId,
        transactionDate: new Date(),
        type: "TRANSFER_OUT",
        amount: paidAmount,
        balanceBefore,
        balanceAfter,
        paymentModeId: paymentMode,
        referenceNo: referenceNumber || null,
        remarks: `Supplier payment to ${supplierId}`,
        relatedType: "SUPPLIER_PAYMENT",
        relatedId: savedPayment._id,
      });
    }

    // Update PETTY CASH balance & log transaction
    if (effectiveSourceType === "PETTY_CASH") {
      const pettyCash = await PettyCash.findOne();
      const balanceBefore = Number(pettyCash.currentBalance);
      const balanceAfter = balanceBefore - Number(paidAmount);

      pettyCash.currentBalance = balanceAfter;
      await pettyCash.save();

      await PettyCashTransaction.create({
        transactionDate: new Date(),
        type: "EXPENSE",
        amount: paidAmount,
        balanceBefore,
        balanceAfter,
        remarks: `Supplier payment to ${supplierId}`,
        relatedType: "SUPPLIER_PAYMENT",
        relatedId: savedPayment._id,
      });
    }

    const updatedPurchase = await recalcPurchasePayment(purchaseId, paymentMode, referenceNumber);

    return res.status(201).json({
      success: true,
      message: "Supplier payment created successfully",
      data: {
        payment: savedPayment,
        updatedPurchaseStatus: updatedPurchase?.status,
      },
    });
  } catch (err) {
    console.error("Error creating supplier payment:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating supplier payment",
      error: err.message,
    });
  }
};

const listSupplierPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      supplierId,
      sourceType,
      startDate,
      endDate,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isDeleted: false };

    // Filter by supplierId
    if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
      query.supplierId = supplierId;
    }

    // Filter by sourceType
    if (sourceType && ['BANK', 'PETTY_CASH'].includes(sourceType)) {
      query.sourceType = sourceType;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    // Search in specific fields
    if (search) {
      query.$or = [
        { referenceNumber: { $regex: search, $options: 'i' } },
        { paymentId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await SupplierPayment.countDocuments(query);

    const payments = await SupplierPayment.find(query)
      .populate({
        path: 'supplierId',
        select: 'firstName lastName email phone profileImage',
        model: 'User'
      })
      .populate('purchaseId', 'purchaseId totalAmount purchaseDate')
      .populate('paymentMode', 'name')
      .populate('bankId', 'bankName accountNumber accountHoldername')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Format date function
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formattedPayments = payments.map((p) => {
      const supplier = p.supplierId ? {
        id: p.supplierId._id,
        name: `${p.supplierId.firstName || ''} ${p.supplierId.lastName || ''}`.trim(),
        email: p.supplierId.email || null,
        phone: p.supplierId.phone || null,
        profileImage: p.supplierId.profileImage
          ? `${baseUrl}${p.supplierId.profileImage.replace(/\\/g, '/')}`
          : ''
      } : null;

      const purchase = p.purchaseId ? {
        id: p.purchaseId._id,
        purchaseId: p.purchaseId.purchaseId,
        totalAmount: p.purchaseId.totalAmount,
        purchaseDate: formatDate(p.purchaseId.purchaseDate)
      } : null;

      const bank = p.sourceType === 'BANK' && p.bankId ? {
        id: p.bankId._id,
        bankName: p.bankId.bankName,
        accountNumber: p.bankId.accountNumber,
        accountHolder: p.bankId.accountHoldername
      } : null;

      return {
        id: p._id,
        paymentId: p.paymentId,
        referenceNumber: p.referenceNumber,
        paymentDate: formatDate(p.paymentDate),
        sourceType: p.sourceType,
        amount: p.amount,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        supplier,
        purchase,
        bank,
        paymentMode: p.paymentMode ? p.paymentMode.name : null,
        createdAt: formatDate(p.createdAt),
        updatedAt: formatDate(p.updatedAt)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Supplier payments retrieved successfully',
      data: {
        payments: formattedPayments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Error fetching supplier payments:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier payments',
      error: err.message
    });
  }
};

const updateSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user;
    const {
      purchaseId,
      supplierId,
      referenceNumber,
      paymentDate,
      paymentMode,
      amount,
      paidAmount,
      dueAmount,
    } = req.body;

    // Find payment in transaction
    const existingPayment = await SupplierPayment.findById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        message: 'Supplier payment not found'
      });
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const otherPayments = await SupplierPayment.find({
      purchaseId,
      _id: { $ne: id },
      isDeleted: false,
    });
    const otherPaidTotal = otherPayments.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0),
      0
    );
    const maxAllowed = Math.max(Number(purchase.totalAmount || 0) - otherPaidTotal, 0);
    if (Number(paidAmount) > maxAllowed) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed outstanding balance.",
      });
    }

    // Update payment
    const updatedPayment = await SupplierPayment.findByIdAndUpdate(
      id,
      {
        purchaseId,
        supplierId,
        referenceNumber,
        paymentDate,
        paymentMode,
        amount,
        paidAmount,
        dueAmount,
        updatedBy: userId
      },
      { new: true }
    );

    const updatedPurchase = await recalcPurchasePayment(purchaseId, paymentMode, referenceNumber);

    res.status(200).json({
      success: true,
      message: 'Supplier payment updated successfully',
      data: {
        payment: updatedPayment,
        updatedPurchaseStatus: updatedPurchase?.status
      }
    });

  } catch (err) {

    console.error('Error updating supplier payment:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating supplier payment',
      error: err.message
    });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;

    // First find the payment to get the purchaseId
    const payment = await SupplierPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    // Delete the payment
    const deleted = await SupplierPayment.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier payment deleted successfully and purchase status updated to partial paid',
    });
    await recalcPurchasePayment(payment.purchaseId);

  } catch (err) {
    res.status(500).json({
      message: 'Error deleting supplier payment',
      error: err.message
    });
  }
};

const deleteSupplierPaymentById = async (id) => {
  const payment = await SupplierPayment.findById(id);
  if (!payment) {
    return false;
  }

  const deleted = await SupplierPayment.findByIdAndDelete(id);
  if (!deleted) {
    return false;
  }

  await recalcPurchasePayment(payment.purchaseId);
  return true;
};

const bulkDeleteSupplierPayments = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const payments = await SupplierPayment.find({}).select('_id');
      targetIds = payments.map(p => p._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide supplier payment ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteSupplierPaymentById(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      success: true,
      message: 'Supplier payments deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting supplier payments', error: error.message });
  }
};

module.exports = {
  createSupplierPayment,
  listSupplierPayments,
  updateSupplierPayment,
  deleteSupplierPayment,
  bulkDeleteSupplierPayments
};
