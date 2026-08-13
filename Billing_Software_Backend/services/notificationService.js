const mongoose = require("mongoose");
const Notification = require("@models/Notification");
const Invoice = require("@models/Invoice");
const InvoicePayment = require("@models/InvoicePayment");
const Quotation = require("@models/Quotation");
const Purchase = require("@models/Purchase");
const Customer = require("@models/Customer");
const CompanySettings = require("@models/CompanySettings");
const User = require("@models/User");

const CREDIT_NOTIFICATION_TYPE = "invoice_credit_pending";
const QUOTATION_NOTIFICATION_TYPE = "quotation_expiry_pending";
const PURCHASE_NOTIFICATION_TYPE = "purchase_due_pending";
const ACTIVE_UNPAID_STATUSES = ["UNPAID", "PARTIALLY_PAID", "OVERDUE", "SENT", "PENDING"];
const ACTIVE_QUOTATION_STATUSES = ["draft", "sent"];
const ACTIVE_PURCHASE_DUE_STATUSES = ["pending", "partially_paid"];

const toMoney = (value) => Number((Number(value) || 0).toFixed(2));

const startOfDay = (input) => {
  const date = input ? new Date(input) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const toNotificationDate = (input = new Date()) => {
  const date = startOfDay(input);
  return date.toISOString().slice(0, 10);
};

const dayDiff = (from, to = new Date()) => {
  const fromDate = startOfDay(from);
  const toDate = startOfDay(to);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
};

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const getCustomerContactFromInvoice = async (invoice) => {
  if (invoice?.billTo?.name || invoice?.billTo?.phone) {
    return {
      name: invoice.billTo?.name || "Customer",
      phone: invoice.billTo?.phone || "N/A",
    };
  }

  const possibleCustomerId =
    invoice?.customerId && typeof invoice.customerId === "object" && invoice.customerId?.name
      ? null
      : invoice?.billTo?._id || invoice?.customerId;

  if (invoice?.customerId && typeof invoice.customerId === "object" && invoice.customerId?.name) {
    return {
      name: invoice.customerId.name,
      phone: invoice.customerId.phone || "N/A",
    };
  }

  if (!isObjectId(possibleCustomerId)) {
    return {
      name: "Customer",
      phone: "N/A",
    };
  }

  const customer = await Customer.findById(possibleCustomerId).select("name phone").lean();
  return {
    name: customer?.name || "Customer",
    phone: customer?.phone || "N/A",
  };
};

const getCustomerContactFromQuotation = async (quotation) => {
  if (quotation?.billTo?.name || quotation?.billTo?.phone) {
    return {
      name: quotation.billTo?.name || "Customer",
      phone: quotation.billTo?.phone || "N/A",
    };
  }

  const possibleCustomerId = quotation?.billTo?._id || quotation?.customerId;

  if (!isObjectId(possibleCustomerId)) {
    return {
      name: "Customer",
      phone: "N/A",
    };
  }

  const customer = await Customer.findById(possibleCustomerId).select("name phone").lean();
  return {
    name: customer?.name || "Customer",
    phone: customer?.phone || "N/A",
  };
};

const getSupplierContactFromPurchase = async (purchase) => {
  if (purchase?.supplierName) {
    return {
      name: purchase.supplierName,
      phone: "N/A",
    };
  }

  if (purchase?.billTo && typeof purchase.billTo === "object") {
    const fullName = `${purchase.billTo.firstName || ""} ${purchase.billTo.lastName || ""}`.trim();
    return {
      name: fullName || "Supplier",
      phone: purchase.billTo.phone || "N/A",
    };
  }

  return {
    name: "Supplier",
    phone: "N/A",
  };
};

const getOutstandingAmount = async (invoiceId, totalAmount) => {
  const [paymentAgg] = await InvoicePayment.aggregate([
    {
      $match: {
        invoiceId: new mongoose.Types.ObjectId(String(invoiceId)),
      },
    },
    {
      $group: {
        _id: "$invoiceId",
        totalPaid: { $sum: "$amount" },
      },
    },
  ]);

  const totalPaid = toMoney(paymentAgg?.totalPaid || 0);
  return Math.max(toMoney(totalAmount) - totalPaid, 0);
};

const buildCreditNotificationPayload = async (invoice) => {
  if (!invoice || invoice.isDeleted || ["PAID", "CANCELLED", "DRAFT", "EXCHANGE"].includes(invoice.status)) {
    return null;
  }

  if (!ACTIVE_UNPAID_STATUSES.includes(invoice.status)) {
    return null;
  }

  const isCreditFlow =
    invoice.payment_method === "CREDIT" ||
    ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);

  if (!isCreditFlow) {
    return null;
  }

  const outstandingAmount = await getOutstandingAmount(invoice._id, invoice.TotalAmount);
  if (outstandingAmount <= 0) {
    return null;
  }

  const today = startOfDay(new Date());
  const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const startDate = startOfDay(invoiceDate);
  const endDate = dueDate ? startOfDay(dueDate) : null;
  if (today < startDate) {
    return null;
  }

  if (endDate && today < endDate) {
    return null;
  }

  const customer = await getCustomerContactFromInvoice(invoice);
  const customerName = customer.name;
  const pendingDays = Math.max(dayDiff(invoiceDate), 0);
  const priority = pendingDays >= 7 ? "high" : "medium";
  const title = "Credit invoice payment pending";
  const message = dueDate
    ? `${customerName} has overdue payment for ${invoice.invoiceNumber}. Balance ₹${outstandingAmount}, overdue by ${pendingDays} day(s).`
    : `${customerName} has pending credit payment for ${invoice.invoiceNumber}. Balance ₹${outstandingAmount}, pending for ${pendingDays} day(s).`;

  return {
    type: CREDIT_NOTIFICATION_TYPE,
    title,
    message: dueDate
      ? `${customerName} has pending credit payment for ${invoice.invoiceNumber}. Balance Rs.${outstandingAmount}, pending for ${pendingDays} day(s), due on ${endDate.toLocaleDateString("en-IN")}.`
      : message,
    priority,
    entityType: "invoice",
    entityId: invoice._id,
    entityTypeRef: "Invoice",
    userId: invoice.userId,
    actionUrl: `/admin/view-invoice/${invoice._id}`,
    meta: {
      invoiceNumber: invoice.invoiceNumber || "",
      customerName,
      customerPhone: customer.phone || "N/A",
      balanceAmount: outstandingAmount,
      pendingDays,
      dueDate,
      invoiceDate,
      statusLabel: invoice.status,
    },
  };
};

