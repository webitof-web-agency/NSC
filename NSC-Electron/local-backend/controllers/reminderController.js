const Reminder = require('../models/Reminder');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const { runReminderCron } = require('../invoiceReminderCron');
const { runRecurringInvoiceCron } = require('../recurringInvoicesCron');

exports.triggerRecurringInvoiceCron = async (req, res) => {
  try {
    console.log('Manual trigger of recurring invoice cron requested');

    await runRecurringInvoiceCron();

    return res.status(200).json({
      success: true,
      message: 'Recurring invoice cron executed successfully',
      time: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error executing recurring invoice cron:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute recurring invoice cron',
      error: error.message
    });
  }
};

// @desc Get all reminders with pagination and search
exports.getReminders = async (req, res) => {
  try {
    const { search = '', type = '', status = '' } = req.query;
    const userId = req.user;

    // Build search query
    const searchQuery = {
      createdBy: userId,
      ...(type && { type }),
      ...(status && { status })
    };

    // Add search functionality
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'emailConfig.subject': { $regex: search, $options: 'i' } }
      ];
    }

    // Get all reminders with populated fields
    const reminders = await Reminder.find(searchQuery)
      .populate('targetInvoice', 'invoiceNumber customerName totalAmount')
      .populate('targetCustomer', 'name email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Reminders fetched successfully',
      data: {
        reminders
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: err.message
    });
  }
};

// @desc Get a single reminder by ID
exports.getReminderById = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id)
      .populate('targetInvoice', 'invoiceNumber customerName totalAmount dueDate')
      .populate('targetCustomer', 'name email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('companyId', 'companyName');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if user has access to this reminder
    if (reminder.createdBy._id.toString() !== req.user.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reminder fetched successfully',
      data: reminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder',
      error: err.message
    });
  }
};

// @desc Create new reminder
exports.createReminder = async (req, res) => {
  try {
    const userId = req.user;
    const {
      name,
      type,
      remindDays,
      remindTiming,
      remindEvent,
      isEnabled,
      emailConfig,
      targetInvoice,
      targetCustomer,
      manualReminderData
    } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's company
    const company = await CompanySettings.findOne({ userId });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company settings not found'
      });
    }

    // For manual reminders, validate target invoice and customer
    if (type === 'manual') {
      if (targetInvoice) {
        const invoice = await Invoice.findById(targetInvoice);
        if (!invoice) {
          return res.status(404).json({
            success: false,
            message: 'Target invoice not found'
          });
        }
      }

      if (targetCustomer) {
        const customer = await Customer.findById(targetCustomer);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: 'Target customer not found'
          });
        }
      }
    }

    // Create reminder data
    const reminderData = {
      name,
      type,
      isEnabled,
      emailConfig,
      createdBy: userId,
      companyId: company._id
    };

    // Add type-specific fields
    if (type === 'automatic' || type === 'automatic_Purchase') {
      reminderData.remindDays = remindDays;
      reminderData.remindTiming = remindTiming;
      reminderData.remindEvent = remindEvent;
    } else if (type === 'manual' || type === 'manual_purchase') {
      reminderData.targetInvoice = targetInvoice;
      reminderData.targetCustomer = targetCustomer;
      reminderData.manualReminderData = manualReminderData;
    }

    const reminder = new Reminder(reminderData);
    await reminder.save();

    // Populate the created reminder
    await reminder.populate([
      { path: 'targetInvoice', select: 'invoiceNumber customerName totalAmount' },
      { path: 'targetCustomer', select: 'name email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      data: reminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: err.message
    });
  }
};

