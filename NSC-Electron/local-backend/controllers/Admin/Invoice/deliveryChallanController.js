// controllers/deliveryChallanController.js
const mongoose = require('mongoose');
const DeliveryChallan = require('@models/DeliveryChallan');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');
const User = require('@models/User');
const { validationResult } = require('express-validator');
const BankDetail = require("@models/BankDetail");

const resolveItemId = (item) => {
  const candidate =
    item?.id ??
    item?.product_id ??
    item?.productId ??
    item?._id ??
    item?.variantId;
  return candidate ? String(candidate) : new mongoose.Types.ObjectId().toString();
};


const createDeliveryChallan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      invoiceId,
      challanDate,
      referenceNo,
      items,
      notes,
      termsAndCondition,
      taxableAmount,
      totalAmount,
      vat,
      totalDiscount,
      roundOff,
      status,
      sign_type,
      signatureName,
      signatureId,
      bank,
      receivedBy,
      billFrom,
      billTo
    } = req.body;

    const userId = req.user || req.user?._id;
    const customerId = billTo;

    // Validate customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle signature
    let signatureImage = null;
    let savedSignatureId = null;

    if (sign_type === "eSignature" && req.file) {
      signatureImage = req.file.path;
    } else if (sign_type === "digitalSignature" && signatureId) {
      savedSignatureId = signatureId;
    }

    // Create delivery challan
    const deliveryChallan = new DeliveryChallan({
      invoiceId: invoiceId || null,
      customerId,
      challanDate: challanDate ? new Date(challanDate) : new Date(),
      referenceNo: referenceNo || "",
      items: items.map(item => ({
        id: resolveItemId(item),
        name: item.name,
        unit: item.unit || "",
        qty: item.qty,
        rate: item.rate,
        discount: item.discount || 0,
        tax: item.tax || 0,
        tax_group_id: item.tax_group_id || null,
        amount: item.amount || (item.rate * item.qty),
        discount_type: item.discount_type || "Fixed",
        discount_value: item.discount_value || 0,
      })),
      status: status || "PENDING",
      bank: bank || null,
      taxableAmount: req.body.subTotal,
      totalAmount: req.body.grandTotal,
      vat: req.body.totalTax || 0,
      totalDiscount: req.body.totalDiscount || 0,
      roundOff: roundOff || false,
      notes: notes || "",
      termsAndCondition: termsAndCondition || "",
      sign_type: sign_type || "none",
      signatureName: sign_type === "eSignature" ? signatureName : null,
      signatureImage,
      signatureId: sign_type === "digitalSignature" ? savedSignatureId : null,
      receivedBy: receivedBy || "",
      userId,
      billFrom,
      billTo
    });

    await deliveryChallan.save();

    res.status(201).json({
      message: "Delivery challan created successfully",
      data: deliveryChallan
    });

  } catch (err) {
    console.error("Create delivery challan error:", err);
    res.status(500).json({ message: "Error creating delivery challan", error: err.message });
  }
};


const updateDeliveryStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, receivedBy, receivedDate } = req.body;

    const deliveryChallan = await DeliveryChallan.findById(id).session(session);
    if (!deliveryChallan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Delivery challan not found' });
    }

    // Update status and related fields
    deliveryChallan.status = status;

    if (status === 'DELIVERED' || status === 'PARTIALLY_DELIVERED') {
      deliveryChallan.receivedBy = receivedBy || '';
      deliveryChallan.receivedDate = receivedDate ? new Date(receivedDate) : new Date();
    } else if (status === 'CANCELLED') {
      deliveryChallan.receivedBy = '';
      deliveryChallan.receivedDate = null;
    }

    await deliveryChallan.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'Delivery status updated successfully',
      data: deliveryChallan
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update delivery status error:', err);
    res.status(500).json({ message: 'Error updating delivery status', error: err.message });
  }
};