const buildQuotationNotificationPayload = async (quotation) => {
  if (!quotation || quotation.isDeleted) {
    return null;
  }

  if (!ACTIVE_QUOTATION_STATUSES.includes(String(quotation.status || "").toLowerCase())) {
    return null;
  }

  if (quotation.invoiceId) {
    return null;
  }

  if (!quotation.expiryDate) {
    return null;
  }

  const today = startOfDay(new Date());
  const quotationDate = quotation.quotationDate ? new Date(quotation.quotationDate) : new Date();
  const expiryDate = new Date(quotation.expiryDate);
  const startDate = startOfDay(quotationDate);
  const endDate = startOfDay(expiryDate);

  if (today < startDate) {
    return null;
  }

  if (today > endDate) {
    return null;
  }

  const customer = await getCustomerContactFromQuotation(quotation);
  const pendingDays = Math.max(dayDiff(quotationDate), 0);
  const daysLeft = Math.max(dayDiff(today, endDate), 0);
  const priority = daysLeft <= 1 ? "high" : daysLeft <= 3 ? "medium" : "low";
  const customerName = customer.name || "Customer";

  return {
    type: QUOTATION_NOTIFICATION_TYPE,
    title: "Quotation expiry pending",
    message: `${customerName}'s quotation ${quotation.quotationId} will expire on ${endDate.toLocaleDateString("en-IN")}. ${daysLeft} day(s) left.`,
    priority,
    entityType: "quotation",
    entityId: quotation._id,
    entityTypeRef: "Quotation",
    userId: quotation.userId,
    actionUrl: `/admin/quotations/view/${quotation._id}`,
    meta: {
      quotationId: quotation.quotationId || "",
      customerName,
      customerPhone: customer.phone || "N/A",
      pendingDays,
      invoiceDate: quotationDate,
      expiryDate,
      statusLabel: quotation.status,
    },
  };
};

