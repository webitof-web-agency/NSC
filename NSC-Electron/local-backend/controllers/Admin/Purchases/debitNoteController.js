// controllers/debitNoteController.js
const mongoose = require('mongoose');
const DebitNote = require('@models/DebitNote');
const Purchase = require('@models/Purchase');
const Product = require('@models/Product');
const User = require('@models/User');
const Inventory = require('@models/Inventory');
const { body, validationResult } = require('express-validator');
const { sendMail } = require("@utils/mailer");
const { syncPurchaseNotificationForPurchase } = require("@services/notificationService");

const normalizeDebitNoteItems = (rawItems = []) =>
  (Array.isArray(rawItems) ? rawItems : []).map(item => {
    const qty = Number(item.qty || item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount = Number(item.amount || qty * rate);
    const rawProductId = item.productId || item.product_id || null;
    const productId = isValidObjectId(rawProductId) ? rawProductId : null;

    return {
      id: item.id || String(rawProductId || item.variantId || ""),
      productId,
      name: item.name,
      hsn_code: item.hsn_code || null,
      variantId: item.variantId || null,
      variantName: item.variantName || "",
      variantDesignNo: item.variantDesignNo || "",
      variantColor: item.variantColor || "",
      variantSize: item.variantSize || "",
      unit: item.unit || "",
      qty,
      rate,
      discount: Number(item.discount || 0),
      tax: Number(item.tax || 0),
      tax_group_id: item.tax_group_id || null,
      discount_type: item.discount_type || "Fixed",
      discount_value: Number(item.discount_value || 0),
      amount
    };
  }).filter((item) => item.name && item.qty > 0);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const toPurchaseItemShape = (item = {}) => {
  const qty = Number(item.qty || item.quantity || 0);
  const rate = Number(item.rate || 0);
  const amount = Number(item.amount || qty * rate);

  return {
    id: String(item.productId || item.product_id || item.id || ""),
    name: item.name || "",
    hsn_code: item.hsn_code || "",
    variantId: item.variantId || null,
    variantName: item.variantName || "",
    variantDesignNo: item.variantDesignNo || "",
    variantColor: item.variantColor || "",
    variantSize: item.variantSize || "",
    unit: item.unit || "",
    qty,
    rate,
    discount: Number(item.discount || 0),
    tax: Number(item.tax || 0),
    tax_group_id: item.tax_group_id || null,
    discount_type: item.discount_type || "Fixed",
    discount_value: Number(item.discount_value || 0),
    amount
  };
};

const buildUpdatedPurchaseItems = (originalItems = [], returnedItems = [], exchangeItems = []) => {
  const finalItems = (Array.isArray(originalItems) ? originalItems : []).map((item) => toPurchaseItemShape(item));
  const indexByKey = new Map();

  finalItems.forEach((item, index) => {
    const key = String(item.variantId || item.id || "");
    if (key) indexByKey.set(key, index);
  });

  returnedItems.forEach((item) => {
    const key = String(item.variantId || item.productId || item.id || "");
    if (!key || !indexByKey.has(key)) return;

    const targetIndex = indexByKey.get(key);
    const current = finalItems[targetIndex];
    const currentQty = Number(current?.qty || 0);
    const returnedQty = Number(item.qty || 0);
    const nextQty = currentQty - returnedQty;

    if (nextQty <= 0) {
      finalItems[targetIndex] = null;
      indexByKey.delete(key);
      return;
    }

    const ratio = currentQty > 0 ? nextQty / currentQty : 0;
    finalItems[targetIndex] = {
      ...current,
      qty: nextQty,
      discount: Number((Number(current.discount || 0) * ratio).toFixed(2)),
      tax: Number((Number(current.tax || 0) * ratio).toFixed(2)),
      amount: Number((Number(current.amount || 0) * ratio).toFixed(2)),
    };
  });

  exchangeItems.forEach((item) => {
    const normalized = toPurchaseItemShape(item);
    if (!normalized.name || normalized.qty <= 0) return;
    finalItems.push(normalized);
  });

  return finalItems.filter(Boolean);
};

const revertUpdatedPurchaseItems = (currentItems = [], returnedItems = [], exchangeItems = []) => {
  const finalItems = (Array.isArray(currentItems) ? currentItems : []).map((item) => toPurchaseItemShape(item));
  const findIndexByKey = (key) => finalItems.findIndex((item) => String(item.variantId || item.id || "") === key);

  returnedItems.forEach((item) => {
    const normalized = toPurchaseItemShape(item);
    const key = String(normalized.variantId || normalized.id || "");
    if (!key) return;
    const existingIndex = findIndexByKey(key);

    if (existingIndex === -1) {
      finalItems.push(normalized);
      return;
    }

    const current = finalItems[existingIndex];
    finalItems[existingIndex] = {
      ...current,
      qty: Number(current.qty || 0) + Number(normalized.qty || 0),
      discount: Number((Number(current.discount || 0) + Number(normalized.discount || 0)).toFixed(2)),
      tax: Number((Number(current.tax || 0) + Number(normalized.tax || 0)).toFixed(2)),
      amount: Number((Number(current.amount || 0) + Number(normalized.amount || 0)).toFixed(2)),
    };
  });

  exchangeItems.forEach((item) => {
    const key = String(item.variantId || item.productId || item.id || "");
    const existingIndex = findIndexByKey(key);
    if (existingIndex === -1) return;

    const current = finalItems[existingIndex];
    const currentQty = Number(current?.qty || 0);
    const removeQty = Number(item.qty || 0);
    const nextQty = currentQty - removeQty;

    if (nextQty <= 0) {
      finalItems.splice(existingIndex, 1);
      return;
    }

    const ratio = currentQty > 0 ? nextQty / currentQty : 0;
    finalItems[existingIndex] = {
      ...current,
      qty: nextQty,
      discount: Number((Number(current.discount || 0) * ratio).toFixed(2)),
      tax: Number((Number(current.tax || 0) * ratio).toFixed(2)),
      amount: Number((Number(current.amount || 0) * ratio).toFixed(2)),
    };
  });

  return finalItems.filter(Boolean);
};

const calculatePurchaseTotals = (items = []) => {
  const totalDiscount = Number(items.reduce((sum, item) => sum + Number(item.discount || 0), 0).toFixed(2));
  const totalTax = Number(items.reduce((sum, item) => sum + Number(item.tax || 0), 0).toFixed(2));
  const totalAmount = Number(items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));

  return {
    totalDiscount,
    totalTax,
    totalAmount,
    finalAmount: totalAmount
  };
};

