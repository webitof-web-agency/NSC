const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const InvoicePayment = require('@models/InvoicePayment');
const Customer = require('@models/Customer');
const Purchase = require('@models/Purchase');
const SupplierPayment = require('@models/SupplierPayment');
const User = require('@models/User');
const MonthlyExpense = require('@models/MonthlyExpense');
const Commission = require('@models/Commission');
const ExcelJS = require('exceljs');

const formatAmount = (amount) => Number(amount.toFixed(2));

const calculateChange = (previous, current) => {
  if (previous === 0 && current === 0) return { change: "0.00", trend: "equal" };
  if (previous === 0) return { change: "100.00", trend: "up" };

  const change = (((current - previous) / previous) * 100).toFixed(2);
  let trend = "equal";
  if (change > 0) trend = "up";
  else if (change < 0) trend = "down";

  return { change, trend };
};

const roundMoney = (amount) => Number((amount || 0).toFixed(2));

const PAYMENT_MODE_LABELS = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  CREDIT: 'Credit',
  PHONEPE: 'PhonePe',
  RAZORPAY: 'Razorpay',
  BANK: 'Bank',
  CHEQUE: 'Cheque',
  MIXED: 'Mixed',
  OTHER: 'Other',
};

const normalizePaymentModeKey = (value) => {
  const key = String(value || '').trim().toUpperCase();
  if (!key) return 'OTHER';
  return PAYMENT_MODE_LABELS[key] ? key : 'OTHER';
};

const allocateInvoiceByPaymentMode = (invoice) => {
  const netSales = roundMoney(Number(invoice?.TotalAmount || 0) - Number(invoice?.returned_amount || 0));
  if (netSales <= 0) return [];

  const paymentMethod = normalizePaymentModeKey(invoice?.payment_method);
  if (paymentMethod !== 'MIXED') {
    return [{ mode: paymentMethod, amount: netSales }];
  }

  const splitEntries = [
    { mode: 'CASH', amount: Number(invoice?.cashAmount || 0) },
    { mode: 'CARD', amount: Number(invoice?.cardAmount || 0) },
    { mode: 'UPI', amount: Number(invoice?.upiAmount || 0) },
  ].filter((entry) => entry.amount > 0);

  const splitTotal = splitEntries.reduce((sum, entry) => sum + entry.amount, 0);
  if (splitTotal <= 0) {
    return [{ mode: 'MIXED', amount: netSales }];
  }

  let allocatedSoFar = 0;
  return splitEntries.map((entry, index) => {
    const isLast = index === splitEntries.length - 1;
    const proportionalAmount = isLast
      ? roundMoney(netSales - allocatedSoFar)
      : roundMoney((netSales * entry.amount) / splitTotal);

    allocatedSoFar += proportionalAmount;
    return {
      mode: entry.mode,
      amount: proportionalAmount,
    };
  });
};