exports.createReminderQuotation = async (req, res) => {
  try {
    const userId = req.user;
    const {
      name,
      type,
      remindDays,
      remindTiming,
      remindEvent,
      isEnabled,
      emailConfig,
      targetInvoice,
      targetQuotation,
      targetCustomer,
      manualReminderData
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const company = await CompanySettings.findOne({ userId });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Validate targets for manual reminders
    if (
      type === 'manual' ||
      type === 'manual_purchase' ||
      type === 'manual_quotation'
    ) {
      if (targetInvoice) {
        const invoice = await Invoice.findById(targetInvoice);
        if (!invoice) {
          return res.status(404).json({ success: false, message: 'Target invoice not found' });
        }
      }

      if (targetQuotation) {
        const quotation = await Quotation.findById(targetQuotation);
        if (!quotation) {
          return res.status(404).json({ success: false, message: 'Target quotation not found' });
        }
      }

      if (targetCustomer) {
        const customer = await Customer.findById(targetCustomer);
        if (!customer) {
          return res.status(404).json({ success: false, message: 'Target customer not found' });
        }
      }
    }

    // Construct reminder data
    const reminderData = {
      name,
      type,
      isEnabled,
      emailConfig,
      createdBy: userId,
      companyId: company._id
    };

    // Add specific fields
    if (
      type === 'automatic' ||
      type === 'automatic_Purchase' ||
      type === 'automatic_quotation'
    ) {
      reminderData.remindDays = remindDays;
      reminderData.remindTiming = remindTiming;
      reminderData.remindEvent = remindEvent;
    } else {
      reminderData.targetInvoice = targetInvoice;
      reminderData.targetQuotation = targetQuotation;
      reminderData.targetCustomer = targetCustomer;
      reminderData.manualReminderData = manualReminderData;
    }

    const reminder = new Reminder(reminderData);
    await reminder.save();

    await reminder.populate([
      { path: 'targetInvoice', select: 'invoiceNumber customerName totalAmount' },
      { path: 'targetQuotation', select: 'quotationNumber customerName totalAmount' },
      { path: 'targetCustomer', select: 'name email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      data: reminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: err.message
    });
  }
};
// @desc Update reminder
exports.updateReminder = async (req, res) => {
  try {
    const userId = req.user;
    const reminderId = req.params.id;
    const updateData = req.body;

    // Find the reminder
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if user has access to this reminder
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update the reminder
    const updatedReminder = await Reminder.findByIdAndUpdate(
      reminderId,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'targetInvoice', select: 'invoiceNumber customerName totalAmount' },
      { path: 'targetCustomer', select: 'name email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Reminder updated successfully',
      data: updatedReminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update reminder',
      error: err.message
    });
  }
};

exports.updateReminderQuotation = async (req, res) => {
  try {
    const userId = req.user;
    const reminderId = req.params.id;
    const updateData = req.body;

    // Find the reminder
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Quotation reminder not found'
      });
    }

    // Ensure the reminder is a quotation-type reminder
    if (
      !['manual_quotation', 'automatic_quotation'].includes(reminder.type)
    ) {
      return res.status(400).json({
        success: false,
        message: 'This reminder is not a quotation reminder'
      });
    }

    // Verify user access
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate targetQuotation if included
    if (updateData.targetQuotation) {
      const quotation = await Quotation.findById(updateData.targetQuotation);
      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: 'Target quotation not found'
        });
      }
    }

    // Validate targetCustomer if included
    if (updateData.targetCustomer) {
      const customer = await Customer.findById(updateData.targetCustomer);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Target customer not found'
        });
      }
    }

    // If updating emailConfig, validate fields
    if (updateData.emailConfig) {
      const { fromEmail, cc, bcc } = updateData.emailConfig;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (fromEmail && !emailRegex.test(fromEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid "fromEmail" format'
        });
      }

      if (cc && !cc.every(email => emailRegex.test(email))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid "cc" email format'
        });
      }

      if (bcc && !bcc.every(email => emailRegex.test(email))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid "bcc" email format'
        });
      }
    }

    // Perform the update
    const updatedReminder = await Reminder.findByIdAndUpdate(
      reminderId,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'targetQuotation', select: 'quotationNumber customerName totalAmount' },
      { path: 'targetCustomer', select: 'name email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Quotation reminder updated successfully',
      data: updatedReminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation reminder',
      error: err.message
    });
  }
};

// @desc Delete reminder
exports.deleteReminder = async (req, res) => {
  try {
    const userId = req.user;
    const reminderId = req.params.id;

    // Find the reminder
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if user has access to this reminder
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Hard delete - permanently remove from database
    await Reminder.findByIdAndDelete(reminderId);

    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: err.message
    });
  }
};

