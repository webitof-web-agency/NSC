const mongoose = require('mongoose');
const Purchase = require('@models/Purchase');
const SupplierPayment = require('@models/SupplierPayment');
const Inventory = require('@models/Inventory');
const Product = require('@models/Product');
const User = require('@models/User');
const DebitNote = require('@models/DebitNote');
const { body, validationResult } = require('express-validator');
const { sendMail } = require("@utils/mailer");
const EWayBill = require('../../../models/EWayBill');
const {generateMockEWayBill} = require('../../../utils/ewayBillService');
const Supplier = require('@models/Supplier');
const ExcelJS = require('exceljs');
const fs = require('fs');
const ProductVariant = require('@models/ProductVariant');
const PaymentMode = require('@models/PaymentMode');
const Broker = require('@models/Broker');
const BrokerDetail = require('@models/BrokerDetail');
const TaxGroup = require('@models/TaxGroup');
const TaxRate = require('@models/TaxRate');

const findTaxGroupByRate = async (gstRate) => {
  const rateNumber = Number(gstRate);
  if (!Number.isFinite(rateNumber) || rateNumber <= 0) return null;

  const rateLabel = `${rateNumber}%`;
  let taxGroup = await TaxGroup.findOne({
    tax_name: { $regex: new RegExp(`^${rateLabel}$`, 'i') }
  });
  return taxGroup ? taxGroup._id : null;
};

const upsertBrokerDealForPurchase = async ({ brokerDetail, purchase, commissionType, commissionValue, commissionAmount, userId }) => {
  if (!brokerDetail || !purchase) return;

  const deal = {
    purchaseId: purchase._id,
    purchaseNumber: purchase.purchaseId,
    commissionType,
    commissionValue,
    commissionAmount
  };

  let broker = await Broker.findOne({ phone: brokerDetail.phone, isDeleted: false });
  if (!broker) {
    broker = new Broker({
      name: brokerDetail.name,
      phone: brokerDetail.phone,
      userId,
      deals: [deal]
    });
    await broker.save();
    return;
  }

  const existingIndex = broker.deals.findIndex((d) => String(d.purchaseId) === String(purchase._id));
  if (existingIndex >= 0) {
    broker.deals[existingIndex] = { ...broker.deals[existingIndex], ...deal };
  } else {
    broker.deals.push(deal);
  }
  broker.name = brokerDetail.name;
  await broker.save();
};

// const createPurchase = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const {
//       purchaseOrderId,
//       userId,
//       billFrom,
//       billTo,
//       referenceNo,
//       purchaseDate,
//       items,
//       notes,
//       termsAndCondition,
//       paymentMode,
//       subTotal,
//       totalTax,
//       totalDiscount,
//       grandTotal,
//       sign_type,
//       signatureId,
//       signatureName,
//       checkNumber,
//       bank,
//       sp_amount,
//       sp_paid_amount
//     } = req.body;

//     const billFromUser = await User.findById(billFrom).session(session);
//     const billToUser = await User.findById(billTo).session(session);
//     if (!billFromUser || !billToUser) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
//     }



//     const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
//     if (sign_type && !validSignatureTypes.includes(sign_type)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: 'Invalid signature type' });
//     }

//     if (sign_type === 'eSignature') {
//       if (!req.file) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({ message: 'Signature image is required for eSignature' });
//       }
//       if (!signatureName) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({ message: 'Signature name is required for eSignature' });
//       }
//     }

//     const calculatedSubTotal = subTotal || items.reduce((sum, item) => sum + (item.amount || (item.quantity * (item.rate || 0))), 0);
//     const calculatedTotalDiscount = totalDiscount || items.reduce((sum, item) => sum + (item.discount || 0), 0);
//     const calculatedTotalTax = totalTax || items.reduce((sum, item) => sum + (item.tax || 0), 0);
//     const calculatedGrandTotal = grandTotal || (calculatedSubTotal + calculatedTotalTax - calculatedTotalDiscount);

//     let status = req.body.status || 'pending';
//     let paidAmount = 0;
//     let balanceAmount = calculatedGrandTotal;
//     if (sp_amount && sp_paid_amount && status === 'paid') {
//       if (sp_paid_amount === sp_amount) {
//         status = 'paid';
//         paidAmount = sp_paid_amount;
//         balanceAmount = 0;
//       } else {
//         status = 'partially_paid';
//         paidAmount = sp_paid_amount;
//         balanceAmount = sp_amount - sp_paid_amount;
//       }
//     }

//     let purchaseId = req.body.purchaseId;
//     if (!purchaseId) {
//       purchaseId = `PO-${String(count + 1).padStart(6, '0')}`;
//     }

//     const purchase = new Purchase({
//       purchaseOrderId,
//       vendorId: billTo,
//       purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
//       dueDate: new Date(purchaseDate ? new Date(purchaseDate) : new Date()),
//       referenceNo: referenceNo || '',
//       items: items.map(item => ({
//         id: item.id,
//         name: item.name,
//         unit: item.unit,
//         qty: item.qty,
//         rate: item.rate,
//         discount: item.discount,
//         tax: item.tax,
//         tax_group_id: item.tax_group_id,
//         discount_type: item.discount_type,
//         discount_value: item.discount_value,
//         amount: item.amount
//       })),
//       status,
//       paymentMode,
//       taxableAmount: subTotal || calculatedSubTotal,
//       totalDiscount: totalDiscount || calculatedTotalDiscount,
//       totalTax: totalTax || calculatedTotalTax,
//       roundOff: req.body.roundOff || false,
//       totalAmount: grandTotal || calculatedGrandTotal,
//       paidAmount,
//       balanceAmount,
//       bank: bank || null,
//       notes: notes || '',
//       termsAndCondition: termsAndCondition || '',
//       sign_type: sign_type || 'none',
//       signatureId: signatureId || null,
//       signatureImage: sign_type === 'eSignature' ? req.file.path : null,
//       signatureName: sign_type === 'eSignature' ? signatureName : null,
//       checkNumber: checkNumber || null,
//       userId,
//       billFrom,
//       billTo
//     });

//     await purchase.save({ session });

//     if (purchaseOrderId) {
//     }

//     if (status === 'paid' || status === 'partially_paid') {
//       const supplierPayment = new SupplierPayment({
//         purchaseId: purchase._id,
//         supplierId: billTo,
//         referenceNumber: req.body.sp_referenceNumber || '',
//         paymentDate: req.body.sp_paymentDate || '',
//         paymentMode: req.body.sp_paymentMode || '',
//         amount: req.body.sp_amount || '',
//         paidAmount: req.body.sp_amount || '',
//         dueAmount: req.body.sp_due_amount || '',
//         notes: req.body.sp_notes || '',
//         createdBy: userId
//       });
//       await supplierPayment.save({ session });
//     }

//     if (status === 'paid' || status === 'partially_paid') {
//       for (const item of items) {
//         let inventory = await Inventory.findOne({ productId: item.id, userId }).session(session);
//         if (!inventory) {
//           inventory = new Inventory({ productId: item.id, userId, quantity: 0 });
//         }
//         const previousQuantity = inventory.quantity;
//         inventory.quantity += item.qty || 0;
//         inventory.inventory_history.push({
//           unitId: item.unit,
//           quantity: previousQuantity,
//           notes: `Stock in from purchase ${purchase.purchaseId}`,
//           type: 'stock_in',
//           adjustment: item.qty || 0,
//           referenceId: purchase._id,
//           referenceType: 'purchase',
//           createdBy: userId
//         });
//         await inventory.save({ session });
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       message: 'Purchase created successfully',
//       data: { purchase }
//     });

//     if (billToUser?.email && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
//       try {
//         await sendMail({
//           from: `"Your Company" <${process.env.SMTP_EMAIL}>`,
//           to: billToUser.email,
//           subject: "New Purchase Created",
//           html: `
//             <h3>Hello ${billToUser.name},</h3>
//             <p>A new purchase has been created for you.</p>
//             <p><strong>Reference No:</strong> ${purchase.referenceNo}</p>
//             <p><strong>Total Amount:</strong> ${purchase.totalAmount}</p>
//             <p>Purchase Date: ${new Date(purchase.purchaseDate).toLocaleDateString()}</p>
//             <br>
//             <p>Best Regards,<br>Your Company</p>
//           `
//         });
//       } catch (emailErr) {
//         console.error("Failed to send purchase email:", emailErr.message);
//       }
//     }

//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error(err);
//     res.status(500).json({ message: 'Error creating purchase', error: err.message });
//   }
// };

const createPurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userId,
      billFrom,
      billTo,
      referenceNo,
      supplier_bill_number,
      purchaseDate,
      purchaseBillDate,
      dueDate,
      dueDays,
      items,
      notes,
      termsAndCondition,
      paymentMode,
      // totalTax,
      // totalDiscount,
      grandTotal,
      overall_discount,
      taxType,
      gstType,
      // sign_type,
      // signatureId,
      // signatureName,
      checkNumber,
      bank,
      sp_amount,
      sp_paid_amount,
      sp_referenceNumber,

      brokerId,
      brokerName,
      brokerPhone,
      brokerCommissionType,
      brokerCommissionValue
    } = req.body;

    // console.log(req.body)

    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);

    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: "Invalid bill from or bill to user ID" });
    }

    // const validSignatureTypes = ["none", "digitalSignature", "eSignature"];
    // if (sign_type && !validSignatureTypes.includes(sign_type)) {
    //   return res.status(400).json({ message: "Invalid signature type" });
    // }

    // if (sign_type === "eSignature") {
    //   if (!req.file) return res.status(400).json({ message: "Signature image is required for eSignature" });
    //   if (!signatureName) return res.status(400).json({ message: "Signature name is required for eSignature" });
    // }

    // const calculatedSubTotal = subTotal || items.reduce((sum, item) => sum + (item.amount || (item.quantity * (item.rate || 0))), 0);
    // const calculatedTotalDiscount = totalDiscount || items.reduce((sum, item) => sum + (item.discount || 0), 0);
    // const calculatedTotalTax = totalTax || items.reduce((sum, item) => sum + (item.tax || 0), 0);
    // const calculatedGrandTotal = grandTotal || (calculatedSubTotal + calculatedTotalTax - calculatedTotalDiscount);
    
    const effectiveTaxType = taxType || "GST";
    const effectiveGstType = effectiveTaxType === "Non-GST" ? null : (gstType || "Exclusive");

    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const overallDiscount =
      overall_discount !== undefined && overall_discount !== null && overall_discount !== ""
        ? Number(overall_discount) || 0
        : 0;
    const normalizedItems = items.map(item => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const discount = Number(item.discount) || 0;
      const lineTotal = qty * rate;
      if (discount < 0 || discount > lineTotal) {
        throw new Error("Invalid discount amount.");
      }
      const itemTax = (effectiveTaxType === "GST") ? (Number(item.tax) || 0) : 0;
      const netBase = lineTotal - discount;
      const amount = (effectiveTaxType === "GST" && effectiveGstType === "Inclusive")
        ? netBase
        : netBase + itemTax;
      subTotal += lineTotal;
      totalDiscount += discount;
      totalTax += itemTax;

      return {
        id: item.product_id || item.id,
        productId: item.product_id || item.id,
        // productId: item.id,           // ✅ INTERNAL USE (inventory)
        productObjectId: item.id,        // MongoDB _id (for inventory)
        name: item.name,
        hsn_code: item.hsn_code,

        variantId: item.variantId || null,
        variantName: item.variantName || "",
        variantDesignNo: item.variantDesignNo || "",
        variantColor: item.variantColor || "",
        variantSize: item.variantSize || "",

        unit: item.unit || "",
        qty,
        rate,
        discount,
        tax: itemTax,
        tax_group_id: item.tax_group_id || null,
        discount_type: item.discount_type || "Fixed",
        discount_value: item.discount_value || 0,
        amount
      };
    });

    const totalAmount = Math.max(
      (effectiveTaxType === "GST" && effectiveGstType === "Inclusive" ? subTotal : subTotal + totalTax) -
      totalDiscount - overallDiscount,
      0
    );

    let resolvedBroker = null;
    let resolvedCommissionType = null;
    let resolvedCommissionValue = 0;
    let brokerCommissionAmount = 0;

    if (brokerId || (brokerName && brokerPhone)) {
      if (brokerId) {
        resolvedBroker = await BrokerDetail.findOne({ _id: brokerId, isDeleted: false });
      } else if (brokerPhone) {
        resolvedBroker = await BrokerDetail.findOne({ phone: brokerPhone, isDeleted: false });
        if (!resolvedBroker) {
          resolvedBroker = await BrokerDetail.create({
            name: brokerName || brokerPhone,
            phone: brokerPhone,
            commissionType: brokerCommissionType || 'Percentage',
            commissionValue: brokerCommissionValue !== undefined ? Number(brokerCommissionValue) : 0,
            userId
          });
        }
      }

      if (!resolvedBroker) {
        return res.status(404).json({ message: "Broker not found" });
      }

      resolvedCommissionType = brokerCommissionType || resolvedBroker.commissionType || 'Percentage';
      resolvedCommissionValue =
        brokerCommissionValue !== undefined && brokerCommissionValue !== null && brokerCommissionValue !== ""
          ? Number(brokerCommissionValue)
          : Number(resolvedBroker.commissionValue) || 0;

      brokerCommissionAmount =
        resolvedCommissionType === 'Percentage'
          ? (totalAmount * resolvedCommissionValue) / 100
          : resolvedCommissionValue;
    }

    const finalAmount = totalAmount; // now totalAmount only , not baseAmount + brokerCommissionAmount;
    
    let status = "pending";
    let paidAmount = 0;
    // let balanceAmount = calculatedGrandTotal;
    // let balanceAmount = totalAmount;

    const spAmount = Number(req.body.sp_amount) || 0;
    const spPaidAmount = Number(req.body.sp_paid_amount) || 0;
    if (spPaidAmount < 0) {
      return res.status(400).json({ message: "Paid amount cannot be negative." });
    }
    if (spPaidAmount > totalAmount) {
      return res.status(400).json({ message: "Paid amount cannot exceed total amount." });
    }

    // if (sp_amount && sp_paid_amount && status === "paid") {
    //   if (sp_paid_amount === sp_amount) {
    //     status = "paid";
    //     paidAmount = sp_paid_amount;
    //     balanceAmount = 0;
    //   } else {
    //     status = "partially_paid";
    //     paidAmount = sp_paid_amount;
    //     balanceAmount = sp_amount - sp_paid_amount;
    //   }
    // }

    let balanceAmount = finalAmount;
    paidAmount = spPaidAmount || 0;
    balanceAmount = Math.max(finalAmount - paidAmount, 0);
    if (paidAmount === 0) {
      status = "pending";
    } else if (balanceAmount === 0) {
      status = "paid";
    } else {
      status = "partially_paid";
    }

    // if (status === "paid") {
    //   if (spPaidAmount >= totalAmount) {
    //     status = "paid";
    //     paidAmount = totalAmount;
    //     balanceAmount = 0;
    //   } else if (spPaidAmount > 0) {
    //     status = "partially_paid";
    //     paidAmount = spPaidAmount;
    //     balanceAmount = totalAmount - spPaidAmount;
    //   }
    // }

    const supplierBillNumber =
      req.body.supplier_bill_number || req.body.sp_referenceNumber || "";

    const requestedPurchaseId = req.body.purchaseId;
    let purchaseId = requestedPurchaseId;
    if (purchaseId) {
      const existingPurchase = await Purchase.findOne({ purchaseId });
      if (existingPurchase) {
        return res.status(409).json({
          message: "Purchase ID already exists. Please refresh and try again."
        });
      }
    } else {
      purchaseId = await Purchase.generateNextPurchaseId();
    }

    const purchase = new Purchase({
      purchaseId,
      supplier_bill_number: supplierBillNumber,
      vendorId: billTo,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      purchaseBillDate: purchaseBillDate ? new Date(purchaseBillDate) : null,
      dueDate: dueDate
        ? new Date(dueDate)
        : purchaseBillDate
          ? new Date(purchaseBillDate)
          : new Date(purchaseDate ? new Date(purchaseDate) : new Date()),
      dueDays: typeof dueDays === "number" ? dueDays : dueDays ? Number(dueDays) : null,
      referenceNo: referenceNo || sp_referenceNumber || "",
      // items: items.map(item => ({
      //   id: item.id,
      //   name: item.name,
      //   hsn_code: item.hsn_code,
      //   // ✅ SAVE VARIANT
      //   variantId: item.variantId,
      //   variantName: item.variantName,
      //   variantDesignNo: item.variantDesignNo,
      //   variantColor: item.variantColor,
      //   variantSize: item.variantSize,
      //   // ✅ REQUIRED FOR E-WAY BILL
      //   // variantHsn_code: item.variantHsn_code,
      //   unit: item.unit,
      //   qty: item.qty,
      //   rate: item.rate,
      //   discount: item.discount,
      //   tax: item.tax,
      //   tax_group_id: item.tax_group_id,
      //   discount_type: item.discount_type,
      //   discount_value: item.discount_value,
      //   amount: item.amount
      // })),
      items: normalizedItems,
      status,
      // paymentMode: paymentMode && paymentMode !== "" ? paymentMode : null,
      paymentMode: paymentMode || req.body.sp_paymentMode || null,
      // taxableAmount: subTotal || calculatedSubTotal,
      // totalDiscount: totalDiscount || calculatedTotalDiscount,
      // totalTax: totalTax || calculatedTotalTax,
      roundOff: req.body.roundOff || false,
      // totalAmount: grandTotal || calculatedGrandTotal,
      totalAmount: totalAmount,   // ✅ grand total after discount
      totalDiscount: totalDiscount,
      totalTax: totalTax,
      overall_discount: overallDiscount,
      taxType: effectiveTaxType,
      gstType: effectiveTaxType === "Non-GST" ? null : effectiveGstType,
      paidAmount,
      balanceAmount,
      // balanceAmount: finalAmount - paidAmount,

      broker: resolvedBroker
        ? {
          brokerId: resolvedBroker._id,
          name: resolvedBroker.name,
          phone: resolvedBroker.phone,
          commissionType: resolvedCommissionType,
          commissionValue: resolvedCommissionValue,
          commissionAmount: brokerCommissionAmount,
        }
        : undefined,

      finalAmount: totalAmount,   // ✅ same as payable

      bank: bank || null,
      notes: notes || "",
      termsAndCondition: termsAndCondition || "",
      // sign_type: sign_type || "none",
      // signatureId: signatureId || null,
      // signatureImage: sign_type === "eSignature" ? req.file.path : null,
      // signatureName: sign_type === "eSignature" ? signatureName : null,
      checkNumber: checkNumber || null,
      userId,
      billFrom,
      billTo
    });

    // console.log("Purchase object to save:", purchase);

    await purchase.save();

    if (resolvedBroker) {
      await upsertBrokerDealForPurchase({
        brokerDetail: resolvedBroker,
        purchase,
        commissionType: resolvedCommissionType,
        commissionValue: resolvedCommissionValue,
        commissionAmount: brokerCommissionAmount,
        userId
      });
    }

    if (status === "paid" || status === "partially_paid") {
      const supplierPayment = new SupplierPayment({
        purchaseId: purchase._id,
        supplierId: billTo,

        sourceType: req.body.sp_sourceType || "ON_ACCOUNT", // ✅ DEFAULT

        paymentMode: req.body.sp_paymentMode || null,
        bankId: req.body.sp_bankId || null,

        referenceNumber: req.body.sp_referenceNumber || "",
        paymentDate: req.body.sp_paymentDate || "",
        // paymentMode: req.body.sp_paymentMode || "",
        // amount: req.body.sp_amount || "",
        amount: paidAmount,
        // paidAmount: req.body.sp_amount || "",
        paidAmount,
        // dueAmount: req.body.sp_due_amount || "",
        dueAmount: balanceAmount,
        createdBy: userId,
      });
      await supplierPayment.save();
    }

    // Update Inventory
    if (status === "paid" || status === "partially_paid" || status === "pending") {
      for (const item of normalizedItems) {
        await Inventory.findOneAndUpdate(
          { variantId: item.variantId, userId },
          {
            $setOnInsert: { productId: item.productId || item.id }, // Set productId only on insert
            $inc: { quantity: item.qty || 0 },
            $push: {
              inventory_history: {
                unitId: item.unit,
                quantity: 0, // Will be set to current quantity before increment
                notes: `Stock in from purchase ${purchase.purchaseId}`,
                type: "stock_in",
                adjustment: item.qty || 0,
                referenceId: purchase._id,
                referenceType: "purchase",
                createdBy: userId,
              }
            }
          },
          { upsert: true, new: true }
        );
      }
    }

    res.status(201).json({
      message: "Purchase created successfully",
      data: { purchase,
        //  ewayBill: ewayBillResult            // new 
      }
    });

    // if (billToUser?.email && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
    //   try {
    //     await sendMail({
    //       from: `"Naresh Saree Collection" <${process.env.SMTP_EMAIL}>`,
    //       to: billToUser.email,
    //       subject: "New Purchase Created",
    //       html: `
    //         <h3>Hello ${billToUser.firstName},</h3>
    //         <p>A new purchase has been created for you.</p>
    //         <p><strong>Purchase No:</strong> ${purchase.purchaseId}</p>
    //         <p><strong>Total Item Amount:</strong> ${purchase.totalAmount}</p>
    //         <p>Purchase Date: ${new Date(purchase.purchaseDate).toLocaleDateString()}</p><br>
    //         <p>Best Regards,<br>Naresh Saree Collection</p>
    //       `
    //     });
    //     // If necessary to mail the Garage expense's amount.
    //     // <p><strong>Final Amount with all Garage Expense:</strong> ${purchase.finalAmount}</p>
    //   } catch (emailErr) {
    //     console.error("Failed to send purchase email:", emailErr.message);
    //   }
    // }

  } catch (err) {
    console.error(err);
    if (err.message === "Invalid discount amount.") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Error creating purchase", error: err.message });
  }
};

const exportPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ isDeleted: false })
      .populate('billTo')
      .populate('paymentMode', 'name slug')
      .sort({ createdAt: -1 });

    // Fetch all suppliers related to these purchases to get GSTIN and address details
    // The Purchase model links to User via 'billTo', and Supplier model links to User via 'user_id'
    const userIds = purchases.map(p => p.billTo?._id).filter(id => id);
    const suppliers = await Supplier.find({ user_id: { $in: userIds } });
    
    const supplierMap = {};
    suppliers.forEach(sup => {
      supplierMap[sup.user_id.toString()] = sup;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchases');

    worksheet.columns = [
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Purchase No', key: 'purchaseId', width: 20 },
      { header: 'Reference No', key: 'referenceNo', width: 20 },
      { header: 'Supplier Bill No', key: 'supplierBillNumber', width: 20 },
      
      // Supplier Details
      { header: 'Supplier Name', key: 'supplierName', width: 30 },
      { header: 'Supplier Phone', key: 'supplierPhone', width: 15 },
      { header: 'Address', key: 'supplierAddress', width: 30 },
      { header: 'City', key: 'supplierCity', width: 15 },
      { header: 'Pincode', key: 'supplierPincode', width: 10 },
      { header: 'GSTIN', key: 'supplierGst', width: 20 },

      // Product Details
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'Variant', key: 'variant', width: 25 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Rate', key: 'rate', width: 10 },
      { header: 'GST Type', key: 'gstType', width: 12 },
      { header: 'Tax Rate', key: 'taxRate', width: 12 },
      { header: 'Item Amount', key: 'itemAmount', width: 15 },

      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Mode', key: 'paymentMode', width: 20 },
      { header: 'Total Purchase Amount', key: 'totalAmount', width: 20 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
      { header: 'Balance', key: 'balanceAmount', width: 15 },
    ];

    purchases.forEach((purchase) => {
      const isInclusive =
        purchase.taxType === 'GST' && purchase.gstType === 'Inclusive';
      const supplierUser = purchase.billTo;
      const supplierDetails = supplierUser ? supplierMap[supplierUser._id.toString()] : null;

      const supplierName = supplierDetails?.company_name || supplierUser?.name || 'N/A';
      const supplierPhone = supplierDetails?.phone_number || supplierUser?.phone || 'N/A';
      const supplierAddress = supplierDetails?.company_address || supplierUser?.address || '-';
      const supplierCity = supplierDetails?.city || '';
      const supplierPincode = supplierDetails?.pin_code || supplierUser?.postalCode || '-';
      const supplierGst = supplierDetails?.gst_no || '-';

      if (purchase.items && purchase.items.length > 0) {
        purchase.items.forEach((item, index) => {
          let variantStr = item.variantName || '';
          const parts = [];
          if (item.variantDesignNo) parts.push(`Design: ${item.variantDesignNo}`);
          if (item.variantColor) parts.push(`Color: ${item.variantColor}`);
          if (item.variantSize) parts.push(`Size: ${item.variantSize}`);
          if (parts.length > 0) variantStr += ` (${parts.join(', ')})`;

          // Only show purchase-level details for the first item to avoid "duplicates" visual
          const isFirstItem = index === 0;
          const qty = Number(item.qty || 0);
          const rate = Number(item.rate || 0);
          const discount = Number(item.discount || 0);
          const taxAmount = Number(item.tax || 0);
          const saleAmount = Math.max(qty * rate, 0);
          const baseBeforeTax = Math.max(saleAmount - discount, 0);
          const taxableValue = isInclusive
            ? Math.max(baseBeforeTax - taxAmount, 0)
            : baseBeforeTax;
          const taxRate = taxableValue > 0
            ? Number(((taxAmount / taxableValue) * 100).toFixed(2))
            : 0;

          worksheet.addRow({
            purchaseDate: isFirstItem ? new Date(purchase.purchaseDate).toLocaleDateString() : '',
            purchaseId: isFirstItem ? purchase.purchaseId : '',
            referenceNo: isFirstItem ? (purchase.referenceNo || '-') : '',
            supplierBillNumber: isFirstItem ? (purchase.supplier_bill_number || '-') : '',
            
            supplierName: isFirstItem ? supplierName : '',
            supplierPhone: isFirstItem ? supplierPhone : '',
            supplierAddress: isFirstItem ? supplierAddress : '',
            supplierCity: isFirstItem ? supplierCity : '',
            supplierPincode: isFirstItem ? supplierPincode : '',
            supplierGst: isFirstItem ? supplierGst : '',

            productName: item.name,
            variant: variantStr,
            qty,
            rate,
            gstType: isFirstItem ? (purchase.gstType || '') : '',
            taxRate,
            itemAmount: item.amount || 0,

            status: isFirstItem ? purchase.status : '',
            paymentMode: isFirstItem ? (purchase.paymentMode?.name || 'N/A') : '',
            
            // Only show totals on the first row so summing the column (if filtered) isn't doubly wrong, 
            // and visually it groups the invoice.
            totalAmount: isFirstItem ? purchase.totalAmount : '', 
            paidAmount: isFirstItem ? purchase.paidAmount : '',
            balanceAmount: isFirstItem ? purchase.balanceAmount : '',
          });
        });
      } else {
        // Fallback if no items
        worksheet.addRow({
          purchaseDate: new Date(purchase.purchaseDate).toLocaleDateString(),
          purchaseId: purchase.purchaseId,
          referenceNo: purchase.referenceNo || '-',
          supplierBillNumber: purchase.supplier_bill_number || '-',
          
          supplierName,
          supplierPhone,
          supplierAddress,
          supplierCity,
          supplierPincode,
          supplierGst,

          productName: '-',
          variant: '-',
          qty: 0,
          rate: 0,
          itemAmount: 0,

          status: purchase.status,
          paymentMode: purchase.paymentMode?.name || 'N/A',
          totalAmount: purchase.totalAmount,
          paidAmount: purchase.paidAmount,
          balanceAmount: purchase.balanceAmount,
        });
      }
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + 'purchases-export-' + Date.now() + '.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting purchases:', error);
    res.status(500).json({ message: 'Error exporting purchases', error: error.message });
  }
};

// const updatePurchase = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const {
//       _id,
//       purchaseId,
//       userId,
//       billFrom,
//       billTo,
//       referenceNo,
//       purchaseDate,
//       items,
//       notes,
//       termsAndCondition,
//       paymentMode,
//       subTotal,
//       totalTax,
//       totalDiscount,
//       grandTotal,
//       sign_type,
//       signatureId,
//       signatureName,
//       checkNumber,
//       bank,
//       sp_amount,
//       sp_paid_amount,
//       status: reqStatus
//     } = req.body;

//     if (!_id) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: 'Purchase ID is required' });
//     }

//     const purchase = await Purchase.findById(_id).session(session);
//     if (!purchase) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ message: 'Purchase not found' });
//     }

//     const billFromUser = await User.findById(billFrom).session(session);
//     const billToUser = await User.findById(billTo).session(session);
//     if (!billFromUser || !billToUser) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
//     }


//     // Signature validation
//     const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
//     if (sign_type && !validSignatureTypes.includes(sign_type)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: 'Invalid signature type' });
//     }

//     if (sign_type === 'eSignature') {
//       if (!req.file && !purchase.signatureImage) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({ message: 'Signature image is required for eSignature' });
//       }
//       if (!signatureName && !purchase.signatureName) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({ message: 'Signature name is required for eSignature' });
//       }
//     }

//     // Calculations
//     const calculatedSubTotal = subTotal || items.reduce((sum, item) => sum + (item.amount || (item.qty * (item.rate || 0))), 0);
//     const calculatedTotalDiscount = totalDiscount || items.reduce((sum, item) => sum + (item.discount || 0), 0);
//     const calculatedTotalTax = totalTax || items.reduce((sum, item) => sum + (item.tax || 0), 0);
//     const calculatedGrandTotal = grandTotal || (calculatedSubTotal + calculatedTotalTax - calculatedTotalDiscount);

//     let status = reqStatus || purchase.status || 'pending';
//     let paidAmount = 0;
//     let balanceAmount = calculatedGrandTotal;

//     if (sp_amount && sp_paid_amount) {
//       if (sp_paid_amount === sp_amount) {
//         status = 'paid';
//         paidAmount = sp_paid_amount;
//         balanceAmount = 0;
//       } else {
//         status = 'partially_paid';
//         paidAmount = sp_paid_amount;
//         balanceAmount = sp_amount - sp_paid_amount;
//       }
//     }

//     // Revert previous inventory changes before updating
//     if (purchase.status === 'paid' || purchase.status === 'partially_paid') {
//       for (const item of purchase.items) {
//         const inventory = await Inventory.findOne({ productId: item.id, userId }).session(session);
//         if (inventory) {
//           inventory.quantity -= item.qty || 0;
//           inventory.inventory_history.push({
//             unitId: item.unit,
//             quantity: inventory.quantity + (item.qty || 0),
//             notes: `Stock reverted from purchase update ${purchase.purchaseId}`,
//             type: 'stock_out',
//             adjustment: -(item.qty || 0),
//             referenceId: purchase._id,
//             referenceType: 'purchase',
//             createdBy: userId
//           });
//           await inventory.save({ session });
//         }
//       }
//     }

//     // Update purchase
//     purchase.vendorId = billTo;
//     purchase.purchaseDate = purchaseDate ? new Date(purchaseDate) : purchase.purchaseDate;
//     purchase.referenceNo = referenceNo || purchase.referenceNo;
//     purchase.items = items.map(item => ({
//       id: item.id,
//       name: item.name,
//       unit: item.unit,
//       qty: item.qty,
//       rate: item.rate,
//       discount: item.discount,
//       tax: item.tax,
//       tax_group_id: item.tax_group_id,
//       discount_type: item.discount_type,
//       discount_value: item.discount_value,
//       amount: item.amount
//     }));
//     purchase.status = status;
//     purchase.paymentMode = paymentMode || purchase.paymentMode;
//     purchase.taxableAmount = subTotal;
//     purchase.totalDiscount = totalDiscount;
//     purchase.totalTax = totalTax;
//     purchase.totalAmount = grandTotal;
//     purchase.paidAmount = paidAmount;
//     purchase.balanceAmount = balanceAmount;
//     purchase.notes = notes || purchase.notes;
//     purchase.termsAndCondition = termsAndCondition || purchase.termsAndCondition;
//     purchase.sign_type = sign_type || purchase.sign_type;
//     purchase.signatureId = signatureId || purchase.signatureId;
//     purchase.signatureImage = sign_type === 'eSignature' ? (req.file ? req.file.path : purchase.signatureImage) : null;
//     purchase.signatureName = sign_type === 'eSignature' ? (signatureName || purchase.signatureName) : null;
//     purchase.checkNumber = checkNumber || purchase.checkNumber;
//     purchase.bank = bank || purchase.bank;
//     purchase.userId = userId;
//     purchase.billFrom = billFrom;
//     purchase.billTo = billTo;

//     await purchase.save({ session });

//     // Update inventory for new items
//     if (status === 'paid' || status === 'partially_paid') {
//       for (const item of items) {
//         let inventory = await Inventory.findOne({ productId: item.id, userId }).session(session);
//         if (!inventory) {
//           inventory = new Inventory({ productId: item.id, userId, quantity: 0 });
//         }
//         const previousQuantity = inventory.quantity;
//         inventory.quantity += item.qty || 0;
//         inventory.inventory_history.push({
//           unitId: item.unit,
//           quantity: previousQuantity,
//           notes: `Stock in from updated purchase ${purchase.purchaseId}`,
//           type: 'stock_in',
//           adjustment: item.qty || 0,
//           referenceId: purchase._id,
//           referenceType: 'purchase',
//           createdBy: userId
//         });
//         await inventory.save({ session });
//       }
//     }

//     // Update supplier payment
//     await SupplierPayment.deleteMany({ purchaseId: purchase._id }).session(session);
//     if (status === 'paid' || status === 'partially_paid') {
//       const supplierPayment = new SupplierPayment({
//         purchaseId: purchase._id,
//         supplierId: billTo,
//         referenceNumber: req.body.sp_referenceNumber || '',
//         paymentDate: req.body.sp_paymentDate || '',
//         paymentMode: req.body.sp_paymentMode || '',
//         amount: req.body.sp_amount || '',
//         paidAmount: req.body.sp_amount || '',
//         dueAmount: req.body.sp_due_amount || '',
//         notes: req.body.sp_notes || '',
//         createdBy: userId
//       });
//       await supplierPayment.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       message: 'Purchase updated successfully',
//       data: { purchase }
//     });



//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error(err);
//     res.status(500).json({ message: 'Error updating purchase', error: err.message });
//   }
// };

const updatePurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      _id,
      purchaseId,
      userId,
      billFrom,
      billTo,
      referenceNo,
      supplier_bill_number,
      purchaseDate,
      purchaseBillDate,
      dueDate,
      items,
      notes,
      termsAndCondition,
      paymentMode,
      // totalTax,
      // totalDiscount,
      // grandTotal,
      // sign_type,
      // signatureId,
      // signatureName,
      checkNumber,
      bank,
      sp_amount,
      sp_paid_amount,
      sp_referenceNumber,
      status: reqStatus,
      overall_discount,
      dueDays,
      taxType,
      gstType,

      // ✅ Broker
      brokerId,
      brokerName,
      brokerPhone,
      brokerCommissionType,
      brokerCommissionValue
    } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "Purchase ID is required" });
    }

    const purchase = await Purchase.findById(_id);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    const previousItems = Array.isArray(purchase.items) ? purchase.items : [];
    const previousBrokerPhone = purchase.broker?.phone || null;

    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);
    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: "Invalid bill from or bill to user ID" });
    }

    // Signature validation
    // const validSignatureTypes = ["none", "digitalSignature", "eSignature"];
    // if (sign_type && !validSignatureTypes.includes(sign_type)) {
    //   return res.status(400).json({ message: "Invalid signature type" });
    // }

    // if (sign_type === "eSignature") {
    //   if (!req.file && !purchase.signatureImage) {
    //     return res.status(400).json({ message: "Signature image is required for eSignature" });
    //   }
    //   if (!signatureName && !purchase.signatureName) {
    //     return res.status(400).json({ message: "Signature name is required for eSignature" });
    //   }
    // }

    const effectiveTaxType = taxType || purchase.taxType || "GST";
    const effectiveGstType =
      effectiveTaxType === "Non-GST" ? null : (gstType || purchase.gstType || "Exclusive");

    /* ----------------------------------------------------
      1️⃣ Normalize items (qty × rate only)
    ---------------------------------------------------- */
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const overallDiscount = Number(overall_discount) || 0;
    const normalizedItems = items.map(item => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const discount = Number(item.discount) || 0;
      const lineTotal = qty * rate;
      if (discount < 0 || discount > lineTotal) {
        throw new Error("Invalid discount amount.");
      }
      const itemTax = (effectiveTaxType === "GST") ? (Number(item.tax) || 0) : 0;
      const netBase = lineTotal - discount;
      const amount = (effectiveTaxType === "GST" && effectiveGstType === "Inclusive")
        ? netBase
        : netBase + itemTax;
      subTotal += lineTotal;
      totalDiscount += discount;
      totalTax += itemTax;

      return {
        id: item.product_id || item.id,
        productId: item.product_id || item.id,
        name: item.name,
        hsn_code: item.hsn_code,

        variantId: item.variantId || null,
        variantName: item.variantName || "",
        variantDesignNo: item.variantDesignNo || "",
        variantColor: item.variantColor || "",
        variantSize: item.variantSize || "",

        unit: item.unit || "",
        qty,
        rate,
        discount,
        tax: itemTax,
        tax_group_id: item.tax_group_id || null,
        discount_type: item.discount_type || "Fixed",
        discount_value: item.discount_value || 0,
        amount,
      };
    });

    /* ----------------------------------------------------
       2️⃣ Calculate totalAmount
    ---------------------------------------------------- */
    const totalAmount = Math.max(
      (effectiveTaxType === "GST" && effectiveGstType === "Inclusive" ? subTotal : subTotal + totalTax) -
      totalDiscount - overallDiscount,
      0
    );

    // Calculations
    // const calculatedSubTotal = subTotal || items.reduce((sum, item) => sum + (item.amount || (item.qty * (item.rate || 0))), 0);
    // const calculatedTotalDiscount = totalDiscount || items.reduce((sum, item) => sum + (item.discount || 0), 0);
    // const calculatedTotalTax = totalTax || items.reduce((sum, item) => sum + (item.tax || 0), 0);
    // const calculatedGrandTotal = grandTotal || (calculatedSubTotal + calculatedTotalTax - calculatedTotalDiscount);

    /* ----------------------------------------------------
      Broker commission (record only, items-based)
    ---------------------------------------------------- */
    let resolvedBroker = null;
    let resolvedCommissionType = null;
    let resolvedCommissionValue = 0;
    let brokerCommissionAmount = 0;

    if (brokerId || (brokerName && brokerPhone)) {
      if (brokerId) {
        resolvedBroker = await BrokerDetail.findOne({ _id: brokerId, isDeleted: false });
      } else if (brokerPhone) {
        resolvedBroker = await BrokerDetail.findOne({ phone: brokerPhone, isDeleted: false });
        if (!resolvedBroker) {
          resolvedBroker = await BrokerDetail.create({
            name: brokerName || brokerPhone,
            phone: brokerPhone,
            commissionType: brokerCommissionType || 'Percentage',
            commissionValue: brokerCommissionValue !== undefined ? Number(brokerCommissionValue) : 0,
            userId
          });
        }
      }

      if (!resolvedBroker) {
        return res.status(404).json({ message: "Broker not found" });
      }

      resolvedCommissionType = brokerCommissionType || resolvedBroker.commissionType || 'Percentage';
      resolvedCommissionValue =
        brokerCommissionValue !== undefined && brokerCommissionValue !== null && brokerCommissionValue !== ""
          ? Number(brokerCommissionValue)
          : Number(resolvedBroker.commissionValue) || 0;

      brokerCommissionAmount =
        resolvedCommissionType === 'Percentage'
          ? (totalAmount * resolvedCommissionValue) / 100
          : resolvedCommissionValue;
    }

    // const finalAmount = baseAmount + brokerCommissionAmount;
    const finalAmount = totalAmount;
    
    let status = reqStatus || purchase.status || "pending";
    let paidAmount = purchase.paidAmount || 0;
    let balanceAmount = Math.max(finalAmount - paidAmount, 0);

    // if (sp_amount && sp_paid_amount) {
    //   if (sp_paid_amount === sp_amount) {
    //     status = "paid";
    //     paidAmount = sp_paid_amount;
    //     balanceAmount = 0;
    //   } else {
    //     status = "partially_paid";
    //     paidAmount = sp_paid_amount;
    //     balanceAmount = sp_amount - sp_paid_amount;
    //   }
    // }

    const spAmount = Number(sp_amount) || 0;
    const spPaidAmount = Number(sp_paid_amount) || 0;

    if (sp_paid_amount !== undefined && sp_paid_amount !== null && sp_paid_amount !== "") {
      if (spPaidAmount < 0) {
        return res.status(400).json({ message: "Paid amount cannot be negative." });
      }
    if (spPaidAmount > finalAmount) {
      return res.status(400).json({ message: "Paid amount cannot exceed total amount." });
    }
      paidAmount = spPaidAmount;
      balanceAmount = Math.max(finalAmount - paidAmount, 0);
    }

    if (paidAmount === 0) {
      status = "pending";
    } else if (balanceAmount === 0) {
      status = "paid";
    } else {
      status = "partially_paid";
    }

    const statusAffectsStock = (value) =>
      value === "paid" || value === "partially_paid" || value === "pending";
    const previousAffectsStock = statusAffectsStock(purchase.status);
    const currentAffectsStock = statusAffectsStock(status);

    // Update purchase
    purchase.vendorId = billTo;
    purchase.purchaseDate = purchaseDate ? new Date(purchaseDate) : purchase.purchaseDate;
    purchase.purchaseBillDate = purchaseBillDate
      ? new Date(purchaseBillDate)
      : purchase.purchaseBillDate;
    purchase.dueDate = dueDate
      ? new Date(dueDate)
      : purchaseBillDate
        ? new Date(purchaseBillDate)
        : purchaseDate
          ? new Date(purchaseDate)
          : purchase.dueDate;
    if (dueDays !== undefined) {
      purchase.dueDays = dueDays !== null && dueDays !== ""
        ? Number(dueDays)
        : null;
    }
    purchase.referenceNo = referenceNo || sp_referenceNumber || purchase.referenceNo;
    purchase.supplier_bill_number = supplier_bill_number || sp_referenceNumber || purchase.supplier_bill_number;
    // purchase.items = items;
    purchase.items = normalizedItems;
    purchase.status = status;
    // purchase.paymentMode = paymentMode || purchase.paymentMode;
    purchase.paymentMode = paymentMode || req.body.sp_paymentMode || purchase.paymentMode || null;
    // purchase.taxableAmount = calculatedSubTotal;
    // purchase.totalDiscount = calculatedTotalDiscount;
    // purchase.totalTax = calculatedTotalTax;
    // purchase.totalAmount = calculatedGrandTotal;
    purchase.totalAmount = totalAmount;      // grand total after discount
    purchase.totalDiscount = totalDiscount;
    purchase.totalTax = totalTax;
    purchase.overall_discount = overallDiscount;
    purchase.taxType = effectiveTaxType;
    purchase.gstType = effectiveTaxType === "Non-GST" ? null : effectiveGstType;
    purchase.finalAmount = finalAmount;      // same as totalAmount
    purchase.paidAmount = paidAmount;
    purchase.balanceAmount = balanceAmount;
    purchase.notes = notes || purchase.notes;
    purchase.termsAndCondition = termsAndCondition || purchase.termsAndCondition;
    // purchase.sign_type = sign_type || purchase.sign_type;
    // purchase.signatureId = signatureId || purchase.signatureId;
    // purchase.signatureImage = sign_type === "eSignature" ? (req.file ? req.file.path : purchase.signatureImage) : null;
    // purchase.signatureName = sign_type === "eSignature" ? (signatureName || purchase.signatureName) : null;
    purchase.checkNumber = checkNumber || purchase.checkNumber;
    purchase.bank = bank || purchase.bank;
    purchase.userId = userId;
    purchase.billFrom = billFrom;
    purchase.billTo = billTo;

    if (resolvedBroker) {
      purchase.broker = {
        brokerId: resolvedBroker._id,
        name: resolvedBroker.name,
        phone: resolvedBroker.phone,
        commissionType: resolvedCommissionType,
        commissionValue: resolvedCommissionValue,
        commissionAmount: brokerCommissionAmount
      };
    } else if (!brokerId && !brokerPhone && !brokerName) {
      purchase.broker = undefined;
    }

    await purchase.save();

    if (resolvedBroker) {
      await upsertBrokerDealForPurchase({
        brokerDetail: resolvedBroker,
        purchase,
        commissionType: resolvedCommissionType,
        commissionValue: resolvedCommissionValue,
        commissionAmount: brokerCommissionAmount,
        userId
      });
      if (previousBrokerPhone && previousBrokerPhone !== resolvedBroker.phone) {
        await Broker.updateOne(
          { phone: previousBrokerPhone, isDeleted: false },
          { $pull: { deals: { purchaseId: purchase._id } } }
        );
      }
    } else if (previousBrokerPhone) {
      await Broker.updateOne(
        { phone: previousBrokerPhone, isDeleted: false },
        { $pull: { deals: { purchaseId: purchase._id } } }
      );
    }

    const buildQtyMap = (list) => {
      const map = new Map();
      for (const item of list) {
        if (!item || !item.variantId) continue;
        const key = String(item.variantId);
        const qty = Number(item.qty) || 0;
        const unit = item.unit || "";
        const productId = item.productId || item.product_id || "";
        const existing = map.get(key);
        if (existing) {
          existing.qty += qty;
        } else {
          map.set(key, { qty, unit, productId });
        }
      }
      return map;
    };

    const previousQtyByVariant = buildQtyMap(previousItems);
    const currentQtyByVariant = buildQtyMap(normalizedItems);
    const allVariantIds = new Set([
      ...previousQtyByVariant.keys(),
      ...currentQtyByVariant.keys()
    ]);

    for (const variantId of allVariantIds) {
      const prev = previousQtyByVariant.get(variantId) || { qty: 0, unit: "", productId: "" };
      const curr = currentQtyByVariant.get(variantId) || { qty: 0, unit: "", productId: "" };
      let delta = 0;

      if (previousAffectsStock && currentAffectsStock) {
        delta = (curr.qty || 0) - (prev.qty || 0);
      } else if (previousAffectsStock && !currentAffectsStock) {
        delta = -(prev.qty || 0);
      } else if (!previousAffectsStock && currentAffectsStock) {
        delta = curr.qty || 0;
      }

      if (!delta) continue;
      const unitId = curr.unit || prev.unit || "";

      await Inventory.findOneAndUpdate(
        { variantId, userId, isDeleted: false },
        {
          $inc: { quantity: delta },
          $setOnInsert: {
            productId: curr.productId || prev.productId || null
          },
          $push: {
            inventory_history: {
              unitId,
              quantity: 0,
              notes: `Stock ${delta > 0 ? "in" : "out"} from updated purchase ${purchase.purchaseId}`,
              type: delta > 0 ? "stock_in" : "stock_out",
              adjustment: delta,
              referenceId: purchase._id,
              referenceType: "purchase",
              createdBy: userId,
            }
          }
        },
        { upsert: true, new: true }
      );
    }

    // Supplier Payments
    await SupplierPayment.deleteMany({ purchaseId: purchase._id });
    if (status === "paid" || status === "partially_paid") {
      await SupplierPayment.create({
        purchaseId: purchase._id,
        supplierId: billTo,

        // ✅ REQUIRED — SAME AS createPurchase
        sourceType: req.body.sp_sourceType || "ON_ACCOUNT",

        referenceNumber: req.body.sp_referenceNumber || "",
        paymentDate: req.body.sp_paymentDate || "",
        paymentMode: req.body.sp_paymentMode || "",
        bankId: req.body.sp_bankId || null,
        // amount: sp_amount || "",
        amount: paidAmount,
        // paidAmount: sp_paid_amount || "",
        paidAmount,
        // dueAmount: req.body.sp_due_amount || "",
        dueAmount: balanceAmount,
        notes: req.body.sp_notes || "",
        createdBy: userId,
      });
    }

    res.status(200).json({ message: "Purchase updated successfully", data: { purchase } });

  } catch (err) {
    console.error(err);
    if (err.message === "Invalid discount amount.") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Error updating purchase", error: err.message });
  }
};

