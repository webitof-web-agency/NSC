const mongoose = require("mongoose");
const Invoice = require("@models/Invoice");
const Quotation = require("@models/Quotation");
const { validationResult } = require("express-validator");
const InvoicePayment = require("@models/InvoicePayment");
const Signature = require("@models/Signature");
const CreditNote = require("@models/CreditNote");
const PaymentMode = require("@models/PaymentMode");
const Inventory = require("@models/Inventory");
const DeliveryChallan = require("@models/DeliveryChallan");
const BankDetail = require("@models/BankDetail");
const ProductVariant = require("@models/ProductVariant");
const {
  enrichInvoicePrintItems,
  normalizeInvoiceItems,
} = require("@utils/invoicePrintItems");

const getNextExchangeInvoiceNumberInternal = async () => {
  const prefix = "EXC-";
  const lastExchange = await Invoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber")
    .lean();

  let lastNumber = 0;
  if (lastExchange?.invoiceNumber) {
    const match = lastExchange.invoiceNumber.match(/\d+$/);
    if (match) {
      lastNumber = parseInt(match[0], 10);
    }
  }

  const nextNumber = lastNumber + 1;
  return `${prefix}${String(nextNumber).padStart(6, "0")}`;
};
const BankTransaction = require("@models/BankTransaction");
const GeneralSetting = require("@models/GeneralSetting");
const CompanySettings = require("@models/CompanySettings");
const { sendMail } = require("@utils/mailer");
const { syncCreditNotificationForInvoice, resolveNotificationForInvoice } = require("@services/notificationService");
const toMoney = (value) =>
  Number((Number(value) || 0).toFixed(2));

const toIsoWithoutMilliseconds = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
};

const normalizeInvoiceShippingAddress = (value) => {
  const raw = typeof value === "string"
    ? (() => {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    })()
    : value || {};

  return {
    name: String(raw.name || "").trim(),
    addressLine1: String(raw.addressLine1 || "").trim(),
    addressLine2: String(raw.addressLine2 || "").trim(),
    country: String(raw.country || "").trim(),
    state: String(raw.state || "").trim(),
    city: String(raw.city || "").trim(),
    pincode: String(raw.pincode || "").trim(),
  };
};

const getCommissionBase = (item = {}) => {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  const taxPerUnit = qty > 0 ? (Number(item.tax) || 0) / qty : 0;
  const rateAfterTax = Math.max(rate - taxPerUnit, 0);

  return {
    qty,
    rate,
    rateAfterTax,
    basePrice: qty * rateAfterTax,
  };
};

const getInvoiceItemKey = (item = {}) =>
  String(item.rowId || item.id || `${String(item.product_id || "")}-${String(item.variantId || "")}`);

const getCommissionItemKey = (item = {}) => {
  const rowId = String(item.rowId || item.id || "").trim();
  if (rowId) {
    return `row:${rowId}`;
  }

  return [
    String(item.staffId || ""),
    String(item.product_id || item.productId || ""),
    String(item.variantId || ""),
    String(item.designNo || item.design_no || item.product_name || ""),
    Number(item.qty || 0),
    Number(item.rate || 0),
  ].join("|");
};

const createCommissionRecordsForInvoiceItems = async ({
  invoiceId,
  items = [],
  createdBy,
  existingCommissions = [],
}) => {
  const commissionedKeys = new Set();

  for (const commission of existingCommissions || []) {
    for (const commissionItem of commission?.items || []) {
      commissionedKeys.add(getCommissionItemKey(commissionItem));
    }
  }

  const staffGroups = {};

  for (const item of items || []) {
    if (!item?.staffId) continue;

    const itemKey = getCommissionItemKey(item);
    if (commissionedKeys.has(itemKey)) continue;

    const staffIdStr = String(item.staffId);
    if (!staffGroups[staffIdStr]) {
      staffGroups[staffIdStr] = {
        staffId: item.staffId,
        items: [],
      };
    }

    staffGroups[staffIdStr].items.push(item);
  }

  if (Object.keys(staffGroups).length === 0) {
    return [];
  }

  const createdCommissionRecords = [];
  const settings = await CommissionSystemSetting.findOne();
  const month = new Date().toISOString().slice(0, 7);
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const staffId of Object.keys(staffGroups)) {
    const group = staffGroups[staffId];
    const staffUser = await User.findById(group.staffId).populate("roleId");

    if (!staffUser || staffUser.roleId?.roleName !== "Staff") {
      continue;
    }

    let staffCommissionPercent = Number(staffUser.commissionPercent) || 0;
    if (staffCommissionPercent === 0) {
      staffCommissionPercent = Number(settings?.commissionPercent || 0);
    }

    if (staffCommissionPercent <= 0) {
      continue;
    }

    const commissionItems = [];
    let totalCommissionForDoc = 0;

    for (const item of group.items) {
      const productId = item.product_id || item.productId;
      if (!productId) continue;

      const { qty, rate, basePrice } = getCommissionBase(item);
      const itemCommission = (basePrice * staffCommissionPercent) / 100;

      commissionItems.push({
        rowId: item.rowId || item.id || null,
        productId,
        variantId: item.variantId || null,
        designNo: item.designNo || item.design_no || item.product_name || item.name || "",
        qty,
        rate,
        saleRate: rate,
        amount: basePrice,
        commissionPercent: staffCommissionPercent,
        commissionAmount: itemCommission,
      });

      totalCommissionForDoc += itemCommission;
    }

    if (commissionItems.length === 0) continue;

    const commissionRecord = await Commission.create({
      staffId: group.staffId,
      invoiceId,
      items: commissionItems,
      totalCommissionAmount: totalCommissionForDoc,
      month,
      date: dateStr,
      createdBy,
    });

    createdCommissionRecords.push(commissionRecord);

    await User.findByIdAndUpdate(group.staffId, {
      $inc: { commissionEarned: totalCommissionForDoc },
    });

    const existingMonth = await User.findOne({
      _id: group.staffId,
      "monthlyCommission.month": month,
    });

    if (existingMonth) {
      await User.findOneAndUpdate(
        { _id: group.staffId, "monthlyCommission.month": month },
        {
          $inc: { "monthlyCommission.$.commission": totalCommissionForDoc },
          $push: { "monthlyCommission.$.records": commissionRecord._id },
        }
      );
    } else {
      await User.findByIdAndUpdate(group.staffId, {
        $push: {
          monthlyCommission: {
            month,
            commission: totalCommissionForDoc,
            records: [commissionRecord._id],
          },
        },
      });
    }

    const existingDate = await User.findOne({
      _id: group.staffId,
      "dailyCommission.date": dateStr,
    });

    if (existingDate) {
      await User.findOneAndUpdate(
        { _id: group.staffId, "dailyCommission.date": dateStr },
        {
          $inc: { "dailyCommission.$.commission": totalCommissionForDoc },
          $push: { "dailyCommission.$.records": commissionRecord._id },
        }
      );
    } else {
      await User.findByIdAndUpdate(group.staffId, {
        $push: {
          dailyCommission: {
            date: dateStr,
            commission: totalCommissionForDoc,
            records: [commissionRecord._id],
          },
        },
      });
    }
  }

  return createdCommissionRecords;
};

const attachCostSnapshotsToItems = async (items = [], existingItems = []) => {
  const existingSnapshotMap = new Map(
    (existingItems || []).map((item) => [getInvoiceItemKey(item), item])
  );

  const variantIds = [
    ...new Set(
      (items || [])
        .map((item) => item?.variantId)
        .filter((variantId) => mongoose.Types.ObjectId.isValid(String(variantId)))
        .map((variantId) => String(variantId))
    ),
  ];

  const variants = variantIds.length
    ? await ProductVariant.find({ _id: { $in: variantIds } })
      .select("_id purchase_price")
      .lean()
    : [];

  const variantCostMap = new Map(
    variants.map((variant) => [String(variant._id), Number(variant.purchase_price || 0)])
  );

  return (items || []).map((item) => {
    const existing = existingSnapshotMap.get(getInvoiceItemKey(item));
    const qty = Number(item?.qty || 0);
    const snapshotCost =
      existing?.costPriceSnapshot !== undefined && existing?.costPriceSnapshot !== null
        ? Number(existing.costPriceSnapshot || 0)
        : item?.costPriceSnapshot !== undefined && item?.costPriceSnapshot !== null
          ? Number(item.costPriceSnapshot || 0)
          : variantCostMap.get(String(item?.variantId || "")) || 0;

    const totalCostSnapshot =
      item?.totalCostSnapshot !== undefined && item?.totalCostSnapshot !== null
        ? Number(item.totalCostSnapshot || 0)
        : Number((snapshotCost * qty).toFixed(2));

    return {
      ...item,
      costPriceSnapshot: Number(snapshotCost.toFixed(2)),
      totalCostSnapshot: Number(totalCostSnapshot.toFixed(2)),
    };
  });
};

const getOrCreateInventoryRecord = async ({
  productId,
  variantId,
  userId,
  unitId,
  createdBy,
  note,
}) => {
  let resolvedProductId = productId;

  if (!resolvedProductId && variantId) {
    const variant = await ProductVariant.findById(variantId)
      .select("productId")
      .lean();
    resolvedProductId = variant?.productId || null;
  }

  let inventory = await Inventory.findOne({
    variantId,
    userId,
    isDeleted: false,
  });

  if (inventory) {
    if (!inventory.productId && resolvedProductId) {
      inventory.productId = resolvedProductId;
      await inventory.save();
    }
    return { inventory, created: false };
  }

  const deletedInventory = await Inventory.findOne({
    variantId,
    userId,
    isDeleted: true,
  });

  if (deletedInventory) {
    deletedInventory.isDeleted = false;
    if (!deletedInventory.productId && resolvedProductId) {
      deletedInventory.productId = resolvedProductId;
    }
    inventory = deletedInventory;
  } else {
    if (!resolvedProductId) {
      throw new Error("Unable to resolve productId for inventory record");
    }

    inventory = new Inventory({
      productId: resolvedProductId,
      variantId,
      quantity: 0,
      userId,
      inventory_history: [],
      notes: "",
    });
  }

  if (note) {
    inventory.inventory_history.push({
      unitId: unitId || null,
      quantity: inventory.quantity,
      notes: note,
      type: "adjustment",
      adjustment: 0,
      referenceId: null,
      referenceType: "adjustment",
      createdBy,
    });
  }

  try {
    await inventory.save();
  } catch (error) {
    // Another request may create the same inventory row concurrently.
    if (error?.code === 11000) {
      const existingInventory = await Inventory.findOne({
        variantId,
        userId,
        isDeleted: false,
      });

      if (existingInventory) {
        return { inventory: existingInventory, created: false };
      }
    }
    throw error;
  }

  return { inventory, created: true };
};
// For Staff Commission
const User = require("@models/User");
const Product = require("@models/Product");
const Commission = require("@models/Commission");
const CommissionSystemSetting = require("@models/CommissionSystemSetting");
const ExcelJS = require("exceljs");
const fs = require('fs');
const Customer = require('@models/Customer');
const { triggerWhatsAppSend } = require('../../../whatsapp-module');

const createInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      referenceNo,
      items,
      payment_method,
      notes,
      termsAndCondition,
      customerGstin,
      ewayBillNumber,
      shippingAddress,
      taxableAmount,
      TotalAmount,
      vat,
      totalDiscount,
      overall_discount,
      roundOff,
      bank,
      // isRecurring,        hide the isRecurring logic
      // repeatEvery,
      // customIntervalNumber,
      // customIntervalType,
      // startOn,
      // endsOn,
      // neverExpire,
      // stopped,
      // sign_type,          hide the signature logic
      // signatureName,
      // signatureId,
      billFrom,
      billTo,
      status,
      payment_date,
      payment_notes,
      staffId, //  ← ADD THIS
      taxType, // ← Tax Type (GST/Non-GST)
      gstType, // ← GST Mode (Inclusive/Exclusive)
      cashAmount, // ← MIXED payment: Cash portion
      upiAmount, // ← MIXED payment: UPI portion
      exchangeOldTotal,
      exchangeOriginalItems,
    } = req.body;

    const userId = req.user;
    const customerId = billTo ? billTo : "UNKNOWN";

    // Check for duplicate invoice number
    if (invoiceNumber) {
      const existingInvoice = await Invoice.findOne({ invoiceNumber });
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: `Invoice number ${invoiceNumber} already exists`,
          errors: {
            invoiceNumber: `Invoice number ${invoiceNumber} already exists`,
          },
        });
      }
    }


    // Auto calculate totals
    let calculatedTaxableAmount;
    const lineDiscountTotal = items.reduce(
      (sum, item) => sum + Number(item.discount || 0),
      0
    );
    const overallDiscount = Number(overall_discount) || 0;
    let calculatedTotalDiscount =
      totalDiscount !== undefined && totalDiscount !== null && totalDiscount !== ""
        ? Number(totalDiscount)
        : lineDiscountTotal + overallDiscount;
    let calculatedVat =
      vat || items.reduce((sum, item) => sum + Number(item.tax || 0), 0);

    // ✅ Calculate based on GST Mode
    let calculatedTotalAmount;

    if (taxType === "GST" && gstType === "Inclusive") {
      // For Inclusive: item amounts already include tax, so just sum them
      calculatedTaxableAmount = items.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      calculatedTotalAmount = Number(
        (Number(calculatedTaxableAmount) - Number(calculatedTotalDiscount)).toFixed(2)
      );
    } else {
      // For Exclusive or Non-GST: use rate*qty as base, then add tax
      calculatedTaxableAmount =
        taxableAmount ||
        items.reduce(
          (sum, item) => sum + Number(item.rate) * Number(item.qty),
          0
        );
      calculatedTotalAmount = Number(
        (
          Number(calculatedTaxableAmount) +
          Number(calculatedVat) -
          Number(calculatedTotalDiscount)
        ).toFixed(2)
      );
    }


    const inventoryCache = new Map();
    const autoCreatedInventoryKeys = new Set();

    const getInventoryForItem = async (item) => {
      const key = `${String(item.product_id)}-${String(item.variantId)}`;
      if (inventoryCache.has(key)) return inventoryCache.get(key);

      const { inventory, created } = await getOrCreateInventoryRecord({
        productId: item.product_id,
        variantId: item.variantId,
        userId,
        unitId: item.unit || null,
        createdBy: userId,
        note: `Inventory auto-created from Invoice #${invoiceNumber || referenceNo || ""}`,
      });

      if (created) {
        autoCreatedInventoryKeys.add(key);
      }

      inventoryCache.set(key, inventory);
      return inventory;
    };

    for (const item of items) {
      if (!item.product_id || !item.variantId) {
        return res.status(400).json({
          success: false,
          message: "Product variant is missing",
        });
      }

      await getInventoryForItem(item);
    }

    // Inventory validation skipped: allow zero/negative stock on invoice creation

    // 🔐 FINAL STATUS DECISION (frontend-driven)
    let finalStatus = "UNPAID";

    if (status === "DRAFT") {
      finalStatus = "DRAFT";
    } else if (status === "PAID") {
      finalStatus = "PAID";
    } else if (status === "PENDING" && (payment_method === "PHONEPE" || payment_method === "UPI" || payment_method === "MIXED")) {
      finalStatus = "PENDING";
    } else if (status === "EXCHANGE") {
      finalStatus = "EXCHANGE";
    }

    // 🔐 FINAL PAYMENT METHOD
    let finalPaymentMethod = payment_method || null;

    if (finalStatus === "PAID") {
      if (!["CASH", "CARD", "MIXED", "PHONEPE", "UPI"].includes(finalPaymentMethod)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment method for PAID invoice",
        });
      }
    }


    // Create invoice
    const parsedExchangeOriginalItems = (() => {
      if (!exchangeOriginalItems) return [];
      if (Array.isArray(exchangeOriginalItems)) return exchangeOriginalItems;
      try {
        return JSON.parse(exchangeOriginalItems);
      } catch {
        return [];
      }
    })();

    const itemsWithSnapshots = await attachCostSnapshotsToItems(items);
    const exchangeOriginalItemsWithSnapshots =
      finalStatus === "EXCHANGE"
        ? await attachCostSnapshotsToItems(parsedExchangeOriginalItems)
        : [];

    const invoice = new Invoice({
      invoiceNumber,
      customerId,
      invoiceDate: new Date(invoiceDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      referenceNo: referenceNo || "",
      items: itemsWithSnapshots.map((item) => ({
        // id: item.id,
        rowId: item.id,                     //  UUID from UI (safe)
        product_id: item.product_id,        //  REAL MongoDB ObjectId

        // ✅ SAVE VARIANT
        variantId: item.variantId,
        variantName: item.variantName,
        variantDesignNo: item.variantDesignNo,
        variantColor: item.variantColor,
        variantSize: item.variantSize,

        staffId: item.staffId || null,   //  ADD THIS
        name: item.name,
        key: item.key,
        qty: item.qty,
        unit: item.unit,
        hsn_code: item.hsn_code,
        rate: item.rate,
        discount: item.discount || 0,
        tax: item.tax || 0,
        tax_group_id: item.tax_group_id,
        amount: item.amount || item.rate * item.qty,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        costPriceSnapshot: item.costPriceSnapshot || 0,
        totalCostSnapshot: item.totalCostSnapshot || 0,
      })),
      exchangeOriginalItems: finalStatus === "EXCHANGE"
        ? (exchangeOriginalItemsWithSnapshots || []).map((item) => ({
          rowId: item.id || item.rowId,
          product_id: item.product_id,
          variantId: item.variantId,
          variantName: item.variantName,
          variantDesignNo: item.variantDesignNo,
          variantColor: item.variantColor,
          variantSize: item.variantSize,
          staffId: item.staffId || null,
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          hsn_code: item.hsn_code,
          rate: item.rate,
          discount: item.discount || 0,
          tax: item.tax || 0,
          tax_group_id: item.tax_group_id,
          amount: item.amount,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          costPriceSnapshot: item.costPriceSnapshot || 0,
          totalCostSnapshot: item.totalCostSnapshot || 0,
        }))
        : [],
      // status: status || "DRAFT",
      // status: "UNPAID",
      // payment_method,
      status: finalStatus,               // ✅ FIX
      payment_method: finalPaymentMethod, // ✅ FIX
      taxableAmount: calculatedTaxableAmount,
      TotalAmount: calculatedTotalAmount,
      vat: calculatedVat,
      totalDiscount: calculatedTotalDiscount,
      overall_discount: overallDiscount,
      roundOff: roundOff || false,
      // bank: bank || null,
      bank: null,      // ❌ DO NOT FORCE BANK ANYMORE
      notes: notes || "",
      termsAndCondition: termsAndCondition || "",
      customerGstin: String(customerGstin || "").trim(),
      ewayBillNumber: String(ewayBillNumber || "").trim(),
      shippingAddress: normalizeInvoiceShippingAddress(shippingAddress),
      // isRecurring,                      // hide them
      // repeatEvery,
      // customIntervalNumber,
      // customIntervalType,
      // startOn: isRecurring ? new Date(startOn) : null,
      // endsOn: isRecurring ? (endsOn ? new Date(endsOn) : null) : null,
      // neverExpire,
      // stopped,
      // nextRecurringDate,
      // sign_type,                        // hide them
      // signatureName,
      // signatureImage,
      // signatureId: savedSignatureId,
      billFrom,
      billTo: billTo || null,
      userId,
      taxType: taxType || "GST",           // ✅ Save tax type
      gstType: taxType === "Non-GST" ? null : (gstType || "Exclusive"),     // ✅ Save GST mode only for GST, null for Non-GST
      cashAmount: payment_method === "MIXED" ? (cashAmount || null) : null,  // ✅ Cash portion for MIXED
      cardAmount: payment_method === "MIXED" ? (req.body.cardAmount || null) : null,
      upiAmount: payment_method === "MIXED" ? (upiAmount || null) : null,    // ✅ UPI portion for MIXED
    });

    // Generate publicShareId eagerly so every invoice immediately has a shareable link
    const { getOrCreatePublicShareId } = require('../../../services/publicShareService');
    await getOrCreatePublicShareId(invoice);

    await invoice.save();

    await createCommissionRecordsForInvoiceItems({
      invoiceId: invoice._id,
      items,
      createdBy: req.user,
    });
    // COMMISSION CALCULATION END

    // Update inventory for each item (skip for draft)
    if (invoice.status !== "DRAFT") {
      for (const item of items) {
        const productId = item.product_id;
        if (!productId) continue;

        const key = `${String(productId)}-${String(item.variantId)}`;
        let inventory =
          inventoryCache.get(key) ||
          (await Inventory.findOne({
            productId,
            variantId: item.variantId,
            userId,
            isDeleted: false,
          }));
        if (!inventory) {
          const createdResult = await getOrCreateInventoryRecord({
            productId,
            variantId: item.variantId,
            userId,
            unitId: item.unit || null,
            createdBy: userId,
            note: `Inventory auto-created from Invoice #${invoiceNumber || referenceNo || ""}`,
          });
          inventory = createdResult.inventory;
        }

        const previousQuantity = inventory.quantity;
        inventory.quantity -= item.qty;

        inventory.inventory_history.push({
          unitId: item.unit || null,
          quantity: previousQuantity,
          notes: `Stock reduced due to Invoice #${invoice.referenceNo || invoice._id
            }`,
          type: "stock_out",
          adjustment: -item.qty,
          referenceId: invoice._id,
          referenceType: "invoice",
          createdBy: userId,
        });

        await inventory.save();
      }
    }


    await syncCreditNotificationForInvoice(invoice._id);

    res.status(201).json({
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (err) {
    console.error("Create invoice error:", err);
    res
      .status(500)
      .json({ message: "Error creating invoice", error: err.message });
  }
};


async function updateInvoiceStatus(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  const payments = await InvoicePayment.find({ invoiceId });

  const totalPaid = Number(
    payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
  );

  const invoiceTotal = Number(Number(invoice.TotalAmount).toFixed(2));

  // ✅ tolerance for rounding
  let newStatus;
  if (Math.abs(totalPaid - invoiceTotal) <= 0.01) {
    // ✅ Check if this is an exchange transaction
    const isExchange = invoice.isExchange === true;

    if (isExchange) {
      newStatus = "EXCHANGE";
    } else {
      newStatus = "PAID";
    }
  } else if (totalPaid > 0) {
    newStatus = "PARTIALLY_PAID";
  } else {
    newStatus = "UNPAID";
  }

  // Use findByIdAndUpdate to avoid validation errors on items (rowId requirement)
  await Invoice.findByIdAndUpdate(
    invoiceId,
    { $set: { status: newStatus } },
    { runValidators: false }
  );

  // Keep credit note status in sync when invoice is fully paid
  if (newStatus === "PAID") {
    await CreditNote.updateMany(
      { invoiceId: invoice._id, isDeleted: false },
      { $set: { status: "PAID" } }
    );
  }

  await syncCreditNotificationForInvoice(invoiceId);
}


const sendInvoiceEmail = async (req, res) => {
  try {
    const {
      invoiceId,
      to,
      cc,
      subject,
      htmlContent,
      sendAttachment = false,
    } = req.body;

    if (!invoiceId || !to || !subject || !htmlContent) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const companySettings = await CompanySettings.findOne().sort({
      createdAt: -1,
    });
    const companyName = companySettings?.companyName || "Naresh Saree Collection";
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
          filename: `Invoice-${invoiceId}.pdf`,
          path: `${process.env.INVOICE_UPLOAD_PATH || "./uploads/invoices"
            }/${invoiceId}.pdf`,
        },
      ];
    }

    // Send email
    await sendMail(mailOptions);

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { status: "SENT" },
      { new: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "Invoice email sent and status updated to 'sent'",
      data: updatedInvoice,
    });
  } catch (err) {
    console.error("Failed to send invoice email:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to send invoice email",
      error: err.message,
    });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = req.params.id;
    const userId = req.user;

    const existingInvoice = await Invoice.findById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const {
      invoiceDate,
      dueDate,
      referenceNo,
      items,
      payment_method,
      notes,
      termsAndCondition,
      customerGstin,
      ewayBillNumber,
      shippingAddress,
      taxableAmount,
      TotalAmount,
      vat,
      totalDiscount,
      overall_discount,
      roundOff,
      bank,
      // isRecurring,           // hide the isRecurring logic
      // repeatEvery,
      // customIntervalNumber,
      // customIntervalType,
      // startOn,
      // endsOn,
      // neverExpire,
      // stopped,
      // sign_type,                // hide the signature logic
      // signatureName,
      // signatureId,
      billFrom,
      billTo,
      status,
      payment_date,
      payment_notes,
      taxType,  // ← Tax Type (GST/Non-GST)
      gstType,  // ← GST Mode (Inclusive/Exclusive)
      cashAmount,  // ← MIXED payment: Cash portion
      upiAmount,   // ← MIXED payment: UPI portion
      exchangeOldTotal,
      exchangeOriginalItems,
    } = req.body;


    // ✅ Merge incoming items with existing to prevent losing variant fields
    const existingItems = (existingInvoice.items || []).map((it) =>
      typeof it?.toObject === "function" ? it.toObject() : it
    );

    let mergedItems = existingItems;
    if (Array.isArray(items) && items.length > 0) {
      const existingByRowId = new Map(
        existingItems.map((it) => [String(it.rowId || it.id || ""), it])
      );
      mergedItems = items.map((item) => {
        const rowKey = String(item.rowId || item.id || "");
        const existing = existingByRowId.get(rowKey);
        return {
          ...(existing || {}),
          ...item,
          rowId: item.rowId || item.id || existing?.rowId || existing?.id,
          product_id: item.product_id || existing?.product_id,
          variantId: item.variantId || existing?.variantId,
          variantName: item.variantName || existing?.variantName,
          variantDesignNo: item.variantDesignNo || existing?.variantDesignNo,
          variantColor: item.variantColor || existing?.variantColor,
          variantSize: item.variantSize || existing?.variantSize,
        };
      });
    }

    mergedItems = await attachCostSnapshotsToItems(mergedItems, existingItems);

    // ✅ Calculate discount and tax totals
    const lineDiscountTotal = mergedItems.reduce(
      (sum, item) => sum + toMoney(item.discount || 0),
      0
    );
    const overallDiscount =
      overall_discount !== undefined && overall_discount !== null && overall_discount !== ""
        ? Number(overall_discount) || 0
        : Number(existingInvoice.overall_discount) || 0;

    const calculatedTotalDiscount = toMoney(
      totalDiscount ?? (lineDiscountTotal + overallDiscount)
    );

    const calculatedVat = toMoney(
      vat ??
      mergedItems.reduce((sum, item) => sum + toMoney(item.tax || 0), 0)
    );

    // ✅ Calculate based on GST Mode
    let calculatedTaxableAmount;
    let calculatedTotalAmount;

    if (taxType === "GST" && gstType === "Inclusive") {
      // For Inclusive: item amounts already include tax, so just sum them
      calculatedTaxableAmount = toMoney(
        mergedItems.reduce(
          (sum, item) => sum + toMoney(item.amount || 0),
          0
        )
      );
      calculatedTotalAmount = toMoney(
        calculatedTaxableAmount - calculatedTotalDiscount
      );
    } else {
      // For Exclusive or Non-GST: use rate*qty as base, then add tax
      calculatedTaxableAmount = toMoney(
        taxableAmount ??
        mergedItems.reduce(
          (sum, item) => sum + toMoney(item.rate) * Number(item.qty),
          0
        )
      );
      calculatedTotalAmount = toMoney(
        calculatedTaxableAmount + calculatedVat - calculatedTotalDiscount
      );
    }


    const updateData = {
      invoiceDate: invoiceDate
        ? new Date(invoiceDate)
        : existingInvoice.invoiceDate,
      dueDate:
        dueDate !== undefined
          ? (dueDate ? new Date(dueDate) : null)
          : existingInvoice.dueDate,
      referenceNo,
      items: mergedItems,
      status,
      payment_method: payment_method !== undefined ? payment_method : existingInvoice.payment_method,
      taxableAmount: calculatedTaxableAmount,
      TotalAmount: calculatedTotalAmount,
      vat: calculatedVat,
      totalDiscount: calculatedTotalDiscount,
      overall_discount: overallDiscount,
      roundOff,
      bank,
      notes,
      termsAndCondition,
      customerGstin: customerGstin ?? existingInvoice.customerGstin ?? "",
      ewayBillNumber: ewayBillNumber ?? existingInvoice.ewayBillNumber ?? "",
      shippingAddress:
        shippingAddress !== undefined
          ? normalizeInvoiceShippingAddress(shippingAddress)
          : normalizeInvoiceShippingAddress(existingInvoice.shippingAddress),
      // isRecurring,          // hide them
      // repeatEvery,
      // customIntervalNumber,
      // customIntervalType,
      // startOn,
      // endsOn,
      // neverExpire,
      // stopped,
      // nextRecurringDate,
      // sign_type,                           // hide them
      // signatureName: updatedSignatureName,
      // signatureImage,
      // signatureId: updatedSignatureId,
      billFrom: billFrom || existingInvoice.billFrom || null,
      billTo: billTo || existingInvoice.billTo || null,
      userId,
      taxType: taxType || existingInvoice.taxType || "GST",     // ✅ Save tax type
      gstType: (taxType || existingInvoice.taxType) === "Non-GST" ? null : (gstType || existingInvoice.gstType || "Exclusive"), // ✅ Save GST mode only for GST, null for Non-GST
      cashAmount: payment_method === "MIXED" ? (cashAmount || null) : null,  // ✅ Cash portion for MIXED
      cardAmount: payment_method === "MIXED" ? (req.body.cardAmount || null) : null,
      upiAmount: payment_method === "MIXED" ? (upiAmount || null) : null,    // ✅ UPI portion for MIXED
    };

    const parsedExchangeOriginalItems = (() => {
      if (!exchangeOriginalItems) return [];
      if (Array.isArray(exchangeOriginalItems)) return exchangeOriginalItems;
      try {
        return JSON.parse(exchangeOriginalItems);
      } catch {
        return [];
      }
    })();

    const exchangeOriginalSnapshotSource =
      existingInvoice.exchangeOriginalItems && existingInvoice.exchangeOriginalItems.length > 0
        ? existingInvoice.exchangeOriginalItems
        : existingInvoice.items;
    const parsedExchangeOriginalItemsWithSnapshots =
      parsedExchangeOriginalItems.length > 0
        ? await attachCostSnapshotsToItems(
          parsedExchangeOriginalItems,
          exchangeOriginalSnapshotSource
        )
        : [];

    if (parsedExchangeOriginalItemsWithSnapshots.length > 0) {
      updateData.exchangeOriginalItems = parsedExchangeOriginalItemsWithSnapshots;
    }

    const skipExchangeDetection = req.body.skipExchangeDetection !== undefined 
      ? String(req.body.skipExchangeDetection).trim().toLowerCase() === "true"
      : true; // Default to true so regular edits don't become exchanges

    const isExchangeTransaction =
      !skipExchangeDetection &&
      ['PAID', 'PARTIALLY_PAID', 'EXCHANGE'].includes(existingInvoice.status) &&
      itemsHaveChanged(existingInvoice.items, mergedItems);

    let exchangedItems = [];

    if (isExchangeTransaction) {
      const exchangeBaseItems =
        parsedExchangeOriginalItemsWithSnapshots.length > 0
          ? parsedExchangeOriginalItemsWithSnapshots
          : (existingInvoice.exchangeOriginalItems && existingInvoice.exchangeOriginalItems.length > 0
            ? existingInvoice.exchangeOriginalItems
            : existingInvoice.items);

      updateData.exchangeOriginalItems = exchangeBaseItems;

      const oldQtyMap = new Map();
      existingInvoice.items.forEach((item) => {
        const key = `${String(item.product_id)}-${String(item.variantId || "no-variant")}`;
        oldQtyMap.set(key, (oldQtyMap.get(key) || 0) + Number(item.qty || 0));
      });
      const newQtyMap = new Map();
      mergedItems.forEach((item) => {
        const key = `${String(item.product_id)}-${String(item.variantId || "no-variant")}`;
        newQtyMap.set(key, (newQtyMap.get(key) || 0) + Number(item.qty || 0));
      });
      for (const [key, newQty] of newQtyMap.entries()) {
        const oldQty = oldQtyMap.get(key);
        if (oldQty !== undefined && Number(newQty) > Number(oldQty)) {
          return res.status(400).json({
            message: "Exchange quantity cannot exceed original quantity",
          });
        }
      }

      // Get items that were removed/exchanged (to restock)
      // Compare both product_id AND variantId to handle variant exchanges
      exchangedItems = existingInvoice.items.filter(oldItem =>
        !mergedItems.some(newItem =>
          String(newItem.product_id) === String(oldItem.product_id) &&
          String(newItem.variantId || '') === String(oldItem.variantId || '')
        )
      );


      // Restock exchanged or reduced-quantity items back to inventory
      const restockAdjustments = [];
      for (const [key, oldQty] of oldQtyMap.entries()) {
        const newQty = Number(newQtyMap.get(key) || 0);
        const diff = Number(oldQty) - newQty;
        if (diff > 0) {
          const [productId, variantId] = String(key).split("-");
          const sourceItem = existingInvoice.items.find(
            (it) =>
              String(it.product_id) === String(productId) &&
              String(it.variantId || "no-variant") === String(variantId)
          );
          restockAdjustments.push({
            product_id: productId,
            variantId: variantId === "no-variant" ? null : variantId,
            qty: diff,
            unit: sourceItem?.unit || "pcs",
          });
        }
      }

      for (const item of restockAdjustments) {
        if (item.variantId) {
          try {
            const { inventory: inventoryRecord } = await getOrCreateInventoryRecord({
              productId: item.product_id,
              variantId: item.variantId,
              userId,
              unitId: item.unit || "pcs",
              createdBy: req.user,
              note: `Inventory auto-created from Invoice Update #${invoiceId}`,
            });

            inventoryRecord.quantity += item.qty;
            inventoryRecord.inventory_history.push({
              unitId: item.unit || 'pcs',
              quantity: inventoryRecord.quantity,
              notes: `Stock restored due to Exchange - Invoice #${invoiceId}`,
              type: 'stock_in',
              adjustment: item.qty,
              referenceId: invoiceId,
              referenceType: 'exchange',
              createdBy: req.user
            });

            await inventoryRecord.save();
          } catch (err) {
            console.log("?????? Inventory restock error (non-critical):", err.message);
          }
        }
      }

      // Deduct stock for new items
      const newItems = mergedItems.filter(newItem =>
        !existingInvoice.items.some(oldItem =>
          String(newItem.product_id) === String(oldItem.product_id) &&
          String(newItem.variantId || '') === String(oldItem.variantId || '')
        )
      );


      for (const item of newItems) {
        if (item.variantId) {
          try {
            const { inventory: inventoryRecord } = await getOrCreateInventoryRecord({
              productId: item.product_id,
              variantId: item.variantId,
              userId,
              unitId: item.unit || "pcs",
              createdBy: req.user,
              note: `Inventory auto-created from Invoice Update #${invoiceId}`,
            });

            // Deduct quantity
            inventoryRecord.quantity -= item.qty;

            // Add history entry
            inventoryRecord.inventory_history.push({
              unitId: item.unit || 'pcs',
              quantity: inventoryRecord.quantity,
              notes: `Stock reduced due to Exchange - Invoice #${invoiceId}`,
              type: 'stock_out',
              adjustment: -item.qty,
              referenceId: invoiceId,
              referenceType: 'exchange',
              createdBy: req.user
            });

            await inventoryRecord.save();
          } catch (err) {
            console.log("?????? Inventory deduction error (non-critical):", err.message);
          }
        }
      }

      const parsedExchangeOldTotal = Number(exchangeOldTotal);
      const hasProvidedOldTotal =
        exchangeOldTotal !== undefined &&
        exchangeOldTotal !== null &&
        Number.isFinite(parsedExchangeOldTotal);
      const oldTotal = hasProvidedOldTotal
        ? parsedExchangeOldTotal
        : exchangeBaseItems.reduce((sum, item) => {
          const amount = item?.amount !== undefined && item?.amount !== null
            ? Number(item.amount)
            : (Number(item.qty || 0) * Number(item.rate || 0));
          return sum + (Number.isNaN(amount) ? 0 : amount);
        }, 0);
      const newTotal = Number(calculatedTotalAmount);
      const amountDifference = Number((newTotal - oldTotal).toFixed(2));

      if (Number.isNaN(amountDifference)) {
        return res.status(400).json({
          message: "Invalid exchange amount difference",
        });
      }


      // Store the difference for frontend logic
      updateData.amountDifference = amountDifference;
      updateData.isExchange = true;
      updateData.exchangeOldTotal = oldTotal;
      updateData.exchangeNewTotal = newTotal;

      // Case 1: Customer returns value (downgrade - new product is cheaper)
      if (amountDifference < 0) {
        const refundAmount = Math.abs(amountDifference);
        const currentReturned = Number(existingInvoice.returned_amount || 0);
        updateData.returned_amount = Math.max(currentReturned + refundAmount, 0);
        updateData.profit_amount = existingInvoice.profit_amount || null;
        updateData.status = "EXCHANGE";
        updateData.exchangePending = false;
        const existingPayment = await InvoicePayment.findOne({ invoiceId: existingInvoice._id });
        if (existingPayment) {
          await InvoicePayment.findByIdAndUpdate(
            existingPayment._id,
            {
              $set: {
                amount: newTotal,
                notes: `Payment updated - Exchange downgrade (Original: ???${oldTotal}, Refunded: ???${Math.abs(amountDifference)})`,
                received_on: new Date()
              }
            }
          );
        }
      }

      // Case 2: Customer pays more (upgrade - new product is more expensive)
      else if (amountDifference > 0) {
        updateData.returned_amount = existingInvoice.returned_amount || null;
        updateData.status = "EXCHANGE";
        updateData.exchangePending = false;
      }

      // Case 3: Same amount (variant exchange, same price)
      else {
        updateData.returned_amount = existingInvoice.returned_amount || null;
        updateData.profit_amount = existingInvoice.profit_amount || null;
        updateData.status = "EXCHANGE";
        updateData.exchangePending = false;
      }

      // Status handled above per exchange case
    }

    // Helper function: Check if items have changed (including variants)
    function itemsHaveChanged(oldItems, newItems) {
      // Compare product/variant keys and quantities to detect exchanges or qty changes
      const buildQtyMap = (items) => {
        const map = new Map();
        items.forEach((i) => {
          const key = `${String(i.product_id)}-${String(i.variantId || 'no-variant')}`;
          map.set(key, (map.get(key) || 0) + Number(i.qty || 0));
        });
        return map;
      };
      const oldMap = buildQtyMap(oldItems);
      const newMap = buildQtyMap(newItems);
      if (oldMap.size !== newMap.size) return true;
      for (const [key, oldQty] of oldMap.entries()) {
        const newQty = newMap.get(key);
        if (newQty === undefined) return true;
        if (Number(newQty) !== Number(oldQty)) return true;
      }
      const changed = false;


      return changed;
    }

    const invoice = await Invoice.findByIdAndUpdate(invoiceId, updateData, {
      new: true,
    });

    // ??? Adjust stock for added/removed items when editing invoice (non-exchange)
    if (invoice && !isExchangeTransaction && Array.isArray(mergedItems)) {
      const existingKeys = new Set(
        (existingInvoice.items || []).map(
          (it) => `${String(it.product_id)}-${String(it.variantId || "")}`
        )
      );
      const mergedKeys = new Set(
        (mergedItems || []).map(
          (it) => `${String(it.product_id)}-${String(it.variantId || "")}`
        )
      );

      const newItemsToDeduct = mergedItems.filter(
        (it) => !existingKeys.has(`${String(it.product_id)}-${String(it.variantId || "")}`)
      );
      const removedItemsToRestock = (existingInvoice.items || []).filter(
        (it) => !mergedKeys.has(`${String(it.product_id)}-${String(it.variantId || "")}`)
      );
      const oldQtyMap = new Map();
      const oldItemMap = new Map();
      (existingInvoice.items || []).forEach((it) => {
        const key = `${String(it.product_id)}-${String(it.variantId || "")}`;
        oldQtyMap.set(key, (oldQtyMap.get(key) || 0) + Number(it.qty || 0));
        if (!oldItemMap.has(key)) oldItemMap.set(key, it);
      });
      const newQtyMap = new Map();
      (mergedItems || []).forEach((it) => {
        const key = `${String(it.product_id)}-${String(it.variantId || "")}`;
        newQtyMap.set(key, (newQtyMap.get(key) || 0) + Number(it.qty || 0));
      });

      // Restock removed items
      for (const item of removedItemsToRestock) {
        if (!item.product_id || !item.variantId) continue;

        const { inventory: inventoryRecord } = await getOrCreateInventoryRecord({
          productId: item.product_id,
          variantId: item.variantId,
          userId,
          unitId: item.unit || null,
          createdBy: req.user,
          note: `Inventory auto-created from Invoice Update #${invoiceId}`,
        });

        inventoryRecord.quantity += Number(item.qty || 0);
        inventoryRecord.inventory_history.push({
          unitId: item.unit || null,
          quantity: inventoryRecord.quantity,
          notes: `Stock restored due to Invoice Update #${invoiceId}`,
          type: "stock_in",
          adjustment: Number(item.qty || 0),
          referenceId: invoiceId,
          referenceType: "invoice",
          createdBy: req.user,
        });

        await inventoryRecord.save();
      }

      // Deduct stock for newly added items
      for (const item of newItemsToDeduct) {
        if (!item.product_id || !item.variantId) continue;

        const { inventory: inventoryRecord } = await getOrCreateInventoryRecord({
          productId: item.product_id,
          variantId: item.variantId,
          userId,
          unitId: item.unit || null,
          createdBy: req.user,
          note: `Inventory auto-created from Invoice Update #${invoiceId}`,
        });

        inventoryRecord.quantity -= item.qty;
        inventoryRecord.inventory_history.push({
          unitId: item.unit || null,
          quantity: inventoryRecord.quantity,
          notes: `Stock reduced due to Invoice Update #${invoiceId}`,
          type: "stock_out",
          adjustment: -item.qty,
          referenceId: invoiceId,
          referenceType: "invoice",
          createdBy: req.user,
        });

        await inventoryRecord.save();
      }

      // Adjust stock for quantity changes on existing items
      for (const [key, oldQty] of oldQtyMap.entries()) {
        if (!newQtyMap.has(key)) continue;
        const newQty = Number(newQtyMap.get(key) || 0);
        const diff = newQty - Number(oldQty || 0);
        if (diff === 0) continue;

        const sourceItem = oldItemMap.get(key);
        if (!sourceItem?.product_id || !sourceItem?.variantId) continue;

        const { inventory: inventoryRecord } = await getOrCreateInventoryRecord({
          productId: sourceItem.product_id,
          variantId: sourceItem.variantId,
          userId,
          unitId: sourceItem.unit || null,
          createdBy: req.user,
          note: `Inventory auto-created from Invoice Update #${invoiceId}`,
        });

        if (diff > 0) {
          inventoryRecord.quantity -= diff;
          inventoryRecord.inventory_history.push({
            unitId: sourceItem.unit || null,
            quantity: inventoryRecord.quantity,
            notes: `Stock reduced due to Invoice Update #${invoiceId}`,
            type: "stock_out",
            adjustment: -diff,
            referenceId: invoiceId,
            referenceType: "invoice",
            createdBy: req.user,
          });
        } else {
          const restoreQty = Math.abs(diff);
          inventoryRecord.quantity += restoreQty;
          inventoryRecord.inventory_history.push({
            unitId: sourceItem.unit || null,
            quantity: inventoryRecord.quantity,
            notes: `Stock restored due to Invoice Update #${invoiceId}`,
            type: "stock_in",
            adjustment: restoreQty,
            referenceId: invoiceId,
            referenceType: "invoice",
            createdBy: req.user,
          });
        }

        await inventoryRecord.save();
      }
    }

    const skipPaymentSync = req.body.skipPaymentSync !== undefined
      ? String(req.body.skipPaymentSync).trim().toLowerCase() === "true"
      : true; // Default to true so regular edits don't magically change payments without explicit payment actions

    // ✅ Update existing invoice payment amount if invoice total changed (non-exchange)
    if (invoice && !isExchangeTransaction && !skipPaymentSync) {
      const latestPayment = await InvoicePayment.findOne({ invoiceId })
        .sort({ createdAt: -1 });

      if (latestPayment) {
        const oldTotalAmount = Number(existingInvoice.TotalAmount || 0);
        const newTotalAmount = Number(invoice.TotalAmount || 0);
        const delta = Number((newTotalAmount - oldTotalAmount).toFixed(2));
        const deltaNote =
          delta < 0
            ? `Refunded ₹${Math.abs(delta)}`
            : delta > 0
              ? `Additional ₹${delta} pending`
              : "No amount change";

        const nextUpdate = {
          amount: newTotalAmount,
          notes: `Payment updated due to Invoice Edit (New Total: ₹${newTotalAmount}). ${deltaNote}`,
          received_on: new Date(),
        };

        if (
          latestPayment.payment_method === "MIXED" &&
          (latestPayment.cashAmount || 0) + (latestPayment.upiAmount || 0) > 0
        ) {
          const totalSplit = (latestPayment.cashAmount || 0) + (latestPayment.upiAmount || 0);
          const scale = newTotalAmount / totalSplit;
          const scaledCash = Number(((latestPayment.cashAmount || 0) * scale).toFixed(2));
          const scaledUpi = Number((newTotalAmount - scaledCash).toFixed(2));
          nextUpdate.cashAmount = Math.max(0, scaledCash);
          nextUpdate.upiAmount = Math.max(0, scaledUpi);
        }

        await InvoicePayment.findByIdAndUpdate(latestPayment._id, {
          $set: nextUpdate,
        });
      }
    }

    const existingCommissions = await Commission.find({ invoiceId }).select("items");
    await createCommissionRecordsForInvoiceItems({
      invoiceId,
      items,
      createdBy: req.user,
      existingCommissions,
    });
    // COMMISSION CALCULATION END

    await syncCreditNotificationForInvoice(invoiceId);

    res.status(200).json({
      success: true,
      message: isExchangeTransaction
        ? 'Invoice updated - Exchange transaction'
        : 'Invoice updated successfully',
      data: invoice,
      isExchange: isExchangeTransaction,
      exchangeData: isExchangeTransaction ? {
        amountDifference: updateData.amountDifference,
        requiresPayment: updateData.amountDifference > 0,
        requiresRefund: updateData.amountDifference < 0,
        oldTotal: Number(existingInvoice.TotalAmount),
        newTotal: Number(calculatedTotalAmount)
      } : null,
      exchangedItems
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error updating invoice", error: err.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: "billFrom",
        model: "User",
        select: "firstName lastName email phone profileImage address",
      })
      .populate("billTo", "name email phone billingAddress image")
      .populate(
        "bank",
        "accountHoldername bankName branchName accountNumber IFSCCode"
      )

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    // Customer details
    const customerDetails =
      invoice.customerId &&
        typeof invoice.customerId === "object" &&
        invoice.customerId.name
        ? {
          id: invoice.customerId._id,
          name: invoice.customerId.name || "",
          email: invoice.customerId.email || null,
          phone: invoice.customerId.phone || null,
          image: invoice.customerId.image
            ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, "/")}`
            : "",
          billingAddress: invoice.customerId.billingAddress || null,
        }
        : invoice.customerId === "UNKNOWN"
          ? {
            id: null,
            name: "UNKNOWN",
            email: null,
            phone: "N/A",
            image: "",
            billingAddress: null,
          }
          : null;

    // BillFrom details (from User model)
    const billFromDetails = invoice.billFrom
      ? {
        id: invoice.billFrom._id,
        name: `${invoice.billFrom.firstName || ""} ${invoice.billFrom.lastName || ""
          }`.trim(),
        email: invoice.billFrom.email || null,
        phone: invoice.billFrom.phone || null,
        address: invoice.billFrom.address || null,
        image: invoice.billFrom.profileImage
          ? `${baseUrl}${invoice.billFrom.profileImage.replace(/\\/g, "/")}`
          : "",
      }
      : null;

    // BillTo details
    const billToDetails = invoice.billTo
      ? {
        id: invoice.billTo._id,
        name: invoice.billTo.name || "",
        email: invoice.billTo.email || null,
        phone: invoice.billTo.phone || null,
        billingAddress: invoice.billTo.billingAddress || null,
        image: invoice.billTo.image
          ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, "/")}`
          : "",
      }
      : null;

    // Bank details
    const bankDetails = invoice.bank
      ? {
        id: invoice.bank.id || "",
        accountHoldername: invoice.bank.accountHoldername || "",
        bankName: invoice.bank.bankName || "",
        branchName: invoice.bank.branchName || "",
        accountNumber: invoice.bank.accountNumber || "",
        IFSCCode: invoice.bank.IFSCCode || "",
      }
      : null;

    // Enrich invoice snapshots with current print metadata when older rows are incomplete.
    const normalizedItems = normalizeInvoiceItems(invoice.items);
    const normalizedExchangeItems = normalizeInvoiceItems(invoice.exchangeOriginalItems);

    const allVariantIds = [
      ...normalizedItems.map((i) => i?.variantId).filter(Boolean),
      ...normalizedExchangeItems.map((i) => i?.variantId).filter(Boolean),
    ];
    const allProductIds = [
      ...normalizedItems.map((i) => i?.product_id).filter(Boolean),
      ...normalizedExchangeItems.map((i) => i?.product_id).filter(Boolean),
    ];

    const uniqueVariantIds = Array.from(
      new Set(allVariantIds.map((id) => String(id)))
    );
    const uniqueProductIds = Array.from(
      new Set(allProductIds.map((id) => String(id)))
    );

    const variantMrpMap = new Map();
    const productHsnMap = new Map();
    const [variants, products] = await Promise.all([
      uniqueVariantIds.length > 0
        ? ProductVariant.find({
          _id: { $in: uniqueVariantIds },
        })
          .select("_id mrp")
          .lean()
        : [],
      uniqueProductIds.length > 0
        ? Product.find({ _id: { $in: uniqueProductIds } })
          .select("_id hsn_code")
          .lean()
        : [],
    ]);

    variants.forEach((v) => {
      variantMrpMap.set(String(v._id), Number(v.mrp || 0));
    });
    products.forEach((product) => {
      productHsnMap.set(String(product._id), String(product.hsn_code || "").trim());
    });

    const printMetadata = { variantMrpMap, productHsnMap };
    const enrichedItems = enrichInvoicePrintItems(invoice.items, printMetadata);

    const enrichedExchangeItems = enrichInvoicePrintItems(
      invoice.exchangeOriginalItems,
      printMetadata
    );


    // Response object
    const responseData = {
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customer: customerDetails,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      referenceNo: invoice.referenceNo,
      status: invoice.status,
      payment_method: invoice.payment_method,
      taxableAmount: invoice.taxableAmount,
      totalDiscount: invoice.totalDiscount,
      overall_discount: invoice.overall_discount,
      vat: invoice.vat,
      TotalAmount: invoice.TotalAmount,
      roundOff: invoice.roundOff,
      items: enrichedItems,
      exchangeOriginalItems: enrichedExchangeItems || [],
      itemsCount: invoice.items.length,
      billFrom: billFromDetails,
      billTo: billToDetails,
      bank: bankDetails,
      notes: invoice.notes,
      termsAndCondition: invoice.termsAndCondition,
      customerGstin: invoice.customerGstin || "",
      ewayBillNumber: invoice.ewayBillNumber || "",
      shippingAddress: normalizeInvoiceShippingAddress(invoice.shippingAddress),
      taxType: invoice.taxType || "GST",       // ✅ Return taxType
      gstType: invoice.gstType || "Exclusive", // ✅ Return gstType
      cashAmount: invoice.cashAmount || 0,
      cardAmount: invoice.cardAmount || 0,
      upiAmount: invoice.upiAmount || 0,
      exchangeOldTotal: invoice.exchangeOldTotal ?? null,
      exchangeNewTotal: invoice.exchangeNewTotal ?? null,
      amountDifference: invoice.amountDifference ?? null,
      isExchange: invoice.isExchange ?? false,
      exchangePending: invoice.exchangePending ?? false,

      // ----------------------------
      // Recurring fields (new)
      // ----------------------------
      // isRecurring: invoice.isRecurring,                                     // hide recurring
      // repeatEvery: invoice.isRecurring ? invoice.repeatEvery : null,
      // customIntervalNumber: invoice.isRecurring
      //   ? invoice.customIntervalNumber
      //   : null,
      // customIntervalType: invoice.isRecurring
      //   ? invoice.customIntervalType
      //   : null,
      // startOn: invoice.isRecurring ? invoice.startOn : null,
      // endsOn: invoice.isRecurring ? invoice.endsOn : null,
      // neverExpire: invoice.isRecurring ? invoice.neverExpire : null,
      // stopped: invoice.isRecurring ? invoice.stopped : null,
      // nextRecurringDate: invoice.isRecurring ? invoice.nextRecurringDate : null,

      // sign_type: invoice.sign_type,             // hide signature
      // signature: signatureDetails,
      createdAt: toIsoWithoutMilliseconds(invoice.createdAt),
      updatedAt: toIsoWithoutMilliseconds(invoice.updatedAt),
    };

    res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: responseData,
    });
  } catch (err) {
    console.error("Get invoice error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: err.message,
    });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search = "",
      customerId,
      startDate,
      endDate,
      payment_method,
    } = req.query;

    const userId = req.user?._id || req.user;
    const skip = (page - 1) * limit;

    const query = {
      isDeleted: false,
      parentInvoice: null,
    };

    if (
      status &&
      [
        "DRAFT",
        "UNPAID",
        "SENT",
        "PAID",
        "OVERDUE",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_PAID",
        "PENDING",
        "EXCHANGE", // ✅ Added EXCHANGE status
      ].includes(status)
    ) {
      query.status = status;
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    if (payment_method) {
      query.payment_method = payment_method;
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      const matchingCustomers = await Customer.find({
        userId,
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }],
      })
        .select("_id")
        .lean();
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$or = [
        { invoiceNumber: searchRegex },
        { referenceNo: searchRegex },
        { "items.name": searchRegex },
        { notes: searchRegex },
        { "customerId.phone": searchRegex },
      ];

      if (customerIds.length > 0) {
        query.$or.push(
          { billTo: { $in: customerIds } },
          { customerId: { $in: customerIds } }
        );
      }
    }

    const total = await Invoice.countDocuments(query);

    const invoices = await Invoice.find(query)
      .populate("billFrom", "name email phone companyName")
      .populate("billTo", "name email phone billingAddress image")
      .populate(
        "bank",
        "accountHoldername bankName branchName accountNumber IFSCCode"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get payments grouped by invoice
    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoiceIds } } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
          lastPaymentDate: { $max: "$received_on" },
        },
      },
    ]);

    // Map payments to invoice IDs for quick lookup
    const paymentMap = {};
    payments.forEach((p) => {
      paymentMap[p._id.toString()] = {
        totalPaid: p.totalPaid,
        lastPaymentDate: p.lastPaymentDate,
      };
    });

    const lastInvoice = await Invoice.findOne()
      .sort({ invoiceNumber: -1 })
      .select("invoiceNumber");

    let nextInvoiceNumber = "INV-000001";
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1]);
      nextInvoiceNumber = `INV-${String(lastNumber + 1).padStart(6, "0")}`;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    const formattedInvoices = invoices.map((invoice) => {
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, "0");
        const month = d.toLocaleString("default", { month: "short" });
        const year = d.getFullYear();
        return `${day}, ${month} ${year}`;
      };

      const customerDetails =
        invoice.customerId &&
          typeof invoice.customerId === "object" &&
          invoice.customerId.name
          ? {
            id: invoice.customerId._id,
            name: invoice.customerId.name || "",
            email: invoice.customerId.email || null,
            phone: invoice.customerId.phone || null,
            image: invoice.customerId.image
              ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, "/")}`
              : "",
          }
          : invoice.customerId === "UNKNOWN"
            ? {
              id: null,
              name: "UNKNOWN",
              email: null,
              phone: "N/A",
              image: "",
            }
            : null;

      const billFromDetails = invoice.billFrom
        ? {
          id: invoice.billFrom._id,
          name: invoice.billFrom.name || "",
          email: invoice.billFrom.email || null,
          phone: invoice.billFrom.phone || null,
          companyName: invoice.billFrom.companyName || null,
        }
        : null;

      const billToDetails = invoice.billTo
        ? {
          id: invoice.billTo._id,
          name: invoice.billTo.name || "",
          email: invoice.billTo.email || null,
          phone: invoice.billTo.phone || null,
          billingAddress: invoice.billTo.billingAddress || null,
          image: invoice.billTo.image
            ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, "/")}`
            : "",
        }
        : null;

      const bankDetails = invoice.bank
        ? {
          accountHoldername: invoice.bank.accountHoldername || "",
          bankName: invoice.bank.bankName || "",
          branchName: invoice.bank.branchName || "",
          accountNumber: invoice.bank.accountNumber || "",
          IFSCCode: invoice.bank.IFSCCode || "",
        }
        : null;

      const signatureImage = invoice.signatureImage
        ? `${baseUrl}${invoice.signatureImage.replace(/\\/g, "/")}`
        : null;

      const signatureDetails =
        invoice.sign_type === "eSignature"
          ? {
            name: invoice.signatureName || null,
            image: signatureImage,
          }
          : null;

      const formattedItems = invoice.items.map((item) => ({
        id: item._id,
        productId: item.productId?._id || null,
        name: item.name || item.productId?.name || "",
        description: item.productId?.description || "",
        key: item.key || 0,
        quantity: item.quantity,
        units: item.units,
        unit: item.unit
          ? {
            id: item.unit._id,
            name: item.unit.name,
            symbol: item.unit.symbol,
          }
          : null,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        taxInfo: item.taxInfo,
        amount: item.amount,
        discountType: item.discountType,
      }));

      // Payment info
      const paymentInfo = paymentMap[invoice._id.toString()] || {
        totalPaid: 0,
        lastPaymentDate: null,
      };
      const rawTotalPaid = Number(paymentInfo.totalPaid || 0);
      const invoiceTotalAmount = Number(invoice.TotalAmount || 0);
      const normalizedTotalPaid =
        invoice.status === "EXCHANGE"
          ? Math.min(rawTotalPaid, invoiceTotalAmount)
          : rawTotalPaid;

      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customer: customerDetails,
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        referenceNo: invoice.referenceNo,
        status: invoice.status,
        payment_method: invoice.payment_method,
        cashAmount: invoice.cashAmount || 0,
        cardAmount: invoice.cardAmount || 0,
        upiAmount: invoice.upiAmount || 0,
        taxableAmount: invoice.taxableAmount,
        totalDiscount: invoice.totalDiscount,
        vat: invoice.vat,
        TotalAmount: invoice.TotalAmount,
        roundOff: invoice.roundOff,
        totalPaid: normalizedTotalPaid,
        remainingBalance: Math.max(invoiceTotalAmount - normalizedTotalPaid, 0),
        lastPaymentDate: formatDate(paymentInfo.lastPaymentDate),
        items: formattedItems,
        itemsCount: invoice.items.length,
        billFrom: billFromDetails,
        billTo: billToDetails,
        bank: bankDetails,
        notes: invoice.notes,
        termsAndCondition: invoice.termsAndCondition,
        customerGstin: invoice.customerGstin || "",
        ewayBillNumber: invoice.ewayBillNumber || "",
        shippingAddress: normalizeInvoiceShippingAddress(invoice.shippingAddress),
        isRecurring: invoice.isRecurring,
        recurring: invoice.isRecurring ? invoice.recurring : null,
        recurringDuration: invoice.isRecurring
          ? invoice.recurringDuration
          : null,
        sign_type: invoice.sign_type,
        signature: signatureDetails,
        createdAt: toIsoWithoutMilliseconds(invoice.createdAt),
        updatedAt: toIsoWithoutMilliseconds(invoice.updatedAt),
      };
    });

    res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
      data: {
        invoices: formattedInvoices,
        nextInvoiceNumber,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("List invoices error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: err.message,
    });
  }
};

