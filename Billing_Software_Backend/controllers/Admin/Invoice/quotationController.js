const mongoose = require('mongoose');
const Quotation = require('@models/Quotation');
const User = require('@models/User');
const Product = require('@models/Product');
const Customer = require('@models/Customer');
const { sendMail } = require("@utils/mailer");
const CompanySettings = require('@models/CompanySettings');
const {
    syncQuotationNotificationForQuotation,
    resolveNotificationForQuotation,
} = require('@services/notificationService');
const { triggerWhatsAppSend } = require('../../../whatsapp-module');


const createQuotation = async (req, res) => {
  try {
    const {
      customerId,
      quotationDate,
      expiryDate,
      referenceNo,
      items = [],
      status,
      paymentTerms,
      notes,
      termsAndCondition,
      sign_type,
      signatureId,
      signatureName,
      billFrom,
      billTo,
      bank,
      salesPerson,
      convert_type
    } = req.body;

    const userId = req.user;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Quotation must contain at least 1 item" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Invalid user ID" });

    const billFromUser = await User.findById(billFrom);
    const billToUser = await Customer.findById(billTo);

    if (!billFromUser || !billToUser) {
      return res.status(404).json({ message: "Invalid billFrom or billTo user ID" });
    }

    // Signature validations
    const validSignatureTypes = ["none", "digitalSignature", "eSignature"];
    if (sign_type && !validSignatureTypes.includes(sign_type)) {
      return res.status(400).json({ message: "Invalid signature type" });
    }

    if (sign_type === "eSignature" && !req.file) {
      return res.status(400).json({ message: "Signature image is required for eSignature" });
    }

    // Auto calculate totals
    const taxableAmount = items.reduce((sum, item) => sum + (item.rate * item.qty), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const vat = items.reduce((sum, item) => sum + (item.tax || 0), 0);
    const totalAmount = taxableAmount + vat - totalDiscount;

    const quotation = new Quotation({
      customerId,
      quotationDate: new Date(quotationDate),
      expiryDate: expiryDate || null,
      referenceNo: referenceNo || "",
      items: items.map(item => ({
        id: item.id,
        product_id: item.product_id || null,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        variantDesignNo: item.variantDesignNo || null,
        variantColor: item.variantColor || null,
        variantSize: item.variantSize || null,
        name: item.name,
        hsn_code: item.hsn_code || '',
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        discount: item.discount || 0,
        tax: item.tax || 0,
        tax_group_id: item.tax_group_id,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount || (item.qty * item.rate)
      })),
      status: status || "draft",
      bank: bank || null,
      paymentTerms: paymentTerms || "",
      taxableAmount: req.body.subTotal || taxableAmount,
      totalDiscount: req.body.totalDiscount || totalDiscount,
      vat: req.body.totalTax || vat,
      roundOff: req.body.roundOff || false,
      TotalAmount: req.body.grandTotal || totalAmount,
      notes: notes || "",
      termsAndCondition: termsAndCondition || "",
      sign_type: sign_type || "none",
      signatureId: sign_type === "digitalSignature" ? signatureId : null,
      signatureImage: sign_type === "eSignature" ? req.file?.path : null,
      signatureName: sign_type === "eSignature" ? signatureName : null,
      userId,
      salesPerson: salesPerson || null,
      billFrom,
      billTo,
      convert_type: convert_type || "quotation"
    });

    await quotation.save();
    await syncQuotationNotificationForQuotation(quotation._id);

    // Send Email if status is "sent"
    if (
      quotation.status === "sent" &&
      billToUser?.email &&
      process.env.SMTP_EMAIL &&
      process.env.SMTP_PASSWORD
    ) {
      try {
        await sendMail({
          from: `"${billFromUser.name || "Your Company"}" <${process.env.SMTP_EMAIL}>`,
          to: billToUser.email,
          subject: "New Quotation Sent",
          html: `
            <h3>Hello ${billToUser.name},</h3>
            <p>A new quotation has been sent to you.</p>
            <p><strong>Reference No:</strong> ${quotation.referenceNo}</p>
            <p><strong>Total Amount:</strong> ${quotation.TotalAmount}</p>
            <p><strong>Status:</strong> ${quotation.status}</p>
            <br>
            <p>Best Regards,<br>${billFromUser.name}</p>
          `
        });
      } catch (emailErr) {
        console.error("Failed to send quotation email:", emailErr.message);
      }
    }

    res.status(201).json({
      message: "Quotation created successfully",
      data: quotation,
    });

  } catch (err) {
    console.error("Quotation creation error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error creating quotation",
      error: err.message
    });
  }
};