const buildPurchaseNotificationPayload = async (purchase) => {
  if (!purchase || purchase.isDeleted) {
    return null;
  }

  const normalizedStatus = String(purchase.status || "").toLowerCase();
  if (!ACTIVE_PURCHASE_DUE_STATUSES.includes(normalizedStatus)) {
    return null;
  }

  const totalAmount = toMoney(purchase.totalAmount || 0);
  const paidAmount = toMoney(purchase.paidAmount || 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);

  if (balanceAmount <= 0) {
    return null;
  }

  const today = startOfDay(new Date());
  const purchaseDate = purchase.purchaseDate ? new Date(purchase.purchaseDate) : new Date();
  const dueDate = purchase.dueDate ? new Date(purchase.dueDate) : null;
  const startDate = startOfDay(purchaseDate);
  const endDate = dueDate ? startOfDay(dueDate) : null;
  if (today < startDate) {
    return null;
  }

  if (endDate && today < endDate) {
    return null;
  }

  const supplier = await getSupplierContactFromPurchase(purchase);
  const supplierName = supplier.name || "Supplier";
  const supplierBillNumber = purchase.supplier_bill_number || "N/A";
  const pendingDays = Math.max(dayDiff(purchaseDate), 0);

  let priority = "medium";
  if (endDate) {
    const daysLeft = Math.max(dayDiff(today, endDate), 0);
    priority = daysLeft <= 1 ? "high" : daysLeft <= 3 ? "medium" : "low";
  } else {
    priority = pendingDays >= 7 ? "high" : "medium";
  }

  const paymentLabel = normalizedStatus === "partially_paid" ? "partially paid" : "no payment";
  const message = dueDate
    ? `${supplierName} has ${paymentLabel} purchase ${purchase.purchaseId}. Supplier Bill No: ${supplierBillNumber}. Balance Rs.${balanceAmount}, due on ${endDate.toLocaleDateString("en-IN")}.`
    : `${supplierName} has ${paymentLabel} purchase ${purchase.purchaseId}. Supplier Bill No: ${supplierBillNumber}. Balance Rs.${balanceAmount}, pending for ${pendingDays} day(s).`;

  return {
    type: PURCHASE_NOTIFICATION_TYPE,
    title: "Purchase due payment pending",
    message,
    priority,
    entityType: "purchase",
    entityId: purchase._id,
    entityTypeRef: "Purchase",
    userId: purchase.userId,
    actionUrl: `/admin/purchases/view/${purchase._id}`,
    meta: {
      purchaseId: purchase.purchaseId || "",
      supplierName,
      supplierBillNumber,
      customerPhone: supplier.phone || "N/A",
      balanceAmount,
      pendingDays,
      dueDate,
      invoiceDate: purchaseDate,
      statusLabel: purchase.status,
    },
  };
};

const getCompanyIdForUser = async (userId) => {
  if (!isObjectId(userId)) return null;

  const company = await CompanySettings.findOne({ userId }).select("_id").lean();
  return company?._id || null;
};

const getPrimaryAdminUserId = async () => {
  const admin = await User.findOne({ user_type: 1, isDeleted: false }).select("_id").lean();
  return admin?._id ? String(admin._id) : null;
};

const resolveNotificationForInvoice = async (invoiceId) => {
  if (!isObjectId(invoiceId)) return;

  await Notification.deleteMany({
    type: CREDIT_NOTIFICATION_TYPE,
    entityType: "invoice",
    entityId: invoiceId,
    status: "active",
  });
};

const resolveNotificationForQuotation = async (quotationId) => {
  if (!isObjectId(quotationId)) return;

  await Notification.deleteMany({
    type: QUOTATION_NOTIFICATION_TYPE,
    entityType: "quotation",
    entityId: quotationId,
    status: "active",
  });
};

const resolveNotificationForPurchase = async (purchaseId) => {
  if (!isObjectId(purchaseId)) return;

  await Notification.deleteMany({
    type: PURCHASE_NOTIFICATION_TYPE,
    entityType: "purchase",
    entityId: purchaseId,
    status: "active",
  });
};