const applyInventoryMovement = async ({
  items = [],
  userId,
  referenceId,
  referenceCode,
  movementType,
  notes
}) => {
  const direction = movementType === "stock_in" ? 1 : -1;

  for (const item of items) {
    const qty = Number(item.qty || 0);
    if (!item.variantId || !qty || qty <= 0) continue;

    const inventory = await Inventory.findOne({
      variantId: item.variantId,
      userId,
      isDeleted: false,
    });

    const beforeQty = inventory?.quantity || 0;
    const inventoryProductId = isValidObjectId(item.productId) ? item.productId : null;

    if (!inventory && !isValidObjectId(inventoryProductId)) {
      console.warn(`Inventory not found and productId missing for variant ${item.variantId}, skipping ${movementType}`);
      continue;
    }

    await Inventory.findOneAndUpdate(
      { variantId: item.variantId, userId, isDeleted: false },
      {
        $setOnInsert: {
          productId: inventoryProductId,
          variantId: item.variantId,
          userId,
          isDeleted: false
        },
        $inc: { quantity: direction * qty },
        $push: {
          inventory_history: {
            unitId: item.unit,
            quantity: beforeQty,
            type: movementType,
            adjustment: direction * qty,
            referenceId,
            referenceType: "debit_note",
            notes: `${notes} ${referenceCode}`,
            createdBy: userId,
          },
        },
      },
      { new: true, upsert: true }
    );
  }
};


const createDebitNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user;

    const {
      purchaseId,
      debitNoteDate,
      referenceNo,
      paymentMode,
      items = [],
      replacementItems = [],
      notes,
      termsAndCondition,
      status = "draft",
      billFrom,
      billTo,
      checkNumber,
      bank,
      paidAmount = 0
    } = req.body;

    /* ---------------------------------
      BASIC VALIDATIONS
    --------------------------------- */
    if (!purchaseId) {
      return res.status(400).json({ message: "purchaseId is required" });
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const vendor = await User.findById(purchase.vendorId);
    if (!vendor) {
      return res.status(422).json({ message: "Invalid vendor ID from purchase" });
    }

    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);

    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: "Invalid bill from or bill to user ID" });
    }

    /* ---------------------------------
      NORMALIZE ITEMS (MATCH PURCHASE)
    --------------------------------- */
    const normalizeItems = (rawItems = []) =>
      (Array.isArray(rawItems) ? rawItems : []).map(item => {
        const qty = Number(item.qty || 0);
        const rate = Number(item.rate || 0);
        const amount = Number(item.amount || qty * rate);
        const productId = item.productId || item.product_id || item.id || null;

        return {
          id: item.id,
          productId,
          name: item.name,
          hsn_code: item.hsn_code || null,
          variantId: item.variantId || null,
          variantName: item.variantName || "",
          variantDesignNo: item.variantDesignNo || "",
          variantColor: item.variantColor || "",
          variantSize: item.variantSize || "",
          unit: item.unit || "",
          qty,
          rate,
          amount
        };
      }).filter((item) => item.name && item.qty > 0);

    const aggregateQtyByKey = (rawItems = []) => rawItems.reduce((map, item) => {
      const key = String(item.variantId || item.id || "");
      if (!key) return map;
      map.set(key, (map.get(key) || 0) + Number(item.qty || 0));
      return map;
    }, new Map());

    const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

    const toPurchaseItemShape = (item = {}) => {
      const qty = Number(item.qty || item.quantity || 0);
      const rate = Number(item.rate || 0);
      const amount = Number(item.amount || qty * rate);

      return {
        id: String(item.productId || item.product_id || item.id || ""),
        name: item.name || "",
        hsn_code: item.hsn_code || "",
        variantId: item.variantId || null,
        variantName: item.variantName || "",
        variantDesignNo: item.variantDesignNo || "",
        variantColor: item.variantColor || "",
        variantSize: item.variantSize || "",
        unit: item.unit || "",
        qty,
        rate,
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
        tax_group_id: item.tax_group_id || null,
        discount_type: item.discount_type || "Fixed",
        discount_value: Number(item.discount_value || 0),
        amount
      };
    };

    const buildUpdatedPurchaseItems = (originalItems = [], returnedItems = [], exchangeItems = []) => {
      const finalItems = (Array.isArray(originalItems) ? originalItems : []).map((item) => toPurchaseItemShape(item));
      const indexByKey = new Map();

      finalItems.forEach((item, index) => {
        const key = String(item.variantId || item.id || "");
        if (key) indexByKey.set(key, index);
      });

      returnedItems.forEach((item) => {
        const key = String(item.variantId || item.productId || item.id || "");
        if (!key || !indexByKey.has(key)) return;

        const targetIndex = indexByKey.get(key);
        const current = finalItems[targetIndex];
        const currentQty = Number(current?.qty || 0);
        const returnedQty = Number(item.qty || 0);
        const nextQty = currentQty - returnedQty;

        if (nextQty <= 0) {
          finalItems[targetIndex] = null;
          indexByKey.delete(key);
          return;
        }

        const ratio = currentQty > 0 ? nextQty / currentQty : 0;
        finalItems[targetIndex] = {
          ...current,
          qty: nextQty,
          discount: Number((Number(current.discount || 0) * ratio).toFixed(2)),
          tax: Number((Number(current.tax || 0) * ratio).toFixed(2)),
          amount: Number((Number(current.amount || 0) * ratio).toFixed(2)),
        };
      });

      exchangeItems.forEach((item) => {
        const normalized = toPurchaseItemShape(item);
        if (!normalized.name || normalized.qty <= 0) return;
        finalItems.push(normalized);
      });

      return finalItems.filter(Boolean);
    };

    const normalizedItems = normalizeDebitNoteItems(items);
    const normalizedReplacementItems = normalizeDebitNoteItems(replacementItems);
    const effectiveStatus = normalizedReplacementItems.length > 0 ? "replaced" : "return";

    if (normalizedItems.length === 0) {
      return res.status(400).json({ message: "At least one return item is required" });
    }

    /* ---------------------------------
      AMOUNT CALCULATIONS
    --------------------------------- */
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const replacementAmount = normalizedReplacementItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const netAdjustment = Number((totalAmount - replacementAmount).toFixed(2));
    const adjustmentType = netAdjustment > 0
      ? "supplier_credit"
      : netAdjustment < 0
        ? "supplier_payable"
        : "even_exchange";

    const paid = Math.max(Number(paidAmount || 0), 0);
    const balanceAmount = Math.max(Number((Math.abs(netAdjustment) - paid).toFixed(2)), 0);

    /* ---------------------------------
      CREATE DEBIT NOTE
    --------------------------------- */
    const debitNote = new DebitNote({
      purchaseId,
      vendorId: purchase.vendorId,

      debitNoteDate: debitNoteDate ? new Date(debitNoteDate) : new Date(),
      dueDate: debitNoteDate ? new Date(debitNoteDate) : new Date(),

      referenceNo: referenceNo || "",
      items: normalizedItems,
      replacementItems: normalizedReplacementItems,

      status: effectiveStatus,
      paymentMode: paymentMode || null,

      totalAmount,
      replacementAmount,
      netAdjustment,
      adjustmentType,
      finalAmount: totalAmount,

      paidAmount: paid,
      balanceAmount,

      bank: bank || null,
      notes: notes || "",
      termsAndCondition: termsAndCondition || "",
      checkNumber: checkNumber || null,

      userId,
      createdBy: userId,
      billFrom,
      billTo
    });

    await debitNote.save();

    const purchaseUpdate = { status: effectiveStatus };

    if (effectiveStatus === "replaced") {
      const updatedPurchaseItems = buildUpdatedPurchaseItems(
        purchase.items || [],
        normalizedItems,
        normalizedReplacementItems
      );
      const updatedTotals = calculatePurchaseTotals(updatedPurchaseItems);
      const updatedPaidAmount = Number(purchase.paidAmount || 0);

      purchaseUpdate.items = updatedPurchaseItems;
      purchaseUpdate.totalDiscount = updatedTotals.totalDiscount;
      purchaseUpdate.totalTax = updatedTotals.totalTax;
      purchaseUpdate.totalAmount = updatedTotals.totalAmount;
      purchaseUpdate.finalAmount = updatedTotals.finalAmount;
      purchaseUpdate.balanceAmount = Math.max(Number((updatedTotals.totalAmount - updatedPaidAmount).toFixed(2)), 0);
    }

    await Purchase.findByIdAndUpdate(purchaseId, purchaseUpdate);

    /* ---------------------------------
      INVENTORY UPDATE (ONLY ON RETURN)
    --------------------------------- */
    if (["return", "replaced"].includes(effectiveStatus)) {
      await applyInventoryMovement({
        items: normalizedItems,
        userId,
        referenceId: debitNote._id,
        referenceCode: debitNote.debitNoteId,
        movementType: "stock_out",
        notes: "Purchase return via Debit Note"
      });

      await applyInventoryMovement({
        items: normalizedReplacementItems,
        userId,
        referenceId: debitNote._id,
        referenceCode: debitNote.debitNoteId,
        movementType: "stock_in",
        notes: "Supplier exchange in via Debit Note"
      });
    }

    /* ---------------------------------
      RESPONSE
    --------------------------------- */
    res.status(201).json({
      success: true,
      message: "Debit note created successfully",
      data: debitNote
    });

    /* ---------------------------------
      EMAIL NOTIFICATION (OLD FEATURE)
    --------------------------------- */
    if (billToUser?.email && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      try {
        await sendMail({
          from: `"Your Company" <${process.env.SMTP_EMAIL}>`,
          to: billToUser.email,
          subject: "New Debit Note Created",
          html: `
            <h3>Hello ${billToUser.firstName || billToUser.name},</h3>
            <p>A new debit note has been created.</p>
            <p><strong>Debit Note No:</strong> ${debitNote.debitNoteId}</p>
            <p><strong>Return Amount:</strong> ${debitNote.totalAmount}</p>
            <p><strong>Replacement Amount:</strong> ${debitNote.replacementAmount}</p>
            <p><strong>Net Adjustment:</strong> ${debitNote.netAdjustment}</p>
            <p><strong>Date:</strong> ${new Date(debitNote.debitNoteDate).toLocaleDateString()}</p>
            <br/>
            <p>Best Regards,<br/>Naresh Saree COllection</p>
          `
        });
      } catch (emailErr) {
        console.error("Failed to send debit note email:", emailErr.message);
      }
    }

  } catch (err) {
    console.error("ERROR Creating Debit Note:", err);
    res.status(500).json({
      success: false,
      message: "Error creating debit note",
      error: err.message
    });
  }
};