const getQuotationById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;
        const baseUrl = `${req.protocol}://${req.get('host')}/`;

        const quotation = await Quotation.findOne({
            _id: id,
            isDeleted: false
        })
            .populate('customerId', 'name email phone image billingAddress')
            .populate('userId', 'firstName lastName email phone profileImage address')
            .populate('billFrom', 'firstName lastName email phone profileImage address')
            .populate('billTo', 'name email phone image billingAddress')
            .populate('items.id', 'name description price unit')
            .populate('signatureId', 'signatureName signatureImage')
            .populate('bank', '_id accountHoldername bankName branchName accountNumber IFSCCode'); // Add bank population

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: 'Quotation not found or unauthorized'
            });
        }

        // Format dates as "dd/MM/yyyy"
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // Format customer details
        const customerDetails = quotation.customerId ? {
            id: quotation.customerId._id,
            name: quotation.customerId.name || '',
            email: quotation.customerId.email || null,
            phone: quotation.customerId.phone || null,
            image: quotation.customerId.image
                ? `${baseUrl}${quotation.customerId.image.replace(/\\/g, '/')}`
                : '',
            billingAddress: quotation.customerId.billingAddress || null
        } : null;

        // Format billFrom details
        const billFromDetails = quotation.billFrom ? {
            id: quotation.billFrom._id,
            name: `${quotation.billFrom.firstName || ''} ${quotation.billFrom.lastName || ''}`.trim(),
            email: quotation.billFrom.email || null,
            phone: quotation.billFrom.phone || null,
            profileImage: quotation.billFrom.profileImage
                ? `${baseUrl}${quotation.billFrom.profileImage.replace(/\\/g, '/')}`
                : '',
            address: quotation.billFrom.address || null,
            user_type: quotation.billFrom.user_type || 1
        } : null;

        // Format billTo details
        const billToDetails = quotation.billTo ? {
            id: quotation.billTo._id,
            name: quotation.billTo.name || '',
            email: quotation.billTo.email || null,
            phone: quotation.billTo.phone || null,
            image: quotation.billTo.image
                ? `${baseUrl}${quotation.billTo.image.replace(/\\/g, '/')}`
                : '',
            billingAddress: quotation.billTo.billingAddress || null
        } : null;

        // Format bank details
        const bankDetails = quotation.bank ? {
            id: quotation.bank._id,
            accountHoldername: quotation.bank.accountHoldername || '',
            bankName: quotation.bank.bankName || '',
            branchName: quotation.bank.branchName || '',
            accountNumber: quotation.bank.accountNumber || '',
            IFSCCode: quotation.bank.IFSCCode || ''
        } : null;

        // Format signature details
        const signatureImage = quotation.signatureImage
            ? `${baseUrl}${quotation.signatureImage.replace(/\\/g, '/')}`
            : null;

        const signatureDetails = quotation.sign_type === 'eSignature' ? {
            name: quotation.signatureName || null,
            image: signatureImage
        } : quotation.signatureId ? {
            id: quotation.signatureId._id,
            name: quotation.signatureId.signatureName || null,
            image: quotation.signatureId.signatureImage ? `${baseUrl}${quotation.signatureId.signatureImage.replace(/\\/g, '/')}` : null
        } : null;

        // Format items
        const formattedItems = quotation.items.map(item => ({
            id: item?.id ?? null,
            product_id: item?.product_id ?? null,
            productId: item?.product_id ?? null,
            variantId: item?.variantId ?? null,
            variantName: item?.variantName ?? null,
            variantDesignNo: item?.variantDesignNo ?? null,
            variantColor: item?.variantColor ?? null,
            variantSize: item?.variantSize ?? null,
            name: item.name || item.id?.name || '',
            description: item.id?.description || '',
            unit: item.unit || item.id?.unit || '',
            qty: item.qty || 0,
            rate: item.rate || item.id?.price || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            tax_group_id: item.tax_group_id || null,
            discount_type: item.discount_type || 'Fixed',
            discount_value: item.discount_value || 0,
            amount: item.amount || 0
        }));

        const response = {
            id: quotation._id,
            quotationId: quotation.quotationId,
            salesPerson: quotation.salesPerson,
            customer: customerDetails,
            quotationDate: quotation.quotationDate,
            expiryDate: quotation.expiryDate,
            referenceNo: quotation.referenceNo,
            status: quotation.status,
            paymentTerms: quotation.paymentTerms,
            taxableAmount: quotation.taxableAmount,
            totalDiscount: quotation.totalDiscount,
            vat: quotation.vat,
            roundOff: quotation.roundOff,
            TotalAmount: quotation.TotalAmount,
            items: formattedItems,
            billFrom: billFromDetails,
            billTo: billToDetails,
            bank: bankDetails,
            notes: quotation.notes,
            termsAndCondition: quotation.termsAndCondition,
            sign_type: quotation.sign_type,
            signature: signatureDetails,
            convert_type: quotation.convert_type,
            createdAt: formatDate(quotation.createdAt),
            updatedAt: formatDate(quotation.updatedAt)
        };

        res.status(200).json({
            success: true,
            message: 'Quotation retrieved successfully',
            data: response
        });

    } catch (err) {
        console.error('Get quotation by ID error:', err);
        res.status(500).json({
            success: false,
            message: 'Error retrieving quotation',
            error: err.message
        });
    }
};