const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const getYearRange = (year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

const formatPeriodDate = (value) => {
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getProfitLossFilters = (query = {}) => {
  const now = new Date();
  const reportType = query.reportType === 'yearly' ? 'yearly' : 'monthly';
  const year = Number(query.year) || now.getFullYear();
  const month = Number(query.month) || now.getMonth() + 1;
  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate ? new Date(query.endDate) : null;
  const hasDateRange =
    startDate instanceof Date &&
    !Number.isNaN(startDate.getTime()) &&
    endDate instanceof Date &&
    !Number.isNaN(endDate.getTime());

  return {
    reportType: hasDateRange ? 'range' : reportType,
    year,
    month,
    startDate: hasDateRange ? new Date(startDate.setHours(0, 0, 0, 0)) : null,
    endDate: hasDateRange ? new Date(endDate.setHours(23, 59, 59, 999)) : null,
  };
};

const getProfitLossRecords = async (userId, filters) => {
  const { reportType, year, month, startDate, endDate } = filters;
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periods =
    reportType === 'range' && startDate && endDate
      ? [
          {
            label: `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`,
            key: `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`,
            start: startDate,
            end: endDate,
          },
        ]
      : reportType === 'yearly'
      ? monthLabels.map((label, index) => ({
          label,
          key: `${year}-${String(index + 1).padStart(2, '0')}`,
          ...getMonthRange(year, index + 1),
        }))
      : [
          {
            label: `${monthLabels[month - 1]} ${year}`,
            key: `${year}-${String(month).padStart(2, '0')}`,
            ...getMonthRange(year, month),
          },
        ];

  const records = await Promise.all(
    periods.map(async (period) => {
      const salesQuery = {
        userId,
        isDeleted: false,
        status: { $nin: ['CANCELLED', 'DRAFT'] },
        invoiceDate: { $gte: period.start, $lte: period.end },
      };
      const purchaseQuery = {
        userId,
        isDeleted: false,
        status: { $ne: 'cancelled' },
        purchaseDate: { $gte: period.start, $lte: period.end },
      };
      const expenseQuery = {
        userId,
        isDeleted: false,
        expenseDate: { $gte: period.start, $lte: period.end },
      };
      const commissionQuery = {
        createdBy: userId,
        createdAt: { $gte: period.start, $lte: period.end },
      };

      const [salesInvoices, purchases, expenses, commissions] = await Promise.all([
        Invoice.find(salesQuery)
          .select('TotalAmount returned_amount items exchangeOriginalItems')
          .lean(),
        Purchase.find(purchaseQuery)
          .select('totalAmount broker')
          .lean(),
        MonthlyExpense.find(expenseQuery)
          .select('amount sourceType')
          .lean(),
        Commission.find(commissionQuery)
          .select('totalCommissionAmount')
          .lean(),
      ]);

      const grossSales = roundMoney(
        salesInvoices.reduce((sum, invoice) => sum + Number(invoice.TotalAmount || 0), 0)
      );
      const salesReturn = roundMoney(
        salesInvoices.reduce((sum, invoice) => sum + Number(invoice.returned_amount || 0), 0)
      );
      const netSales = roundMoney(grossSales - salesReturn);

      const getItemsCost = (invoiceItems = []) =>
        (invoiceItems || []).reduce(
          (sum, item) => {
            const fallbackCost =
              Number(item?.costPriceSnapshot || 0) * Number(item?.qty || 0);
            const resolvedCost =
              item?.totalCostSnapshot ?? fallbackCost ?? 0;
            return sum + Number(resolvedCost);
          },
          0
        );

      const grossCogs = roundMoney(
        salesInvoices.reduce((sum, invoice) => sum + getItemsCost(invoice.items), 0)
      );
      const salesReturnCogs = roundMoney(
        salesInvoices.reduce(
          (sum, invoice) => sum + getItemsCost(invoice.exchangeOriginalItems),
          0
        )
      );
      const netCogs = roundMoney(grossCogs - salesReturnCogs);
      const grossProfit = roundMoney(netSales - netCogs);

      const purchaseExpenses = roundMoney(
        expenses
          .filter((expense) => expense.sourceType === 'PURCHASE')
          .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      );
      const operatingExpenses = roundMoney(
        expenses
          .filter((expense) => expense.sourceType !== 'PURCHASE')
          .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      );
      const brokerCommission = roundMoney(
        purchases.reduce(
          (sum, purchase) => sum + Number(purchase?.broker?.commissionAmount || 0),
          0
        )
      );
      const staffCommission = roundMoney(
        commissions.reduce(
          (sum, commission) => sum + Number(commission.totalCommissionAmount || 0),
          0
        )
      );

      const totalExpenses = roundMoney(
        purchaseExpenses + operatingExpenses + brokerCommission + staffCommission
      );
      const netProfitLoss = roundMoney(grossProfit - totalExpenses);

      return {
        period: period.label,
        periodKey: period.key,
        grossSales,
        salesReturn,
        netSales,
        grossCogs,
        salesReturnCogs,
        netCogs,
        grossProfit,
        purchaseExpenses,
        operatingExpenses,
        brokerCommission,
        staffCommission,
        totalExpenses,
        netProfitLoss,
        status: netProfitLoss >= 0 ? 'PROFIT' : 'LOSS',
      };
    })
  );

  const summary = records.reduce(
    (acc, record) => ({
      grossSales: roundMoney(acc.grossSales + record.grossSales),
      salesReturn: roundMoney(acc.salesReturn + record.salesReturn),
      netSales: roundMoney(acc.netSales + record.netSales),
      grossCogs: roundMoney(acc.grossCogs + record.grossCogs),
      salesReturnCogs: roundMoney(acc.salesReturnCogs + record.salesReturnCogs),
      netCogs: roundMoney(acc.netCogs + record.netCogs),
      grossProfit: roundMoney(acc.grossProfit + record.grossProfit),
      purchaseExpenses: roundMoney(acc.purchaseExpenses + record.purchaseExpenses),
      operatingExpenses: roundMoney(acc.operatingExpenses + record.operatingExpenses),
      brokerCommission: roundMoney(acc.brokerCommission + record.brokerCommission),
      staffCommission: roundMoney(acc.staffCommission + record.staffCommission),
      totalExpenses: roundMoney(acc.totalExpenses + record.totalExpenses),
      netProfitLoss: roundMoney(acc.netProfitLoss + record.netProfitLoss),
    }),
    {
      grossSales: 0,
      salesReturn: 0,
      netSales: 0,
      grossCogs: 0,
      salesReturnCogs: 0,
      netCogs: 0,
      grossProfit: 0,
      purchaseExpenses: 0,
      operatingExpenses: 0,
      brokerCommission: 0,
      staffCommission: 0,
      totalExpenses: 0,
      netProfitLoss: 0,
    }
  );

  summary.status = summary.netProfitLoss >= 0 ? 'PROFIT' : 'LOSS';

  const paymentModeAccumulator = {};
  records.forEach(() => {});

  const overallSalesQuery =
    reportType === 'range' && startDate && endDate
      ? {
          userId,
          isDeleted: false,
          status: { $nin: ['CANCELLED', 'DRAFT'] },
          invoiceDate: { $gte: startDate, $lte: endDate },
        }
      : reportType === 'yearly'
      ? {
          userId,
          isDeleted: false,
          status: { $nin: ['CANCELLED', 'DRAFT'] },
          invoiceDate: { $gte: getYearRange(year).start, $lte: getYearRange(year).end },
        }
      : {
          userId,
          isDeleted: false,
          status: { $nin: ['CANCELLED', 'DRAFT'] },
          invoiceDate: { $gte: getMonthRange(year, month).start, $lte: getMonthRange(year, month).end },
        };

  const allSalesInvoices = await Invoice.find(overallSalesQuery)
    .select('TotalAmount returned_amount payment_method cashAmount cardAmount upiAmount')
    .lean();

  allSalesInvoices.forEach((invoice) => {
    const allocations = allocateInvoiceByPaymentMode(invoice);
    allocations.forEach(({ mode, amount }) => {
      if (!paymentModeAccumulator[mode]) {
        paymentModeAccumulator[mode] = {
          mode,
          label: PAYMENT_MODE_LABELS[mode] || mode,
          netSales: 0,
        };
      }
      paymentModeAccumulator[mode].netSales = roundMoney(
        paymentModeAccumulator[mode].netSales + Number(amount || 0)
      );
    });
  });

  const paymentModeBreakdown = Object.values(paymentModeAccumulator)
    .map((entry) => {
      const salesShare =
        summary.netSales > 0 ? Number(entry.netSales || 0) / Number(summary.netSales || 0) : 0;
      const grossProfit = roundMoney(summary.grossProfit * salesShare);
      const allocatedExpenses = roundMoney(summary.totalExpenses * salesShare);
      const netProfitLoss = roundMoney(grossProfit - allocatedExpenses);

      return {
        mode: entry.mode,
        label: entry.label,
        netSales: roundMoney(entry.netSales),
        salesSharePercentage: roundMoney(salesShare * 100),
        grossProfit,
        allocatedExpenses,
        netProfitLoss,
        status: netProfitLoss >= 0 ? 'PROFIT' : 'LOSS',
      };
    })
    .sort((a, b) => b.netSales - a.netSales);

  summary.paymentModeBreakdown = paymentModeBreakdown;

  return { records, summary };
};

// ------------------------- Income Stats -------------------------
const getIncomeStats = async (req, res) => {
  try {
    let { page = 1, limit = 10, startDate, endDate, search, paymentMode } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const baseFilter = {};
    if (startDate && endDate) {
      baseFilter.received_on = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (paymentMode && String(paymentMode).trim().toLowerCase() !== "all") {
      baseFilter.payment_method = String(paymentMode).trim().toUpperCase();
    }

    const searchTerm = String(search || "").trim().toLowerCase();
    const hasCustomRange = Boolean(startDate && endDate);
    const currentRangeStart = hasCustomRange ? new Date(startDate) : startOfCurrentMonth;
    const currentRangeEnd = hasCustomRange ? new Date(endDate) : endOfCurrentMonth;
    const rangeDuration = Math.max(currentRangeEnd.getTime() - currentRangeStart.getTime(), 0);
    const previousRangeEnd = new Date(currentRangeStart.getTime() - 1);
    const previousRangeStart = hasCustomRange
      ? new Date(previousRangeEnd.getTime() - rangeDuration)
      : startOfPreviousMonth;
    const previousRangeFinalEnd = hasCustomRange ? previousRangeEnd : endOfPreviousMonth;

    const matchesSearch = (payment) => {
      if (!searchTerm) return true;
      const invoice = payment?.invoiceId;
      const customer = invoice?.billTo;
      const paymentMethod =
        typeof payment?.payment_method === "string"
          ? payment.payment_method
          : payment?.payment_method?.name;
      const haystack = [
        invoice?.invoiceNumber,
        invoice?.referenceNo,
        customer?.name,
        customer?.phone,
        customer?.email,
        paymentMethod,
        payment?.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm);
    };

    const buildPaymentQuery = (extraFilter = {}) =>
      InvoicePayment.find({ ...baseFilter, ...extraFilter })
        .populate({
          path: "invoiceId",
          select: "billTo invoiceNumber items referenceNo",
          populate: {
            path: "billTo",
            model: "Customer",
            select: "name email phone image"
          }
        });

    const [currentPaymentsRaw, previousPaymentsRaw, allPaymentsRaw] =
      await Promise.all([
        buildPaymentQuery({
          received_on: { $gte: currentRangeStart, $lte: currentRangeEnd },
        }),
        buildPaymentQuery({
          received_on: { $gte: previousRangeStart, $lte: previousRangeFinalEnd },
        }),
        buildPaymentQuery({}).sort({ received_on: -1 }),
      ]);

    const currentPayments = currentPaymentsRaw.filter(matchesSearch);
    const previousPayments = previousPaymentsRaw.filter(matchesSearch);
    const filteredPayments = allPaymentsRaw.filter(matchesSearch);
    const totalRecords = filteredPayments.length;
    const allPayments = filteredPayments.slice(skip, skip + limit);

    const currentTotal = currentPayments.reduce((sum, p) => sum + p.amount, 0);
    const previousTotal = previousPayments.reduce((sum, p) => sum + p.amount, 0);

    const currentProductSales = currentPayments.reduce((sum, payment) => {
      const invoice = payment.invoiceId;
      if (!invoice) return sum;
      return sum + invoice.items.reduce((a, i) => a + i.amount, 0);
    }, 0);

    const previousProductSales = previousPayments.reduce((sum, payment) => {
      const invoice = payment.invoiceId;
      if (!invoice) return sum;
      return sum + invoice.items.reduce((a, i) => a + i.amount, 0);
    }, 0);

    const currentServiceRevenue = 0;
    const previousServiceRevenue = 0;
    const currentOtherRevenue = 0;
    const previousOtherRevenue = 0;

    const totalChange = calculateChange(previousTotal, currentTotal);
    const productChange = calculateChange(previousProductSales, currentProductSales);
    const serviceChange = calculateChange(previousServiceRevenue, currentServiceRevenue);
    const otherChange = calculateChange(previousOtherRevenue, currentOtherRevenue);

    const transactions = allPayments.map((payment) => {
      const invoice = payment.invoiceId;
      const customer = invoice?.billTo;

      return {
        id: payment._id,
        invoiceNumber: invoice?.invoiceNumber || "",
        customer: {
          name: customer?.name || "",
          email: customer?.email || "",
          phone: customer?.phone || "",
          image: customer?.image
            ? `${process.env.BASE_URL}/${customer.image}`
            : ""
        },
        paidDate: payment.received_on,
        amount: formatAmount(payment.amount),

        paymentMode: typeof payment.payment_method === "string"
        ? {
            id: null,
            name: payment.payment_method,
            slug: payment.payment_method.toLowerCase(),
            status: "active"
          }
        : payment.payment_method
          ? {
              id: payment.payment_method._id,
              name: payment.payment_method.name,
              slug: payment.payment_method.slug,
              status: payment.payment_method.status
            }
          : null,
        cashAmount: Number(payment.cashAmount || 0),
        cardAmount: Number(payment.cardAmount || 0),
        upiAmount: Number(payment.upiAmount || 0),
        creditAmount: Number(payment.creditAmount || 0),

        referenceNo: invoice?.referenceNo || "",
        createdAt: payment.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      message: "Product and Total Income data fetched successfully",
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
        paymentMode: paymentMode || null
      },
      data: {
        product_sales: {
          previousMonthAmount: formatAmount(previousProductSales),
          currentMonthAmount: formatAmount(currentProductSales),
          percentage: +Number(productChange.change || 0).toFixed(),
          trend: productChange.trend
        },
        total_income: {
          previousMonthAmount: formatAmount(previousTotal),
          currentMonthAmount: formatAmount(currentTotal),
          percentage: +Number(totalChange.change || 0).toFixed(),
          trend: totalChange.trend
        },
        service_revenue: {
          previousMonthAmount: formatAmount(previousServiceRevenue),
          currentMonthAmount: formatAmount(currentServiceRevenue),
          percentage: +Number(serviceChange.change || 0).toFixed(),
          trend: serviceChange.trend
        },
        other_revenue: {
          previousMonthAmount: formatAmount(previousOtherRevenue),
          currentMonthAmount: formatAmount(currentOtherRevenue),
          percentage: +Number(otherChange.change || 0).toFixed(),
          trend: otherChange.trend
        }
      },
      records: transactions,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching income stats:", error);
    return res.status(500).json({
      message: "Failed to fetch income statistics",
      error: error.message
    });
  }
};


const getPurchaseReport = async (req, res) => {
  try {
    let { startDate, endDate, search, paymentMode, page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    /* ------------------------------------------------
       BASE FILTERS (NO DATE HERE)
    ------------------------------------------------ */
    const baseFilters = { isDeleted: false };

    if (paymentMode) {
      baseFilters.paymentMode = paymentMode;
    }

    if (search) {
      baseFilters.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
      ];
    }

    /* ------------------------------------------------
       DATE FILTERS (APPLIED PER QUERY)
    ------------------------------------------------ */
    const currentDateFilter =
      startDate && endDate
        ? { $gte: new Date(startDate), $lte: new Date(endDate) }
        : { $gte: startOfCurrentMonth };

    const previousDateFilter =
      startDate && endDate
        ? { $gte: new Date(startDate), $lte: new Date(endDate) }
        : { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth };

    /* ------------------------------------------------
       QUERIES
    ------------------------------------------------ */
    const [
      currentPayments,
      previousPayments,
      allPayments,
      totalRecords
    ] = await Promise.all([
      // Current period
      SupplierPayment.find({
        ...baseFilters,
        paymentDate: currentDateFilter,
      })
        .populate("purchaseId")
        .populate("supplierId", "firstName lastName email profileImageUrl")
        .populate("paymentMode", "name slug status"),

      // Previous period
      SupplierPayment.find({
        ...baseFilters,
        paymentDate: previousDateFilter,
      })
        .populate("purchaseId")
        .populate("supplierId", "firstName lastName email profileImageUrl")
        .populate("paymentMode", "name slug status"),

      // Paginated table records (IMPORTANT FIX)
      SupplierPayment.find({
        ...baseFilters,
        ...(startDate && endDate
          ? { paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
          : {}),
      })
        .populate("purchaseId")
        .populate("supplierId", "firstName lastName email profileImageUrl")
        .populate("paymentMode", "name slug status")
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit),

      // Pagination count (IMPORTANT FIX)
      SupplierPayment.countDocuments({
        ...baseFilters,
        ...(startDate && endDate
          ? { paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
          : {}),
      }),
    ]);

    /* ------------------------------------------------
       CALCULATIONS (SAFE)
    ------------------------------------------------ */
    const currentTotal = currentPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    const previousTotal = previousPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    const currentPurchaseAmount = currentPayments.reduce((sum, payment) => {
      const purchase = payment.purchaseId;
      if (!purchase || !Array.isArray(purchase.items)) return sum;

      return (
        sum +
        purchase.items.reduce(
          (acc, item) => acc + Number(item.amount || 0),
          0
        )
      );
    }, 0);

    const previousPurchaseAmount = previousPayments.reduce((sum, payment) => {
      const purchase = payment.purchaseId;
      if (!purchase || !Array.isArray(purchase.items)) return sum;

      return (
        sum +
        purchase.items.reduce(
          (acc, item) => acc + Number(item.amount || 0),
          0
        )
      );
    }, 0);

    const totalChange = calculateChange(previousTotal, currentTotal);
    const purchaseChange = calculateChange(
      previousPurchaseAmount,
      currentPurchaseAmount
    );

    /* ------------------------------------------------
       TRANSACTIONS
    ------------------------------------------------ */
    const transactions = allPayments.map((payment) => ({
      Id: payment._id,
      supplier: payment.supplierId
        ? {
            name: `${payment.supplierId.firstName} ${payment.supplierId.lastName}`.trim(),
            email: payment.supplierId.email || null,
            image: payment.supplierId.profileImageUrl || null,
          }
        : { name: "Unknown", email: null, image: null },

      paymentId: payment.paymentId,
      paidDate: payment.paymentDate,
      amount: Number(payment.amount || 0),
      paymentMode: payment.paymentMode
        ? {
            id: payment.paymentMode._id,
            name: payment.paymentMode.name,
            slug: payment.paymentMode.slug,
            status: payment.paymentMode.status,
          }
        : null,
      referenceNo: payment.referenceNumber || "",
      createdAt: payment.createdAt,
    }));

    /* ------------------------------------------------
       RESPONSE
    ------------------------------------------------ */
    return res.status(200).json({
      success: true,
      message: "Purchase and Supplier Payment data fetched successfully",
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
        paymentMode: paymentMode || null,
      },
      data: {
        product_purchases: {
          previousMonthAmount: Number(previousPurchaseAmount.toFixed(2)),
          currentMonthAmount: Number(currentPurchaseAmount.toFixed(2)),
          percentage: Math.round(Number(purchaseChange.change) || 0),
          trend: purchaseChange.trend,
        },
        total_payments: {
          previousMonthAmount: Number(previousTotal.toFixed(2)),
          currentMonthAmount: Number(currentTotal.toFixed(2)),
          percentage: Math.round(Number(totalChange.change) || 0),
          trend: totalChange.trend,
        },
      },
      records: transactions,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching purchase report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase report",
      error: error.message,
    });
  }
};

const getPaymentSummaryReport = async (req, res) => {
  try {
    let { page = 1, limit = 10, startDate, endDate, search, paymentMode } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const now = new Date();

    // Default date ranges
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ---------- Filters ----------
    const filter = {};
    if (startDate && endDate) {
      filter.received_on = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (paymentMode) {

      filter.$or = [
        { payment_method: paymentMode },
        { payment_method: mongoose.Types.ObjectId.isValid(paymentMode)
            ? new mongoose.Types.ObjectId(paymentMode)
            : null
        }
      ];
    }

    if (search) {
      filter.$or = [
        { referenceNo: { $regex: search, $options: 'i' } },
        { paymentId: { $regex: search, $options: 'i' } }
      ];
    }

    // ---------- Monthly Totals (by payment mode) ----------
    const calculateMonthlyTotal = async (start, end) => {
      const data = await InvoicePayment.aggregate([
        {
          $match: {
            received_on: { $gte: start, $lte: end },
            ...filter
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: [{ $type: "$payment_method" }, "objectId"] },
                "$payment_method",
                "$payment_method" // string stays string
              ]
            },
            totalAmount: { $sum: "$amount" }
          }
        },
        {

          paymentMode: {
            name: typeof item._id === "string" ? item._id : item.paymentMode?.name
          }
        },
        { $unwind: { path: "$paymentMode", preserveNullAndEmptyArrays: true } }
      ]);
      return data;
    };

    const currentTotals = await calculateMonthlyTotal(startOfCurrentMonth, endOfCurrentMonth);
    const previousTotals = await calculateMonthlyTotal(startOfPreviousMonth, endOfPreviousMonth);

    let totalCurrent = 0;
    let totalPrevious = 0;
    const summary = {};

    // merge modes
    const allModes = new Map();

    [...currentTotals, ...previousTotals].forEach(item => {
      if (item.paymentMode) {
        allModes.set(item.paymentMode._id.toString(), item.paymentMode);
      }
    });

    for (let [modeId, mode] of allModes.entries()) {
      const currentObj = currentTotals.find(ct => ct._id?.toString() === modeId);
      const previousObj = previousTotals.find(pt => pt._id?.toString() === modeId);

      const current = currentObj?.totalAmount || 0;
      const previous = previousObj?.totalAmount || 0;

      totalCurrent += current;
      totalPrevious += previous;

      const changePercentage = previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : (current > 0 ? 100 : 0);

      summary[mode.slug] = {
        paymentMode: {
          id: mode._id,
          name: mode.name,
          slug: mode.slug,
          status: mode.status
        },
        previousMonthAmount: previous.toFixed(2),
        currentMonthAmount: current.toFixed(2),
        changePercentage,
        trend: current > previous ? "up" : current < previous ? "down" : "equal"
      };
    }

    summary.total = {
      previousMonthAmount: totalPrevious.toFixed(2),
      currentMonthAmount: totalCurrent.toFixed(2),
      changePercentage: totalPrevious > 0
        ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100)
        : 0,
      trend: totalCurrent > totalPrevious ? "up" : totalCurrent < totalPrevious ? "down" : "equal"
    };

    // ---------- Paginated detailed payments ----------
    const payments = await InvoicePayment.find(filter)
      .populate({
        path: 'invoiceId',
        populate: { path: 'billTo', model: 'Customer', select: 'name email phone' } // ✅ FIX: billTo not customerId
      })
      .populate('payment_method', 'name slug status')
      .sort({ received_on: -1 })
      .skip(skip)
      .limit(limit);

    const data = payments.map(p => ({
      customer: p.invoiceId?.billTo?.name || 'N/A', // ✅ FIXED
      paymentId: p._id.toString(),
      paidDate: p.received_on.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      amount: p.amount.toFixed(2),
      paymentMode: p.payment_method
        ? {
            id: p.payment_method._id,
            name: p.payment_method.name,
            slug: p.payment_method.slug,
            status: p.payment_method.status
          }
        : null,
      referenceNo: p.invoiceId?.referenceNo || '',
      createdAt: p.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }));

    const totalRecords = await InvoicePayment.countDocuments(filter);

    res.status(200).json({
      message: "Payment Summary Report fetched successfully",
      summary,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
        paymentMode: paymentMode || null
      },
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      },
      data
    });

  } catch (error) {
    console.error("Error fetching payment summary report:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

const getProfitLossReport = async (req, res) => {
  try {
    const filters = getProfitLossFilters(req.query);
    const { records, summary } = await getProfitLossRecords(req.user, filters);

    res.status(200).json({
      success: true,
      message: 'Profit/Loss report fetched successfully',
      filters,
      summary,
      records,
    });
  } catch (error) {
    console.error('Error fetching profit/loss report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profit/loss report',
      error: error.message,
    });
  }
};

const exportProfitLossReportExcel = async (req, res) => {
  try {
    const filters = getProfitLossFilters(req.query);
    const { records, summary } = await getProfitLossRecords(req.user, filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Profit & Loss');

    worksheet.columns = [
      { header: 'Period', key: 'period', width: 14 },
      { header: 'Gross Sales', key: 'grossSales', width: 16 },
      { header: 'Sales Return', key: 'salesReturn', width: 16 },
      { header: 'Net Sales', key: 'netSales', width: 16 },
      { header: 'Gross COGS', key: 'grossCogs', width: 16 },
      { header: 'Return COGS', key: 'salesReturnCogs', width: 16 },
      { header: 'Net COGS', key: 'netCogs', width: 16 },
      { header: 'Gross Profit', key: 'grossProfit', width: 16 },
      { header: 'Purchase Expenses', key: 'purchaseExpenses', width: 18 },
      { header: 'Operating Expenses', key: 'operatingExpenses', width: 18 },
      { header: 'Broker Commission', key: 'brokerCommission', width: 18 },
      { header: 'Staff Commission', key: 'staffCommission', width: 16 },
      { header: 'Total Expenses', key: 'totalExpenses', width: 16 },
      { header: 'Net Profit/Loss', key: 'netProfitLoss', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    records.forEach((record) => worksheet.addRow(record));
    worksheet.addRow({});
    worksheet.addRow({
      period: 'Total',
      grossSales: summary.grossSales,
      salesReturn: summary.salesReturn,
      netSales: summary.netSales,
      grossCogs: summary.grossCogs,
      salesReturnCogs: summary.salesReturnCogs,
      netCogs: summary.netCogs,
      grossProfit: summary.grossProfit,
      purchaseExpenses: summary.purchaseExpenses,
      operatingExpenses: summary.operatingExpenses,
      brokerCommission: summary.brokerCommission,
      staffCommission: summary.staffCommission,
      totalExpenses: summary.totalExpenses,
      netProfitLoss: summary.netProfitLoss,
      status: summary.status,
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(records.length + 3).font = { bold: true };

    const fileSuffix =
      filters.reportType === 'range' && filters.startDate && filters.endDate
        ? `${filters.startDate.toISOString().slice(0, 10)}_${filters.endDate.toISOString().slice(0, 10)}`
        : filters.reportType === 'yearly'
        ? `${filters.year}`
        : `${filters.year}-${String(filters.month).padStart(2, '0')}`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Profit_Loss_Report_${fileSuffix}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting profit/loss report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting profit/loss report',
      error: error.message,
    });
  }
};

module.exports = {
  getIncomeStats,
  getPurchaseReport,
  getPaymentSummaryReport,
  getProfitLossReport,
  exportProfitLossReportExcel,
};
