const mongoose = require('mongoose');
const CreditNote = require('@models/CreditNote');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');
const User = require('@models/User');
const { validationResult } = require('express-validator');
const { sendMail } = require("@utils/mailer");


const createCreditNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      invoiceId,
      creditNoteDate,
      referenceNo,
      reason,
      description,
      items,
      payment_method,
      refund_method,
      notes,
      termsAndCondition,
      taxableAmount,
      totalAmount,
      vat,
      totalDiscount,
      roundOff,
      status,
      bank,
      sign_type,
      signatureName,
      signatureId,
      billFrom,
      billTo
    } = req.body;

    const userId = req.user;

    // Get invoice details if provided
    let customerId = billTo;
    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      customerId = invoice.customerId;
    }

    // Validate billFrom and billTo exist
    const billFromUser = await User.findById(billFrom);
    if (!billFromUser) {
      return res.status(404).json({ message: 'Bill From user not found' });
    }

    let billToCustomer = null;
    if (billTo) {
      billToCustomer = await Customer.findById(billTo);
      if (!billToCustomer) {
        return res.status(404).json({ message: 'Bill To customer not found' });
      }
    }

    // Signature handling
    let signatureImage = null;
    let savedSignatureId = null;

    if (sign_type === 'eSignature' && req.file) {
      signatureImage = req.file.path;
    } else if (sign_type === 'digitalSignature' && signatureId) {
      savedSignatureId = signatureId;
    }

    // Create Credit Note
    const creditNote = new CreditNote({
      invoiceId: invoiceId || null,
      customerId: customerId,
      creditNoteDate: new Date(creditNoteDate),
      referenceNo: referenceNo || '',
      reason: reason || 'OTHER',
      description: description || '',
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        discount: item.discount || 0,
        tax: item.tax || 0,
        tax_group_id: item.tax_group_id,
        amount: item.amount || (item.rate * item.qty),
        discount_type: item.discount_type,
        discount_value: item.discount_value
      })),
      payment_method,
      status: status || 'PENDING',
      refund_method: refund_method || 'CREDIT_TO_ACCOUNT',
      taxableAmount: req.body.subTotal,
      totalAmount: req.body.grandTotal,
      vat: req.body.totalTax || 0,
      totalDiscount: req.body.totalDiscount || 0,
      roundOff: roundOff || false,
      bank: bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      sign_type: sign_type || 'none',
      signatureName,
      signatureImage,
      signatureId: savedSignatureId,
      billFrom,
      billTo,
      userId
    });

    await creditNote.save();

    res.status(201).json({
      message: 'Credit note created successfully',
      data: creditNote
    });

    // Send email notification (non-blocking)
    if (billToCustomer?.email && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      sendMail({
        from: `"${billFromUser.name || 'Your Company'}" <${process.env.SMTP_EMAIL}>`,
        to: billToCustomer.email,
        subject: `Credit Note Issued (Ref: ${creditNote.referenceNo || creditNote._id})`,
        html: `
          <h3>Hello ${billToCustomer.name},</h3>
          <p>A new credit note has been issued against your invoice.</p>
          <p><strong>Total Amount:</strong> ${creditNote.totalAmount}</p>
          <p><strong>Reason:</strong> ${creditNote.reason}</p>
        `
      }).catch(err => console.error("Failed to send email", err));
    }

  } catch (err) {
    console.error('Create credit note error:', err);
    res.status(500).json({ message: 'Error creating credit note', error: err.message });
  }
};