const updateDeliveryChallan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      invoiceId,
      challanDate,
      referenceNo,
      items,
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
      receivedBy,
      billFrom,
      billTo
    } = req.body;

    const userId = req.user || req.user?._id;

    // Find existing challan
    const deliveryChallan = await DeliveryChallan.findById(id);
    if (!deliveryChallan) {
      return res.status(404).json({ message: "Delivery challan not found" });
    }

    // Handle signature update
    let signatureImage = deliveryChallan.signatureImage;
    let savedSignatureId = deliveryChallan.signatureId;

    if (sign_type === "eSignature" && req.file) {
      signatureImage = req.file.path;
      savedSignatureId = null;
    } else if (sign_type === "digitalSignature" && signatureId) {
      savedSignatureId = signatureId;
      signatureImage = null;
    }

    // Update fields
    deliveryChallan.invoiceId = invoiceId ?? deliveryChallan.invoiceId;
    deliveryChallan.customerId = billTo ?? deliveryChallan.customerId;
    deliveryChallan.challanDate = challanDate ? new Date(challanDate) : deliveryChallan.challanDate;
    deliveryChallan.referenceNo = referenceNo ?? deliveryChallan.referenceNo;

    if (items) {
      deliveryChallan.items = items.map(item => ({
        id: resolveItemId(item),
        name: item.name,
        unit: item.unit || "",
        qty: item.qty,
        rate: item.rate,
        discount: item.discount || 0,
        tax: item.tax || 0,
        tax_group_id: item.tax_group_id || null,
        amount: item.amount || (item.rate * item.qty),
        discount_type: item.discount_type || "Fixed",
        discount_value: item.discount_value || 0
      }));
    }

    deliveryChallan.status = status ?? deliveryChallan.status;
    deliveryChallan.bank = bank ?? deliveryChallan.bank;
    deliveryChallan.taxableAmount = taxableAmount ?? deliveryChallan.taxableAmount;
    deliveryChallan.totalAmount = totalAmount ?? deliveryChallan.totalAmount;
    deliveryChallan.vat = vat ?? deliveryChallan.vat;
    deliveryChallan.totalDiscount = totalDiscount ?? deliveryChallan.totalDiscount;
    deliveryChallan.roundOff = roundOff ?? deliveryChallan.roundOff;
    deliveryChallan.notes = notes ?? deliveryChallan.notes;
    deliveryChallan.termsAndCondition = termsAndCondition ?? deliveryChallan.termsAndCondition;

    deliveryChallan.sign_type = sign_type ?? deliveryChallan.sign_type;
    deliveryChallan.signatureName = sign_type === "eSignature" ? signatureName : null;
    deliveryChallan.signatureImage = signatureImage;
    deliveryChallan.signatureId = sign_type === "digitalSignature" ? savedSignatureId : null;

    deliveryChallan.receivedBy = receivedBy ?? deliveryChallan.receivedBy;
    deliveryChallan.billFrom = billFrom ?? deliveryChallan.billFrom;
    deliveryChallan.billTo = billTo ?? deliveryChallan.billTo;

    await deliveryChallan.save();

    res.status(200).json({
      message: "Delivery challan updated successfully",
      data: deliveryChallan
    });

  } catch (err) {
    console.error("Update delivery challan error:", err);
    res.status(500).json({ message: "Error updating delivery challan", error: err.message });
  }
};