const getNextInvoiceNumber = async (req, res) => {
  try {
    // 1. Fetch general settings
    const [invoicePrefixSetting, invoiceNumberTypeSetting] = await Promise.all([
      GeneralSetting.findOne({ key: "invoicePrefix" }).lean(),
      GeneralSetting.findOne({ key: "invoiceNumberType" }).lean(),
    ]);

    const invoicePrefix =
      invoicePrefixSetting?.value &&
        typeof invoicePrefixSetting.value === "string"
        ? invoicePrefixSetting.value
        : "INV_";

    const invoiceNumberType =
      invoiceNumberTypeSetting?.value &&
        typeof invoiceNumberTypeSetting.value === "string"
        ? invoiceNumberTypeSetting.value
        : "auto";

    let nextInvoiceNumber = null;

    const lastInvoice = await Invoice.findOne({})
      .sort({ createdAt: -1 })
      .select("invoiceNumber")
      .lean();

    let lastNumber = 0;

    if (lastInvoice?.invoiceNumber) {
      // Extract number from last invoice, e.g., INV-000123 → 123
      const match = lastInvoice.invoiceNumber.match(/\d+$/);
      if (match) {
        lastNumber = parseInt(match[0], 10);
      }
    }

    const nextNumber = lastNumber + 1;
    nextInvoiceNumber = `${invoicePrefix}${String(nextNumber).padStart(
      6,
      "0"
    )}`;

    return res.status(200).json({
      success: true,
      message: "Next invoice number fetched successfully",
      data: {
        invoicePrefix,
        invoiceNumberType,
        nextInvoiceNumber,
      },
    });
  } catch (err) {
    console.error("Error fetching next invoice number:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching next invoice number",
      error: err.message,
    });
  }
};