const getAllCreditNotes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search = '',
      customerId,
      invoiceId,
      startDate,
      endDate,
      refund_method
    } = req.query;

    const userId = req.user;
    const skip = (page - 1) * limit;

    const query = {
      isDeleted: false,

    };

    if (status && ['UNPAID', 'PENDING', 'PAID', 'CANCELLED'].includes(status)) {
      query.status = status;
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
      query.invoiceId = invoiceId;
    }

    if (refund_method) {
      query.refund_method = refund_method;
    }

    if (startDate || endDate) {
      query.creditNoteDate = {};
      if (startDate) query.creditNoteDate.$gte = new Date(startDate);
      if (endDate) query.creditNoteDate.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { creditNoteNumber: searchRegex },
        { referenceNo: searchRegex },
        { reason: searchRegex },
        { description: searchRegex },
        { 'items.name': searchRegex },
        { notes: searchRegex },
        { 'customerId.name': searchRegex }
      ];
    }

    const total = await CreditNote.countDocuments(query);

    const creditNotes = await CreditNote.find(query)
      .populate('invoiceId', 'invoiceNumber invoiceDate totalAmount status')
      .populate('customerId', 'name email phone image billingAddress')
      .populate('billFrom', 'firstName lastName email phone profileImage address companyName')
      .populate('billTo', 'name email phone billingAddress shippingAddress image')
      .populate('appliedToInvoice', 'invoiceNumber invoiceDate')
      .populate('bank', 'accountHoldername bankName branchName accountNumber IFSCCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    const formattedCreditNotes = creditNotes.map((note) => {
      // Customer details
      const customerDetails = note.customerId ? {
        id: note.customerId._id,
        name: note.customerId.name || '',
        email: note.customerId.email || null,
        phone: note.customerId.phone || null,
        billingAddress: note.customerId.billingAddress || null,
        image: note.customerId.image
          ? `${baseUrl}${note.customerId.image.replace(/\\/g, '/')}`
          : ''
      } : null;

      // BillFrom details
      const billFromDetails = note.billFrom ? {
        id: note.billFrom._id,
        name: `${note.billFrom.firstName || ''} ${note.billFrom.lastName || ''}`.trim(),
        email: note.billFrom.email || null,
        phone: note.billFrom.phone || null,
        companyName: note.billFrom.companyName || null,
        address: note.billFrom.address || null,
        image: note.billFrom.profileImage
          ? `${baseUrl}${note.billFrom.profileImage.replace(/\\/g, '/')}`
          : ''
      } : null;

      // BillTo details
      const billToDetails = note.billTo ? {
        id: note.billTo._id,
        name: note.billTo.name || '',
        email: note.billTo.email || null,
        phone: note.billTo.phone || null,
        billingAddress: note.billTo.billingAddress || null,
        shippingAddress: note.billTo.shippingAddress || null,
        image: note.billTo.image
          ? `${baseUrl}${note.billTo.image.replace(/\\/g, '/')}`
          : ''
      } : null;

      // Invoice details
      const invoiceDetails = note.invoiceId ? {
        id: note.invoiceId._id,
        invoiceNumber: note.invoiceId.invoiceNumber,
        invoiceDate: formatDate(note.invoiceId.invoiceDate),
        totalAmount: note.invoiceId.totalAmount,
        status: note.invoiceId.status
      } : null;

      // Applied invoice details
      const appliedInvoiceDetails = note.appliedToInvoice ? {
        id: note.appliedToInvoice._id,
        invoiceNumber: note.appliedToInvoice.invoiceNumber,
        invoiceDate: formatDate(note.appliedToInvoice.invoiceDate)
      } : null;

      // Bank details
      const bankDetails = note.bank ? {
        accountHoldername: note.bank.accountHoldername || '',
        bankName: note.bank.bankName || '',
        branchName: note.bank.branchName || '',
        accountNumber: note.bank.accountNumber || '',
        IFSCCode: note.bank.IFSCCode || ''
      } : null;

      // Signature details
      let signatureDetails = null;
      if (note.sign_type === 'eSignature') {
        signatureDetails = {
          name: note.signatureName || null,
          image: note.signatureImage
            ? `${baseUrl}${note.signatureImage.replace(/\\/g, '/')}`
            : null
        };
      } else if (note.sign_type === 'digitalSignature') {
        signatureDetails = {
          signatureId: note.signatureId || null
        };
      }

      // Formatted items
      const formattedItems = note.items.map(item => ({
        id: item._id,
        productId: item.id || null,
        name: item.name || '',
        unit: item.unit || '',
        qty: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        tax_group_id: item.tax_group_id,
        amount: item.amount,
        discount_type: item.discount_type,
        discount_value: item.discount_value
      }));

      return {
        id: note._id,
        creditNoteNumber: note.creditNoteNumber,
        referenceNo: note.referenceNo,
        reason: note.reason,
        description: note.description,
        creditNoteDate: formatDate(note.creditNoteDate),
        status: note.status,
        refund_method: note.refund_method,
        taxableAmount: note.taxableAmount,
        totalDiscount: note.totalDiscount,
        vat: note.vat,
        totalAmount: note.totalAmount,
        roundOff: note.roundOff,
        items: formattedItems,
        itemsCount: note.items.length,
        customer: customerDetails,
        invoice: invoiceDetails,
        billFrom: billFromDetails,
        billTo: billToDetails,
        appliedToInvoice: appliedInvoiceDetails,
        appliedDate: formatDate(note.appliedDate),
        bank: bankDetails,
        notes: note.notes,
        termsAndCondition: note.termsAndCondition,
        sign_type: note.sign_type,
        signature: signatureDetails,
        createdAt: formatDate(note.createdAt),
        updatedAt: formatDate(note.updatedAt)
      };
    });

    // Get next credit note number
    const lastCreditNote = await CreditNote.findOne()
      .sort({ creditNoteNumber: -1 })
      .select('creditNoteNumber');

    let nextCreditNoteNumber = 'CN-000001';
    if (lastCreditNote && lastCreditNote.creditNoteNumber) {
      const lastNumber = parseInt(lastCreditNote.creditNoteNumber.split('-')[1]);
      nextCreditNoteNumber = `CN-${String(lastNumber + 1).padStart(6, '0')}`;
    }

    res.status(200).json({
      success: true,
      message: 'Credit notes retrieved successfully',
      data: {
        creditNotes: formattedCreditNotes,
        nextCreditNoteNumber,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('List credit notes error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit notes',
      error: err.message
    });
  }
};


const getCreditNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Credit Note ID format'
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const note = await CreditNote.findById(id)
      .populate('invoiceId', 'invoiceNumber invoiceDate dueDate totalAmount taxableAmount vat totalDiscount items status')
      .populate('customerId', 'name email phone billingAddress shippingAddress image')
      .populate('billFrom', 'firstName lastName email phone profileImage address companyName')
      .populate('billTo', 'name email phone billingAddress shippingAddress image')
      .populate('appliedToInvoice', 'invoiceNumber invoiceDate totalAmount')
      .populate('bank', '_id accountHoldername bankName branchName accountNumber IFSCCode')
      .populate('signatureId', 'name signatureImage createdAt')
      .populate('userId', 'firstName lastName email');

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Credit note not found'
      });
    }

    if (note.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Credit note has been deleted'
      });
    }

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    // Customer details
    const customerDetails = note.customerId ? {
      id: note.customerId._id,
      name: note.customerId.name || '',
      email: note.customerId.email || null,
      phone: note.customerId.phone || null,
      billingAddress: note.customerId.billingAddress || null,
      shippingAddress: note.customerId.shippingAddress || null,
      image: note.customerId.image
        ? `${baseUrl}${note.customerId.image.replace(/\\/g, '/')}`
        : ''
    } : null;

    // BillFrom details
    const billFromDetails = note.billFrom ? {
      id: note.billFrom._id,
      name: `${note.billFrom.firstName || ''} ${note.billFrom.lastName || ''}`.trim(),
      email: note.billFrom.email || null,
      phone: note.billFrom.phone || null,
      companyName: note.billFrom.companyName || null,
      address: note.billFrom.address || null,
      image: note.billFrom.profileImage
        ? `${baseUrl}${note.billFrom.profileImage.replace(/\\/g, '/')}`
        : ''
    } : null;

    // BillTo details
    const billToDetails = note.billTo ? {
      id: note.billTo._id,
      name: note.billTo.name || '',
      email: note.billTo.email || null,
      phone: note.billTo.phone || null,
      billingAddress: note.billTo.billingAddress || null,
      shippingAddress: note.billTo.shippingAddress || null,
      image: note.billTo.image
        ? `${baseUrl}${note.billTo.image.replace(/\\/g, '/')}`
        : ''
    } : null;

    // Invoice details
    const invoiceDetails = note.invoiceId ? {
      id: note.invoiceId._id,
      invoiceNumber: note.invoiceId.invoiceNumber,
      invoiceDate: formatDate(note.invoiceId.invoiceDate),
      dueDate: formatDate(note.invoiceId.dueDate),
      totalAmount: note.invoiceId.totalAmount,
      taxableAmount: note.invoiceId.taxableAmount,
      vat: note.invoiceId.vat,
      totalDiscount: note.invoiceId.totalDiscount,
      status: note.invoiceId.status,
      items: note.invoiceId.items?.map(item => ({
        name: item.name,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount
      })) || []
    } : null;

    // Applied invoice details
    const appliedInvoiceDetails = note.appliedToInvoice ? {
      id: note.appliedToInvoice._id,
      invoiceNumber: note.appliedToInvoice.invoiceNumber,
      invoiceDate: formatDate(note.appliedToInvoice.invoiceDate),
      totalAmount: note.appliedToInvoice.totalAmount
    } : null;

    // Bank details
    const bankDetails = note.bank ? {
      id: note.bank._id,
      accountHoldername: note.bank.accountHoldername || '',
      bankName: note.bank.bankName || '',
      branchName: note.bank.branchName || '',
      accountNumber: note.bank.accountNumber || '',
      IFSCCode: note.bank.IFSCCode || ''
    } : null;

    // Signature details
    let signatureDetails = null;
    if (note.sign_type === 'eSignature') {
      signatureDetails = {
        name: note.signatureName || null,
        image: note.signatureImage
          ? `${baseUrl}${note.signatureImage.replace(/\\/g, '/')}`
          : null
      };
    } else if (note.sign_type === 'digitalSignature' && note.signatureId) {
      signatureDetails = {
        id: note.signatureId._id,
        name: note.signatureId.name || null,
        image: note.signatureId.signatureImage
          ? `${baseUrl}${note.signatureId.signatureImage.replace(/\\/g, '/')}`
          : null,
        createdAt: formatDate(note.signatureId.createdAt)
      };
    }

    // User details (creator)
    const userDetails = note.userId ? {
      id: note.userId._id,
      name: `${note.userId.firstName || ''} ${note.userId.lastName || ''}`.trim(),
      email: note.userId.email || null
    } : null;

    // Formatted items
    const formattedItems = note.items.map(item => ({
      id: item._id,
      productId: item.id || null,
      name: item.name || '',
      unit: item.unit || '',
      qty: item.qty,
      rate: item.rate,
      discount: item.discount,
      tax: item.tax,
      tax_group_id: item.tax_group_id,
      amount: item.amount,
      discount_type: item.discount_type,
      discount_value: item.discount_value
    }));

    const response = {
      id: note._id,
      creditNoteNumber: note.creditNoteNumber,
      referenceNo: note.referenceNo,
      reason: note.reason,
      description: note.description,
      creditNoteDate: note.creditNoteDate,
      status: note.status,
      refund_method: note.refund_method,
      taxableAmount: note.taxableAmount,
      totalDiscount: note.totalDiscount,
      vat: note.vat,
      totalAmount: note.totalAmount,
      roundOff: note.roundOff,
      items: formattedItems,
      itemsCount: note.items.length,
      customer: customerDetails,
      invoice: invoiceDetails,
      billFrom: billFromDetails,
      billTo: billToDetails,
      appliedToInvoice: appliedInvoiceDetails,
      appliedDate: note.appliedDate,
      bank: bankDetails,
      notes: note.notes,
      termsAndCondition: note.termsAndCondition,
      sign_type: note.sign_type,
      signature: signatureDetails,
      createdBy: userDetails,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Credit note retrieved successfully',
      data: response
    });

  } catch (err) {
    console.error('Get credit note by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit note details',
      error: err.message
    });
  }
};