const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if quotation exists
    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // Update fields
    if (updateData.quotationDate) quotation.quotationDate = new Date(updateData.quotationDate);
    if (updateData.salesPerson !== undefined) quotation.salesPerson = updateData.salesPerson || null;
    if (updateData.expiryDate !== undefined) quotation.expiryDate = updateData.expiryDate || null;
    if (updateData.referenceNo !== undefined) quotation.referenceNo = updateData.referenceNo;
    if (updateData.status) quotation.status = updateData.status;
    if (updateData.paymentTerms !== undefined) quotation.paymentTerms = updateData.paymentTerms;
    if (updateData.notes !== undefined) quotation.notes = updateData.notes;
    if (updateData.termsAndCondition !== undefined) quotation.termsAndCondition = updateData.termsAndCondition;
    if (updateData.sign_type !== undefined) quotation.sign_type = updateData.sign_type;
    if (updateData.signatureId !== undefined) quotation.signatureId = updateData.signatureId;
    if (updateData.convert_type !== undefined) quotation.convert_type = updateData.convert_type;
    if (updateData.billFrom !== undefined) quotation.billFrom = updateData.billFrom;
    if (updateData.billTo !== undefined) {
      quotation.billTo = updateData.billTo;
      quotation.customerId = updateData.billTo;
    }
    if (updateData.customerId !== undefined && updateData.billTo === undefined) {
      quotation.customerId = updateData.customerId;
    }
    if (updateData.bank !== undefined) quotation.bank = updateData.bank || null;

    // Handle signature image upload
    if (updateData.sign_type === "eSignature" && req.file) {
      quotation.signatureImage = req.file.path;
      quotation.signatureName = updateData.signatureName;
    }

    // Items update & recalculation
    if (updateData.items) {
      quotation.items = updateData.items.map(item => ({
        id: item.id,
        product_id: item.product_id || null,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        variantDesignNo: item.variantDesignNo || null,
        variantColor: item.variantColor || null,
        variantSize: item.variantSize || null,
        name: item.name,
        hsn_code: item.hsn_code || '',
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        tax_group_id: item.tax_group_id,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount
      }));

      // Recalculate totals
      let taxableAmount = 0;
      let totalDiscount = 0;
      let vat = 0;
      let totalAmount = 0;

      updateData.items.forEach(item => {
        const itemAmount = item.amount || (item.qty * (item.rate || 0));
        taxableAmount += itemAmount;
        totalDiscount += item.discount || 0;
        vat += item.tax || 0;
        totalAmount += itemAmount;
      });

      quotation.taxableAmount = updateData.subTotal || taxableAmount;
      quotation.totalDiscount = updateData.totalDiscount || totalDiscount;
      quotation.vat = updateData.totalTax || vat;
      quotation.TotalAmount = updateData.grandTotal || totalAmount;
    }

    await quotation.save();
    await syncQuotationNotificationForQuotation(quotation._id);

    res.status(200).json({
      message: "Quotation updated successfully",
      data: quotation
    });

  } catch (err) {
    console.error("Update quotation error:", err);
    res.status(500).json({
      message: "Error updating quotation",
      error: err.message
    });
  }
};