// Get all purchases
const getAllPurchases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search = '',
      vendorId,
      startDate,
      endDate,
      paymentMode
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {
      isDeleted: false
    };

    // Add status filter
    if (status && ['pending', 'completed', 'cancelled', 'partially_paid', 'paid'].includes(status)) {
      query.status = status;
    }

    // Add vendor filter
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    // Add payment mode filter
    if (paymentMode) {
      query.paymentMode = { $exists: true, $ne: null };
    }

    // Add date range filter
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.purchaseDate.$lte = new Date(endDate);
      }
    }

    // Add search filter
    if (search) {
      query.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { supplier_bill_number: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await Purchase.countDocuments(query);

    // Build base query
    let purchaseQuery = Purchase.find(query)
      .populate('vendorId', 'firstName lastName email phone')
      .populate('userId', 'firstName lastName email')
      .populate('billFrom', 'firstName lastName email profileImage phone')
      .populate('billTo', 'firstName lastName email profileImage phone')
      .populate({
        path: 'bank',
        model: 'BankDetail',
        select: 'bankName accountNumber accountHoldername IFSCCode'
      })
      .populate({
        path: 'paymentMode',
        model: 'PaymentMode',
        select: 'name slug status'
      })
      .sort({ createdAt: -1 })  // Changed from purchaseDate to createdAt for descending order
      .skip(skip)
      .limit(Number(limit));

    // Conditionally populate paymentMode only when paymentMode filter is applied
    // if (paymentMode) {
    //   purchaseQuery = purchaseQuery.populate({
    //     path: 'paymentMode',
    //     model: 'PaymentMode',
    //     select: 'name slug status',
    //     match: { _id: mongoose.Types.ObjectId.isValid(paymentMode) ? mongoose.Types.ObjectId(paymentMode) : null }
    //   });
    // }

    // Execute query
    const purchases = await purchaseQuery;

    const formattedPurchases = await Promise.all(purchases.map(async (purchase) => {
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      const signatureImage = purchase.signatureImage
        ? `${baseUrl}${purchase.signatureImage.replace(/\\/g, '/')}`
        : null;

      // Format dates as "dd, MMM yyyy"
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear();
        return `${day}, ${month} ${year}`;
      };

      // Vendor details
      const vendorDetails = purchase.vendorId ? {
        id: purchase.vendorId._id,
        name: `${purchase.vendorId.firstName || ''} ${purchase.vendorId.lastName || ''}`.trim(),
        email: purchase.vendorId.email || null,
        phone: purchase.vendorId.phone || null
      } : null;

      // User details (who created the purchase)
      const userDetails = purchase.userId ? {
        id: purchase.userId._id,
        name: `${purchase.userId.firstName || ''} ${purchase.userId.lastName || ''}`.trim(),
        email: purchase.userId.email || null
      } : null;

      // BillFrom details
      const billFromDetails = purchase.billFrom ? {
        id: purchase.billFrom._id,
        name: `${purchase.billFrom.firstName || ''} ${purchase.billFrom.lastName || ''}`.trim(),
        email: purchase.billFrom.email || null,
        phone: purchase.billFrom.phone || null,
        profileImage: purchase.billFrom.profileImage
          ? `${baseUrl}${purchase.billFrom.profileImage.replace(/\\/g, '/')}`
          : ''
      } : null;

      // BillTo details
      const billToDetails = purchase.billTo ? {
        id: purchase.billTo._id,
        name: `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim(),
        email: purchase.billTo.email || null,
        phone: purchase.billTo.phone || null,
        profileImage: purchase.billTo.profileImage
          ? `${baseUrl}${purchase.billTo.profileImage.replace(/\\/g, '/')}`
          : ''
      } : null;

      // Bank details
      const bankDetails = purchase.bank ? {
        id: purchase.bank._id,
        name: purchase.bank.bankName || null,
        accountNumber: purchase.bank.accountNumber || null,
        accountHolderName: purchase.bank.accountHoldername || null,
        ifscCode: purchase.bank.IFSCCode || null
      } : null;

      // Payment mode details (only if paymentMode was populated)
      const paymentModeDetails = purchase.paymentMode ? {
        id: purchase.paymentMode._id,
        name: purchase.paymentMode.name,
        slug: purchase.paymentMode.slug,
        status: purchase.paymentMode.status
      } : null;

      // Signature details
      const signatureDetails = purchase.sign_type === 'eSignature' ? {
        name: purchase.signatureName || null,
        image: signatureImage
      } : purchase.signatureId ? {
        id: purchase.signatureId._id,
        name: purchase.signatureId.signatureName || null
      } : null;

      return {
        id: purchase._id,
        purchaseId: purchase.purchaseId,
        vendor: vendorDetails,
        user: userDetails,
        purchaseDate: formatDate(purchase.purchaseDate),
        purchaseBillDate: formatDate(purchase.purchaseBillDate),
        dueDate: formatDate(purchase.dueDate),
        dueDays: purchase.dueDays ?? null,
        referenceNo: purchase.referenceNo,
        supplier_bill_number: purchase.supplier_bill_number,
        status: purchase.status,
        paymentMode: paymentModeDetails,
        taxableAmount: purchase.taxableAmount,
        totalDiscount: purchase.totalDiscount,
        totalTax: purchase.totalTax,
        totalAmount: purchase.totalAmount,
        paidAmount: purchase.paidAmount,
        balanceAmount: purchase.balanceAmount,
        itemsCount: purchase.items.length,
        billFrom: billFromDetails,
        billTo: billToDetails,
        notes: purchase.notes,
        termsAndCondition: purchase.termsAndCondition,
        sign_type: purchase.sign_type,
        signature: signatureDetails,
        bank: bankDetails,
        checkNumber: purchase.checkNumber,
        createdAt: formatDate(purchase.createdAt),
        updatedAt: formatDate(purchase.updatedAt)
      };
    }));

    res.status(200).json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: {
        purchases: formattedPurchases,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get all purchases error:', err);
    res.status(500).json({
      message: 'Error fetching purchases',
      error: err.message
    });
  }
};

const listPurchasesMinimal = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const userId = req.user;

    // Get all purchase IDs that already have a debit note
    const usedPurchaseIds = await DebitNote.find({ userId, isDeleted: false }).distinct('purchaseId');

    // Build query
    const query = {
      userId,
      isDeleted: false,
      status: { $in: ['paid', 'pending', 'partially_paid'] },
      _id: { $nin: usedPurchaseIds } // Filter out used purchases
    };

    // Add search filter if search term exists
    if (search) {
      query.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { 'vendorId.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Get purchases with different limits based on search
    const purchases = await Purchase.find(query)
      .select('_id purchaseId referenceNo purchaseDate status totalAmount vendorId')
      .populate('vendorId', 'name') // Minimal vendor info
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 20); // No limit when searching, limit 20 otherwise

    // Get payment details for these purchases
    const paymentDetails = await SupplierPayment.find({
      purchaseId: { $in: purchases.map(p => p._id) }
    }).select('purchaseId amount paidAmount dueAmount paymentDate');

    // Create a map of purchaseId to payment details for quick lookup
    const paymentMap = paymentDetails.reduce((map, payment) => {
      map[payment.purchaseId.toString()] = {
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        dueAmount: payment.dueAmount,
        paymentDate: payment.paymentDate
      };
      return map;
    }, {});

    // Format response
    const formattedPurchases = purchases.map(purchase => {
      const paymentInfo = paymentMap[purchase._id.toString()] || null;

      return {
        id: purchase._id,
        purchaseId: purchase.purchaseId,
        referenceNo: purchase.referenceNo,
        purchaseDate: purchase.purchaseDate,
        status: purchase.status,
        totalAmount: purchase.totalAmount,
        vendor: purchase.vendorId ? {
          id: purchase.vendorId._id,
          name: purchase.vendorId.name
        } : null,
        // Add payment details if available
        payment: paymentInfo ? {
          amount: paymentInfo.amount,
          paidAmount: paymentInfo.paidAmount,
          dueAmount: paymentInfo.dueAmount,
          paymentDate: paymentInfo.paymentDate
        } : null
      };
    });

    res.status(200).json({
      success: true,
      message: search
        ? 'Search results for purchases retrieved successfully'
        : 'Last 20 purchases (paid/pending/partially paid) retrieved successfully',
      data: formattedPurchases,
      meta: {
        count: purchases.length,
        isSearchResult: !!search
      }
    });

  } catch (err) {
    console.error('List minimal purchases error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: err.message
    });
  }
};

const listPurchasesPending = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const userId = req.user;

    // Build the base query
    const query = {
      userId,
      isDeleted: false
    };

    // Add search conditions if search term exists
    if (search.trim()) {
      query.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
      ];
    }

    // Fetch purchases with optimized projection
    const purchases = await Purchase.find(query)
      .select('_id purchaseId referenceNo purchaseDate status totalAmount billTo')
      .populate('billTo', 'name')
      .sort({ createdAt: -1 })
      .limit(search.trim() ? 0 : 20)
      .lean();

    // Early return if no purchases found
    if (!purchases.length) {
      return res.status(200).json({
        success: true,
        message: 'No pending purchases found',
        data: [],
        meta: {
          count: 0,
          isSearchResult: !!search.trim()
        }
      });
    }

    // Get all payment details for these purchases in a single query
    const purchaseIds = purchases.map(p => p._id);
    const paymentDetails = await SupplierPayment.find({
      purchaseId: { $in: purchaseIds },
      isDeleted: false
    }).select('purchaseId amount paidAmount dueAmount')
      .lean();

    // Create aggregated payment information for each purchase
    const paymentAggregation = paymentDetails.reduce((acc, payment) => {
      const purchaseId = payment.purchaseId.toString();

      if (!acc[purchaseId]) {
        acc[purchaseId] = {
          amount: 0,
          paidAmount: 0,
          dueAmount: 0
        };
      }

      acc[purchaseId].amount += payment.amount || 0;
      acc[purchaseId].paidAmount += payment.paidAmount || 0;
      acc[purchaseId].dueAmount += payment.dueAmount || 0;

      return acc;
    }, {});

    // Process purchases with optimized filtering and mapping
    const formattedPurchases = purchases.reduce((result, purchase) => {
      const purchaseIdStr = purchase._id.toString();
      const paymentInfo = paymentAggregation[purchaseIdStr];

      // Calculate due amount based on purchase total and payments
      const calculatedDueAmount = purchase.totalAmount - (paymentInfo?.paidAmount || 0);

      // Skip purchases with no due amount
      if (calculatedDueAmount <= 0) {
        return result;
      }

      result.push({
        id: purchase._id,
        purchaseId: purchase.purchaseId,
        referenceNo: purchase.referenceNo,
        purchaseDate: purchase.purchaseDate,
        status: purchase.status,
        totalAmount: purchase.totalAmount,
        vendor: purchase.billTo ? {
          id: purchase.billTo._id,
          name: purchase.billTo.name
        } : null,
        payment: paymentInfo ? {
          amount: paymentInfo.amount,
          paidAmount: paymentInfo.paidAmount,
          dueAmount: calculatedDueAmount,
          paymentDate: paymentInfo.paymentDate
        } : {
          amount: 0,
          paidAmount: 0,
          dueAmount: purchase.totalAmount,
          paymentDate: null
        }
      });

      return result;
    }, []);

    res.status(200).json({
      success: true,
      message: search.trim()
        ? 'Search results for pending purchases retrieved successfully'
        : 'Pending purchases retrieved successfully',
      data: formattedPurchases,
      meta: {
        count: formattedPurchases.length,
        isSearchResult: !!search.trim()
      }
    });

  } catch (err) {
    console.error('List pending purchases error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending purchases',
      error: err.message
    });
  }
};

// Get purchase by ID
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('vendorId', 'firstName lastName email phone')
      .populate('userId', 'firstName lastName email')
      .populate('billFrom', 'firstName lastName email profileImage phone address')
      .populate('billTo', 'firstName lastName email profileImage phone address')
      .populate({
        path: 'bank',
        model: 'BankDetail',
        select: 'bankName accountNumber accountHoldername IFSCCode branchName'
      })
      .populate({
        path: 'paymentMode',
        model: 'PaymentMode',
        select: 'name slug status'
      })
      // .populate({
      //   path: 'signatureId',
      //   model: 'Signature',
      //   select: 'signatureName signatureImage createdAt'
      // });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    // Vendor details
    const vendorDetails = purchase.vendorId ? {
      id: purchase.vendorId._id,
      name: `${purchase.vendorId.firstName || ''} ${purchase.vendorId.lastName || ''}`.trim(),
      email: purchase.vendorId.email || null,
      phone: purchase.vendorId.phone || null
    } : null;

    // User details
    const userDetails = purchase.userId ? {
      id: purchase.userId._id,
      name: `${purchase.userId.firstName || ''} ${purchase.userId.lastName || ''}`.trim(),
      email: purchase.userId.email || null
    } : null;

    // BillFrom details
    const billFromDetails = purchase.billFrom ? {
      id: purchase.billFrom._id,
      name: `${purchase.billFrom.firstName || ''} ${purchase.billFrom.lastName || ''}`.trim(),
      email: purchase.billFrom.email || null,
      phone: purchase.billFrom.phone || null,
      address: purchase.billFrom.address || null,
      profileImage: purchase.billFrom.profileImage
        ? `${baseUrl}${purchase.billFrom.profileImage.replace(/\\/g, '/')}`
        : ''
    } : null;

    let supplierDetails = null;

    if (purchase.billTo?._id) {
      supplierDetails = await Supplier.findOne({
        user_id: purchase.billTo._id,
        isDeleted: false
      }).lean();
    }

    // BillTo details
    const billToDetails = purchase.billTo ? {
      // ✅ USER DATA (from Purchase)
      id: purchase.billTo._id,
      name: `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim(),
      email: purchase.billTo.email || null,
      phone: purchase.billTo.phone || null,
      address: purchase.billTo.address || null,
      profileImage: purchase.billTo.profileImage
        ? `${baseUrl}${purchase.billTo.profileImage.replace(/\\/g, '/')}`
        : '',

      // ✅ SUPPLIER DATA (business info)
      companyName: supplierDetails?.company_name || null,
      companyAddress: supplierDetails?.company_address || null,
      city: supplierDetails?.city || null,
      state: supplierDetails?.state || null,
      pinCode: supplierDetails?.pin_code || null,
      gstNo: supplierDetails?.gst_no || null,
      panNo: supplierDetails?.pan_no || null,
      accounts: supplierDetails?.account_details || []
    } : null;


    const bankDetails = purchase.bank ? {
      id: purchase.bank._id,
      name: purchase.bank.bankName || null,
      accountNumber: purchase.bank.accountNumber || null,
      accountHolderName: purchase.bank.accountHoldername || null,
      ifscCode: purchase.bank.IFSCCode || null,
      branchName: purchase.bank.branchName || null
    } : null;


    const paymentModeDetails = purchase.paymentMode ? {
      id: purchase.paymentMode._id,
      name: purchase.paymentMode.name || null,
      slug: purchase.paymentMode.slug || null,
      status: purchase.paymentMode.status ?? null
    } : null;

    const brokerDetails = purchase.broker
      ? {
        brokerId: purchase.broker.brokerId || null,
        name: purchase.broker.name || null,
        phone: purchase.broker.phone || null,
        commissionType: purchase.broker.commissionType || "Percentage",
        commissionValue: purchase.broker.commissionValue || 0,
        commissionAmount: purchase.broker.commissionAmount || 0
      }
      : null;

    // const expenseDetails = purchase.expenses
    // ? {
    //     garageCharges: purchase.expenses.garageCharges || 0,
    //     loadingCharges: purchase.expenses.loadingCharges || 0,
    //     unloadingCharges: purchase.expenses.unloadingCharges || 0,
    //     transportCharges: purchase.expenses.transportCharges || 0,
    //     otherCharges: purchase.expenses.otherCharges || 0,
    //     expenseNotes: purchase.expenses.expenseNotes || "",
    //     totalExpenses: purchase.expenses.totalExpenses || 0
    //   }
    // : {
    //     garageCharges: 0,
    //     loadingCharges: 0,
    //     unloadingCharges: 0,
    //     transportCharges: 0,
    //     otherCharges: 0,
    //     expenseNotes: "",
    //     totalExpenses: 0
    // };


    // Signature details
    // let signatureDetails = null;
    // if (purchase.sign_type === 'eSignature') {
    //   const signatureImage = purchase.signatureImage
    //     ? `${baseUrl}${purchase.signatureImage.replace(/\\/g, '/')}`
    //     : null;
    //   signatureDetails = {
    //     name: purchase.signatureName || null,
    //     image: signatureImage,
    //     type: 'eSignature'
    //   };
    // } else if (purchase.signatureId) {
    //   const signatureImage = purchase.signatureId.signatureImage
    //     ? `${baseUrl}${purchase.signatureId.signatureImage.replace(/\\/g, '/')}`
    //     : null;
    //   signatureDetails = {
    //     id: purchase.signatureId._id,
    //     name: purchase.signatureId.signatureName || null,
    //     image: signatureImage,
    //     createdAt: purchase.signatureId.createdAt,
    //     type: 'digitalSignature'
    //   };
    // }

    // Items
    const formattedItems = purchase.items.map(item => ({
      id: item.id,
      name: item.name,
      hsn_code: item.hsn_code,
      // ✅ SAVE VARIANT
      variantId: item.variantId,
      variantName: item.variantName,
      variantDesignNo: item.variantDesignNo,
      variantColor: item.variantColor,
      variantSize: item.variantSize,
      unit: item.unit,
      qty: item.qty,
      rate: item.rate,
      discount: item.discount || 0,
      tax: item.tax || 0,
      tax_group_id: item.tax_group_id || null,
      // discount: item.discount,
      // tax: item.tax,
      // tax_group: item.tax_group_id ? {
      //   id: item.tax_group_id._id,
      //   name: item.tax_group_id.name,
      //   rate: item.tax_group_id.rate
      // } : null,
      // discount_type: item.discount_type,
      // discount_value: item.discount_value,
      amount: item.amount
    }));

    // Final response
    const responseData = {
      id: purchase._id,
      purchaseId: purchase.purchaseId,
      vendor: vendorDetails,
      user: userDetails,
      purchaseDate: purchase.purchaseDate,
      purchaseBillDate: purchase.purchaseBillDate,
      dueDate: purchase.dueDate,
      dueDays: purchase.dueDays ?? null,
      referenceNo: purchase.referenceNo,
      supplier_bill_number: purchase.supplier_bill_number,
      status: purchase.status,
      paymentMode: paymentModeDetails,
      // taxableAmount: purchase.taxableAmount,
      // totalDiscount: purchase.totalDiscount,
      // totalTax: purchase.totalTax,
      totalDiscount: purchase.totalDiscount,
      totalTax: purchase.totalTax,
      overall_discount: purchase.overall_discount,
      totalAmount: purchase.totalAmount,
      paidAmount: purchase.paidAmount,
      balanceAmount: purchase.balanceAmount,
      taxType: purchase.taxType || "GST",
      gstType: purchase.gstType || "Exclusive",

      // ✅ NEW
      // expenses: expenseDetails,
      broker: brokerDetails,
      finalAmount: purchase.finalAmount,

      items: formattedItems,
      billFrom: billFromDetails,
      billTo: billToDetails,
      notes: purchase.notes,
      termsAndCondition: purchase.termsAndCondition,
      // sign_type: purchase.sign_type,
      // signature: signatureDetails,
      bank: bankDetails,
      checkNumber: purchase.checkNumber,
      roundOff: purchase.roundOff,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Purchase retrieved successfully',
      data: responseData
    });
  } catch (err) {
    console.error('Get purchase by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase',
      error: err.message
    });
  }
};