const updateCreditNote = async (req, res) => {
  try {
    const { id: creditNoteId } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user;

    // Check if credit note exists
    const creditNote = await CreditNote.findById(creditNoteId);
    if (!creditNote) {
      return res.status(404).json({ message: "Credit Note not found" });
    }

    const {
      creditNoteDate,
      referenceNo,
      reason,
      description,
      items,
      payment_method,
      refund_method,
      notes,
      termsAndCondition,
      taxableAmount,
      totalAmount,
      vat,
      totalDiscount,
      roundOff,
      bank,
      sign_type,
      signatureName,
      signatureId,
      billFrom,
      status,
      billTo
    } = req.body;

    // Validate billFrom and billTo existence if provided
    if (billFrom) {
      const billFromUser = await User.findById(billFrom);
      if (!billFromUser) return res.status(404).json({ message: "Bill From user not found" });
    }

    if (billTo) {
      const billToCustomer = await Customer.findById(billTo);
      if (!billToCustomer) return res.status(404).json({ message: "Bill To customer not found" });
    }

    // Handle signature logic
    if (sign_type === "eSignature" && req.file) {
      creditNote.signatureImage = req.file.path;
      creditNote.signatureName = signatureName;
      creditNote.signatureId = null;
    } else if (sign_type === "digitalSignature" && signatureId) {
      creditNote.signatureId = signatureId;
      creditNote.signatureImage = null;
      creditNote.signatureName = null;
    }

    // Update fields
    creditNote.creditNoteDate = creditNoteDate || creditNote.creditNoteDate;
    creditNote.referenceNo = referenceNo || creditNote.referenceNo;
    creditNote.reason = reason || creditNote.reason;
    creditNote.description = description || creditNote.description;
    creditNote.items = items
      ? items.map(item => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          qty: item.qty,
          rate: item.rate,
          discount: item.discount || 0,
          tax: item.tax || 0,
          tax_group_id: item.tax_group_id,
          amount: item.amount || item.rate * item.qty,
          discount_type: item.discount_type,
          discount_value: item.discount_value
        }))
      : creditNote.items;

    creditNote.payment_method = payment_method || creditNote.payment_method;
    creditNote.refund_method = refund_method || creditNote.refund_method;
    creditNote.taxableAmount = req.body.subTotal || creditNote.taxableAmount;
    creditNote.totalAmount = req.body.grandTotal || creditNote.totalAmount;
    creditNote.vat = req.body.totalTax || creditNote.vat;
    creditNote.totalDiscount = req.body.totalDiscount || creditNote.totalDiscount;
    creditNote.roundOff = roundOff !== undefined ? roundOff : creditNote.roundOff;
    creditNote.bank = bank || creditNote.bank;
    creditNote.notes = notes || creditNote.notes;
    creditNote.termsAndCondition = termsAndCondition || creditNote.termsAndCondition;
    creditNote.sign_type = sign_type || creditNote.sign_type;
    creditNote.billFrom = billFrom || creditNote.billFrom;
    creditNote.billTo = billTo || creditNote.billTo;
    creditNote.status = status || creditNote.status;
    creditNote.userId = userId;

    await creditNote.save();

    return res.status(200).json({
      message: "Credit note updated successfully",
      data: creditNote,
    });

  } catch (err) {
    console.error("Update credit note error:", err);
    return res.status(500).json({
      message: "Error updating credit note",
      error: err.message,
    });
  }
};