// @desc Toggle reminder status (enable/disable)
exports.toggleReminderStatus = async (req, res) => {
  try {
    const userId = req.user;
    const reminderId = req.params.id;
    const { isEnabled } = req.body;

    // Find the reminder
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if user has access to this reminder
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update the reminder status
    const updatedReminder = await Reminder.findByIdAndUpdate(
      reminderId,
      { isEnabled },
      { new: true }
    ).populate([
      { path: 'targetInvoice', select: 'invoiceNumber customerName totalAmount' },
      { path: 'targetCustomer', select: 'name email' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(200).json({
      success: true,
      message: `Reminder ${isEnabled ? 'enabled' : 'disabled'} successfully`,
      data: updatedReminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle reminder status',
      error: err.message
    });
  }
};

// @desc Send manual reminder immediately
exports.sendManualReminder = async (req, res) => {
  try {
    const userId = req.user;
    const reminderId = req.params.id;

    // Find the reminder
    const reminder = await Reminder.findById(reminderId)
      .populate('targetInvoice')
      .populate('targetCustomer')
      .populate('createdBy');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if user has access to this reminder
    if (reminder.createdBy._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if it's a manual reminder
    if (reminder.type !== 'manual') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for manual reminders'
      });
    }

    // Check if reminder is already sent
    if (reminder.manualReminderData.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Reminder has already been sent'
      });
    }

    // TODO: Implement actual email sending logic here
    // For now, we'll just mark it as sent
    reminder.manualReminderData.status = 'sent';
    reminder.lastSent = new Date();
    await reminder.save();

    res.status(200).json({
      success: true,
      message: 'Manual reminder sent successfully',
      data: reminder
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to send manual reminder',
      error: err.message
    });
  }
};

// @desc Get reminders by type
exports.getRemindersByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;
    const userId = req.user;

    if (!['automatic', 'manual', 'automatic_Purchase', 'manual_purchase'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder type'
      });
    }

    // Build search query
    const searchQuery = {
      createdBy: userId,
      type,
      status: { $ne: 'archived' }
    };

    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'emailConfig.subject': { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await Reminder.countDocuments(searchQuery);

    // Get paginated results
    const reminders = await Reminder.find(searchQuery)
      .populate('targetInvoice', 'invoiceNumber customerName totalAmount')
      .populate('targetCustomer', 'name email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      message: `${type} reminders fetched successfully`,
      data: {
        reminders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders by type',
      error: err.message
    });
  }
};