const getNextExchangeInvoiceNumber = async (req, res) => {
  try {
    const prefix = "EXC-";
    const lastExchange = await Invoice.findOne({
      invoiceNumber: { $regex: `^${prefix}` },
    })
      .sort({ createdAt: -1 })
      .select("invoiceNumber")
      .lean();

    let lastNumber = 0;
    if (lastExchange?.invoiceNumber) {
      const match = lastExchange.invoiceNumber.match(/\d+$/);
      if (match) {
        lastNumber = parseInt(match[0], 10);
      }
    }

    const nextNumber = lastNumber + 1;
    const nextInvoiceNumber = `${prefix}${String(nextNumber).padStart(6, "0")}`;

    return res.status(200).json({
      success: true,
      message: "Next exchange invoice number fetched successfully",
      data: {
        invoicePrefix: prefix,
        invoiceNumberType: "auto",
        nextInvoiceNumber,
      },
    });
  } catch (err) {
    console.error("Error fetching next exchange invoice number:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching next exchange invoice number",
      error: err.message,
    });
  }
};

const getChildInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search = "",
      customerId,
      startDate,
      endDate,
      payment_method,
    } = req.query;

    const userId = req.user._id;
    const skip = (page - 1) * limit;

    const query = {
      isDeleted: false,
      parentInvoice: { $ne: null },
    };

    if (
      status &&
      [
        "DRAFT",
        "SENT",
        "PAID",
        "OVERDUE",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_PAID",
      ].includes(status)
    ) {
      query.status = status;
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    if (payment_method) {
      query.payment_method = payment_method;
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { invoiceNumber: searchRegex },
        { referenceNo: searchRegex },
        { "items.name": searchRegex },
        { notes: searchRegex },
        { "customerId.name": searchRegex },
      ];
    }

    const total = await Invoice.countDocuments(query);

    const invoices = await Invoice.find(query)
      .populate("billFrom", "name email phone companyName")
      .populate("billTo", "name email phone billingAddress image")
      .populate(
        "bank",
        "accountHoldername bankName branchName accountNumber IFSCCode"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get payments grouped by invoice
    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoiceIds } } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
          lastPaymentDate: { $max: "$received_on" },
        },
      },
    ]);

    // Map payments to invoice IDs for quick lookup
    const paymentMap = {};
    payments.forEach((p) => {
      paymentMap[p._id.toString()] = {
        totalPaid: p.totalPaid,
        lastPaymentDate: p.lastPaymentDate,
      };
    });

    const lastInvoice = await Invoice.findOne()
      .sort({ invoiceNumber: -1 })
      .select("invoiceNumber");

    let nextInvoiceNumber = "INV-000001";
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1]);
      nextInvoiceNumber = `INV-${String(lastNumber + 1).padStart(6, "0")}`;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    const formattedInvoices = invoices.map((invoice) => {
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, "0");
        const month = d.toLocaleString("default", { month: "short" });
        const year = d.getFullYear();
        return `${day}, ${month} ${year}`;
      };

      const customerDetails =
        invoice.customerId &&
          typeof invoice.customerId === "object" &&
          invoice.customerId.name
          ? {
            id: invoice.customerId._id,
            name: invoice.customerId.name || "",
            email: invoice.customerId.email || null,
            phone: invoice.customerId.phone || null,
            image: invoice.customerId.image
              ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, "/")}`
              : "",
          }
          : invoice.customerId === "UNKNOWN"
            ? {
              id: null,
              name: "UNKNOWN",
              email: null,
              phone: "N/A",
              image: "",
            }
            : null;

      const billFromDetails = invoice.billFrom
        ? {
          id: invoice.billFrom._id,
          name: invoice.billFrom.name || "",
          email: invoice.billFrom.email || null,
          phone: invoice.billFrom.phone || null,
          companyName: invoice.billFrom.companyName || null,
        }
        : null;

      const billToDetails = invoice.billTo
        ? {
          id: invoice.billTo._id,
          name: invoice.billTo.name || "",
          email: invoice.billTo.email || null,
          phone: invoice.billTo.phone || null,
          billingAddress: invoice.billTo.billingAddress || null,
          image: invoice.billTo.image
            ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, "/")}`
            : "",
        }
        : null;

      const bankDetails = invoice.bank
        ? {
          accountHoldername: invoice.bank.accountHoldername || "",
          bankName: invoice.bank.bankName || "",
          branchName: invoice.bank.branchName || "",
          accountNumber: invoice.bank.accountNumber || "",
          IFSCCode: invoice.bank.IFSCCode || "",
        }
        : null;

      const signatureImage = invoice.signatureImage
        ? `${baseUrl}${invoice.signatureImage.replace(/\\/g, "/")}`
        : null;

      const signatureDetails =
        invoice.sign_type === "eSignature"
          ? {
            name: invoice.signatureName || null,
            image: signatureImage,
          }
          : null;

      const formattedItems = invoice.items.map((item) => ({
        id: item._id,
        productId: item.productId?._id || null,
        name: item.name || item.productId?.name || "",
        description: item.productId?.description || "",
        key: item.key || 0,
        quantity: item.quantity,
        units: item.units,
        unit: item.unit
          ? {
            id: item.unit._id,
            name: item.unit.name,
            symbol: item.unit.symbol,
          }
          : null,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        taxInfo: item.taxInfo,
        amount: item.amount,
        discountType: item.discountType,
      }));

      // Payment info
      const paymentInfo = paymentMap[invoice._id.toString()] || {
        totalPaid: 0,
        lastPaymentDate: null,
      };

      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customer: customerDetails,
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        referenceNo: invoice.referenceNo,
        status: invoice.status,
        payment_method: invoice.payment_method,
        taxableAmount: invoice.taxableAmount,
        totalDiscount: invoice.totalDiscount,
        vat: invoice.vat,
        TotalAmount: invoice.TotalAmount,
        roundOff: invoice.roundOff,
        totalPaid: paymentInfo.totalPaid,
        remainingBalance: invoice.TotalAmount - paymentInfo.totalPaid,
        lastPaymentDate: formatDate(paymentInfo.lastPaymentDate),
        items: formattedItems,
        itemsCount: invoice.items.length,
        billFrom: billFromDetails,
        billTo: billToDetails,
        bank: bankDetails,
        notes: invoice.notes,
        termsAndCondition: invoice.termsAndCondition,
        customerGstin: invoice.customerGstin || "",
        ewayBillNumber: invoice.ewayBillNumber || "",
        shippingAddress: normalizeInvoiceShippingAddress(invoice.shippingAddress),
        isRecurring: invoice.isRecurring,
        recurring: invoice.isRecurring ? invoice.recurring : null,
        recurringDuration: invoice.isRecurring
          ? invoice.recurringDuration
          : null,
        sign_type: invoice.sign_type,
        signature: signatureDetails,
        createdAt: toIsoWithoutMilliseconds(invoice.createdAt),
        updatedAt: toIsoWithoutMilliseconds(invoice.updatedAt),
      };
    });

    res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
      data: {
        invoices: formattedInvoices,
        nextInvoiceNumber,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("List invoices error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: err.message,
    });
  }
};