// Update purchase status
const updatePurchaseStatus = async (req, res) => {
  try {
    const {
      status,
      sp_amount,
      sp_paid_amount,
      sp_referenceNumber,
      sp_paymentDate,
      sp_paymentMode,
      sp_notes
    } = req.body;

    const { id } = req.params;
    const userId = req.user._id; // Assuming user is authenticated

    const validStatuses = ['pending', 'completed', 'cancelled', 'partially_paid', 'paid'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    let purchase = await Purchase.findById(id)
      .populate('vendorId', 'firstName lastName email phone')
      .populate('userId', 'firstName lastName email')
      .populate('billFrom', 'firstName lastName email profileImage phone')
      .populate('billTo', 'firstName lastName email profileImage phone')
      .populate({ path: 'items.id', model: 'Product', select: 'name sku description' })
      .populate({ path: 'bank', model: 'BankDetail', select: 'bankName accountNumber accountHoldername IFSCCode' });

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    let paidAmount = purchase.paidAmount || 0;
    let balanceAmount = purchase.balanceAmount || 0;
    const incomingPaid = sp_paid_amount !== undefined && sp_paid_amount !== null && sp_paid_amount !== ""
      ? Number(sp_paid_amount)
      : null;
    if (incomingPaid !== null) {
      if (incomingPaid < 0) {
        return res.status(400).json({
          success: false,
          message: 'Paid amount cannot be negative'
        });
      }
      if (incomingPaid > purchase.totalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Paid amount cannot exceed total amount'
        });
      }
      paidAmount = incomingPaid;
    }
    balanceAmount = Math.max(Number(purchase.totalAmount || 0) - paidAmount, 0);
    let computedStatus = 'pending';
    if (paidAmount === 0) computedStatus = 'pending';
    else if (balanceAmount === 0) computedStatus = 'paid';
    else computedStatus = 'partially_paid';

    purchase.status = status === 'cancelled' ? 'cancelled' : computedStatus;
    purchase.paidAmount = paidAmount;
    purchase.balanceAmount = balanceAmount;
    await purchase.save();

    if (status === 'paid' || status === 'partially_paid') {
      let supplierPayment = await SupplierPayment.findOne({ purchaseId: purchase._id });

      if (supplierPayment) {
        supplierPayment.referenceNumber = sp_referenceNumber || supplierPayment.referenceNumber;
        supplierPayment.paymentDate = sp_paymentDate || supplierPayment.paymentDate;
        supplierPayment.paymentMode = sp_paymentMode || supplierPayment.paymentMode;
        supplierPayment.amount = sp_amount || purchase.totalAmount;
        supplierPayment.paidAmount = sp_paid_amount || paidAmount;
        supplierPayment.dueAmount = balanceAmount;
        supplierPayment.notes = sp_notes || supplierPayment.notes;
        await supplierPayment.save();
      } else {
        supplierPayment = new SupplierPayment({
          purchaseId: purchase._id,
          supplierId: purchase.billTo,
          referenceNumber: sp_referenceNumber || '',
          paymentDate: sp_paymentDate || new Date(),
          paymentMode: sp_paymentMode || purchase.paymentMode,
          amount: sp_amount || purchase.totalAmount,
          paidAmount: sp_paid_amount || paidAmount,
          dueAmount: balanceAmount,
          notes: sp_notes || '',
          createdBy: userId
        });
        await supplierPayment.save();
      }
    }

    if (status === 'paid') {
      for (const item of purchase.items) {
        let inventory = await Inventory.findOne({
          productId: item.id,
          userId: purchase.userId
        });

        if (!inventory) {
          inventory = new Inventory({
            productId: item.id,
            userId: purchase.userId,
            quantity: 0
          });
        }

        inventory.quantity += item.qty || 0;

        inventory.inventory_history.push({
          unitId: item.unit,
          quantity: inventory.quantity,
          notes: `Stock in from purchase ${purchase.purchaseId}`,
          type: 'stock_in',
          adjustment: item.qty || 0,
          referenceId: purchase._id,
          referenceType: 'purchase',
          createdBy: userId
        });

        await inventory.save();
      }
    }

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    const responseData = {
      id: purchase._id,
      purchaseId: purchase.purchaseId,
      purchaseDate: formatDate(purchase.purchaseDate),
      dueDate: formatDate(purchase.dueDate),
      referenceNo: purchase.referenceNo,
      status: purchase.status,
      paymentMode: purchase.paymentMode,
      taxableAmount: purchase.taxableAmount,
      totalDiscount: purchase.totalDiscount,
      totalTax: purchase.totalTax,
      totalAmount: purchase.totalAmount,
      paidAmount: purchase.paidAmount,
      balanceAmount: purchase.balanceAmount,
      items: purchase.items.map(item => ({
        id: item.id?._id || null,
        product: item.id ? {
          id: item.id._id,
          name: item.id.name,
          sku: item.id.sku,
          description: item.id.description
        } : null,
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount
      })),
      notes: purchase.notes,
      termsAndCondition: purchase.termsAndCondition,
      sign_type: purchase.sign_type,
      checkNumber: purchase.checkNumber,
      createdAt: formatDate(purchase.createdAt),
      updatedAt: formatDate(purchase.updatedAt)
    };

    res.status(200).json({
      success: true,
      message: 'Purchase status updated successfully',
      data: responseData
    });

  } catch (err) {
    console.error('Update purchase status error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating purchase status',
      error: err.message
    });
  }
};