const syncCreditNotificationForInvoice = async (invoiceId) => {
  if (!isObjectId(invoiceId)) return null;

  const invoice = await Invoice.findById(invoiceId)
    .populate("billTo", "name phone")
    .select("invoiceNumber invoiceDate dueDate status TotalAmount userId billTo customerId isDeleted payment_method")
    .lean();

  if (!invoice) {
    await resolveNotificationForInvoice(invoiceId);
    return null;
  }

  const payload = await buildCreditNotificationPayload(invoice);
  if (!payload) {
    await resolveNotificationForInvoice(invoiceId);
    return null;
  }

  const adminUserId = await getPrimaryAdminUserId();
  const recipientIds = Array.from(
    new Set(
      [String(payload.userId), adminUserId]
        .filter(Boolean)
        .filter((id) => isObjectId(id))
    )
  );

  const todayKey = toNotificationDate();
  const results = [];

  for (const recipientUserId of recipientIds) {
    const companyId = await getCompanyIdForUser(recipientUserId);
    const dedupeKey = `${CREDIT_NOTIFICATION_TYPE}:${String(invoice._id)}:${recipientUserId}`;

    const existing = await Notification.findOne({
      dedupeKey,
      status: "active",
    });

    if (!existing) {
      const created = await Notification.create({
        ...payload,
        userId: recipientUserId,
        companyId,
        dedupeKey,
        notificationDate: todayKey,
        isRead: false,
        readAt: null,
      });
      results.push(created);
      continue;
    }

    const shouldResetReadState =
      existing.notificationDate !== todayKey ||
      toMoney(existing.meta?.balanceAmount || 0) !== toMoney(payload.meta.balanceAmount) ||
      String(existing.meta?.statusLabel || "") !== String(payload.meta.statusLabel || "");

    existing.title = payload.title;
    existing.message = payload.message;
    existing.priority = payload.priority;
    existing.actionUrl = payload.actionUrl;
    existing.companyId = companyId;
    existing.meta = payload.meta;
    existing.notificationDate = todayKey;
    existing.resolvedAt = null;

    if (shouldResetReadState) {
      existing.isRead = false;
      existing.readAt = null;
    }

    await existing.save();
    results.push(existing);
  }

  return results[0] || null;
};

const syncQuotationNotificationForQuotation = async (quotationId) => {
  if (!isObjectId(quotationId)) return null;

  const quotation = await Quotation.findById(quotationId)
    .populate("billTo", "name phone")
    .select("quotationId quotationDate expiryDate status userId billTo customerId isDeleted invoiceId")
    .lean();

  if (!quotation) {
    await resolveNotificationForQuotation(quotationId);
    return null;
  }

  const payload = await buildQuotationNotificationPayload(quotation);
  if (!payload) {
    await resolveNotificationForQuotation(quotationId);
    return null;
  }

  const adminUserId = await getPrimaryAdminUserId();
  const recipientIds = Array.from(
    new Set(
      [String(payload.userId), adminUserId]
        .filter(Boolean)
        .filter((id) => isObjectId(id))
    )
  );

  const todayKey = toNotificationDate();
  const results = [];

  for (const recipientUserId of recipientIds) {
    const companyId = await getCompanyIdForUser(recipientUserId);
    const dedupeKey = `${QUOTATION_NOTIFICATION_TYPE}:${String(quotation._id)}:${recipientUserId}`;

    const existing = await Notification.findOne({
      dedupeKey,
      status: "active",
    });

    if (!existing) {
      const created = await Notification.create({
        ...payload,
        userId: recipientUserId,
        companyId,
        dedupeKey,
        notificationDate: todayKey,
        isRead: false,
        readAt: null,
      });
      results.push(created);
      continue;
    }

    const shouldResetReadState =
      existing.notificationDate !== todayKey ||
      String(existing.meta?.statusLabel || "") !== String(payload.meta.statusLabel || "") ||
      String(existing.meta?.expiryDate || "") !== String(payload.meta.expiryDate || "");

    existing.title = payload.title;
    existing.message = payload.message;
    existing.priority = payload.priority;
    existing.actionUrl = payload.actionUrl;
    existing.companyId = companyId;
    existing.meta = payload.meta;
    existing.notificationDate = todayKey;
    existing.resolvedAt = null;

    if (shouldResetReadState) {
      existing.isRead = false;
      existing.readAt = null;
    }

    await existing.save();
    results.push(existing);
  }

  return results[0] || null;
};

