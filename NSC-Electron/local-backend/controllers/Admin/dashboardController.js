const Invoice = require("@models/Invoice");
const Product = require("@models/Product");
const User = require("@models/User");
const Customer = require("@models/Customer");
const Purchase = require("@models/Purchase");
const InvoicePayment = require("@models/InvoicePayment");
const Quotation = require("@models/Quotation");
const SupplierPayment = require("@models/SupplierPayment");
const DebitNote = require("@models/DebitNote");

exports.getDashboard = async (req, res) => {
  try {
    // ---------- COUNTS ----------
    const totalInvoiceCount = await Invoice.countDocuments({ isDeleted: false });
    const totalProductCount = await Product.countDocuments();
    const totalCustomerCount = await Customer.countDocuments({ isDeleted: false });
    const totalSupplierCount = await User.countDocuments({ user_type: 2 });

    const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5000";

    // ---------- LAST 5 CUSTOMERS ----------
    const lastFiveCustomers = await Customer.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email phone status image createdAt")
      .lean();

    const formattedCustomers = lastFiveCustomers.map((c) => ({
      _id: c._id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      imageUrl: c.image ? `${baseUrl}/${c.image.replace(/\\/g, "/")}` : "",
      createdAt: c.createdAt,
    }));

    // ---------- LAST 5 SUPPLIERS ----------
    const lastFiveSuppliers = await User.find({ user_type: 2 })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("firstName lastName email phone profileImage createdAt")
      .lean();

    const formattedSuppliers = lastFiveSuppliers.map((s) => ({
      _id: s._id,
      name: `${s.firstName} ${s.lastName || ""}`.trim(),
      email: s.email,
      phone: s.phone || "",
      profileImageUrl: s.profileImage ? `${baseUrl}/${s.profileImage.replace(/\\/g, "/")}` : "",
      createdAt: s.createdAt,
    }));

    // ---------- LAST 5 INVOICES ----------
    const lastSevenInvoices = await Invoice.find({ isDeleted: false })    // lastFiveInvoices if want
      .sort({ createdAt: -1 })
      .limit(7)  // 5 if want
      .populate("billTo", "name email phone image")
      .select("invoiceNumber TotalAmount status customerId billTo createdAt")
      .lean();

    const formattedInvoices = lastSevenInvoices.map((inv) => {
      const hasCustomerObject =
        inv.customerId && typeof inv.customerId === "object" && inv.customerId.name;
      const party =
        inv.billTo ||
        (inv.customerId === "UNKNOWN"
          ? { _id: null, name: "UNKNOWN", email: null, phone: "N/A", image: "" }
          : hasCustomerObject ? inv.customerId : null);
      return {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.TotalAmount,
        status: inv.status,
        customer: party
          ? {
            id: party._id,
            name: party.name,
            email: party.email,
            phone: party.phone,
            imageUrl: party.image ? `${baseUrl}/${party.image.replace(/\\/g, "/")}` : "",
          }
          : null,
        createdAt: inv.createdAt,
      };
    });

    // ---------- LAST 5 PURCHASES ----------
      const lastFivePurchases = await Purchase.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "billTo",
        select: "firstName lastName email phone profileImage isDeleted",
        match: {}, 
        options: { lean: true }
      })
      .select("purchaseId totalAmount status billTo createdAt")
      .lean();

    const formattedPurchases = lastFivePurchases.map((p) => ({
      _id: p._id,
      purchaseId: p.purchaseId,
      totalAmount: p.totalAmount,
      status: p.status,
      vendor: p.billTo
        ? {
            id: p.billTo._id,
            name: `${p.billTo.firstName || ""} ${p.billTo.lastName || ""}`.trim(),
            email: p.billTo.email,
            phone: p.billTo.phone,
            profileImage: p.billTo.profileImage
              ? `${baseUrl}/${p.billTo.profileImage.replace(/\\/g, "/")}`
              : "",
            isDeleted: p.billTo.isDeleted || false, // optional: return deleted status
          }
        : null,
      createdAt: p.createdAt,
    }));

    // ---------- LAST 5 PAYMENTS ----------
    const lastFivePayments = await InvoicePayment.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("invoiceId", "invoiceNumber TotalAmount")
      .populate("received_by", "firstName lastName email profileImage")
      .lean();

    const formattedPayments = lastFivePayments.map((pay) => ({
          _id: pay._id,
          amount: pay.amount,
          payment_method: pay.payment_method || null,
          cashAmount: pay.cashAmount || null, // Direct from model (MIXED only)
          upiAmount: pay.upiAmount || null, // Direct from model (MIXED only)
          received_on: pay.received_on,
          notes: pay.notes || "",
          invoice: pay.invoiceId
            ? {
                id: pay.invoiceId._id,
                invoiceNumber: pay.invoiceId.invoiceNumber,
                totalAmount: pay.invoiceId.TotalAmount,
              }
            : null,
          received_by: pay.received_by
            ? {
                id: pay.received_by._id,
                name: `${pay.received_by.firstName} ${
                  pay.received_by.lastName || ""
                }`.trim(),
                email: pay.received_by.email,
                profileImage: pay.received_by.profileImage
                  ? `${baseUrl}/${pay.received_by.profileImage.replace(
                      /\\/g,
                      "/"
                    )}`
                  : "",
              }
            : null,
      createdAt: pay.createdAt,
    }));

    // ---------- SALES KPIs ----------
    const totalSalesAgg = await Invoice.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$TotalAmount" } } },
    ]);
    const totalSalesAmount = totalSalesAgg.length ? totalSalesAgg[0].total : 0;

    const totalDueAgg = await Invoice.aggregate([
      { $match: { isDeleted: false, status: { $in: ["UNPAID", "OVERDUE", "PARTIALLY_PAID"] } } },
      { $group: { _id: null, total: { $sum: "$TotalAmount" } } },
    ]);
    const totalDueAmount = totalDueAgg.length ? totalDueAgg[0].total : 0;

    const receivedAgg = await InvoicePayment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const receivedAmount = receivedAgg.length ? receivedAgg[0].total : 0;

    const quotationCount = await Quotation.countDocuments({ isDeleted: false });

    // ---------- PURCHASE KPIs ----------
    const totalPurchasesAgg = await Purchase.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const totalPurchasesAmount = totalPurchasesAgg.length ? totalPurchasesAgg[0].total : 0;

    const totalPaidPurchasesAgg = await SupplierPayment.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$paidAmount" } } },
    ]);
    const totalPaidPurchases = totalPaidPurchasesAgg.length ? totalPaidPurchasesAgg[0].total : 0;

    const totalDuePurchasesAgg = await Purchase.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$balanceAmount" } } },
    ]);
    const totalDuePurchases = totalDuePurchasesAgg.length ? totalDuePurchasesAgg[0].total : 0;

    const debitNoteCount = await DebitNote.countDocuments({ isDeleted: false });

    // ---------- GRAPH 1: Top 3 Products by Sales ----------
    const topProducts = await Invoice.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.id",
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.amount" },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          totalQty: 1,
          totalSales: 1,
        },
      },
    ]);

    // ---------- GRAPH 2: Sales & Purchases by Month ----------
    const salesByMonthAgg = await Invoice.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          amount: { $sum: "$TotalAmount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const purchasesByMonthAgg = await Purchase.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          amount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const graph2 = monthNames.map((m) => ({
      month: m,
      sales: 0,
      purchases: 0,
    }));

    salesByMonthAgg.forEach((s) => {
      graph2[s._id - 1].sales = s.amount;
    });

    purchasesByMonthAgg.forEach((p) => {
      graph2[p._id - 1].purchases = p.amount;
    });

    // ---------- GRAPH 3: Sales Comparison (Today vs Yesterday) ----------
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const endOfYesterday = new Date(startOfToday.getTime() - 1);

    const todayAgg = await Invoice.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$TotalAmount" } } },
    ]);
    const todaySales = todayAgg.length ? todayAgg[0].total : 0;

    const yesterdayAgg = await Invoice.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: startOfYesterday, $lte: endOfYesterday } } },
      { $group: { _id: null, total: { $sum: "$TotalAmount" } } },
    ]);
    const yesterdaySales = yesterdayAgg.length ? yesterdayAgg[0].total : 0;

    let trend = "equal";
    let percentChange = 0;
    if (yesterdaySales === 0 && todaySales > 0) {
      trend = "up";
      percentChange = 100;
    } else if (yesterdaySales > 0) {
      const diff = todaySales - yesterdaySales;
      percentChange = Math.round((diff / yesterdaySales) * 100);
      trend = diff > 0 ? "up" : diff < 0 ? "down" : "equal";
    }

    const salesComparison = {
      today: todaySales,
      yesterday: yesterdaySales,
      trend, // "up", "down", "equal"
      percentChange,
    };

    // ---------- RESPONSE ----------
    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: {
        totalInvoiceCount,
        totalProductCount,
        totalCustomerCount,
        totalSupplierCount,
        lastFiveCustomers: formattedCustomers,
        lastFiveSuppliers: formattedSuppliers,
        lastSevenInvoices: formattedInvoices,        // lastFiveInvoices if want
        lastFivePurchases: formattedPurchases,
        lastFivePayments: formattedPayments,
        sales: {
          totalSalesAmount,
          totalDueAmount,
          receivedAmount,
          quotationCount,
        },
        purchases: {
          totalPurchasesAmount,
          totalPaidPurchases,
          totalDuePurchases,
          debitNoteCount,
        },
        graph1: topProducts,
        graph2,
        salesComparison,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};