const deleteCreditNote = async (req, res) => {
  try {
    const { id: creditNoteId } = req.params;

    const creditNote = await CreditNote.findById(creditNoteId);
    if (!creditNote) {
      return res.status(404).json({ message: "Credit Note not found" });
    }

    await CreditNote.deleteOne({ _id: creditNoteId });

    return res.status(200).json({
      message: "Credit note deleted successfully",
      id: creditNoteId,
    });

  } catch (err) {
    console.error("Delete credit note error:", err);
    return res.status(500).json({
      message: "Error deleting credit note",
      error: err.message,
    });
  }
};

const bulkDeleteCreditNotes = async (req, res) => {
  const { ids, all } = req.body;
  try {
    if (all) {
      const result = await CreditNote.deleteMany({});
      return res.status(200).json({
        message: "Credit notes deleted successfully",
        deletedCount: result.deletedCount || 0
      });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Please provide credit note ids." });
    }
    const result = await CreditNote.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({
      message: "Credit notes deleted successfully",
      deletedCount: result.deletedCount || 0
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error deleting credit notes",
      error: err.message,
    });
  }
};


module.exports = {
  createCreditNote,
  getAllCreditNotes,
  getCreditNoteById,
  updateCreditNote,
  deleteCreditNote,
  bulkDeleteCreditNotes
};