const listInvoicesMinimal = async (req, res) => {
  try {
    const { search = "" } = req.body;
    const userId = req.user;

    // Get all invoice IDs that already have credit notes
    const creditNoteInvoices = await CreditNote.find({
      isDeleted: false,
    }).distinct("invoiceId");

    // Build base query
    const query = {
      isDeleted: false,
      _id: { $nin: creditNoteInvoices }, // Exclude invoices in credit notes
    };

    // Add search filter if search term exists
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } },
        { "customerId.name": { $regex: search, $options: "i" } },
      ];
    }

    // Fetch invoices (limit to last 20 if no search)
    const invoices = await Invoice.find(query)
      .select(
        "_id invoiceNumber referenceNo invoiceDate status TotalAmount customerId"
      )
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 20);

    // Get payment info for these invoices
    const paymentDetails = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoices.map((i) => i._id) } } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    // Create a quick lookup map for payments
    const paymentMap = paymentDetails.reduce((map, p) => {
      map[p._id.toString()] = p.totalPaid;
      return map;
    }, {});

    // Format response
    const formattedInvoices = invoices.map((invoice) => {
      const totalPaid = paymentMap[invoice._id.toString()] || 0;
      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        referenceNo: invoice.referenceNo,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        totalAmount: invoice.TotalAmount,
        customer:
          invoice.customerId &&
            typeof invoice.customerId === "object" &&
            invoice.customerId.name
            ? { id: invoice.customerId._id, name: invoice.customerId.name }
            : invoice.customerId === "UNKNOWN"
              ? { id: null, name: "UNKNOWN" }
              : null,
        payment: {
          totalPaid,
          remaining: invoice.TotalAmount - totalPaid,
        },
      };
    });

    res.status(200).json({
      success: true,
      message: search
        ? "Search results for invoices without credit notes retrieved successfully"
        : "Last 20 invoices without credit notes retrieved successfully",
      data: formattedInvoices,
      meta: {
        count: invoices.length,
        isSearchResult: !!search,
      },
    });
  } catch (err) {
    console.error("List minimal invoices error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: err.message,
    });
  }
};

const listInvoicesMinimalWithoutChallan = async (req, res) => {
  try {
    const { search = "" } = req.body;
    const userId = req.user;

    const creditNoteInvoices = await CreditNote.find({
      isDeleted: false,
    }).distinct("invoiceId");

    const challanInvoices = await DeliveryChallan.find({
      isDeleted: false,
    }).distinct("invoiceId");

    const excludedInvoiceIds = [...challanInvoices];

    // Base query
    const query = {
      isDeleted: false,
      _id: { $nin: excludedInvoiceIds },
    };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } },
        { "customerId.name": { $regex: search, $options: "i" } },
      ];
    }

    const invoices = await Invoice.find(query)
      .select(
        "_id invoiceNumber referenceNo invoiceDate status TotalAmount customerId"
      )
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 20);

    const paymentDetails = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoices.map((i) => i._id) } } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    const paymentMap = paymentDetails.reduce((map, p) => {
      map[p._id.toString()] = p.totalPaid;
      return map;
    }, {});

    const formattedInvoices = invoices.map((invoice) => {
      const totalPaid = paymentMap[invoice._id.toString()] || 0;
      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        referenceNo: invoice.referenceNo,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        totalAmount: invoice.TotalAmount,
        customer:
          invoice.customerId &&
            typeof invoice.customerId === "object" &&
            invoice.customerId.name
            ? { id: invoice.customerId._id, name: invoice.customerId.name }
            : invoice.customerId === "UNKNOWN"
              ? { id: null, name: "UNKNOWN" }
              : null,
        payment: {
          totalPaid,
          remaining: invoice.TotalAmount - totalPaid,
        },
      };
    });

    res.status(200).json({
      success: true,
      message: search
        ? "Search results for invoices without credit notes and challans retrieved successfully"
        : "Last 20 invoices without credit notes and challans retrieved successfully",
      data: formattedInvoices,
      meta: {
        count: invoices.length,
        isSearchResult: !!search,
      },
    });
  } catch (err) {
    console.error("List invoices without challans error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices without challans",
      error: err.message,
    });
  }
};

const getInvoicePaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Invoice ID format",
      });
    }

    const [invoice, paymentModes] = await Promise.all([
      Invoice.findOne({
        _id: id,
        isDeleted: false,
      })
        .select(
          "_id invoiceNumber referenceNo invoiceDate status TotalAmount customerId"
        )
        .lean(),

      PaymentMode.find({ status: true }).select("name slug status"),
    ]);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found or has been deleted",
      });
    }

    const paymentDetails = await InvoicePayment.aggregate([
      { $match: { invoiceId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    const totalPaid =
      paymentDetails.length > 0 ? paymentDetails[0].totalPaid : 0;
    const paymentCount =
      paymentDetails.length > 0 ? paymentDetails[0].paymentCount : 0;

    // Format date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, "0");
      const month = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    const paymentMethods = paymentModes.map((mode) => ({
      id: mode._id,
      name: mode.name,
      slug: mode.slug,
      status: mode.status,
    }));
    // Format response
    const response = {
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      referenceNo: invoice.referenceNo,
      invoiceDate: invoice.invoiceDate,
      status: invoice.status,
      totalAmount: invoice.TotalAmount,
      customer:
        invoice.customerId &&
          typeof invoice.customerId === "object" &&
          invoice.customerId.name
          ? {
            id: invoice.customerId._id,
            name: invoice.customerId.name,
            email: invoice.customerId.email || null,
            phone: invoice.customerId.phone || null,
          }
          : invoice.customerId === "UNKNOWN"
            ? {
              id: null,
              name: "UNKNOWN",
              email: null,
              phone: "N/A",
            }
            : null,
      payment: {
        totalPaid,
        remaining: invoice.TotalAmount - totalPaid,
        paymentCount,
        isFullyPaid: totalPaid >= invoice.TotalAmount,
        isPartiallyPaid: totalPaid > 0 && totalPaid < invoice.TotalAmount,
      },
      paymentMethods: paymentMethods,
    };

    res.status(200).json({
      success: true,
      message: "Invoice minimal details retrieved successfully",
      data: response,
      // Add payment modes as a separate array in the response
      paymentModes: paymentModes.map((mode) => ({
        id: mode._id,
        name: mode.name,
        slug: mode.slug,
        status: mode.status,
      })),
    });
  } catch (err) {
    console.error("Get invoice minimal error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice details",
      error: err.message,
    });
  }
};

const deleteInvoiceById = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return false;

  await InvoicePayment.deleteMany({ invoiceId: invoice._id });

  if (["UNPAID", "PENDING"].includes(invoice.status)) {
    await CreditNote.deleteMany({ invoiceId: invoice._id });
  }

  await Invoice.findByIdAndDelete(invoice._id);
  await resolveNotificationForInvoice(invoice._id);
  return true;
};

const deleteInvoice = async (req, res) => {
  try {
    const ok = await deleteInvoiceById(req.params.id);
    if (!ok) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json({
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting invoice:", err);
    res
      .status(500)
      .json({ message: "Error deleting invoice", error: err.message });
  }
};

const bulkDeleteInvoices = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const invoices = await Invoice.find({}).select('_id');
      targetIds = invoices.map(i => i._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: "Please provide invoice ids." });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteInvoiceById(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: "Invoices deleted",
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    console.error("Error bulk deleting invoices:", err);
    return res.status(500).json({ message: "Error deleting invoices", error: err.message });
  }
};

const convertQuotationToInvoice = async (req, res) => {
  try {
    const { quotationId } = req.params; // passed in URL
    const userId = req.user;
    // 1. Get quotation
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      throw new Error("Quotation not found");
    }

    // 2. Check if already converted
    if (quotation.invoiceId) {
      throw new Error("Quotation already converted to invoice");
    }

    // 3. Create invoice from quotation data
    const invoiceItems = (quotation.items || []).map((item) => ({
      rowId: item.id || new mongoose.Types.ObjectId().toString(),
      product_id: item.product_id || undefined,
      variantId: item.variantId || undefined,
      variantName: item.variantName || undefined,
      variantDesignNo: item.variantDesignNo || undefined,
      variantColor: item.variantColor || undefined,
      variantSize: item.variantSize || undefined,
      name: item.name,
      hsn_code: item.hsn_code,
      unit: item.unit,
      qty: item.qty,
      rate: item.rate,
      discount: item.discount || 0,
      tax: item.tax || 0,
      tax_group_id: item.tax_group_id,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      amount: item.amount || (item.qty * item.rate),
      staffId: item.staffId || null,
    }));

    const invoiceItemsWithSnapshots = await attachCostSnapshotsToItems(invoiceItems);

    const invoice = new Invoice({
      customerId: quotation.billTo || quotation.customerId || userId,
      invoiceDate: new Date(),
      dueDate: quotation.expiryDate,
      referenceNo: quotation.referenceNo,
      items: invoiceItemsWithSnapshots,
      status: "DRAFT",
      taxableAmount: quotation.taxableAmount,
      TotalAmount: quotation.TotalAmount,
      vat: quotation.vat,
      totalDiscount: quotation.totalDiscount,
      roundOff: quotation.roundOff,
      bank: quotation.bank,
      notes: quotation.notes,
      termsAndCondition: quotation.termsAndCondition,
      sign_type: quotation.sign_type || "none",
      signatureName:
        quotation.sign_type === "eSignature" ? quotation.signatureName : null,
      signatureImage: quotation.signatureImage || null,
      signatureId:
        quotation.sign_type === "digitalSignature"
          ? quotation.savedSignatureId
          : null,
      billFrom: quotation.billFrom,
      billTo: quotation.billTo,
      userId: quotation.userId,
      // store the quotation id in the invoice
      quotationId: quotation._id,
    });

    // Generate publicShareId eagerly
    const { getOrCreatePublicShareId } = require('../../../services/publicShareService');
    await getOrCreatePublicShareId(invoice);

    await invoice.save();

    // 4. Save invoiceId in quotation
    quotation.invoiceId = invoice._id;
    await quotation.save();

    res.status(201).json({
      message: "Quotation converted to invoice successfully",
      data: invoice,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error converting quotation to invoice",
      error: err.message,
    });
  }
};

const recordInvoicePayment = async (req, res) => {
  try {
    const { invoiceId, payment_method, received_on, notes, cashAmount, cardAmount, upiAmount, creditAmount } = req.body;
    const updateExistingPayment = String(req.body.updateExistingPayment || "")
      .trim()
      .toLowerCase() === "true";
    const finalizePayment = String(req.body.finalize || "")
      .trim()
      .toLowerCase() === "true";

    const rawAmount = Number(req.body.amount);
    const amount = toMoney(rawAmount);

    const normalizedCreditAmount = toMoney(Number(creditAmount || 0));

    if (
      !invoiceId ||
      amount < 0 ||
      (amount <= 0 && !(payment_method === "CREDIT" && normalizedCreditAmount > 0) && !updateExistingPayment)
    ) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // ✅ Deduct stock once before accepting payment (only if not already deducted)
    for (const item of invoice.items || []) {
      if (!item.product_id || !item.variantId) continue;

      const { inventory } = await getOrCreateInventoryRecord({
        productId: item.product_id,
        variantId: item.variantId,
        userId: invoice.userId || req.user,
        unitId: item.unit || null,
        createdBy: req.user,
        note: `Inventory auto-created from payment settlement for Invoice #${invoice.invoiceNumber || invoice.referenceNo || ""}`,
      });

      const alreadyDeducted = (inventory.inventory_history || []).some(
        (h) =>
          String(h.referenceId) === String(invoice._id) &&
          (h.referenceType === "invoice" || h.referenceType === "exchange") &&
          h.type === "stock_out"
      );

      if (alreadyDeducted) continue;

      const previousQuantity = inventory.quantity;
      inventory.quantity -= item.qty;
      inventory.inventory_history.push({
        unitId: item.unit || null,
        quantity: previousQuantity,
        notes: `Stock reduced due to Invoice #${invoice.referenceNo || invoice._id}`,
        type: "stock_out",
        adjustment: -item.qty,
        referenceId: invoice._id,
        referenceType: "invoice",
        createdBy: req.user,
      });
      await inventory.save();
    }

    // 🔒 Total paid till now
    const payments = await InvoicePayment.find({ invoiceId });
    const totalPaid = Number(
      payments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)
    );

    const invoiceTotal = Number(
      Number(invoice.TotalAmount || 0).toFixed(2)
    );

    const requiresManualVerification = (method, pendingUpiAmount = 0) => {
      const normalizedMethod = String(method || "").toUpperCase();
      return (
        normalizedMethod === "UPI" ||
        normalizedMethod === "PHONEPE" ||
        (normalizedMethod === "MIXED" && Number(pendingUpiAmount || 0) > 0)
      );
    };


    if (totalPaid >= invoiceTotal && amount > 0) {
      return res.status(400).json({ message: "Invoice already paid" });
    }

    if (toMoney(totalPaid + amount) > invoiceTotal) {
      if (updateExistingPayment && amount <= 0) {
        // Allow updating payment method when invoice total decreases or stays the same
      } else {
        return res.status(400).json({
          message: "Payment exceeds remaining balance",
        });
      }
    }

    const latestPayment = await InvoicePayment.findOne({ invoiceId }).sort({ createdAt: -1 });
    const existingCreditPayment =
      invoice.payment_method === "CREDIT"
        ? await InvoicePayment.findOne({ invoiceId, payment_method: "CREDIT" }).sort({ createdAt: -1 })
        : null;
    const shouldMergeCreditPayment =
      invoice.payment_method === "CREDIT" &&
      existingCreditPayment &&
      Number(existingCreditPayment.creditAmount || 0) > 0;
    const paymentToUpdate = shouldMergeCreditPayment ? existingCreditPayment : latestPayment;

    if (updateExistingPayment || shouldMergeCreditPayment) {

      if (paymentToUpdate) {
        let newAmount = toMoney(totalPaid + amount);
        if (updateExistingPayment && amount <= 0) {
          newAmount = Math.min(newAmount, invoiceTotal);
        }
        const updateFields = {
          amount: newAmount,
          payment_method: payment_method || paymentToUpdate.payment_method,
          received_on: received_on ? new Date(received_on) : new Date(),
          notes: notes || `Payment updated due to Invoice Edit (New Total: ₹${newAmount})`,
        };

        if (shouldMergeCreditPayment) {
          updateFields.payment_method = payment_method || paymentToUpdate.payment_method;
          updateFields.notes =
            notes || `Credit invoice payment settled via ${payment_method}. Total received: Rs.${newAmount}`;
          updateFields.creditAmount = Math.max(0, Number((invoiceTotal - newAmount).toFixed(2)));
        }

        const effectivePaymentMethod =
          updateFields.payment_method || paymentToUpdate.payment_method;

        if (effectivePaymentMethod === "MIXED") {
          const baseCash = Number(paymentToUpdate.cashAmount || 0);
          const baseCard = Number(paymentToUpdate.cardAmount || 0);
          const baseUpi = Number(paymentToUpdate.upiAmount || 0);
          const addCash = Number(cashAmount || 0);
          const addCard = Number(cardAmount || 0);
          const addUpi = Number(upiAmount || 0);

          let nextCash = baseCash + addCash;
          let nextCard = baseCard + addCard;
          let nextUpi = baseUpi + addUpi;
          const totalSplit = nextCash + nextCard + nextUpi;

          if (totalSplit > 0 && toMoney(totalSplit) !== toMoney(newAmount)) {
            nextUpi = Number((newAmount - nextCash - nextCard).toFixed(2));
          } else if (totalSplit === 0) {
            nextCash = 0;
            nextCard = 0;
            nextUpi = newAmount;
          }

          updateFields.cashAmount = Math.max(0, Number(nextCash.toFixed(2)));
          updateFields.cardAmount = Math.max(0, Number(nextCard.toFixed(2)));
          updateFields.upiAmount = Math.max(0, Number(nextUpi.toFixed(2)));
        }

        const updateQuery = {
          $set: updateFields,
          ...(effectivePaymentMethod !== "MIXED"
            ? { $unset: { cashAmount: "", cardAmount: "", upiAmount: "" } }
            : {}),
        };

        await InvoicePayment.findByIdAndUpdate(paymentToUpdate._id, updateQuery);

        await Invoice.findByIdAndUpdate(
          invoiceId,
          {
            $set: {
              payment_method: effectivePaymentMethod,
              cashAmount:
                effectivePaymentMethod === "MIXED"
                  ? Math.max(0, Number(updateFields.cashAmount || 0))
                  : 0,
              cardAmount:
                effectivePaymentMethod === "MIXED"
                  ? Math.max(0, Number(updateFields.cardAmount || 0))
                  : 0,
              upiAmount:
                effectivePaymentMethod === "MIXED"
                  ? Math.max(0, Number(updateFields.upiAmount || 0))
                  : 0,
            },
          },
          { runValidators: false }
        );

        if (
          requiresManualVerification(effectivePaymentMethod, updateFields.upiAmount) &&
          !finalizePayment
        ) {
          await Invoice.findByIdAndUpdate(
            invoiceId,
            { $set: { status: "PENDING" } },
            { runValidators: false }
          );
          await syncCreditNotificationForInvoice(invoiceId);
        } else {
          await updateInvoiceStatus(invoiceId);
        }

        const updatedInvoice = await Invoice.findById(invoiceId);

        return res.status(201).json({
          success: true,
          message: "Payment updated",
          data: {
            invoiceStatus: updatedInvoice.status,
          },
        });
      }
    }

    // ✅ Create payment with conditional MIXED fields
    const paymentData = {
      invoiceId,
      amount,
      payment_method, // "CASH" | "PHONEPE" | "MIXED"
      ...(payment_method === "CREDIT" ? { creditAmount: normalizedCreditAmount } : {}),
      received_on: received_on ? new Date(received_on) : new Date(),
      notes: notes || "",
      received_by: req.user,
    };

    // Add MIXED payment fields if applicable
    if (payment_method === "MIXED") {
      // ✅ Resolve split amounts and keep them consistent with the payment amount
      const invoiceCash = Number(invoice.cashAmount || 0);
      const invoiceCard = Number(invoice.cardAmount || 0);
      const invoiceUpi = Number(invoice.upiAmount || 0);

      let resolvedCash =
        cashAmount !== undefined && cashAmount !== null ? Number(cashAmount) : invoiceCash;
      let resolvedCard =
        cardAmount !== undefined && cardAmount !== null ? Number(cardAmount) : invoiceCard;
      let resolvedUpi =
        upiAmount !== undefined && upiAmount !== null ? Number(upiAmount) : invoiceUpi;

      const offlineSplit = Number((resolvedCash + resolvedCard).toFixed(2));

      if (!resolvedUpi && offlineSplit > 0) {
        resolvedUpi = Number((amount - offlineSplit).toFixed(2));
      }

      // If both missing, default UPI to full amount
      if (!resolvedCash && !resolvedCard && !resolvedUpi) {
        resolvedCash = 0;
        resolvedCard = 0;
        resolvedUpi = amount;
      }

      if (toMoney(resolvedCash + resolvedCard + resolvedUpi) !== toMoney(amount)) {
        resolvedUpi = Number((amount - resolvedCash - resolvedCard).toFixed(2));
      }

      paymentData.cashAmount = Math.max(0, resolvedCash);
      paymentData.cardAmount = Math.max(0, resolvedCard);
      paymentData.upiAmount = Math.max(0, resolvedUpi);
    }

    await InvoicePayment.create(paymentData);

    await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        $set: {
          payment_method,
          cashAmount:
            payment_method === "MIXED"
              ? Math.max(0, Number(paymentData.cashAmount || 0))
              : 0,
          cardAmount:
            payment_method === "MIXED"
              ? Math.max(0, Number(paymentData.cardAmount || 0))
              : 0,
          upiAmount:
            payment_method === "MIXED"
              ? Math.max(0, Number(paymentData.upiAmount || 0))
              : 0,
        },
      },
      { runValidators: false }
    );

    // ✅ Recalculate invoice status, except manual-verification payments stay pending
    if (
      requiresManualVerification(payment_method, paymentData.upiAmount) &&
      !finalizePayment
    ) {
      await Invoice.findByIdAndUpdate(
        invoiceId,
        { $set: { status: "PENDING" } },
        { runValidators: false }
      );
      await syncCreditNotificationForInvoice(invoiceId);
    } else {
      await updateInvoiceStatus(invoiceId);
    }

    const updatedInvoice = await Invoice.findById(invoiceId);

    res.status(201).json({
      success: true,
      message: "Payment recorded",
      data: {
        invoiceStatus: updatedInvoice.status,
      },
    });
  } catch (err) {
    console.error("recordInvoicePayment error:", err);
    res.status(500).json({ message: err.message });
  }
};


const cancelInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the invoice and populate customer (billTo)
    const invoice = await Invoice.findById(id).populate('billTo', 'name phone email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // 2. Validate invoice status (only allow cancellation of certain statuses)
    const cancellableStatuses = ['DRAFT', 'PENDING', 'UNPAID'];
    if (!cancellableStatuses.includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel invoice with status: ${invoice.status}. Only DRAFT, PENDING, or UNPAID invoices can be cancelled.`
      });
    }

    // 3. Store original total for logging
    const originalTotal = invoice.TotalAmount;
    const customerName = invoice.billTo?.name || 'Unknown Customer';

    // 4. Revert inventory for each item
    for (const item of invoice.items) {
      try {

        // Find the inventory record for this variant
        const inventoryRecord = await Inventory.findOne({
          variantId: item.variantId,
          isDeleted: false
        });

        if (inventoryRecord) {

          // Increase stock quantity (revert the sale)
          const newQuantity = inventoryRecord.quantity + item.qty;

          // Add stock_in history entry
          inventoryRecord.inventory_history.push({
            unitId: item.unit,
            quantity: newQuantity,
            notes: `Stock returned - Invoice #${invoice.invoiceNumber} cancelled`,
            type: 'stock_in',
            adjustment: item.qty,
            referenceId: invoice._id,
            referenceType: 'invoice',  // Using 'invoice' as referenceType
            createdBy: req.user
          });

          // Update the quantity
          inventoryRecord.quantity = newQuantity;
          await inventoryRecord.save();

        } else {
          console.log(`⚠️ Inventory record not found for variant ID: ${item.variantId}`);
        }
      } catch (error) {
        console.error(`Error reverting inventory for item ${item.variantId}:`, error);
        // Continue with other items even if one fails
      }
    }

    // 5. Update invoice status to CANCELLED
    invoice.status = 'CANCELLED';
    await invoice.save();

    // 5.1 If a credit note exists for this invoice, cancel it too
    await CreditNote.updateMany(
      { invoiceId: invoice._id, isDeleted: false },
      { $set: { status: "CANCELLED" } }
    );

    await syncCreditNotificationForInvoice(invoice._id);

    // 6. Customer balance is automatically handled:
    // - When status changes to 'CANCELLED', this invoice will be excluded from:
    //   * Outstanding balance calculations
    //   * Unpaid invoices reports
    //   * Customer ledger queries
    // - The billTo customer reference remains intact for historical records


    res.status(200).json({
      success: true,
      message: `Invoice cancelled successfully. Inventory has been restored and customer balance updated.`,
      data: {
        invoice,
        customerName,
        revertedAmount: originalTotal
      }
    });

  } catch (error) {
    console.error('Cancel Invoice Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: error.message
    });
  }
};

// Controller function to handle additional payment for exchange upgrades
const handleExchangePayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { payment_method, amount, cashAmount, cardAmount, upiAmount } = req.body;
    const finalize = Boolean(req.body.finalize);

    // Validate invoice exists
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Validate this is an exchange invoice (or still pending exchange)
    if (!["EXCHANGE", "PARTIALLY_PAID", "PAID", "PENDING", "UNPAID"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: "This endpoint is only for exchange invoices",
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    const { getInvoiceOutstandingAmount } = require("../../../services/invoicePaymentService");
    const { outstandingAmount: remainingDue } = await getInvoiceOutstandingAmount(invoice._id, invoice);

    if (remainingDue <= 0) {
      return res.status(400).json({
        success: false,
        message: "This invoice has already been fully paid.",
      });
    }

    const payAmount = toMoney(Number(amount));
    if (payAmount > remainingDue + 0.01) {
      return res.status(400).json({
        success: false,
        message: "Payment exceeds remaining due amount",
      });
    }

    // Find or create a payment record
    let existingPayment = await InvoicePayment.findOne({ invoiceId: invoice._id });
    if (!existingPayment) {
      // Original invoice had no payment (UNPAID/CREDIT) — create a fresh record
      existingPayment = await InvoicePayment.create({
        invoiceId: invoice._id,
        userId: invoice.userId,
        payment_method,
        amount: 0,
        received_on: new Date(),
        notes: 'Exchange payment record created',
      });
    }

    const cashPortion = toMoney(Number(cashAmount || 0));
    const cardPortion = toMoney(Number(cardAmount || 0));
    const upiPortion = toMoney(Number(upiAmount || 0));
    const effectivePaid = finalize
      ? payAmount
      : payment_method === "MIXED"
        ? cashPortion + cardPortion
        : payment_method === "CASH" || payment_method === "CARD"
          ? payAmount
          : 0;

    const invoiceTotal = toMoney(Number(invoice.grandTotal || invoice.total || 0));
    const totalPaid = toMoney(Number(invoice.totalPaid || existingPayment.amount || 0));

    const newTotalPaid = toMoney(totalPaid + effectivePaid);
    const newRemainingDue = Math.max(toMoney(invoiceTotal - newTotalPaid), 0);

    const paymentUpdate = {
      amount: newTotalPaid,
      payment_method,
      received_on: new Date(),
      notes: `Payment updated - Exchange upgrade (Added: ₹${payAmount})`,
    };

    if (payment_method === "MIXED") {
      paymentUpdate.cashAmount = cashPortion;
      paymentUpdate.cardAmount = cardPortion;
      paymentUpdate.upiAmount = upiPortion;
    }

    await InvoicePayment.findByIdAndUpdate(existingPayment._id, { $set: paymentUpdate });

    const nextStatus =
      finalize || (payment_method !== "UPI" && payment_method !== "MIXED")
        ? "EXCHANGE"
        : "PENDING";

    const invoiceUpdate = {
      profit_amount:
        finalize || payment_method === "CASH" || payment_method === "CARD"
          ? Math.max((invoice.profit_amount || 0) + Number(amount), 0)
          : invoice.profit_amount || null,
      status: nextStatus,
      payment_method,
      exchangePending: nextStatus === "PENDING",
      isExchange: true,
      ...(payment_method === "MIXED" && req.body?.cashAmount !== undefined
        ? { cashAmount: Number(req.body.cashAmount) || 0 }
        : {}),
      ...(payment_method === "MIXED" && req.body?.cardAmount !== undefined
        ? { cardAmount: Number(req.body.cardAmount) || 0 }
        : {}),
      ...(payment_method === "MIXED" && req.body?.upiAmount !== undefined
        ? { upiAmount: Number(req.body.upiAmount) || 0 }
        : {}),
    };

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoice._id,
      { $set: invoiceUpdate },
      { new: true, runValidators: false }
    );

    await syncCreditNotificationForInvoice(updatedInvoice._id);

    // Don't call updateInvoiceStatus - we want to keep status as EXCHANGE


    return res.status(200).json({
      success: true,
      message: 'Exchange payment recorded successfully',
      data: updatedInvoice
    });

  } catch (err) {
    console.error('Exchange payment error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error processing exchange payment',
      error: err.message
    });
  }
};