// @desc Get reminder statistics
exports.getReminderStats = async (req, res) => {
  try {
    const userId = req.user;

    const stats = await Reminder.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: null,
          totalReminders: { $sum: 1 },
          automaticReminders: {
            $sum: { $cond: [{ $in: ['$type', ['automatic', 'automatic_Purchase']] }, 1, 0] }
          },
          manualReminders: {
            $sum: { $cond: [{ $in: ['$type', ['manual', 'manual_purchase']] }, 1, 0] }
          },
          activeReminders: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          enabledReminders: {
            $sum: { $cond: ['$isEnabled', 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalReminders: 0,
      automaticReminders: 0,
      manualReminders: 0,
      activeReminders: 0,
      enabledReminders: 0
    };

    res.status(200).json({
      success: true,
      message: 'Reminder statistics fetched successfully',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder statistics',
      error: err.message
    });
  }
};

// @desc Get invoice placeholders for email templates
exports.getInvoicePlaceholders = async (req, res) => {
  try {
    // Define available placeholders based on Invoice schema
    const placeholders = [
      {
        key: 'CustomerName',
        label: 'Customer Name',
        description: 'The name of the customer',
        category: 'INVOICE'
      },
      {
        key: 'CustomerEmail',
        label: 'Customer Email',
        description: 'The email address of the customer',
        category: 'INVOICE'
      },
      {
        key: 'InvoiceNumber',
        label: 'Invoice Number',
        description: 'The unique invoice number',
        category: 'INVOICE'
      },
      {
        key: 'InvoiceDate',
        label: 'Invoice Date',
        description: 'The date when the invoice was created',
        category: 'INVOICE'
      },
      {
        key: 'DueDate',
        label: 'Due Date',
        description: 'The due date for payment',
        category: 'INVOICE'
      },
      {
        key: 'OverdueDays',
        label: 'Overdue Days',
        description: 'Number of days the invoice is overdue',
        category: 'INVOICE'
      },
      {
        key: 'Balance',
        label: 'Balance',
        description: 'The outstanding balance amount',
        category: 'INVOICE'
      },
      {
        key: 'Total',
        label: 'Total Amount',
        description: 'The total invoice amount',
        category: 'INVOICE'
      },
      {
        key: 'Subject',
        label: 'Subject',
        description: 'Invoice subject/reference',
        category: 'INVOICE'
      },
      {
        key: 'ReferenceNo',
        label: 'P.O. Number',
        description: 'Reference or PO number',
        category: 'INVOICE'
      },
      {
        key: 'Vat',
        label: 'VAT/Tax',
        description: 'Total VAT or tax amount',
        category: 'INVOICE'
      },
      {
        key: 'TotalDiscount',
        label: 'Total Discount',
        description: 'Total discount applied',
        category: 'INVOICE'
      },
      {
        key: 'TaxableAmount',
        label: 'Taxable Amount',
        description: 'Amount before tax',
        category: 'INVOICE'
      },
      {
        key: 'PaymentMethod',
        label: 'Payment Method',
        description: 'Preferred payment method',
        category: 'INVOICE'
      },
      {
        key: 'Notes',
        label: 'Notes',
        description: 'Additional notes on the invoice',
        category: 'INVOICE'
      },
      {
        key: 'TermsAndCondition',
        label: 'Terms & Conditions',
        description: 'Invoice terms and conditions',
        category: 'INVOICE'
      },
      {
        key: 'CreatedBy',
        label: 'Created By',
        description: 'Name of the user who created the invoice',
        category: 'INVOICE'
      },
      {
        key: 'InvoiceUrl',
        label: 'Invoice URL',
        description: 'Link to view the invoice online',
        category: 'INVOICE'
      },
      {
        key: 'InvoicePaymentLink',
        label: 'Invoice Payment Link',
        description: 'Direct link to make payment',
        category: 'INVOICE'
      }
    ];

    res.status(200).json({
      success: true,
      message: 'Invoice placeholders fetched successfully',
      data: {
        placeholders,
        usage: 'Use %PlaceholderName% in email templates to insert dynamic content'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice placeholders',
      error: err.message
    });
  }
};

exports.getQuotationPlaceholders = async (req, res) => {
  try {
    const placeholders = [
      {
        key: 'CustomerName',
        label: 'Customer Name',
        description: 'The name of the customer',
        category: 'QUOTATION'
      },
      {
        key: 'CustomerEmail',
        label: 'Customer Email',
        description: 'The email address of the customer',
        category: 'QUOTATION'
      },
      {
        key: 'QuotationNumber',
        label: 'Quotation Number',
        description: 'The unique quotation number',
        category: 'QUOTATION'
      },
      {
        key: 'QuotationDate',
        label: 'Quotation Date',
        description: 'The date when the quotation was created',
        category: 'QUOTATION'
      },
      {
        key: 'ExpiryDate',
        label: 'Expiry Date',
        description: 'The date when the quotation expires',
        category: 'QUOTATION'
      },
      {
        key: 'Total',
        label: 'Total Amount',
        description: 'The total quotation amount',
        category: 'QUOTATION'
      },
      {
        key: 'SubTotal',
        label: 'Sub Total',
        description: 'The total amount before taxes and discounts',
        category: 'QUOTATION'
      },
      {
        key: 'Discount',
        label: 'Discount',
        description: 'Total discount applied to the quotation',
        category: 'QUOTATION'
      },
      {
        key: 'Tax',
        label: 'Tax / VAT',
        description: 'Total tax applied to the quotation',
        category: 'QUOTATION'
      },
      {
        key: 'Subject',
        label: 'Subject',
        description: 'Quotation subject or reference',
        category: 'QUOTATION'
      },
      {
        key: 'ReferenceNo',
        label: 'Reference Number',
        description: 'Reference or P.O. number for the quotation',
        category: 'QUOTATION'
      },

      {
        key: 'TermsAndCondition',
        label: 'Terms & Conditions',
        description: 'Quotation terms and conditions',
        category: 'QUOTATION'
      },
      {
        key: 'Notes',
        label: 'Notes',
        description: 'Additional notes on the quotation',
        category: 'QUOTATION'
      },
      {
        key: 'CreatedBy',
        label: 'Created By',
        description: 'Name of the user who created the quotation',
        category: 'QUOTATION'
      },
      {
        key: 'QuotationStatus',
        label: 'Quotation Status',
        description: 'Current status of the quotation (e.g., Draft, Sent, Approved, Rejected)',
        category: 'QUOTATION'
      }, {
        key: 'CompanyName',
        label: 'Company Name',
        description: 'The name of the company',
        category: 'QUOTATION'
      }
    ];

    res.status(200).json({
      success: true,
      message: 'Quotation placeholders fetched successfully',
      data: {
        placeholders,
        usage: 'Use %PlaceholderName% in email templates to insert dynamic content'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotation placeholders',
      error: err.message
    });
  }
};

// @desc Manually trigger invoice reminder cron job (for testing)
exports.triggerReminderCron = async (req, res) => {
  try {
    console.log('Manual trigger of invoice reminder cron requested');

    // Run the cron job
    await runReminderCron();

    res.status(200).json({
      success: true,
      message: 'Invoice reminder cron job executed successfully',
      data: {
        executedAt: new Date().toISOString(),
        note: 'Check server logs for detailed execution results'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute invoice reminder cron',
      error: err.message
    });
  }
};