const syncPurchaseNotificationForPurchase = async (purchaseId) => {
  if (!isObjectId(purchaseId)) return null;

  const purchase = await Purchase.findById(purchaseId)
    .populate("billTo", "firstName lastName phone")
    .select("purchaseId purchaseDate dueDate status totalAmount paidAmount balanceAmount supplier_bill_number supplierName userId billTo isDeleted")
    .lean();

  if (!purchase) {
    await resolveNotificationForPurchase(purchaseId);
    return null;
  }

  const payload = await buildPurchaseNotificationPayload(purchase);
  if (!payload) {
    await resolveNotificationForPurchase(purchaseId);
    return null;
  }

  const adminUserId = await getPrimaryAdminUserId();
  const recipientIds = Array.from(
    new Set(
      [String(payload.userId), adminUserId]
        .filter(Boolean)
        .filter((id) => isObjectId(id))
    )
  );

  const todayKey = toNotificationDate();
  const results = [];

  for (const recipientUserId of recipientIds) {
    const companyId = await getCompanyIdForUser(recipientUserId);
    const dedupeKey = `${PURCHASE_NOTIFICATION_TYPE}:${String(purchase._id)}:${recipientUserId}`;

    const existing = await Notification.findOne({
      dedupeKey,
      status: "active",
    });

    if (!existing) {
      const created = await Notification.create({
        ...payload,
        userId: recipientUserId,
        companyId,
        dedupeKey,
        notificationDate: todayKey,
        isRead: false,
        readAt: null,
      });
      results.push(created);
      continue;
    }

    const shouldResetReadState =
      existing.notificationDate !== todayKey ||
      toMoney(existing.meta?.balanceAmount || 0) !== toMoney(payload.meta.balanceAmount) ||
      String(existing.meta?.statusLabel || "") !== String(payload.meta.statusLabel || "") ||
      String(existing.meta?.supplierBillNumber || "") !== String(payload.meta.supplierBillNumber || "");

    existing.title = payload.title;
    existing.message = payload.message;
    existing.priority = payload.priority;
    existing.actionUrl = payload.actionUrl;
    existing.companyId = companyId;
    existing.meta = payload.meta;
    existing.notificationDate = todayKey;
    existing.resolvedAt = null;

    if (shouldResetReadState) {
      existing.isRead = false;
      existing.readAt = null;
    }

    await existing.save();
    results.push(existing);
  }

  return results[0] || null;
};