// Delete purchase (soft delete) + remove supplier payments
const deletePurchaseById = async (purchaseId) => {
  const purchase = await Purchase.findByIdAndDelete(purchaseId);
  if (!purchase) {
    return false;
  }
  await SupplierPayment.deleteMany({ purchaseId: purchase._id });
  return true;
};

const deletePurchase = async (req, res) => {
  try {
    const ok = await deletePurchaseById(req.params.id);
    if (!ok) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    res.status(200).json({
      message: 'Purchase deleted successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Error deleting purchase',
      error: err.message
    });
  }
};

const bulkDeletePurchases = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const purchases = await Purchase.find({}).select('_id');
      targetIds = purchases.map(p => p._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide purchase ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deletePurchaseById(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: 'Purchases deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error deleting purchases',
      error: err.message
    });
  }
};

// Create supplier payment for a purchase
const createSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      purchaseId,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      notes,
      userId
    } = req.body;

    // Validate purchase exists
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(422).json({ message: 'Invalid user ID' });
    }

    // Create supplier payment
    const supplierPayment = new SupplierPayment({
      purchaseId,
      supplierId: purchase.vendorId,
      paymentDate: new Date(paymentDate),
      paymentMode,
      amount,
      referenceNumber,
      notes,
      status: 'completed',
      createdBy: userId
    });

    await supplierPayment.save();

    // Update purchase payment status
    const newPaidAmount = purchase.paidAmount + amount;
    const balanceAmount = purchase.totalAmount - newPaidAmount;

    let status = purchase.status;
    if (balanceAmount <= 0) {
      status = 'paid';
    } else if (newPaidAmount > 0) {
      status = 'partially_paid';
    }

    await Purchase.findByIdAndUpdate(
      purchaseId,
      {
        paidAmount: newPaidAmount,
        balanceAmount,
        status
      }
    );

    res.status(201).json({
      message: 'Supplier payment created successfully',
      data: supplierPayment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Error creating supplier payment',
      error: err.message
    });
  }
};