const getDeliveryChallans = async (req, res) => {
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

    const query = {
      isDeleted: false,

    };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by customer
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.challanDate = {};
      if (startDate) query.challanDate.$gte = new Date(startDate);
      if (endDate) query.challanDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { challanNumber: searchRegex },
        { notes: searchRegex },
        { referenceNo: searchRegex },
        { 'items.name': searchRegex },
        { 'customerId.name': searchRegex }
      ];
    }

    const total = await DeliveryChallan.countDocuments(query);

    const deliveryChallans = await DeliveryChallan.find(query)
      .populate('customerId', 'name email phone image billingAddress')
      .populate('billFrom', 'firstName lastName email phone companyName profileImage address')
      .populate('billTo', 'name email phone billingAddress shippingAddress image')
      .populate('invoiceId', 'invoiceNumber invoiceDate totalAmount status')
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

    const formattedChallans = deliveryChallans.map((challan) => {
      const customerDetails = challan.customerId ? {
        id: challan.customerId._id,
        name: challan.customerId.name || '',
        email: challan.customerId.email || null,
        phone: challan.customerId.phone || null,
        billingAddress: challan.customerId.billingAddress || null,
        image: challan.customerId.image
          ? `${baseUrl}${challan.customerId.image.replace(/\\/g, '/')}`
          : ''
      } : null;

      const billFromDetails = challan.billFrom ? {
        id: challan.billFrom._id,
        name: `${challan.billFrom.firstName || ''} ${challan.billFrom.lastName || ''}`.trim(),
        email: challan.billFrom.email || null,
        phone: challan.billFrom.phone || null,
        companyName: challan.billFrom.companyName || null,
        address: challan.billFrom.address || null,
        image: challan.billFrom.profileImage
          ? `${baseUrl}${challan.billFrom.profileImage.replace(/\\/g, '/')}`
          : ''
      } : null;

      const billToDetails = challan.billTo ? {
        id: challan.billTo._id,
        name: challan.billTo.name || '',
        email: challan.billTo.email || null,
        phone: challan.billTo.phone || null,
        billingAddress: challan.billTo.billingAddress || null,
        shippingAddress: challan.billTo.shippingAddress || null,
        image: challan.billTo.image
          ? `${baseUrl}${challan.billTo.image.replace(/\\/g, '/')}`
          : ''
      } : null;

      const invoiceDetails = challan.invoiceId ? {
        id: challan.invoiceId._id,
        invoiceNumber: challan.invoiceId.invoiceNumber,
        invoiceDate: formatDate(challan.invoiceId.invoiceDate),
        totalAmount: challan.invoiceId.totalAmount,
        status: challan.invoiceId.status
      } : null;

      const formattedItems = challan.items?.map(item => ({
        id: item._id,
        productId: item.id || null,
        name: item.name || '',
        unit: item.unit || '',
        qty: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        amount: item.amount
      })) || [];

      return {
        id: challan._id,
        challanNumber: challan.challanNumber,
        referenceNo: challan.referenceNo,
        challanDate: challan.challanDate,
        status: challan.status,
        notes: challan.notes,
        refund_method: challan.refund_method,
        taxableAmount: challan.taxableAmount,
        totalDiscount: challan.totalDiscount,
        vat: challan.vat,
        totalAmount: challan.totalAmount,
        items: formattedItems,
        itemsCount: formattedItems.length,
        customer: customerDetails,
        billFrom: billFromDetails,
        billTo: billToDetails,
        invoice: invoiceDetails,
        createdAt: challan.createdAt,
        updatedAt: challan.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      message: 'Delivery challans retrieved successfully',
      data: {
        deliveryChallans: formattedChallans,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Get delivery challans error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching delivery challans',
      error: err.message
    });
  }
};