const syncCreditNotificationsForUser = async (userId) => {
  if (!isObjectId(userId)) return { synced: 0, resolved: 0 };

  const user = await User.findById(userId).select("user_type").lean();
  const isAdminUser = Number(user?.user_type) === 1;

  const invoices = await Invoice.find({
    isDeleted: false,
    status: { $in: ACTIVE_UNPAID_STATUSES },
    ...(isAdminUser ? {} : { userId }),
  })
    .select("_id")
    .lean();

  const activeInvoiceIds = [];
  for (const invoice of invoices) {
    const result = await syncCreditNotificationForInvoice(invoice._id);
    if (result) {
      activeInvoiceIds.push(String(invoice._id));
    }
  }

  const staleNotifications = await Notification.find({
    userId,
    type: CREDIT_NOTIFICATION_TYPE,
    status: "active",
    ...(activeInvoiceIds.length
      ? { entityId: { $nin: activeInvoiceIds.map((id) => new mongoose.Types.ObjectId(id)) } }
      : {}),
  }).select("_id");

  if (staleNotifications.length) {
    await Notification.updateMany(
      { _id: { $in: staleNotifications.map((item) => item._id) } },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  } else if (activeInvoiceIds.length === 0) {
    await Notification.updateMany(
      {
        userId,
        type: CREDIT_NOTIFICATION_TYPE,
        status: "active",
      },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  }

  return {
    synced: activeInvoiceIds.length,
    resolved: staleNotifications.length,
  };
};

const syncQuotationNotificationsForUser = async (userId) => {
  if (!isObjectId(userId)) return { synced: 0, resolved: 0 };

  const user = await User.findById(userId).select("user_type").lean();
  const isAdminUser = Number(user?.user_type) === 1;

  const quotations = await Quotation.find({
    isDeleted: false,
    status: { $in: ACTIVE_QUOTATION_STATUSES },
    ...(isAdminUser ? {} : { userId }),
  })
    .select("_id")
    .lean();

  const activeQuotationIds = [];
  for (const quotation of quotations) {
    const result = await syncQuotationNotificationForQuotation(quotation._id);
    if (result) {
      activeQuotationIds.push(String(quotation._id));
    }
  }

  const staleNotifications = await Notification.find({
    userId,
    type: QUOTATION_NOTIFICATION_TYPE,
    status: "active",
    ...(activeQuotationIds.length
      ? { entityId: { $nin: activeQuotationIds.map((id) => new mongoose.Types.ObjectId(id)) } }
      : {}),
  }).select("_id");

  if (staleNotifications.length) {
    await Notification.updateMany(
      { _id: { $in: staleNotifications.map((item) => item._id) } },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  } else if (activeQuotationIds.length === 0) {
    await Notification.updateMany(
      {
        userId,
        type: QUOTATION_NOTIFICATION_TYPE,
        status: "active",
      },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  }

  return {
    synced: activeQuotationIds.length,
    resolved: staleNotifications.length,
  };
};

const syncPurchaseNotificationsForUser = async (userId) => {
  if (!isObjectId(userId)) return { synced: 0, resolved: 0 };

  const user = await User.findById(userId).select("user_type").lean();
  const isAdminUser = Number(user?.user_type) === 1;

  const purchases = await Purchase.find({
    isDeleted: false,
    status: { $in: ACTIVE_PURCHASE_DUE_STATUSES },
    ...(isAdminUser ? {} : { userId }),
  })
    .select("_id")
    .lean();

  const activePurchaseIds = [];
  for (const purchase of purchases) {
    const result = await syncPurchaseNotificationForPurchase(purchase._id);
    if (result) {
      activePurchaseIds.push(String(purchase._id));
    }
  }

  const staleNotifications = await Notification.find({
    userId,
    type: PURCHASE_NOTIFICATION_TYPE,
    status: "active",
    ...(activePurchaseIds.length
      ? { entityId: { $nin: activePurchaseIds.map((id) => new mongoose.Types.ObjectId(id)) } }
      : {}),
  }).select("_id");

  if (staleNotifications.length) {
    await Notification.updateMany(
      { _id: { $in: staleNotifications.map((item) => item._id) } },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  } else if (activePurchaseIds.length === 0) {
    await Notification.updateMany(
      {
        userId,
        type: PURCHASE_NOTIFICATION_TYPE,
        status: "active",
      },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      }
    );
  }

  return {
    synced: activePurchaseIds.length,
    resolved: staleNotifications.length,
  };
};

const syncNotificationsForUser = async (userId) => {
  const [credit, quotation, purchase] = await Promise.all([
    syncCreditNotificationsForUser(userId),
    syncQuotationNotificationsForUser(userId),
    syncPurchaseNotificationsForUser(userId),
  ]);

  return {
    credit,
    quotation,
    purchase,
  };
};

const syncCreditNotificationsForAllUsers = async () => {
  const userIds = await Invoice.distinct("userId", {
    isDeleted: false,
  });

  const results = [];
  for (const userId of userIds) {
    const result = await syncCreditNotificationsForUser(userId);
    results.push({ userId, ...result });
  }

  return results;
};

const syncQuotationNotificationsForAllUsers = async () => {
  const userIds = await Quotation.distinct("userId", {
    isDeleted: false,
  });

  const results = [];
  for (const userId of userIds) {
    const result = await syncQuotationNotificationsForUser(userId);
    results.push({ userId, ...result });
  }

  return results;
};

const syncPurchaseNotificationsForAllUsers = async () => {
  const userIds = await Purchase.distinct("userId", {
    isDeleted: false,
  });

  const results = [];
  for (const userId of userIds) {
    const result = await syncPurchaseNotificationsForUser(userId);
    results.push({ userId, ...result });
  }

  return results;
};

const syncNotificationsForAllUsers = async () => {
  const [creditResults, quotationResults, purchaseResults] = await Promise.all([
    syncCreditNotificationsForAllUsers(),
    syncQuotationNotificationsForAllUsers(),
    syncPurchaseNotificationsForAllUsers(),
  ]);

  return {
    credit: creditResults,
    quotation: quotationResults,
    purchase: purchaseResults,
  };
};

module.exports = {
  CREDIT_NOTIFICATION_TYPE,
  QUOTATION_NOTIFICATION_TYPE,
  PURCHASE_NOTIFICATION_TYPE,
  syncCreditNotificationForInvoice,
  resolveNotificationForInvoice,
  syncCreditNotificationsForUser,
  syncCreditNotificationsForAllUsers,
  syncQuotationNotificationForQuotation,
  resolveNotificationForQuotation,
  syncQuotationNotificationsForUser,
  syncQuotationNotificationsForAllUsers,
  syncPurchaseNotificationForPurchase,
  resolveNotificationForPurchase,
  syncPurchaseNotificationsForUser,
  syncPurchaseNotificationsForAllUsers,
  syncNotificationsForUser,
  syncNotificationsForAllUsers,
};