// Get all debit notes
const getAllDebitNotes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      vendorId,
      startDate,
      endDate,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    if (startDate || endDate) {
      query.debitNoteDate = {};
      if (startDate) {
        query.debitNoteDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.debitNoteDate.$lte = new Date(endDate);
      }
    }

    // Add search filter
    if (search) {
      query.$or = [
        { debitNoteId: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.reason': { $regex: search, $options: 'i' } },
        { signatureName: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await DebitNote.countDocuments(query);

    // Base query with common populates
    let baseQuery = DebitNote.find(query)
      .populate({
        path: 'vendorId',
        select: 'firstName lastName email phone profileImage'
      })
      .populate('purchaseId', 'purchaseId purchaseDate totalAmount supplier_bill_number')
      .populate('createdBy', 'firstName lastName profileImage')
      .populate('approvedBy', 'firstName lastName profileImage')
      .sort({ createdAt: -1, debitNoteDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Run the query without paymentMode populate
    let debitNotes = await baseQuery.lean();

    // Manually populate paymentMode only when valid
    for (let note of debitNotes) {
      if (note.paymentMode && mongoose.Types.ObjectId.isValid(note.paymentMode)) {
        const PaymentMode = mongoose.model('PaymentMode');
        const paymentModeData = await PaymentMode.findById(note.paymentMode)
          .select('name slug status')
          .lean();
        note.paymentMode = paymentModeData || null;
      } else {
        note.paymentMode = null;
      }
    }

    // Format function for date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    // Format response
    const formattedDebitNotes = debitNotes.map((note) => {
      const vendor = note.vendorId ? {
        id: note.vendorId._id,
        name: `${note.vendorId.firstName || ''} ${note.vendorId.lastName || ''}`.trim(),
        email: note.vendorId.email || null,
        phone: note.vendorId.phone || null,
        profileImage: note.vendorId.profileImage
          ? `${process.env.BASE_URL || ''}/${note.vendorId.profileImage}`
          : ''
      } : null;

      const purchase = note.purchaseId ? {
        id: note.purchaseId._id,
        purchaseId: note.purchaseId.purchaseId || null,
        supplierBillNumber: note.purchaseId.supplier_bill_number || null,
        purchaseDate: formatDate(note.purchaseId.purchaseDate),
        totalAmount: note.purchaseId.totalAmount || 0
      } : null;

      const createdBy = note.createdBy ? {
        id: note.createdBy._id,
        name: `${note.createdBy.firstName || ''} ${note.createdBy.lastName || ''}`.trim(),
        profileImage: note.createdBy.profileImage ? `${process.env.BASE_URL}${note.createdBy.profileImage}` : null
      } : null;

      const approvedBy = note.approvedBy ? {
        id: note.approvedBy._id,
        name: `${note.approvedBy.firstName || ''} ${note.approvedBy.lastName || ''}`.trim(),
        profileImage: note.approvedBy.profileImage ? `${process.env.BASE_URL}${note.approvedBy.profileImage}` : null
      } : null;

      const paymentMode = note.paymentMode ? {
        id: note.paymentMode._id,
        name: note.paymentMode.name,
        slug: note.paymentMode.slug,
        status: note.paymentMode.status
      } : null;

      return {
        id: note._id,
        debitNoteId: note.debitNoteId,
        referenceNo: note.referenceNo || null,
        vendor,
        purchase,
        debitNoteDate: formatDate(note.debitNoteDate),
        status: note.status,
        totalAmount: note.totalAmount,
        replacementAmount: note.replacementAmount || 0,
        netAdjustment: note.netAdjustment || 0,
        adjustmentType: note.adjustmentType || 'even_exchange',
        paidAmount: note.paidAmount || 0,
        balanceAmount: note.balanceAmount || 0,
        paymentMode,
        sign_type: note.sign_type || 'none',
        signatureName: note.signatureName || null,
        signatureImage: note.signatureImage ? `${process.env.BASE_URL}${note.signatureImage}` : null,
        notes: note.notes || null,
        createdBy,
        approvedBy,
        createdAt: formatDate(note.createdAt),
        updatedAt: formatDate(note.updatedAt)
      };
    });

    // Send response
    res.status(200).json({
      success: true,
      message: 'Debit notes retrieved successfully',
      data: {
        debitNotes: formattedDebitNotes,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get all debit notes error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving debit notes',
      error: err.message
    });
  }
};

// Get debit note by ID
const getDebitNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate debit note ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid debit note ID'
      });
    }

    const debitNote = await DebitNote.findOne({ _id: id, isDeleted: false })
      .populate('vendorId', 'firstName lastName email phone address')
      .populate('purchaseId', 'purchaseId purchaseDate totalAmount supplier_bill_number')
      .populate('items.productId', 'name sku barcode')
      .populate('billFrom', 'firstName lastName email')
      .populate('billTo', 'firstName lastName email phone address')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('bank', 'bankName accountNumber branch')
      .populate({
        path: 'paymentMode',
        select: 'name slug status',
        match: { _id: { $exists: true, $ne: null } } // Only populate valid payment modes
      });

    if (!debitNote) {
      return res.status(404).json({
        success: false,
        message: 'Debit note not found'
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

    // Vendor details
    const vendor = debitNote.vendorId ? {
      id: debitNote.vendorId._id,
      name: `${debitNote.vendorId.firstName || ''} ${debitNote.vendorId.lastName || ''}`.trim(),
      email: debitNote.vendorId.email || null,
      phone: debitNote.vendorId.phone || null,
      address: debitNote.vendorId.address || null
    } : null;

    // Purchase details
    const purchase = debitNote.purchaseId ? {
      id: debitNote.purchaseId._id,
      purchaseId: debitNote.purchaseId.purchaseId || null,
      supplierBillNumber: debitNote.purchaseId.supplier_bill_number || null,
      purchaseDate: formatDate(debitNote.purchaseId.purchaseDate),
      totalAmount: debitNote.purchaseId.totalAmount || 0
    } : null;

    // Bank details
    const bank = debitNote.bank ? {
      id: debitNote.bank._id,
      bankName: debitNote.bank.bankName || null,
      accountNumber: debitNote.bank.accountNumber || null,
      branch: debitNote.bank.branch || null
    } : null;

    // Payment mode details - Fixed: Handle invalid paymentMode references
    const paymentMode = debitNote.paymentMode && debitNote.paymentMode._id ? {
      id: debitNote.paymentMode._id,
      name: debitNote.paymentMode.name,
      slug: debitNote.paymentMode.slug,
      status: debitNote.paymentMode.status
    } : null;

    const billFrom = debitNote.billFrom ? {
      id: debitNote.billFrom._id,
      name: `${debitNote.billFrom.firstName || ''} ${debitNote.billFrom.lastName || ''}`.trim(),
      email: debitNote.billFrom.email || null
    } : null;

    const billTo = debitNote.billTo ? {
      id: debitNote.billTo._id,
      name: `${debitNote.billTo.firstName || ''} ${debitNote.billTo.lastName || ''}`.trim(),
      email: debitNote.billTo.email || null,
      phone: debitNote.billTo.phone || null,
      address: debitNote.billTo.address || null
    } : null;

    // Created by
    const createdBy = debitNote.createdBy ? {
      id: debitNote.createdBy._id,
      name: `${debitNote.createdBy.firstName || ''} ${debitNote.createdBy.lastName || ''}`.trim()
    } : null;

    // Approved by
    const approvedBy = debitNote.approvedBy ? {
      id: debitNote.approvedBy._id,
      name: `${debitNote.approvedBy.firstName || ''} ${debitNote.approvedBy.lastName || ''}`.trim()
    } : null;

    // Items
    const mapDebitNoteItems = (itemList = []) => itemList.map(item => ({
      product: item.productId ? {
        id: item.productId._id,
        name: item.productId.name || null,
        sku: item.productId.sku || null,
        barcode: item.productId.barcode || null
      } : null,
      id: item.id || null,
      name: item.name || null,
      hsn_code: item.hsn_code || null,
      variantId: item.variantId || null,
      variantName: item.variantName || null,
      variantDesignNo: item.variantDesignNo || null,
      variantColor: item.variantColor || null,
      variantSize: item.variantSize || null,
      unit: item.unit || null,
      quantity: item.quantity || item.qty || 0,
      qty: item.qty || item.quantity || 0,
      rate: item.rate || 0,
      discount: item.discount || 0,
      discount_type: item.discount_type || 'Fixed',
      discount_value: item.discount_value || 0,
      tax: item.tax || 0,
      amount: item.amount || 0,
      reason: item.reason || null,
      taxGroup: item.tax_group_id ? {
        id: item.tax_group_id._id || item.tax_group_id,
        name: item.tax_group_id.name || null,
        rate: item.tax_group_id.rate || 0
      } : null
    }));

    const items = mapDebitNoteItems(debitNote.items || []);
    const replacementItems = mapDebitNoteItems(debitNote.replacementItems || []);

    // Final formatted response
    const formattedDebitNote = {
      id: debitNote._id,
      debitNoteId: debitNote.debitNoteId,
      referenceNo: debitNote.referenceNo || null,
      vendor,
      purchase,
      debitNoteDate: formatDate(debitNote.debitNoteDate),
      debitNoteDateRaw: debitNote.debitNoteDate || null,
      dueDate: formatDate(debitNote.dueDate),
      dueDateRaw: debitNote.dueDate || null,
      status: debitNote.status || null,
      taxableAmount: debitNote.taxableAmount || 0,
      totalDiscount: debitNote.totalDiscount || 0,
      totalTax: debitNote.totalTax || 0,
      totalAmount: debitNote.totalAmount || 0,
      replacementAmount: debitNote.replacementAmount || 0,
      netAdjustment: debitNote.netAdjustment || 0,
      adjustmentType: debitNote.adjustmentType || 'even_exchange',
      paidAmount: debitNote.paidAmount || 0,
      balanceAmount: debitNote.balanceAmount || 0,
      billFrom,
      billTo,
      paymentMode,
      bank,
      notes: debitNote.notes || null,
      termsAndCondition: debitNote.termsAndCondition || null,
      sign_type: debitNote.sign_type || 'none',
      signatureId: debitNote.signatureId || null,
      signatureImage: debitNote.signatureImage ? `${process.env.BASE_URL}${debitNote.signatureImage}` : null,
      signatureName: debitNote.signatureName || null,
      checkNumber: debitNote.checkNumber || null,
      items,
      replacementItems,
      createdBy,
      approvedBy,
      createdAt: formatDate(debitNote.createdAt),
      updatedAt: formatDate(debitNote.updatedAt)
    };

    res.status(200).json({
      success: true,
      message: 'Debit note retrieved successfully',
      data: formattedDebitNote
    });

  } catch (err) {
    console.error('Get debit note by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving debit note',
      error: err.message
    });
  }
};

const updateDebitNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid debit note ID" });
    }

    const {
      purchaseId,
      debitNoteDate,
      referenceNo,
      paymentMode,
      items = [],
      replacementItems = [],
      notes,
      termsAndCondition,
      billFrom,
      billTo,
      checkNumber,
      bank,
      paidAmount = 0
    } = req.body;

    const existingDebitNote = await DebitNote.findOne({ _id: id, isDeleted: false });
    if (!existingDebitNote) {
      return res.status(404).json({ success: false, message: "Debit note not found" });
    }

    const targetPurchaseId = purchaseId || String(existingDebitNote.purchaseId);
    const targetPurchase = await Purchase.findById(targetPurchaseId);
    if (!targetPurchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const vendor = await User.findById(targetPurchase.vendorId);
    if (!vendor) {
      return res.status(422).json({ success: false, message: "Invalid vendor ID from purchase" });
    }

    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);
    if (!billFromUser || !billToUser) {
      return res.status(422).json({ success: false, message: "Invalid bill from or bill to user ID" });
    }

    const oldPurchase = await Purchase.findById(existingDebitNote.purchaseId);
    if (!oldPurchase) {
      return res.status(404).json({ success: false, message: "Original purchase not found" });
    }

    const oldReturnedItems = normalizeDebitNoteItems(existingDebitNote.items || []);
    const oldReplacementItems = normalizeDebitNoteItems(existingDebitNote.replacementItems || []);
    const normalizedItems = normalizeDebitNoteItems(items);
    const normalizedReplacementItems = normalizeDebitNoteItems(replacementItems);
    const effectiveStatus = normalizedReplacementItems.length > 0 ? "replaced" : "return";

    if (normalizedItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one return item is required" });
    }

    const totalAmount = normalizedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const replacementAmount = normalizedReplacementItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const netAdjustment = Number((totalAmount - replacementAmount).toFixed(2));
    const adjustmentType = netAdjustment > 0
      ? "supplier_credit"
      : netAdjustment < 0
        ? "supplier_payable"
        : "even_exchange";
    const paid = Math.max(Number(paidAmount || 0), 0);
    const balanceAmount = Math.max(Number((Math.abs(netAdjustment) - paid).toFixed(2)), 0);

    if (String(oldPurchase._id) === String(targetPurchase._id)) {
      if (existingDebitNote.status === "replaced") {
        const revertedItems = revertUpdatedPurchaseItems(oldPurchase.items || [], oldReturnedItems, oldReplacementItems);
        const revertedTotals = calculatePurchaseTotals(revertedItems);
        oldPurchase.items = revertedItems;
        oldPurchase.totalDiscount = revertedTotals.totalDiscount;
        oldPurchase.totalTax = revertedTotals.totalTax;
        oldPurchase.totalAmount = revertedTotals.totalAmount;
        oldPurchase.finalAmount = revertedTotals.finalAmount;
        oldPurchase.balanceAmount = Math.max(Number((revertedTotals.totalAmount - Number(oldPurchase.paidAmount || 0)).toFixed(2)), 0);
      }
    } else {
      if (existingDebitNote.status === "replaced") {
        const revertedItems = revertUpdatedPurchaseItems(oldPurchase.items || [], oldReturnedItems, oldReplacementItems);
        const revertedTotals = calculatePurchaseTotals(revertedItems);
        oldPurchase.items = revertedItems;
        oldPurchase.totalDiscount = revertedTotals.totalDiscount;
        oldPurchase.totalTax = revertedTotals.totalTax;
        oldPurchase.totalAmount = revertedTotals.totalAmount;
        oldPurchase.finalAmount = revertedTotals.finalAmount;
        oldPurchase.balanceAmount = Math.max(Number((revertedTotals.totalAmount - Number(oldPurchase.paidAmount || 0)).toFixed(2)), 0);
      }
      oldPurchase.status = "paid";
      await oldPurchase.save();
    }

    await applyInventoryMovement({
      items: oldReturnedItems,
      userId,
      referenceId: existingDebitNote._id,
      referenceCode: existingDebitNote.debitNoteId,
      movementType: "stock_in",
      notes: "Debit Note edit revert return"
    });

    await applyInventoryMovement({
      items: oldReplacementItems,
      userId,
      referenceId: existingDebitNote._id,
      referenceCode: existingDebitNote.debitNoteId,
      movementType: "stock_out",
      notes: "Debit Note edit revert replacement"
    });

    const basePurchaseItems = String(oldPurchase._id) === String(targetPurchase._id)
      ? (oldPurchase.items || []).map((item) => toPurchaseItemShape(item))
      : (targetPurchase.items || []).map((item) => toPurchaseItemShape(item));

    if (String(oldPurchase._id) === String(targetPurchase._id) && existingDebitNote.status === "replaced") {
      const baseTotals = calculatePurchaseTotals(basePurchaseItems);
      targetPurchase.items = basePurchaseItems;
      targetPurchase.totalDiscount = baseTotals.totalDiscount;
      targetPurchase.totalTax = baseTotals.totalTax;
      targetPurchase.totalAmount = baseTotals.totalAmount;
      targetPurchase.finalAmount = baseTotals.finalAmount;
      targetPurchase.balanceAmount = Math.max(Number((baseTotals.totalAmount - Number(targetPurchase.paidAmount || 0)).toFixed(2)), 0);
    }

    let updatedPurchaseItems = basePurchaseItems;
    if (effectiveStatus === "replaced") {
      updatedPurchaseItems = buildUpdatedPurchaseItems(basePurchaseItems, normalizedItems, normalizedReplacementItems);
      const updatedTotals = calculatePurchaseTotals(updatedPurchaseItems);
      targetPurchase.items = updatedPurchaseItems;
      targetPurchase.totalDiscount = updatedTotals.totalDiscount;
      targetPurchase.totalTax = updatedTotals.totalTax;
      targetPurchase.totalAmount = updatedTotals.totalAmount;
      targetPurchase.finalAmount = updatedTotals.finalAmount;
      targetPurchase.balanceAmount = Math.max(Number((updatedTotals.totalAmount - Number(targetPurchase.paidAmount || 0)).toFixed(2)), 0);
    }

    targetPurchase.status = effectiveStatus;
    await targetPurchase.save();

    await applyInventoryMovement({
      items: normalizedItems,
      userId,
      referenceId: existingDebitNote._id,
      referenceCode: existingDebitNote.debitNoteId,
      movementType: "stock_out",
      notes: "Purchase return via Debit Note"
    });

    await applyInventoryMovement({
      items: normalizedReplacementItems,
      userId,
      referenceId: existingDebitNote._id,
      referenceCode: existingDebitNote.debitNoteId,
      movementType: "stock_in",
      notes: "Supplier exchange in via Debit Note"
    });

    existingDebitNote.purchaseId = targetPurchase._id;
    existingDebitNote.vendorId = targetPurchase.vendorId;
    existingDebitNote.debitNoteDate = debitNoteDate ? new Date(debitNoteDate) : existingDebitNote.debitNoteDate;
    existingDebitNote.dueDate = debitNoteDate ? new Date(debitNoteDate) : existingDebitNote.dueDate;
    existingDebitNote.referenceNo = referenceNo || "";
    existingDebitNote.items = normalizedItems;
    existingDebitNote.replacementItems = normalizedReplacementItems;
    existingDebitNote.status = effectiveStatus;
    existingDebitNote.paymentMode = paymentMode || null;
    existingDebitNote.totalAmount = totalAmount;
    existingDebitNote.replacementAmount = replacementAmount;
    existingDebitNote.netAdjustment = netAdjustment;
    existingDebitNote.adjustmentType = adjustmentType;
    existingDebitNote.finalAmount = totalAmount;
    existingDebitNote.paidAmount = paid;
    existingDebitNote.balanceAmount = balanceAmount;
    existingDebitNote.bank = bank || null;
    existingDebitNote.notes = notes || "";
    existingDebitNote.termsAndCondition = termsAndCondition || "";
    existingDebitNote.checkNumber = checkNumber || null;
    existingDebitNote.billFrom = billFrom;
    existingDebitNote.billTo = billTo;

    await existingDebitNote.save();

    res.status(200).json({
      success: true,
      message: "Debit note updated successfully",
      data: existingDebitNote
    });
  } catch (err) {
    console.error("Update debit note error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating debit note",
      error: err.message
    });
  }
};