const getDeliveryChallanById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Delivery Challan ID format",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    // Query and populate related references
    const challan = await DeliveryChallan.findById(id)
      .populate("customerId", "name email phone billingAddress shippingAddress image")
      .populate("billFrom", "firstName lastName email phone profileImage address companyName")
      .populate("billTo", "name email phone billingAddress shippingAddress image")
      .populate("invoiceId", "invoiceNumber invoiceDate totalAmount status")
      .populate({
        path: "bank",
        model: BankDetail, // explicitly specify the model
        select: "accountHoldername bankName branchName accountNumber IFSCCode",
      })
      .populate("signatureId", "name signatureImage createdAt");

    // Check if challan exists
    if (!challan) {
      return res.status(404).json({
        success: false,
        message: "Delivery challan not found",
      });
    }

    // Check if deleted
    if (challan.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Delivery challan has been deleted",
      });
    }

    // Utility to format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, "0");
      const month = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    // Customer details
    const customerDetails = challan.customerId
      ? {
        id: challan.customerId._id,
        name: challan.customerId.name || "",
        email: challan.customerId.email || null,
        phone: challan.customerId.phone || null,
        billingAddress: challan.customerId.billingAddress || null,
        shippingAddress: challan.customerId.shippingAddress || null,
        image: challan.customerId.image
          ? `${baseUrl}${challan.customerId.image.replace(/\\/g, "/")}`
          : "",
      }
      : null;

    // Bill From details
    const billFromDetails = challan.billFrom
      ? {
        id: challan.billFrom._id,
        name: `${challan.billFrom.firstName || ""} ${challan.billFrom.lastName || ""}`.trim(),
        email: challan.billFrom.email || null,
        phone: challan.billFrom.phone || null,
        companyName: challan.billFrom.companyName || null,
        address: challan.billFrom.address || null,
        image: challan.billFrom.profileImage
          ? `${baseUrl}${challan.billFrom.profileImage.replace(/\\/g, "/")}`
          : "",
      }
      : null;

    // Bill To details
    const billToDetails = challan.billTo
      ? {
        id: challan.billTo._id,
        name: challan.billTo.name || "",
        email: challan.billTo.email || null,
        phone: challan.billTo.phone || null,
        billingAddress: challan.billTo.billingAddress || null,
        shippingAddress: challan.billTo.shippingAddress || null,
        image: challan.billTo.image
          ? `${baseUrl}${challan.billTo.image.replace(/\\/g, "/")}`
          : "",
      }
      : null;

    // Invoice details
    const invoiceDetails = challan.invoiceId
      ? {
        id: challan.invoiceId._id,
        invoiceNumber: challan.invoiceId.invoiceNumber,
        invoiceDate: challan.invoiceId.invoiceDate,
        totalAmount: challan.invoiceId.totalAmount,
        status: challan.invoiceId.status,
      }
      : null;

    // Bank details
    const bankDetails = challan.bank
      ? {
        id: challan.bank.id || "",
        accountHoldername: challan.bank.accountHoldername || "",
        bankName: challan.bank.bankName || "",
        branchName: challan.bank.branchName || "",
        accountNumber: challan.bank.accountNumber || "",
        IFSCCode: challan.bank.IFSCCode || "",
      }
      : null;

    // Signature details
    let signatureDetails = null;
    if (challan.sign_type === "eSignature") {
      signatureDetails = {
        name: challan.signatureName || null,
        image: challan.signatureImage
          ? `${baseUrl}${challan.signatureImage.replace(/\\/g, "/")}`
          : null,
      };
    } else if (challan.sign_type === "digitalSignature" && challan.signatureId) {
      signatureDetails = {
        id: challan.signatureId._id,
        name: challan.signatureId.name || null,
        image: challan.signatureId.signatureImage
          ? `${baseUrl}${challan.signatureId.signatureImage.replace(/\\/g, "/")}`
          : null,
        createdAt: formatDate(challan.signatureId.createdAt),
      };
    }

    // Format items
    const formattedItems =
      challan.items?.map((item) => ({
        id: item._id,
        productId: item.id || null,
        name: item.name || "",
        unit: item.unit || "",
        qty: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        amount: item.amount,
      })) || [];

    // Final response
    const response = {
      id: challan._id,
      challanNumber: challan.challanNumber,
      referenceNo: challan.referenceNo,
      challanDate: formatDate(challan.challanDate),
      status: challan.status,
      notes: challan.notes || "",
      termsAndCondition: challan.termsAndCondition || "",
      items: challan.items || [],
      itemsCount: formattedItems.length,
      customer: customerDetails,
      billFrom: billFromDetails,
      billTo: billToDetails,
      invoice: invoiceDetails,
      bank: bankDetails,
      sign_type: challan.sign_type,
      signature: signatureDetails,
      taxableAmount: challan.taxableAmount,
      totalAmount: challan.totalAmount,
      totalDiscount: challan.totalDiscount,
      vat: challan.vat  || "",
      createdAt: challan.createdAt,
      updatedAt: challan.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Delivery challan retrieved successfully",
      data: response,
    });
  } catch (err) {
    console.error("Get delivery challan error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching delivery challan details",
      error: err.message,
    });
  }
};


const deleteDeliveryChallan = async (req, res) => {
  try {
    const { id } = req.params;

    const deliveryChallan = await DeliveryChallan.findById(id);
    if (!deliveryChallan || deliveryChallan.isDeleted) {
      return res.status(404).json({ message: 'Delivery challan not found' });
    }

    deliveryChallan.isDeleted = true;
    await deliveryChallan.save();

    res.status(200).json({
      message: 'Delivery challan deleted successfully'
    });
  } catch (err) {
    console.error('Delete delivery challan error:', err);
    res.status(500).json({ message: 'Error deleting delivery challan', error: err.message });
  }
};


module.exports = {
  createDeliveryChallan,
  updateDeliveryStatus,
  updateDeliveryChallan,
  getDeliveryChallans,
  getDeliveryChallanById,
  deleteDeliveryChallan
};