// Get all supplier payments for a purchase
const getSupplierPayments = async (req, res) => {
  try {
    const payments = await SupplierPayment.find({
      purchaseId: req.params.purchaseId,
      isDeleted: false
    })
      .populate('supplierId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1 });

    res.status(200).json({
      message: 'Supplier payments retrieved successfully',
      data: payments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Error retrieving supplier payments',
      error: err.message
    });
  }
};

// Upload Purchases from Excel
const uploadPurchasesFromExcel = async (req, res) => {
  try {
    // 1. Validate file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required'
      });
    }

    // 2. Read Excel file using exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel sheet not found'
      });
    }

    // Convert sheet to JSON
    const rows = [];
    let headers = [];
    
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Capture headers
        headers = row.values;
        if (Array.isArray(headers) && headers.length > 0 && headers[0] === undefined) {
          headers = headers.slice(1);
        }
      } else {
        // Map row to object
        const rowData = {};
        headers.forEach((header, index) => {
          if (header) {
            let cellValue = row.getCell(index + 1).value;
            
            // Handle Rich Text or specific types
            if (typeof cellValue === 'object' && cellValue !== null) {
              if (cellValue.text) cellValue = cellValue.text;
              else if (cellValue.result) cellValue = cellValue.result;
            }
            
            rowData[header] = cellValue;
          }
        });
        // Only add non-empty rows
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    });

    if (!rows.length) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel sheet is empty'
      });
    }

    // 3. Initialize results
    const results = {
      totalRows: rows.length,
      purchasesCreated: 0,
      errors: []
    };

    // 4. Group rows by Reference No
    const purchaseGroups = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;
        
        // Normalize keys
        const normalizeKey = (key) => Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
        const refKey = normalizeKey('Reference No') || normalizeKey('Ref No') || normalizeKey('Invoice No');
        
        const referenceNo = refKey ? row[refKey] : '';
        const groupKey = referenceNo && referenceNo.toString().trim() !== '' 
          ? referenceNo.toString().trim() 
          : `ROW_${rowNumber}_${Math.random()}`; // Unique key for rows without reference

        if (!purchaseGroups[groupKey]) {
          purchaseGroups[groupKey] = {
            referenceNo: referenceNo ? referenceNo.toString().trim() : '',
            rows: [],
            firstRowNumber: rowNumber
          };
        }
        purchaseGroups[groupKey].rows.push({ row, rowNumber });
    }

    const groupKeys = Object.keys(purchaseGroups);

    for (const groupKey of groupKeys) {
      const group = purchaseGroups[groupKey];
      const firstRowData = group.rows[0].row;
      const firstRowNumber = group.rows[0].rowNumber;

      try {
        // field mapping helpers
        const getVal = (keys) => {
          for (const key of keys) {
            const rowKey = Object.keys(firstRowData).find(k => k.toLowerCase() === key.toLowerCase());
            if (rowKey) return firstRowData[rowKey];
          }
          return null;
        };

        // 1. Supplier Lookup
        const supplierNameInput = getVal(['Supplier Name', 'Supplier', 'Party Name']);
        if (!supplierNameInput) throw new Error('Supplier Name is required');

        // Improved Supplier Lookup
        let supplier = null;

        // 1. Try finding in Supplier model (by company_name)
        const supplierDoc = await Supplier.findOne({
           company_name: { $regex: new RegExp(`^${supplierNameInput.trim()}$`, 'i') }
        });

        if (supplierDoc) {
           supplier = await User.findOne({ _id: supplierDoc.user_id, isDeleted: false });
        }

        // 2. Fallback: Try finding in User model (by firstName) if not found above
        if (!supplier) {
            supplier = await User.findOne({
              firstName: { $regex: new RegExp(`^${supplierNameInput.trim()}$`, 'i') },
              user_type: 2, // 2 = Supplier
              isDeleted: false
            });
        }

        // if (!supplier) throw new Error(`Supplier '${supplierNameInput}' not found`);

        // 2. Parse Date
        let purchaseDate = getVal(['Purchase Date', 'Date']);
        if (!purchaseDate) throw new Error('Purchase Date is required');
        
        if (typeof purchaseDate === 'string') {
            purchaseDate = new Date(purchaseDate);
        } else if (typeof purchaseDate === 'number') {
            // Excel serial date to JS Date
            purchaseDate = new Date(Math.UTC(1899, 11, 30) + (purchaseDate - 1) * 24 * 60 * 60 * 1000);
        }
        
        if (!purchaseDate || isNaN(purchaseDate.getTime())) throw new Error(`Invalid Purchase Date`);

        // 3. Due Date / Due Days (Optional)
        let dueDate = getVal(['Due Date', 'DueDate']);
        const dueDaysRaw = getVal(['Due Days', 'DueDays']);

        if (dueDate) {
          if (typeof dueDate === 'string') {
            dueDate = new Date(dueDate);
          } else if (typeof dueDate === 'number') {
            dueDate = new Date(Math.UTC(1899, 11, 30) + (dueDate - 1) * 24 * 60 * 60 * 1000);
          }
          if (!dueDate || isNaN(dueDate.getTime())) {
            throw new Error('Invalid Due Date');
          }
        } else if (dueDaysRaw !== null && dueDaysRaw !== undefined && dueDaysRaw !== '') {
          const dueDays = Number(dueDaysRaw);
          if (!Number.isFinite(dueDays) || dueDays < 0) {
            throw new Error('Invalid Due Days');
          }
          dueDate = new Date(purchaseDate);
          dueDate.setDate(dueDate.getDate() + dueDays);
        } else {
          dueDate = purchaseDate;
        }

        // 4. Status
        const statusVal = getVal(['Status']) || 'pending';
        const status = ['pending', 'ordered', 'received', 'paid', 'partially_paid'].includes(statusVal.toLowerCase()) 
          ? statusVal.toLowerCase() 
          : 'pending';

        // 5. Payment Mode Lookup (New Feature)
        let paymentModeId = null;
        const paymentModeName = getVal(['Payment Mode', 'Payment Type', 'Mode']);
        if (paymentModeName) {
           const paymentMode = await PaymentMode.findOne({
             name: { $regex: new RegExp(`^${paymentModeName.trim()}$`, 'i') }
           });
           if (paymentMode) {
             paymentModeId = paymentMode._id;
           }
           // If not found, we just leave it as null for legacy data, or we could handle it differently if needed.
           // Current requirement is just to import without strict validation errors.
        }

        // 6. Supplier Bill No (Optional)
        const supplierBillNo = getVal(['Supplier Bill No', 'Supplier Bill', 'Bill No']) || '';

        // 7. Broker (Optional)
        const brokerNameInput = getVal(['Broker Name', 'Broker']);
        let brokerDetail = null;
        if (brokerNameInput) {
          brokerDetail = await BrokerDetail.findOne({
            name: { $regex: new RegExp(`^${brokerNameInput.toString().trim()}$`, 'i') },
            isDeleted: false,
            userId: req.user
          });
        }

        // 8. Overall Discount (Optional)
        const overallDiscount = parseFloat(getVal(['Overall Discount', 'OverallDiscount']) || 0) || 0;

        // 8.1 Tax Type / GST Mode (Optional)
        const taxTypeRaw = (getVal(['Tax Type', 'TaxType']) || 'GST').toString().trim();
        const effectiveTaxType =
          taxTypeRaw.toLowerCase() === 'non-gst' || taxTypeRaw.toLowerCase() === 'nongst'
            ? 'Non-GST'
            : 'GST';
        const gstModeRaw = (getVal(['GST Mode', 'GST Type', 'GST Mode (Inclusive/Exclusive)']) || 'Exclusive')
          .toString()
          .trim();
        const effectiveGstType =
          effectiveTaxType === 'Non-GST'
            ? null
            : gstModeRaw.toLowerCase() === 'inclusive'
              ? 'Inclusive'
              : 'Exclusive';

        // 9. Build Items array
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        const purchaseItems = [];
        let hasItemError = false;

        for (const itemRow of group.rows) {
          const r = itemRow.row;
          const getRowVal = (keys) => {
             for (const key of keys) {
               const rowKey = Object.keys(r).find(k => k.toLowerCase() === key.toLowerCase());
               if (rowKey) return r[rowKey];
             }
             return null;
          };

          // Variant logic (Design No required)
          let variantId = null;
          const designNo = (getRowVal(['Variant (Design No)', 'Design No']) || '').toString().trim();
          const color = (getRowVal(['Variant (Color)', 'Color']) || '').toString().trim();
          const size = (getRowVal(['Variant (Size)', 'Size']) || '').toString().trim();
          if (!designNo) {
            results.errors.push({
              row: itemRow.rowNumber,
              reason: 'Variant (Design No) is required',
              data: r
            });
            hasItemError = true;
            break;
          }

          const variantQuery = { designNo: { $regex: `^${designNo}$`, $options: 'i' } };
          if (color) variantQuery.color = { $regex: `^${color}$`, $options: 'i' };
          if (size) variantQuery.size = { $regex: `^${size}$`, $options: 'i' };

          const variant = await ProductVariant.findOne(variantQuery);
          if (variant) {
            variantId = variant._id;
          }
          const product = variant ? await Product.findById(variant.productId).populate('unit') : null;
          const productName = product?.name || designNo || `Item ${itemRow.rowNumber}`;

          const quantity = parseFloat(getRowVal(['Quantity', 'Qty'])) || 0;
          const rate = parseFloat(getRowVal(['Rate', 'Price', 'Unit Price'])) || 0;
          
          if (quantity <= 0) {
              results.errors.push({ row: itemRow.rowNumber, reason: 'Invalid Quantity', data: r });
              hasItemError = true;
              break;
          }
          if (rate < 0) {
              results.errors.push({ row: itemRow.rowNumber, reason: 'Invalid Rate', data: r });
              hasItemError = true;
              break;
          }

          const gross = quantity * rate;
          let discountAmount = Math.max(0, Number(getRowVal([
            'Discount',
            'Item Discount',
            'Discount Value',
            'Item Discount Value'
          ]) || 0));
          if (discountAmount > gross) discountAmount = gross;

          const taxRateRaw = getRowVal([
            'Tax Rate',
            'GST Tax Rate',
            'GST Rate',
            'Tax %',
            'GST %'
          ]);
          const taxRate = Number(
            String(taxRateRaw ?? '')
              .replace('%', '')
              .trim()
          ) || 0;

          let itemTax = 0;
          let amount = 0;
          if (effectiveTaxType === 'GST' && effectiveGstType === 'Inclusive') {
            const netInclusive = gross - discountAmount;
            const divisor = 1 + taxRate / 100;
            const baseAmount = divisor > 0 ? netInclusive / divisor : netInclusive;
            itemTax = netInclusive - baseAmount;
            amount = netInclusive;
          } else {
            const netBase = gross - discountAmount;
            itemTax = effectiveTaxType === 'GST' ? netBase * (taxRate / 100) : 0;
            amount = netBase + itemTax;
          }

          totalAmount += amount;
          totalDiscount += discountAmount;
          totalTax += itemTax;

          const taxGroupId =
            effectiveTaxType === 'GST' ? await findTaxGroupByRate(taxRate) : null;

          purchaseItems.push({
            id: product ? product._id.toString() : (new mongoose.Types.ObjectId()).toString(), // Generate a placeholder ID if product not found
            name: productName,
            productId: product ? product._id : null, // keep actual ObjID if found
            productVariantId: variantId,
            quantity: quantity,
            qty: quantity,
            unitPrice: rate,
            rate: rate, // Added as schema expects 'rate'
            amount: amount, // Added as schema expects 'amount'
            tax: itemTax,
            tax_group_id: taxGroupId,
            discount: discountAmount,
            discount_type: 'Fixed',
            discount_value: discountAmount,
            totalAmount: amount
          });
        }

        if (hasItemError || purchaseItems.length === 0) {
           continue;
        }

        const generatedPurchaseId = await Purchase.generateNextPurchaseId();

        const grandTotal = Math.max(totalAmount - overallDiscount, 0);

        // Create Purchase
        const newPurchase = new Purchase({
          purchaseId: generatedPurchaseId,
          vendorId: supplier ? supplier._id : null,
          supplierName: supplier ? null : supplierNameInput, // Store name if supplier ID not found
          purchaseDate: purchaseDate,
          dueDate: dueDate, 
          referenceNo: group.referenceNo,
          supplier_bill_number: supplierBillNo || group.referenceNo,
          status: status,
          items: purchaseItems,
          totalAmount: grandTotal,
          totalDiscount: totalDiscount,
          totalTax: totalTax,
          overall_discount: overallDiscount,
          taxType: effectiveTaxType,
          gstType: effectiveGstType,
          grandTotal: grandTotal, 
          paidAmount: status === 'paid' ? grandTotal : 0,
          balanceAmount: status === 'paid' ? 0 : grandTotal,
          finalAmount: grandTotal,
          paymentMode: paymentModeId,
          userId: req.user,
          billFrom: req.user,
          billTo: supplier ? supplier._id : null,
          broker: brokerDetail
            ? {
                brokerId: brokerDetail._id,
                name: brokerDetail.name,
                phone: brokerDetail.phone,
                commissionType: brokerDetail.commissionType,
                commissionValue: brokerDetail.commissionValue,
                commissionAmount: 0
              }
            : undefined
        });

        await newPurchase.save();
        results.purchasesCreated++;

        // Inventory Update (if paid/partially_paid AND product exists)
        if ((status === 'paid' || status === 'partially_paid')) {
           for (const item of newPurchase.items) {
              // Only update inventory if we have a valid product ID
              if (item.productId) {
                  let inventory = await Inventory.findOne({
                    productId: item.productId,
                    variantId: item.productVariantId || null
                  });
                  
                  if (!inventory) {
                    inventory = new Inventory({
                          productId: item.productId,
                          variantId: item.productVariantId || null,
                          quantity: 0,
                          userId: req.user,
                          inventory_history: []
                    });
                  }
                  
                  inventory.quantity += item.quantity;
                  inventory.inventory_history.push({
                      quantity: inventory.quantity,
                      type: 'stock_in',
                      adjustment: item.quantity,
                      referenceType: 'purchase',
                      referenceId: newPurchase._id,
                      notes: `Stock in from Excel import`,
                      createdBy: req.user
                  });
                  
                  await inventory.save();
              }
           }
        }

      } catch (error) {
        results.errors.push({
          row: firstRowNumber,
          reason: error.message,
          data: firstRowData
        });
      }
    }

    fs.unlinkSync(req.file.path);
    res.status(200).json({
      success: true,
      message: 'Import processed',
      results
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Excel Import Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
};

// Download Sample Purchase Import Template
const downloadPurchaseExcelTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Purchases Import');

    // Define columns
    sheet.columns = [
      { header: 'Supplier Name', key: 'supplierName', width: 25 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Due Date', key: 'dueDate', width: 15 },
      { header: 'Due Days', key: 'dueDays', width: 12 },
      { header: 'Supplier Bill No', key: 'supplierBillNo', width: 18 },
      { header: 'Broker Name', key: 'brokerName', width: 20 },
      { header: 'Overall Discount', key: 'overallDiscount', width: 18 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'GST Mode', key: 'gstMode', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Rate', key: 'rate', width: 10 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Tax Rate', key: 'taxRate', width: 12 },
      { header: 'Reference No', key: 'referenceNo', width: 15 },
      { header: 'Variant (Design No)', key: 'variantDesignNo', width: 20 },
      { header: 'Variant (Color)', key: 'variantColor', width: 15 },
      { header: 'Variant (Size)', key: 'variantSize', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Mode', key: 'paymentMode', width: 15 } // Added Payment Mode
    ];

    // Add sample rows (Optional, but helpful for user)
    sheet.addRow({
      supplierName: 'ABC Traders',
      purchaseDate: new Date(),
      dueDate: '',
      dueDays: 15,
      supplierBillNo: 'SB-001',
      brokerName: '',
      overallDiscount: 0,
      taxType: 'GST',
      gstMode: 'Exclusive',
      quantity: 100,
      rate: 250,
      discount: 0,
      taxRate: 5,
      referenceNo: '123456',
      variantDesignNo: 'DES-001',
      variantColor: 'Red',
      variantSize: 'M',
      status: 'pending',
      paymentMode: ''
    });

    // Same purchase (same Reference No) with another variant
    sheet.addRow({
      supplierName: '',
      purchaseDate: '',
      dueDate: '',
      dueDays: '',
      supplierBillNo: '',
      brokerName: '',
      overallDiscount: '',
      taxType: '',
      gstMode: '',
      quantity: 60,
      rate: 260,
      discount: 10,
      taxRate: 5,
      referenceNo: '123456',
      variantDesignNo: 'DES-003',
      variantColor: 'Green',
      variantSize: 'L',
      status: '',
      paymentMode: ''
    });
    
    sheet.addRow({
      supplierName: 'ABC Traders',
      purchaseDate: new Date(),
      dueDate: '',
      dueDays: '',
      supplierBillNo: '',
      brokerName: 'John Broker',
      overallDiscount: 100,
      taxType: 'GST',
      gstMode: 'Inclusive',
      quantity: 50,
      rate: 800,
      discount: 50,
      taxRate: 12,
      referenceNo: '7891011',
      variantDesignNo: 'DES-002',
      variantColor: 'Blue',
      variantSize: '32',
      status: 'paid',
      paymentMode: 'UPI'
    });

    // Style the header (yellow background + bold)
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase_import_template.xlsx');

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: err.message
    });
  }
};

const getNextPurchaseId = async (req, res) => {
  try {
    const nextId = await Purchase.generateNextPurchaseId();
    res.status(200).json({
      success: true,
      data: { purchaseId: nextId }
    });
  } catch (err) {
    console.error('Get next purchase ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Error generating purchase ID',
      error: err.message
    });
  }
};

module.exports = {
  createPurchase,
  getNextPurchaseId,
  updatePurchase,
  getAllPurchases,
  listPurchasesMinimal,
  listPurchasesPending,
  getPurchaseById,
  updatePurchaseStatus,
  deletePurchase,
  bulkDeletePurchases,
  createSupplierPayment,
  getSupplierPayments,
  uploadPurchasesFromExcel,
  downloadPurchaseExcelTemplate,
  exportPurchases
};