// Update debit note status
const updateDebitNoteStatus = async (req, res) => {
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
    const userId = req.user;
    const {
      status,
      approvedBy,
      sign_type,
      signatureId,
      signatureName,
      paidAmount = 0
    } = req.body;

    // Fetch debit note
    const debitNote = await DebitNote.findOne({ _id: id, isDeleted: false })
      .populate('items.productId')
      .session(session);

    if (!debitNote) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Debit note not found' });
    }

    // Validate status
    const validStatuses = ['new', 'pending', 'completed', 'cancelled', 'partially_paid', 'paid'];
    if (!validStatuses.includes(status)) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate signature type
    const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
    if (sign_type && !validSignatureTypes.includes(sign_type)) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid signature type' });
    }

    // Validate signature fields for eSignature
    if (sign_type === 'eSignature') {
      if (!req.file && !debitNote.signatureImage) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Signature image is required for eSignature' });
      }
      if (!signatureName) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Signature name is required for eSignature' });
      }
    }

    // Validate approver if status is approved
    if (status === 'approved') {
      const approver = await User.findById(approvedBy || userId).session(session);
      if (!approver) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        await session.abortTransaction();
        session.endSession();
        return res.status(422).json({ success: false, message: 'Invalid approved by user ID' });
      }
      debitNote.approvedBy = approvedBy || userId;
    }

    // Handle signature image replacement
    let oldSignaturePath = '';
    if (req.file) {
      oldSignaturePath = debitNote.signatureImage;
      debitNote.signatureImage = req.file.path;
    }

    // Update debit note fields
    debitNote.status = status;
    if (sign_type) debitNote.sign_type = sign_type;
    if (signatureName) debitNote.signatureName = signatureName;
    if (signatureId) debitNote.signatureId = signatureId;

    // Handle payments
    if (['partially_paid', 'paid'].includes(status)) {
      debitNote.paidAmount = paidAmount;
      debitNote.balanceAmount = debitNote.totalAmount - paidAmount;
    }

    // Save updated debit note
    await debitNote.save({ session });

    // Remove old signature if updated
    if (req.file && oldSignaturePath) {
      try {
        fs.unlinkSync(oldSignaturePath);
      } catch (err) {
        console.error('Error deleting old signature:', err);
      }
    }

    // Update inventory if status is approved
    if (status === 'approved') {
      for (const item of debitNote.items) {
        let inventory = await Inventory.findOne({ productId: item.productId, userId }).session(session);
        if (!inventory) {
          inventory = new Inventory({ productId: item.productId, userId, quantity: 0 });
        }
        inventory.quantity -= item.quantity;
        inventory.inventory_history.push({
          unitId: item.unit,
          quantity: inventory.quantity,
          notes: `Stock out from debit note ${debitNote.debitNoteId}`,
          type: 'stock_out',
          adjustment: -item.quantity,
          referenceId: debitNote._id,
          referenceType: 'debit_note',
          createdBy: userId
        });
        await inventory.save({ session });
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Prepare response
    const responseData = {
      id: debitNote._id,
      debitNoteId: debitNote.debitNoteId,
      status: debitNote.status,
      approvedBy: debitNote.approvedBy ? {
        id: debitNote.approvedBy._id,
        name: `${debitNote.approvedBy.firstName || ''} ${debitNote.approvedBy.lastName || ''}`.trim()
      } : null,
      sign_type: debitNote.sign_type,
      signatureName: debitNote.signatureName,
      signatureImage: debitNote.signatureImage
        ? `${process.env.BASE_URL || 'http://127.0.0.1:5000'}/${debitNote.signatureImage.replace(/\\/g, '/')}`
        : null,
      updatedAt: debitNote.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Debit note status updated successfully',
      data: responseData
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (req.file?.path) fs.unlinkSync(req.file.path);
    console.error('Error updating debit note status:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating debit note status',
      error: err.message
    });
  }
};

