const mongoose = require('mongoose');
const InvoicePayment = require('../models/InvoicePayment');
const Invoice = require('../models/Invoice');

// Utility to match existing rounding conventions if needed
const toMoney = (amount) => Number(Number(amount || 0).toFixed(2));

/**
 * Calculates the exact current outstanding amount for an invoice
 * by aggregating all recorded payments.
 * 
 * @param {string|ObjectId} invoiceId 
 * @param {Object} [invoiceDoc] - Optional prefetched invoice document to save a query
 * @returns {Promise<{ outstandingAmount: number, totalPaid: number, invoiceTotal: number, isCancelled: boolean }>}
 */
const getInvoiceOutstandingAmount = async (invoiceId, invoiceDoc = null) => {
  const invoice = invoiceDoc || await Invoice.findById(invoiceId).lean();
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const isCancelled = invoice.status === 'CANCELLED';

  const paymentAgg = await InvoicePayment.aggregate([
    { $match: { invoiceId: new mongoose.Types.ObjectId(invoiceId) } },
    { $group: { _id: "$invoiceId", totalPaid: { $sum: "$amount" } } },
  ]);

  const totalPaid = paymentAgg.length > 0 ? Number(paymentAgg[0].totalPaid) : 0;
  const invoiceTotal = toMoney(Number(invoice.TotalAmount || 0));
  const outstandingAmount = Math.max(toMoney(invoiceTotal - totalPaid), 0);

  return {
    outstandingAmount,
    totalPaid,
    invoiceTotal,
    isCancelled,
    status: invoice.status,
  };
};

module.exports = {
  getInvoiceOutstandingAmount,
};