const exportInvoicesExcel = async (req, res) => {
  try {
    const {
      status,
      search = "",
      customerId,
      startDate,
      endDate,
      payment_method,
    } = req.query;
    const userId = req.user?._id || req.user;

    // Build query - same as getAllInvoices but without pagination
    const query = {
      isDeleted: false,
      parentInvoice: null,
    };

    if (
      status &&
      [
        "DRAFT",
        "SENT",
        "PAID",
        "OVERDUE",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_PAID",
        "EXCHANGE",
        "UNPAID",
        "PENDING",
      ].includes(status.toUpperCase())
    ) {
      query.status = status.toUpperCase();
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    }

    if (payment_method) {
      query.payment_method = payment_method;
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      const matchingCustomers = await Customer.find({
        userId,
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }],
      })
        .select("_id")
        .lean();
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$or = [
        { invoiceNumber: searchRegex },
        { referenceNo: searchRegex },
        { "items.name": searchRegex },
        { notes: searchRegex },
      ];

      if (customerIds.length > 0) {
        query.$or.push(
          { billTo: { $in: customerIds } },
          { customerId: { $in: customerIds } }
        );
      }
    }

    // Fetch all matching invoices with population
    const invoices = await Invoice.find(query)
      .populate("billTo", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Get payments for all invoices
    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoiceIds } } },
      {
        $group: {
          _id: "$invoiceId",
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    // Map payments to invoice IDs
    const paymentMap = {};
    payments.forEach((p) => {
      paymentMap[p._id.toString()] = p.totalPaid || 0;
    });

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoices");

    // Define columns
    worksheet.columns = [
      { header: "Invoice Number", key: "invoiceNumber", width: 18 },
      { header: "Date", key: "invoiceDate", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Tax Type", key: "taxType", width: 12 },
      { header: "GST Type", key: "gstType", width: 12 },
      { header: "Status", key: "status", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 18 },
      { header: "Product Name", key: "productName", width: 30 },
      { header: "Variant", key: "variant", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Rate", key: "rate", width: 12 },
      { header: "Tax", key: "tax", width: 12 },
      { header: "Discount", key: "discount", width: 12 },
      { header: "Item Total", key: "itemTotal", width: 15 },
      { header: "Invoice Total", key: "invoiceTotal", width: 15 },
      { header: "Paid Amount", key: "paidAmount", width: 15 },
      { header: "Balance", key: "balance", width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };

    // Add data rows - one row per invoice item
    invoices.forEach((invoice) => {
      const customerName =
        invoice.billTo?.name ||
        (invoice.customerId === "UNKNOWN" ? "UNKNOWN" : invoice.customerId?.name) ||
        "N/A";
      const customerPhone =
        invoice.billTo?.phone ||
        (invoice.customerId === "UNKNOWN" ? "N/A" : invoice.customerId?.phone) ||
        "N/A";
      const totalPaid = paymentMap[invoice._id.toString()] || 0;
      const balance = (invoice.TotalAmount || 0) - totalPaid;

      // Format date
      const formattedDate = invoice.invoiceDate
        ? new Date(invoice.invoiceDate).toLocaleDateString("en-GB")
        : "";

      // If invoice has items, create a row for each item
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item, index) => {
          const variantInfo = [
            item.variantColor,
            item.variantSize,
          ]
            .filter(Boolean)
            .join(" - ");

          worksheet.addRow({
            invoiceNumber: index === 0 ? invoice.invoiceNumber : "", // Show invoice number only on first item
            invoiceDate: index === 0 ? formattedDate : "",
            customer: index === 0 ? customerName : "",
            phone: index === 0 ? customerPhone : "",
            taxType: index === 0 ? invoice.taxType || "GST" : "",
            gstType: index === 0 ? invoice.gstType || "N/A" : "",
            status: index === 0 ? invoice.status : "",
            paymentMethod: index === 0 ? invoice.payment_method || "N/A" : "",
            productName: item.name || "N/A",
            variant: variantInfo || "N/A",
            quantity: item.qty || 0,
            rate: item.rate || 0,
            tax: item.tax || 0,
            discount: item.discount || 0,
            itemTotal: item.amount || 0,
            invoiceTotal: index === 0 ? invoice.TotalAmount || 0 : "",
            paidAmount: index === 0 ? totalPaid : "",
            balance: index === 0 ? balance : "",
          });
        });
      } else {
        // If no items, add a single row for the invoice
        worksheet.addRow({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: formattedDate,
          customer: customerName,
          phone: customerPhone,
          taxType: invoice.taxType || "GST",
          gstType: invoice.gstType || "Exclusive",
          status: invoice.status,
          paymentMethod: invoice.payment_method || "N/A",
          productName: "No Items",
          variant: "N/A",
          quantity: 0,
          rate: 0,
          tax: 0,
          discount: 0,
          itemTotal: 0,
          invoiceTotal: invoice.TotalAmount || 0,
          paidAmount: totalPaid,
          balance: balance,
        });
      }
    });

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0];
    const filename = `Invoices_Export_${today}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export invoices error:", err);
    res.status(500).json({
      success: false,
      message: "Error exporting invoices",
      error: err.message,
    });
  }
};

// Download Invoice Excel Template (Simple - For Historical Records Only)
const downloadInvoiceTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice Import Template');

    // Define columns - EXACTLY matching exportInvoicesExcel
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
      { header: 'Date', key: 'invoiceDate', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'GST Type', key: 'gstType', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 18 },
      { header: 'Design No', key: 'designNo', width: 20 },
      { header: 'Variant (Color)', key: 'variantColor', width: 20 },
      { header: 'Variant (Size)', key: 'variantSize', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Rate', key: 'rate', width: 12 },
      { header: 'Tax', key: 'tax', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Item Total', key: 'itemTotal', width: 15 },
      { header: 'Invoice Total', key: 'invoiceTotal', width: 15 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
      { header: 'Balance', key: 'balance', width: 15 },
    ];

    // Style the header (yellow background + bold)
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };

    // Add sample data rows - 3 different invoice types

    // Example 1: GST Exclusive Invoice (2 items)
    worksheet.addRow({
      invoiceNumber: 'INV-000001',
      invoiceDate: '30/01/2024',
      phone: '9876543210',
      taxType: 'GST',
      gstType: 'Exclusive',
      status: 'PAID',
      paymentMethod: 'CASH',
      designNo: 'DES-001',
      variantColor: 'Red',
      variantSize: 'M',
      quantity: 2,
      rate: 500,
      tax: 18,
      discount: 50,
      itemTotal: 950,
      invoiceTotal: 2242,
      paidAmount: 2242,
      balance: 0,
    });

    worksheet.addRow({
      invoiceNumber: '', // Same invoice, second item
      invoiceDate: '',
      phone: '',
      taxType: '',
      gstType: '',
      status: '',
      paymentMethod: '',
      designNo: 'DES-002',
      variantColor: 'Blue',
      variantSize: 'L',
      quantity: 1,
      rate: 1000,
      tax: 18,
      discount: 0,
      itemTotal: 1000,
      invoiceTotal: '',
      paidAmount: '',
      balance: '',
    });

    // Example 2: GST Inclusive Invoice (1 item)
    worksheet.addRow({
      invoiceNumber: 'INV-000002',
      invoiceDate: '30/01/2024',
      phone: '9876543211',
      taxType: 'GST',
      gstType: 'Inclusive',
      status: 'UNPAID',
      paymentMethod: '',
      designNo: 'DES-003',
      variantColor: 'Green',
      variantSize: 'XL',
      quantity: 3,
      rate: 1180,
      tax: 18,
      discount: 0,
      itemTotal: 3540,
      invoiceTotal: 3540,
      paidAmount: 0,
      balance: 3540,
    });

    // Example 3: Non-GST Invoice (1 item)
    worksheet.addRow({
      invoiceNumber: 'INV-000003',
      invoiceDate: '30/01/2024',
      phone: '9876543212',
      taxType: 'Non-GST',
      gstType: '',
      status: 'PAID',
      paymentMethod: 'UPI',
      designNo: 'DES-004',
      variantColor: 'Black',
      variantSize: 'M',
      quantity: 5,
      rate: 200,
      tax: 0,
      discount: 100,
      itemTotal: 900,
      invoiceTotal: 900,
      paidAmount: 500,
      balance: 400,
    });

    // Add instructions
    worksheet.addRow([]);
    worksheet.addRow(['Instructions for Invoice Import:']);
    worksheet.addRow(['1. Invoice Number: Required - Auto-generated if left empty']);
    worksheet.addRow(['2. Date: Required - Format: DD/MM/YYYY (e.g., 30/01/2024)']);
    worksheet.addRow(['3. Phone: Optional - Used to match customer if provided']);
    worksheet.addRow(['4. Tax Type: Optional - GST, Non-GST, etc. (Default: GST)']);
    worksheet.addRow(['5. GST Type: Optional - Exclusive, Inclusive (Default: Exclusive)']);
    worksheet.addRow(['6. Status: Optional - PAID, UNPAID, etc. (Default: PAID)']);
    worksheet.addRow(['7. Payment Method: Optional - CASH, PHONEPE']);
    worksheet.addRow(['8. Design No: Required for each line item']);
    worksheet.addRow(['9. Variant (Color): Optional']);
    worksheet.addRow(['10. Variant (Size): Optional']);
    worksheet.addRow(['11. Quantity: Required - Number of units']);
    worksheet.addRow(['12. Rate: Required - Unit price']);
    worksheet.addRow(['13. Tax: Optional - Tax percentage (e.g., 18 for 18% GST)']);
    worksheet.addRow(['14. Discount: Optional - Discount amount per item']);
    worksheet.addRow(['15. Item Total: Auto-calculated if empty']);
    worksheet.addRow(['16. Invoice Total: Fill only on first row of invoice']);
    worksheet.addRow(['17. Paid Amount: Fill only on first row of invoice']);
    worksheet.addRow(['18. Balance: Auto-calculated (Invoice Total - Paid Amount)']);
    worksheet.addRow([]);
    worksheet.addRow(['IMPORTANT NOTES:']);
    worksheet.addRow(['- Multiple rows with SAME Invoice Number = Multiple items in ONE invoice']);
    worksheet.addRow(['- Leave Invoice Number, Date, Phone, etc. EMPTY for 2nd+ items of same invoice']);
    worksheet.addRow(['- If Phone is provided, the customer must exist in your system (will NOT be auto-created)']);
    worksheet.addRow(['- Products/variants are NOT created from import (historical records only)']);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Invoice_Import_Template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Download Invoice Template Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message,
    });
  }
};


// Upload Historical Invoices from Excel (For Record-Keeping Only)
const uploadInvoicesFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel sheet not found',
      });
    }

    // Parse Excel to JSON
    const rows = [];
    let headers = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = row.values;
        if (Array.isArray(headers) && headers.length > 0 && headers[0] === undefined) {
          headers = headers.slice(1);
        }
      } else {
        const rowData = {};
        headers.forEach((header, index) => {
          if (header) {
            let cellValue = row.getCell(index + 1).value;
            if (typeof cellValue === 'object' && cellValue !== null) {
              if (cellValue.text) cellValue = cellValue.text;
              else if (cellValue.result) cellValue = cellValue.result;
            }
            rowData[header] = cellValue;
          }
        });
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    });

    if (!rows.length) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel sheet is empty',
      });
    }

    const results = {
      totalRows: rows.length,
      invoicesCreated: 0,
      errors: [],
    };

    // Group by Invoice Number
    const invoiceGroups = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const normalizeKey = (key) => Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
      const invKey = normalizeKey('Invoice Number') || normalizeKey('Invoice No');

      const invoiceNumber = invKey ? row[invKey] : '';
      const groupKey = invoiceNumber && invoiceNumber.toString().trim() !== ''
        ? invoiceNumber.toString().trim()
        : `AUTO_${rowNumber}_${Math.random()}`;

      if (!invoiceGroups[groupKey]) {
        invoiceGroups[groupKey] = {
          invoiceNumber: invoiceNumber ? invoiceNumber.toString().trim() : '',
          rows: [],
          firstRowNumber: rowNumber,
        };
      }
      invoiceGroups[groupKey].rows.push({ row, rowNumber });
    }

    // Process each invoice group
    for (const groupKey of Object.keys(invoiceGroups)) {
      const group = invoiceGroups[groupKey];
      const firstRowData = group.rows[0].row;
      const firstRowNumber = group.rows[0].rowNumber;

      try {
        const getVal = (keys) => {
          for (const key of keys) {
            const rowKey = Object.keys(firstRowData).find(k => k.toLowerCase() === key.toLowerCase());
            if (rowKey) return firstRowData[rowKey];
          }
          return null;
        };

        // Customer (Optional) - match by phone if provided
        const customerName = getVal(['Customer', 'Customer Name']);
        const customerPhone = getVal(['Phone', 'Customer Phone']);

        let customer = null;
        if (customerPhone) {
          customer = await Customer.findOne({
            phone: customerPhone.toString().trim(),
            userId: req.user,
          });
        }

        if (!customer && customerName) {
          customer = await Customer.findOne({
            name: { $regex: new RegExp(`^${customerName.toString().trim()}$`, 'i') },
            userId: req.user,
          });
        }

        if ((customerName || customerPhone) && !customer) {
          throw new Error(`Customer not found: ${customerName || customerPhone}. Please add the customer first.`);
        }


        // Invoice Date (Required) - handle DD/MM/YYYY and DD-MM-YYYY formats
        let invoiceDate = getVal(['Date', 'Invoice Date']);
        if (!invoiceDate) throw new Error('Invoice Date is required');

        // Parse date - handle various Excel date formats
        if (typeof invoiceDate === 'string') {
          // Handle both / and - separators
          let parts = invoiceDate.includes('/') ? invoiceDate.split('/') : invoiceDate.split('-');
          if (parts.length === 3) {
            // DD/MM/YYYY or DD-MM-YYYY format
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(parts[2], 10);
            invoiceDate = new Date(year, month, day, 0, 0, 0, 0);
          } else {
            invoiceDate = new Date(invoiceDate);
          }
        } else if (typeof invoiceDate === 'number') {
          // Excel serial date number
          invoiceDate = new Date((invoiceDate - 25569) * 86400 * 1000);
        } else if (invoiceDate instanceof Date) {
          // Already a Date object from Excel
          invoiceDate = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate(), 0, 0, 0, 0);
        }

        if (!invoiceDate || isNaN(invoiceDate.getTime())) {
          throw new Error('Invalid invoice date format');
        }

        // Extract additional invoice-level fields from export format
        const taxType = getVal(['Tax Type', 'TaxType']) || 'GST';
        const gstType = getVal(['GST Type', 'GSTType']);

        const status = (getVal(['Status']) || 'PAID').toUpperCase();
        // Normalize payment method to uppercase to match enum
        const paymentMethod = (getVal(['Payment Method', 'PaymentMethod']) || 'CASH').toString().toUpperCase();
        const invoiceTotal = parseFloat(getVal(['Invoice Total', 'InvoiceTotal']) || 0);
        const paidAmount = parseFloat(getVal(['Paid Amount', 'PaidAmount']) || 0);
        const notes = getVal(['Notes']) || '';

        // Build Items
        let taxableAmount = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        const invoiceItems = [];

        for (const itemRow of group.rows) {
          const r = itemRow.row;
          const getRowVal = (keys) => {
            for (const key of keys) {
              const rowKey = Object.keys(r).find(k => k.toLowerCase() === key.toLowerCase());
              if (rowKey) return r[rowKey];
            }
            return null;
          };

          const designNo = getRowVal(['Design No', 'Variant (Design No)']);
          if (!designNo) {
            results.errors.push({
              row: itemRow.rowNumber,
              reason: 'Design No is required',
              data: r,
            });
            continue;
          }

          const variantColorInput = getRowVal(['Variant (Color)', 'Color']);
          const variantSizeInput = getRowVal(['Variant (Size)', 'Size']);
          const quantity = parseFloat(getRowVal(['Quantity', 'Qty'])) || 1;
          const rate = parseFloat(getRowVal(['Rate', 'Price'])) || 0;
          const discount = parseFloat(getRowVal(['Discount'])) || 0;
          const taxPercentage = parseFloat(getRowVal(['Tax', 'Tax Percentage', 'Tax %'])) || 0;

          if (quantity <= 0 || rate < 0) continue;

          const itemSubtotal = quantity * rate;
          const itemTaxable = itemSubtotal - discount;
          const itemTax = (itemTaxable * taxPercentage) / 100;

          taxableAmount += itemTaxable;
          totalTax += itemTax;
          totalDiscount += discount;

          const variantColor = variantColorInput ? variantColorInput.toString().trim() : '';
          const variantSize = variantSizeInput ? variantSizeInput.toString().trim() : '';

          invoiceItems.push({
            rowId: `${new Date().getTime()}_${Math.random()}`,
            product_id: null, // Not linking to products
            name: designNo.toString().trim(),
            hsn_code: '',
            unit: 'PCS',
            qty: quantity,
            rate: rate,
            discount: discount,
            tax: itemTax,
            discount_type: 'Fixed',
            discount_value: discount,
            amount: itemTaxable,
            variantColor: variantColor,
            variantSize: variantSize,
          });
        }

        if (invoiceItems.length === 0) {
          throw new Error('No valid items found');
        }

        const invoiceItemsWithSnapshots = await attachCostSnapshotsToItems(invoiceItems);

        // Use provided Invoice Total or calculate
        const finalTotalAmount = invoiceTotal > 0 ? invoiceTotal : (taxableAmount + totalTax);

        // Create Invoice with status and payment method from import
        const newInvoice = await Invoice.create({
          invoiceNumber: group.invoiceNumber || undefined,
          customerId: customer ? customer._id : "UNKNOWN",
          billTo: customer ? customer._id : null,
          billFrom: req.user,
          userId: req.user,
          invoiceDate: invoiceDate,
          dueDate: invoiceDate,
          referenceNo: '',
          items: invoiceItemsWithSnapshots,
          status: status,
          payment_method: paymentMethod,
          taxableAmount: taxableAmount,
          TotalAmount: finalTotalAmount,
          vat: totalTax,
          totalDiscount: totalDiscount,
          roundOff: false,
          taxType: taxType,
          // Logic matched from createInvoice controller: Non-GST gets null, others get value or Exclusive
          gstType: (taxType && taxType.toLowerCase().includes('non')) ? null : (gstType || 'Exclusive'),
          notes: notes,
          termsAndCondition: '',
        });

        if (paidAmount > 0 && status !== 'DRAFT') {
          await InvoicePayment.create({
            invoiceId: newInvoice._id,
            userId: req.user,
            amount: paidAmount,
            paymentDate: invoiceDate,
            payment_method: paymentMethod,
            referenceNo: '',
            notes: 'Payment from Excel import',
            received_by: req.user,
            received_on: invoiceDate,
          });
        }

        results.invoicesCreated++;

        // NO INVENTORY UPDATE

      } catch (error) {
        results.errors.push({
          row: firstRowNumber,
          reason: error.message,
          data: firstRowData,
        });
      }
    }

    fs.unlinkSync(req.file.path);

    res.status(201).json({
      success: true,
      message: 'Historical invoice import completed',
      results: results,
    });

  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) { }
    }

    console.error('Invoice Excel Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload invoices from Excel',
      error: error.message,
    });
  }
};

module.exports = {
  createInvoice,
  updateInvoiceStatus,
  sendInvoiceEmail,
  updateInvoice,
  getInvoice,
  getAllInvoices,
  getChildInvoices,
  listInvoicesMinimal,
  getInvoicePaymentDetails,
  convertQuotationToInvoice,
  recordInvoicePayment,
  listInvoicesMinimalWithoutChallan,
  getNextInvoiceNumber,
  getNextExchangeInvoiceNumber,
  deleteInvoice,
  bulkDeleteInvoices,
  cancelInvoice,
  handleExchangePayment,
  exportInvoicesExcel,
  downloadInvoiceTemplate,
  uploadInvoicesFromExcel,
};