// Delete debit note (soft delete)
const deleteDebitNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user; // Assuming user is authenticated

    const debitNote = await DebitNote.findOneAndDelete(
      { _id: id, userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    // Revert purchase status to "paid"
    await Purchase.findByIdAndUpdate(debitNote.purchaseId, { status: 'paid' });
  await syncPurchaseNotificationForPurchase(debitNote.purchaseId);

    res.status(200).json({
      message: 'Debit note deleted successfully',
      data: debitNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Error deleting debit note',
      error: err.message
    });
  }
};

const deleteDebitNoteById = async (id, userId) => {
  const debitNote = await DebitNote.findOneAndDelete(
    { _id: id, userId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!debitNote) {
    return false;
  }
  await Purchase.findByIdAndUpdate(debitNote.purchaseId, { status: 'paid' });
  return true;
};

const bulkDeleteDebitNotes = async (req, res) => {
  const { ids, all } = req.body;
  const userId = req.user;
  try {
    let targetIds = ids;
    if (all) {
      const notes = await DebitNote.find({ userId, isDeleted: false }).select('_id');
      targetIds = notes.map(n => n._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide debit note ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteDebitNoteById(id, userId);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: 'Debit notes deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error deleting debit notes',
      error: err.message
    });
  }
};

module.exports = {
  createDebitNote,
  getAllDebitNotes,
  getDebitNoteById,
  updateDebitNote,
  updateDebitNoteStatus,
  deleteDebitNote,
  bulkDeleteDebitNotes
};
