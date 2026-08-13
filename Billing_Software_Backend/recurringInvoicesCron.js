// FIXED: Removed require('dotenv').config() to prevent reload in production
// FIXED: Removed initializeCron() auto-execution to prevent MongoDB connection conflicts
const mongoose = require('mongoose');
const cron = require('node-cron');
const Invoice = require('./models/Invoice');

/**
 * Calculate next recurring date based on invoice repeat configuration
 * @param {Date} currentDate - current recurrence date
 * @param {Object} invoice - invoice document
 * @returns {Date} next recurrence date
 */
const getNextRecurringDate = (currentDate, invoice) => {
  const newDate = new Date(currentDate);
  let interval = 1;
  let type = invoice.repeatEvery;

  // Handle custom repeat settings
  if (type === 'custom') {
    interval = invoice.customIntervalNumber || 1;
    type = invoice.customIntervalType || 'month';
  }

  switch (type) {
    case 'day':
      newDate.setDate(newDate.getDate() + interval);
      break;
    case 'week':
      newDate.setDate(newDate.getDate() + (7 * interval));
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() + interval);
      break;
    case 'year':
      newDate.setFullYear(newDate.getFullYear() + interval);
      break;
    default:
      newDate.setMonth(newDate.getMonth() + interval);
  }

  return newDate;
};

/**
 * Main recurring invoice cron job
 */
const runRecurringInvoiceCron = async () => {
  console.log(`Running recurring invoice cron at ${new Date().toISOString()}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring invoices that are due for repetition
    const recurringInvoices = await Invoice.find({
      isRecurring: true,
      isDeleted: false,
      stopped: false,
      nextRecurringDate: { $lte: today },
      $or: [
        { neverExpire: true },
        { endsOn: null },
        { endsOn: { $gte: today } },
      ],
    }).session(session);

    if (!recurringInvoices.length) {
      console.log('No recurring invoices to process today.');
      await session.commitTransaction();
      session.endSession();
      return;
    }

    console.log(`Found ${recurringInvoices.length} recurring invoice(s) to process.`);

    for (const invoice of recurringInvoices) {
      try {
        const newInvoiceData = invoice.toObject();

        // Remove unique and auto-generated fields
        delete newInvoiceData._id;
        delete newInvoiceData.invoiceNumber;

        newInvoiceData.parentInvoice = invoice._id;
        newInvoiceData.invoiceDate = today;
        newInvoiceData.dueDate = invoice.dueDate
          ? getNextRecurringDate(invoice.dueDate, invoice)
          : getNextRecurringDate(today, invoice);

        newInvoiceData.status = 'UNPAID';
        newInvoiceData.lastRecurringDate = today;
        newInvoiceData.nextRecurringDate = getNextRecurringDate(today, invoice);

        // Create new recurring invoice
        const newInvoice = new Invoice(newInvoiceData);
        await newInvoice.save({ session });

        // Update parent invoice recurrence info
        invoice.lastRecurringDate = today;
        invoice.nextRecurringDate = getNextRecurringDate(today, invoice);
        await invoice.save({ session });

        console.log(`Created recurring invoice from ${invoice.invoiceNumber} → ${newInvoice.invoiceNumber || newInvoice._id}`);
      } catch (error) {
        console.error(`Error creating recurring invoice from ${invoice._id}:`, error.message);
      }
    }

    await session.commitTransaction();
    console.log('Recurring invoice cron completed successfully.');
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in recurring invoice cron:', error);
  } finally {
    session.endSession();
  }
};

/**
 * Schedule cron job
 * Runs daily at 12:00 AM (midnight)
 * Cron syntax: minute hour day month day-of-week
 */

// Export for manual or API trigger
module.exports = { runRecurringInvoiceCron };