const deleteQuotation = async (req, res) => {
    try {
        const { id } = req.params;

        const quotation = await Quotation.findByIdAndDelete(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!quotation) {
            return res.status(404).json({
                message: 'Quotation not found'
            });
        }

        await resolveNotificationForQuotation(quotation._id);

        res.status(200).json({
            message: 'Quotation deleted successfully',
            data: quotation
        });
    } catch (err) {
        res.status(500).json({
            message: 'Error deleting quotation',
            error: err.message
        });
    }
};

const bulkDeleteQuotations = async (req, res) => {
    const { ids, all } = req.body;
    try {
        if (all) {
            const quotations = await Quotation.find({}).select('_id');
            const result = await Quotation.deleteMany({});
            await Promise.all(quotations.map((quotation) => resolveNotificationForQuotation(quotation._id)));
            return res.status(200).json({
                message: 'Quotations deleted successfully',
                deletedCount: result.deletedCount || 0
            });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide quotation ids.' });
        }
        const result = await Quotation.deleteMany({ _id: { $in: ids } });
        await Promise.all(ids.map((id) => resolveNotificationForQuotation(id)));
        return res.status(200).json({
            message: 'Quotations deleted successfully',
            deletedCount: result.deletedCount || 0
        });
    } catch (err) {
        return res.status(500).json({
            message: 'Error deleting quotations',
            error: err.message
        });
    }
};

