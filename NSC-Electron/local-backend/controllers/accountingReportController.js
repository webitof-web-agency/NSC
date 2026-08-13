const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const InvoicePayment = require('@models/InvoicePayment');
const Customer = require('@models/Customer');
const Purchase = require('@models/Purchase');
const SupplierPayment = require('@models/SupplierPayment');
const User = require('@models/User');

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

// ------------------------- Income Stats -------------------------
const getIncomeStats = async (req, res) => {
  try {
    let { page = 1, limit = 10, startDate, endDate, search } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== Filters =====
    const filter = {};
    if (startDate && endDate) {
      filter.received_on = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (search) {
      filter.$or = [
        { "invoiceId.invoiceNumber": { $regex: search, $options: "i" } },
        { "invoiceId.referenceNo": { $regex: search, $options: "i" } },
        { "invoiceId.billTo.name": { $regex: search, $options: "i" } }
      ];
    }

    // ===== Queries =====
    const [currentPayments, previousPayments, allPayments, totalRecords] =
      await Promise.all([
        // Current month payments
        InvoicePayment.find({ received_on: { $gte: startOfCurrentMonth }, ...filter })
          .populate({
            path: "invoiceId",
            select: "billTo invoiceNumber items referenceNo",
            populate: {
              path: "billTo",
              model: "Customer",
              select: "name email phone image"
            }
          }),
          // .populate({
          //   path: "payment_method",
          //   model: "PaymentMode",
          //   select: "name slug status"
          // }),

        // Previous month payments
        InvoicePayment.find({
          received_on: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
          ...filter
        })
          .populate({
            path: "invoiceId",
            select: "billTo invoiceNumber items referenceNo",
            populate: {
              path: "billTo",
              model: "Customer",
              select: "name email phone image"
            }
          }),
          // .populate({
          //   path: "payment_method",
          //   model: "PaymentMode",
          //   select: "name slug status"
          // }),

        // Paginated list of all payments
        InvoicePayment.find(filter)
          .populate({
            path: "invoiceId",
            select: "billTo invoiceNumber items referenceNo",
            populate: {
              path: "billTo",
              model: "Customer",
              select: "name email phone image"
            }
          })
          // .populate({
          //   path: "payment_method",
          //   model: "PaymentMode",
          //   select: "name slug status"
          // })
          .sort({ received_on: -1 })
          .skip(skip)
          .limit(limit),

        // Count total records
        InvoicePayment.countDocuments(filter)
      ]);

    // ===== Totals =====
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

    // ===== Transactions list =====
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
        // paymentMode: payment.payment_method
        //   ? {
        //       id: payment.payment_method._id,
        //       name: payment.payment_method.name,
        //       slug: payment.payment_method.slug,
        //       status: payment.payment_method.status
        //     }
        //   : null,

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

        referenceNo: invoice?.referenceNo || "",
        createdAt: payment.createdAt
      };
    });

    // ===== Response =====
    return res.status(200).json({
      success: true,
      message: "Product and Total Income data fetched successfully",
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null
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


// const getPurchaseReport = async (req, res) => {
//   try {
//     let { startDate, endDate, search, paymentMode, page = 1, limit = 10 } = req.query;

//     page = Number(page);
//     limit = Number(limit);
//     const skip = (page - 1) * limit;

//     const now = new Date();
//     const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//     const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//     const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

//     // ---------- Filters ----------
//     let filters = { isDeleted: false };

//     if (startDate && endDate) {
//       filters.paymentDate = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate),
//       };
//     }

//     if (paymentMode) {
//       filters.paymentMode = paymentMode; // filter by specific mode
//     }

//     if (search) {
//       filters.$or = [
//         { paymentId: { $regex: search, $options: "i" } },
//         { referenceNumber: { $regex: search, $options: "i" } },
//       ];
//     }

//     // ---------- Queries ----------
//     const [currentPayments, previousPayments, allPayments, totalRecords] = await Promise.all([
//       // Current month
//       SupplierPayment.find({
//         paymentDate: { $gte: startOfCurrentMonth },
//         ...filters,
//       })
//         .populate("purchaseId")
//         .populate("supplierId", "firstName lastName email profileImage profileImageUrl")
//         .populate("paymentMode", "name slug status"),

//       SupplierPayment.find({
//         paymentDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
//         ...filters,
//       })
//         .populate("purchaseId")
//         .populate("supplierId", "firstName lastName email profileImage profileImageUrl")
//         .populate("paymentMode", "name slug status"),

//       SupplierPayment.find(filters)
//         .populate("purchaseId")
//         .populate("supplierId", "firstName lastName email profileImage profileImageUrl")
//         .populate("paymentMode", "name slug status")
//         .skip(skip)
//         .limit(limit),

//       // Total count
//       SupplierPayment.countDocuments(filters),
//     ]);

//     // ---------- Calculations ----------
//     const currentTotal = currentPayments.reduce((sum, p) => sum + p.amount, 0);
//     const previousTotal = previousPayments.reduce((sum, p) => sum + p.amount, 0);

//     const currentPurchaseAmount = currentPayments.reduce((sum, payment) => {
//       const purchase = payment.purchaseId;
//       if (!purchase) return sum;
//       return sum + purchase.items.reduce((acc, item) => acc + item.amount, 0);
//     }, 0);

//     const previousPurchaseAmount = previousPayments.reduce((sum, payment) => {
//       const purchase = payment.purchaseId;
//       if (!purchase) return sum;
//       return sum + purchase.items.reduce((acc, item) => acc + item.amount, 0);
//     }, 0);

//     const totalChange = calculateChange(previousTotal, currentTotal);
//     const purchaseChange = calculateChange(previousPurchaseAmount, currentPurchaseAmount);

//     // ---------- Transactions ----------
//     const transactions = allPayments.map((payment) => ({
//       Id: payment._id,
//       supplier: payment.supplierId
//         ? {
//             name: `${payment.supplierId.firstName} ${payment.supplierId.lastName}`.trim(),
//             email: payment.supplierId.email || null,
//             image: payment.supplierId.profileImageUrl || null,
//           }
//         : { name: "Unknown", email: null, image: null },
//       paymentId: payment.paymentId,
//       paidDate: payment.paymentDate,
//       amount: formatAmount(payment.amount),
//       paymentMode: payment.paymentMode
//         ? {
//             id: payment.paymentMode._id,
//             name: payment.paymentMode.name,
//             slug: payment.paymentMode.slug,
//             status: payment.paymentMode.status,
//           }
//         : null,
//       referenceNo: payment.referenceNumber || "",
//       createdAt: payment.createdAt,
//     }));

//     // ---------- Response ----------
//     return res.status(200).json({
//       success: true,
//       message: "Purchase and Supplier Payment data fetched successfully",
//       filters: {
//         startDate: startDate || null,
//         endDate: endDate || null,
//         search: search || null,
//         paymentMode: paymentMode || null,
//       },
//       data: {
//         product_purchases: {
//           previousMonthAmount: formatAmount(previousPurchaseAmount),
//           currentMonthAmount: formatAmount(currentPurchaseAmount),
//           percentage: Math.round(purchaseChange.change || 0),
//           trend: purchaseChange.trend,
//         },
//         total_payments: {
//           previousMonthAmount: formatAmount(previousTotal),
//           currentMonthAmount: formatAmount(currentTotal),
//           percentage: Math.round(totalChange.change || 0),
//           trend: totalChange.trend,
//         },
//       },
//       records: transactions,
//       pagination: {
//         total: totalRecords,
//         page,
//         limit,
//         totalPages: Math.ceil(totalRecords / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching purchase report:", error);
//     return res.status(500).json({
//       message: "Failed to fetch purchase report",
//       error: error.message,
//     });
//   }
// };

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
      // filter.payment_method = paymentMode; // filter by ObjectId

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
        // {
        //   $group: {
        //     _id: "$payment_method",
        //     totalAmount: { $sum: "$amount" }
        //   }
        // },
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
          // $lookup: {
          //   from: "paymentmodes",
          //   localField: "_id",
          //   foreignField: "_id",
          //   as: "paymentMode"
          // }

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

module.exports = {
  getIncomeStats,
  getPurchaseReport,
  getPaymentSummaryReport
};