const listQuotations = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search = '',
            customerId,
            startDate,
            endDate
        } = req.query;

        const userId = req.user;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            isDeleted: false
        };

        // Add status filter
        if (status && ['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(status)) {
            query.status = status;
        }

        // Add customer filter
        if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
            query.customerId = customerId;
        }

        // Add date range filter
        if (startDate || endDate) {
            query.quotationDate = {};
            if (startDate) {
                query.quotationDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.quotationDate.$lte = new Date(endDate);
            }
        }

        // Add search filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { quotationId: searchRegex },
                { referenceNo: searchRegex },
                { 'items.name': searchRegex },
                { notes: searchRegex }
            ];
        }

        // Get total count
        const total = await Quotation.countDocuments(query);

        // Get quotations with pagination
        const quotations = await Quotation.find(query)
            .populate('customerId', 'name email phone image')
            .populate('signatureId', 'signatureName')
            .populate('billTo', 'name email phone image billingAddress')
            .populate('bank', 'accountHoldername bankName branchName accountNumber IFSCCode') // Add bank population
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Get the next quotation ID
        const lastQuotation = await Quotation.findOne()
            .sort({ quotationId: -1 })
            .select('quotationId');

        let nextQuotationId = 'QT-000001'; // Default if no quotations exist
        if (lastQuotation) {
            const lastNumber = parseInt(lastQuotation.quotationId.split('-')[1]);
            nextQuotationId = `QT-${String(lastNumber + 1).padStart(6, '0')}`;
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/`;

        const formattedQuotations = quotations.map((quotation) => {
            // Format dates as "dd, MMM yyyy"
            const formatDate = (date) => {
                if (!date) return null;
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                return `${day}, ${month} ${year}`;
            };

            // Customer details with image
            const customerDetails = quotation.customerId ? {
                id: quotation.customerId._id,
                name: quotation.customerId.name || '',
                email: quotation.customerId.email || null,
                phone: quotation.customerId.phone || null,
                image: quotation.customerId.image
                    ? `${baseUrl}${quotation.customerId.image.replace(/\\/g, '/')}`
                    : ''
            } : null;

            // BillTo details (from Customer model)
            const billToDetails = quotation.billTo ? {
                id: quotation.billTo._id,
                name: quotation.billTo.name || '',
                email: quotation.billTo.email || null,
                phone: quotation.billTo.phone || null,
                image: quotation.billTo.image
                    ? `${baseUrl}${quotation.billTo.image.replace(/\\/g, '/')}`
                    : '',
                billingAddress: quotation.billTo.billingAddress || null
            } : null;

            // Bank details
            const bankDetails = quotation.bank ? {
                accountHoldername: quotation.bank.accountHoldername || '',
                bankName: quotation.bank.bankName || '',
                branchName: quotation.bank.branchName || '',
                accountNumber: quotation.bank.accountNumber || '',
                IFSCCode: quotation.bank.IFSCCode || ''
            } : null;

            // Signature details
            const signatureImage = quotation.signatureImage
                ? `${baseUrl}${quotation.signatureImage.replace(/\\/g, '/')}`
                : null;

            const signatureDetails = quotation.sign_type === 'eSignature' ? {
                name: quotation.signatureName || null,
                image: signatureImage
            } : quotation.signatureId ? {
                id: quotation.signatureId._id,
                name: quotation.signatureId.signatureName || null
            } : null;

            return {
                id: quotation._id,
                quotationId: quotation.quotationId,
                customer: customerDetails,
                quotationDate: formatDate(quotation.quotationDate),
                expiryDate: formatDate(quotation.expiryDate),
                referenceNo: quotation.referenceNo,
                status: quotation.status,
                paymentTerms: quotation.paymentTerms,
                taxableAmount: quotation.taxableAmount,
                totalDiscount: quotation.totalDiscount,
                vat: quotation.vat,
                TotalAmount: quotation.TotalAmount,
                itemsCount: quotation.items.length,
                billFrom: quotation.billFrom,
                billTo: billToDetails,
                bank: bankDetails, // Include bank details in response
                notes: quotation.notes,
                sign_type: quotation.sign_type,
                signature: signatureDetails,
                convert_type: quotation.convert_type,
                invoiceId: quotation.invoiceId ?? null,
                createdAt: formatDate(quotation.createdAt),
                updatedAt: formatDate(quotation.updatedAt)
            };
        });

        res.status(200).json({
            success: true,
            message: 'Quotations retrieved successfully',
            data: {
                quotations: formattedQuotations,
                nextQuotationId,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (err) {
        console.error('List quotations error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching quotations',
            error: err.message
        });
    }
};

const listQuotationsMinimal = async (req, res) => {
    try {
        const { search = '' } = req.query;
        const userId = req.user;

        // Build base query
        const query = {
            userId,
            isDeleted: false
        };

        // Add search filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { quotationId: searchRegex },
                { referenceNo: searchRegex },
                { 'customerId.name': searchRegex },
                { 'items.name': searchRegex }
            ];
        }

        const quotations = await Quotation.find(query)
            .select('_id quotationId referenceNo quotationDate status TotalAmount customerId')
            .populate('customerId', 'name') // Minimal customer info
            .sort({ quotationDate: -1 })
            .limit(search ? 0 : 20); // Limit to 20 if no search

        const formattedQuotations = quotations.map(q => ({
            id: q._id,
            quotationId: q.quotationId,
            referenceNo: q.referenceNo,
            quotationDate: q.quotationDate,
            status: q.status,
            totalAmount: q.TotalAmount,
            customer: q.customerId ? {
                id: q.customerId._id,
                name: q.customerId.name
            } : null
        }));

        res.status(200).json({
            success: true,
            message: search
                ? 'Search results for quotations retrieved successfully'
                : 'Last 20 quotations retrieved successfully',
            data: formattedQuotations,
            meta: {
                count: quotations.length,
                isSearchResult: !!search
            }
        });

    } catch (err) {
        console.error('List minimal quotations error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching quotations',
            error: err.message
        });
    }
};


const getAllCustomers = async (req, res) => {
    try {
        const { search = '', status } = req.query;

        // Build query
        const query = {
            isDeleted: false
        };

        // Add filters
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { 'billingAddress.city': { $regex: search, $options: 'i' } },
                { 'shippingAddress.city': { $regex: search, $options: 'i' } }
            ];
        }

        // Get all matching customers without pagination
        const customers = await Customer.find(query)
            .collation({ locale: 'en', strength: 2 }) // case-insensitive
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            message: 'Customers fetched successfully',
            data: {
                customers: customers.map(customer => formatCustomerResponse(customer)),
                count: customers.length
            }
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching customers',
            error: err.message
        });
    }
};

function formatCustomerResponse(customer) {
    return {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        image: customer.imageUrl || null, // Include the image URL from virtual
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
    };
};

const updateQuotationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Allowed values: 'accepted' or 'declined'.",
            });
        }

        const quotation = await Quotation.findById(id);
        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: 'Quotation not found.',
            });
        }

        quotation.status = status;
        await quotation.save();
        await syncQuotationNotificationForQuotation(quotation._id);

        res.status(200).json({
            success: true,
            message: `Quotation has been ${status}.`,
            data: quotation,
        });
    } catch (error) {
        console.error('Error updating quotation status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};

const sendQuotationEmailAndUpdateStatus = async (req, res) => {
    try {
        const {
            quotationId,
            to,
            cc,
            subject,
            htmlContent,
            status, // expected values: 'accepted' or 'declined'
            sendAttachment = false
        } = req.body;

        // Validate required fields
        if (!quotationId || !to || !subject || !htmlContent || !status) {
            return res.status(400).json({ message: "Required fields missing" });
        }

        if (!["sent"].includes(status)) {
            return res.status(400).json({
                message: "Invalid status. Allowed values: 'sent'.",
            });
        }

        // Fetch quotation
        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        // Update status
        quotation.status = status;
        await quotation.save();
        await syncQuotationNotificationForQuotation(quotation._id);
        const companySettings = await CompanySettings.findOne().sort({ createdAt: -1 }); // get latest entry
        const companyName = companySettings?.companyName || "Dreams Technogoies";
        // Prepare mail options
        const mailOptions = {
            from: `"${companyName}" <${process.env.SMTP_EMAIL}>`,
            to,
            cc: cc || undefined,
            subject,
            html: htmlContent,
        };

        // Add attachment if requested
        if (sendAttachment) {
            mailOptions.attachments = [
                {
                    filename: `Quotation-${quotationId}.pdf`,
                    path: `${process.env.QUOTATION_UPLOAD_PATH || "./uploads/quotations"}/${quotationId}.pdf`,
                },
            ];
        }

        // Send email
        await sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: `Quotation ${status} and email sent successfully`,
            data: quotation,
        });
    } catch (err) {
        console.error("Failed to send quotation email:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to send quotation email or update status",
            error: err.message,
        });
    }
};

module.exports = {
    createQuotation,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    bulkDeleteQuotations,
    listQuotations,
    listQuotationsMinimal,
    getAllCustomers,
    updateQuotationStatus,
    sendQuotationEmailAndUpdateStatus
};
