const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const Product = require('@models/Product');
const InvoicePayment = require('@models/InvoicePayment');
const CreditNote = require('@models/CreditNote');
const Purchase = require('@models/Purchase');
const SupplierPayment = require('@models/SupplierPayment');
const DebitNote = require('@models/DebitNote');
const Quotation = require('@models/Quotation');
const Supplier = require('@models/Supplier');
const ExcelJS = require('exceljs');

const getInvoiceSalesReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // --- Build filters dynamically ---
    const filters = { isDeleted: false, status: { $ne: 'CANCELLED' } };

    // Date filter
    if (startDate || endDate) {
      filters.invoiceDate = {};
      if (startDate) filters.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.invoiceDate.$lte = end;
      }
    }

    // Search filter (invoice number or item name)
    if (search) {
      const regex = new RegExp(search, 'i');
      filters.$or = [{ invoiceNumber: regex }, { 'items.name': regex }];
    }

    // Month ranges
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const totalInvoices = await Invoice.countDocuments(filters);

    // Fetch invoices (exclude CANCELLED)
    const [currentInvoices, previousInvoices, allInvoices] = await Promise.all([
      Invoice.find({
        invoiceDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        isDeleted: false,
        status: { $ne: 'CANCELLED' },
      })
        // .populate('items.id', 'name code selling_price category product_image')
        .populate('items.product_id', 'name code selling_price category product_image')
        .populate('billTo', 'name email phone image'),

      Invoice.find({
        invoiceDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
        isDeleted: false,
        status: { $ne: 'CANCELLED' },
      })
        // .populate('items.id', 'name code selling_price category product_image')
        .populate('items.product_id', 'name code selling_price category product_image')
        .populate('billTo', 'name email phone image'),

      Invoice.find(filters)
        // .populate('items.id', 'name code selling_price category product_image')
        .populate('items.product_id', 'name code selling_price category product_image')
        .populate('billTo', 'name email phone image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    // console.log("=== DEBUG: RAW INVOICE SAMPLE ===");
    // console.log({
    //   invoiceId: allInvoices?.[0]?._id,
    //   billTo: allInvoices?.[0]?.billTo,
    //   customerId: allInvoices?.[0]?.customerId,
    // });

    // Process invoices helper
    const processInvoices = async (invoices) => {
      const report = [];
      const productMap = {};
      let totalRevenue = 0;

      for (const invoice of invoices) {
        let invoiceRevenue = 0;

        invoice.items.forEach(item => {
          // const product = item.id;
          const product = item.product_id;
          const qty = item.qty || 0;
          const revenue = item.amount || (qty * (item.rate || 0));
          invoiceRevenue += revenue;
          totalRevenue += revenue;

          if (product) {
            if (!productMap[product._id]) {
              productMap[product._id] = {
                _id: product._id,
                name: product.name,
                sku: product.code,
                category: product.category?.name || '-',
                sellingPrice: product.selling_price,
                image: product.product_image
                  ? `${process.env.BASE_URL}${product.product_image}`
                  : '',
                soldQuantity: 0,
                revenue: 0
              };
            }
            productMap[product._id].soldQuantity += qty;
            productMap[product._id].revenue += revenue;
          }
        });

        // Payments
        const payments = await InvoicePayment.find({ invoiceId: invoice._id });
        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const paymentModes = [...new Set(payments.map(p => p.payment_method))];

        // Use actual invoice status instead of calculating
        const status = invoice.status || 'DRAFT';

        report.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customer: {
            name: invoice.billTo?.name || '-',
            email: invoice.billTo?.email || '',
            phone: invoice.billTo?.phone || '',
            image: invoice.billTo?.image
              ? `${process.env.BASE_URL}/${invoice.billTo.image}`
              : ''
          },
          amount: invoice.TotalAmount || 0,
          paidAmount,
          remainingBalance: (invoice.TotalAmount || 0) - paidAmount,
          paymentModes,
          createdAt: invoice.createdAt,
          status,
          invoiceDate: invoice.invoiceDate,
          revenue: invoiceRevenue,
          // products: invoice.items.map(item => ({
          //   _id: item.id?._id || null,
          //   name: item.id?.name || '-',
          //   sku: item.id?.code || '-',
          //   sellingPrice: item.id?.selling_price || 0,
          //   categoryName: item.id?.category?.name || '-',
          //   soldQuantity: item.qty || 0,
          //   revenue: item.amount || (item.qty * (item.rate || 0)) || 0,
          //   image: item.id?.product_image
          //     ? `${process.env.BASE_URL}${item.id.product_image}`
          //     : '',
          // }))

          products: invoice.items.map(item => ({
            _id: item.product_id?._id || null,
            name: item.product_id?.name || '-',
            sku: item.product_id?.code || '-',
            sellingPrice: item.product_id?.selling_price || 0,
            categoryName: item.product_id?.category?.name || '-',
            soldQuantity: item.qty || 0,
            revenue: item.amount || (item.qty * (item.rate || 0)) || 0,
            image: item.product_id?.product_image
              ? `${process.env.BASE_URL}${item.product_id.product_image}`
              : '',
          }))
        });
      }

      return { report, totalRevenue, productMap };
    };

    const { report: currentReport, totalRevenue: currentTotal, productMap: currentProducts } =
      await processInvoices(currentInvoices);
    const { report: previousReport, totalRevenue: previousTotal, productMap: previousProducts } =
      await processInvoices(previousInvoices);
    const { report: allReport } = await processInvoices(allInvoices);

    const getBestSelling = (products) => {
      const productArray = Object.values(products);
      if (!productArray.length) return { name: '-', soldQuantity: 0 };
      return productArray.reduce((max, p) => (p.soldQuantity > max.soldQuantity ? p : max));
    };

    const bestCurrent = getBestSelling(currentProducts);
    const bestPrevious = getBestSelling(previousProducts);

    const calculateChange = (previous, current) => {
      if (previous === 0 && current === 0) return { change: '0%', trend: 'equal' };
      if (previous === 0) return { change: '100%', trend: 'up' };
      const change = (((current - previous) / previous) * 100).toFixed(0);
      return {
        change: Number(change),
        trend: current > previous ? 'up' : current < previous ? 'down' : 'equal',
      };
    };

    res.status(200).json({
      success: true,
      message: 'Invoice sales report fetched successfully',
      data: {
        TotalRevenue: {
          currentMonthAmount: currentTotal,
          previousMonthAmount: previousTotal,
          ...calculateChange(previousTotal, currentTotal),
        },
        ActiveInvoices: {
          currentMonthCount: currentInvoices.length,
          previousMonthCount: previousInvoices.length,
          ...calculateChange(previousInvoices.length, currentInvoices.length),
        },
        BestSellingProduct: {
          name: bestCurrent.name,
          currentMonthQty: bestCurrent.soldQuantity || 0,
          previousMonthQty: bestPrevious.soldQuantity || 0,
          ...calculateChange(bestPrevious.soldQuantity || 0, bestCurrent.soldQuantity || 0),
        }
      },
      records: allReport,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null
      },
      pagination: {
        total: totalInvoices,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalInvoices / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoice sales report:', error);
    return res.status(500).json({ message: 'Error generating report', error: error.message });
  }
};

const getCreditNoteSalesReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Build filter object for EXCHANGE invoices
    const baseFilter = {
      status: 'EXCHANGE',
      isDeleted: false
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      baseFilter.invoiceDate = {};
      if (startDate) baseFilter.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseFilter.invoiceDate.$lte = end;
      }
    }

    // Add search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      baseFilter.$or = [
        { invoiceNumber: searchRegex },
        { 'items.name': searchRegex },
        { referenceNo: searchRegex }
      ];
    }

    // Count only EXCHANGE invoices with filters
    const totalExchangeInvoices = await Invoice.countDocuments(baseFilter);

    // Fetch EXCHANGE invoices instead of credit notes
    const [currentInvoices, previousInvoices, allInvoices] = await Promise.all([
      Invoice.find({
        invoiceDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        status: 'EXCHANGE',
        isDeleted: false
      })
        .populate('billTo', 'name email phone image')
        .sort({ createdAt: -1 }),

      Invoice.find({
        invoiceDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
        status: 'EXCHANGE',
        isDeleted: false
      })
        .populate('billTo', 'name email phone image'),

      Invoice.find(baseFilter) // Use base filter with search and date range
        .populate('billTo', 'name email phone image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
    ]);

    const normalizeCustomer = (invoice) => {
      if (invoice && typeof invoice.customerId === 'string' && invoice.customerId === 'UNKNOWN') {
        invoice.customerId = null;
      }
      return invoice;
    };

    currentInvoices.forEach(normalizeCustomer);
    previousInvoices.forEach(normalizeCustomer);
    allInvoices.forEach(normalizeCustomer);

    const processExchangeInvoices = (invoices) => {
      const report = [];
      const productMap = {};
      let totalReturnedAmount = 0;
      let totalProfitAmount = 0;

      for (const invoice of invoices) {
        // For exchanges, returned_amount is the refund (downgrade) and profit_amount is additional payment (upgrade)
        const returnedAmount = invoice.returned_amount || 0;
        const profitAmount = invoice.profit_amount || 0;
        
        totalReturnedAmount += returnedAmount;
        totalProfitAmount += profitAmount;

        invoice.items.forEach(item => {
          const qty = item.qty || 0;
          const amount = item.amount || (qty * (item.rate || 0));
          const productName = item.name || '-';
          const variantName = item.variantName
            ? item.variantName
            : [item.variantDesignNo, item.variantColor, item.variantSize]
              .filter(Boolean)
              .join(' - ');
          const productId = item.variantId || item.name; // Use variantId or name as key

          if (productId) {
            if (!productMap[productId]) {
              productMap[productId] = {
                _id: productId,
                name: productName,
                variantName,
                sku: item.code || '-',
                category: '-',
                sellingPrice: item.rate || 0,
                image: '',
                exchangedQuantity: 0,
                exchangeAmount: 0
              };
            }
            productMap[productId].exchangedQuantity += qty;
            productMap[productId].exchangeAmount += amount;
          }
        });

        const customer = invoice.billTo || invoice.customerId || null;
        
        report.push({
          creditNoteId: invoice._id, // Keep same field name for frontend compatibility
          creditNoteNumber: invoice.invoiceNumber, // Use invoice number
          customer: {
            name: customer?.name || customer?.companyName || '-',
            email: customer?.email || '',
            phone: customer?.phone || customer?.mobile || '',
            image: customer?.image ? `${process.env.BASE_URL}/${customer.image}` : ''
          },
          refundAmount: invoice.TotalAmount || 0, // Show total invoice amount
          returned_amount: returnedAmount, // Downgrade refund
          profit_amount: profitAmount, // Upgrade profit
          reason: returnedAmount > 0 ? 'Exchange - Downgrade' : 'Exchange - Upgrade',
          status: invoice.status,
          creditNoteDate: invoice.invoiceDate, // Use invoice date
          createdAt: invoice.createdAt,
          items: invoice.items.map(item => ({
            _id: item.variantId || null,
            name: item.name || '-',
            sku: item.code || '-',
            sellingPrice: item.rate || 0,
            categoryName: '-',
            returnedQuantity: item.qty || 0,
            refundAmount: item.amount || (item.qty * (item.rate || 0)) || 0,
            image: ''
          }))
        });
      }

      return { report, totalReturnedAmount, totalProfitAmount, productMap };
    };

    const { report: currentReport, totalReturnedAmount: currentReturnedAmount, totalProfitAmount: currentProfitAmount, productMap: currentProducts } = processExchangeInvoices(currentInvoices);
    const { report: previousReport, totalReturnedAmount: previousReturnedAmount, totalProfitAmount: previousProfitAmount, productMap: previousProducts } = processExchangeInvoices(previousInvoices);
    const { report: allReport } = processExchangeInvoices(allInvoices);

    const getMostExchanged = (products) => {
      const productArray = Object.values(products);
      if (!productArray.length) return { name: '-', exchangedQuantity: 0 };
      return productArray.reduce((max, p) => (p.exchangedQuantity > max.exchangedQuantity ? p : max));
    };

    const bestCurrent = getMostExchanged(currentProducts);
    const bestPrevious = getMostExchanged(previousProducts);

    const calculateChange = (previous, current) => {
      if (previous === 0 && current === 0) return { change: '0%', trend: 'equal' };
      if (previous === 0) return { change: '100%', trend: 'up' };
      const change = (((current - previous) / previous) * 100).toFixed(0);
      return { 
        change: Number(change), 
        trend: current > previous ? 'up' : current < previous ? 'down' : 'equal' 
      };
    };

    return res.status(200).json({
      success: true,
      message: 'Exchange invoice sales return report fetched successfully',
      data: {
        TotalRefund: {
          currentMonthAmount: currentReturnedAmount,
          previousMonthAmount: previousReturnedAmount,
          ...calculateChange(previousReturnedAmount, currentReturnedAmount)
        },
        TotalProfit: {
          currentMonthAmount: currentProfitAmount,
          previousMonthAmount: previousProfitAmount,
          ...calculateChange(previousProfitAmount, currentProfitAmount)
        },
        ActiveCreditNotes: {
          currentMonthCount: currentInvoices.length,
          previousMonthCount: previousInvoices.length,
          ...calculateChange(previousInvoices.length, currentInvoices.length)
        },
        MostReturnedProduct: {
          name: bestCurrent.name,
          variantName: bestCurrent.variantName || '',
          currentMonthQty: bestCurrent.exchangedQuantity || 0,
          previousMonthQty: bestPrevious.exchangedQuantity || 0,
          ...calculateChange(bestPrevious.exchangedQuantity || 0, bestCurrent.exchangedQuantity || 0)
        }
      },
      records: allReport,
      pagination: {
        total: totalExchangeInvoices,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalExchangeInvoices / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching exchange invoice sales return report:', error);
    return res.status(500).json({ message: 'Error generating report', error: error.message });
  }
};


const getPurchaseReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // Build filters dynamically
    const filters = { isDeleted: false };

    // Date range filter
    if (startDate || endDate) {
      filters.purchaseDate = {};
      if (startDate) filters.purchaseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.purchaseDate.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const regex = new RegExp(search, 'i');
      filters.$or = [{ purchaseId: regex }, { supplier_bill_number: regex }, { 'items.name': regex }];
    }

    // Count purchases for pagination
    const totalPurchases = await Purchase.countDocuments(filters);

    // Get month ranges
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const endOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    // Fetch data in parallel
    const [currentPurchases, previousPurchases, allPurchases] =
      await Promise.all([
        Purchase.find({
          purchaseDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
          isDeleted: false,
        })
          .populate('vendorId', 'firstName lastName email phone profileImage')
          // .populate('items.id', 'name code category product_image')
          .sort({ createdAt: -1 }),

        Purchase.find({
          purchaseDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
          isDeleted: false,
        })
          .populate('vendorId', 'firstName lastName email phone profileImage'),
          // .populate('items.id', 'name code category product_image'),

        Purchase.find(filters)
          .populate('vendorId', 'firstName lastName email phone profileImage')
          // .populate('items.id', 'name code category product_image')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
      ]);

    // Helper to process purchases
    const processPurchases = async (purchases) => {
      const report = [];
      const supplierMap = {};
      const productMap = {};
      let totalAmount = 0;

      // efficiently fetch all debit notes for these purchases
      const purchaseIds = purchases.map(p => p._id);
      const debitNotes = await DebitNote.find({ 
          purchaseId: { $in: purchaseIds }, 
          isDeleted: false,
          status: { $ne: 'cancelled' }
      });
      const debitNoteMap = {};
      debitNotes.forEach(dn => {
          const pid = dn.purchaseId.toString();
          if (!debitNoteMap[pid]) debitNoteMap[pid] = [];
          debitNoteMap[pid].push(dn);
      });

      for (const purchase of purchases) {
        totalAmount += purchase.totalAmount;

        // Aggregate supplier totals
        if (purchase.vendorId) {
          const supplierId = purchase.vendorId._id.toString();
          if (!supplierMap[supplierId]) {
            supplierMap[supplierId] = {
              _id: supplierId,
              name: `${purchase.vendorId.firstName || ''} ${
                purchase.vendorId.lastName || ''
              }`.trim(),
              email: purchase.vendorId.email || null,
              phone: purchase.vendorId.phone || null,
              totalAmount: 0,
            };
          }
          supplierMap[supplierId].totalAmount += purchase.totalAmount;
        }

        purchase.items.forEach((item) => {
          const productKey = item.id || item.name;

          if (!productKey) return;

          if (!productMap[productKey]) {
            productMap[productKey] = {
              _id: productKey,
              name: item.name || '-',
              sku: item.id || '-',
              category: '-',
              quantity: 0,
              totalAmount: 0,
              image: '',
            };
          }

          productMap[productKey].quantity += item.qty || 0;
          productMap[productKey].totalAmount += item.amount || 0;
        });

        // Use stored values from Purchase model
        const paidAmount = purchase.paidAmount || 0;
        const balance = purchase.balanceAmount !== undefined ? purchase.balanceAmount : (purchase.totalAmount - paidAmount);

        let status = purchase.status ? purchase.status.toUpperCase() : 'UNPAID';
        
        // Check for Debit Notes (Returns)
        const relatedDebitNotes = debitNoteMap[purchase._id.toString()] || [];
        const returnedAmount = relatedDebitNotes.reduce((sum, dn) => sum + dn.finalAmount, 0); // using finalAmount as it's the value of the note

        // Logic to normalize status for display in table
        // Priority: Cancelled > Returned > Paid > Partially Paid > Unpaid
        if (status === 'CANCELLED') {
            // keep as cancelled
        } else if (returnedAmount >= purchase.totalAmount && purchase.totalAmount > 0) {
            status = 'RETURN';
        } else if (returnedAmount > 0) {
            status = 'PARTIALLY_RETURN';
        } else if (status === 'PENDING' || status === 'PARTIALLY_PAID') {
             if (paidAmount >= purchase.totalAmount && purchase.totalAmount > 0) status = 'PAID';
             else if (paidAmount > 0) status = 'PARTIALLY_PAID';
             else status = 'UNPAID';
        } else if (status === 'COMPLETED') {
             status = 'PAID';
        }

        report.push({
          purchaseId: purchase.purchaseId,
          supplierBillNumber: purchase.supplier_bill_number || '',
          vendor: purchase.vendorId
            ? {
                name: `${purchase.vendorId.firstName || ''} ${
                  purchase.vendorId.lastName || ''
                }`.trim(),
                email: purchase.vendorId.email,
                phone: purchase.vendorId.phone,
                image: purchase.vendorId.profileImage
                  ? `${process.env.BASE_URL}/${purchase.vendorId.profileImage}`
                  : ``,
              }
            : null,
          totalAmount: purchase.totalAmount,
          paidAmount,
          balance,
          status,
          purchaseDate: purchase.purchaseDate,
          items: purchase.items.map((item) => ({
            name: item.name || '-',
            sku: item.id || '-',
            quantity: item.qty || 0,
            amount: item.amount || 0,
            image: '',
          })),
        });
      }

      return { report, totalAmount, supplierMap, productMap };
    };

    // Process paginated data for the table
    const { report: currentReport } = await processPurchases(currentPurchases);
    const { report: allReport } = await processPurchases(allPurchases);

    // --- Calculate Stats using Aggregation (Global, not just paginated) ---
    // We match the same filters as the list to ensure consistency with search/date
    const stats = await Purchase.aggregate([
      { $match: filters },
      // Lookup DebitNotes to identify returned purchases
      {
        $lookup: {
          from: 'debitnotes', // Ensure this matches your collection name (usually lowercase plural of model)
          localField: '_id',
          foreignField: 'purchaseId',
          as: 'debitNotes'
        }
      },
      {
        $addFields: {
           // Sum of all debit notes for this purchase (active ones)
           debitNoteTotal: { 
             $sum: {
               $map: {
                 input: { 
                   $filter: { 
                     input: "$debitNotes", 
                     as: "dn", 
                     cond: { 
                        $and: [
                          { $ne: ["$$dn.status", "cancelled"] },
                          { $eq: ["$$dn.isDeleted", false] }
                        ]
                     } 
                   } 
                 },
                 as: "activeDn",
                 in: "$$activeDn.finalAmount"
               }
             }
           }
        }
      },
      {
        $addFields: {
           isReturned: { $gte: ["$debitNoteTotal", "$totalAmount"] }, // Fully returned
           effectiveStatus: {
             $cond: {
               if: { $eq: [{ $toLower: "$status" }, "cancelled"] },
               then: "cancelled",
               else: {
                 $cond: {
                   if: { $gte: ["$debitNoteTotal", "$totalAmount"] },
                   then: "return",
                   else: { $toLower: "$status" }
                 }
               }
             }
           }
        }
      },
      {
        $group: {
          _id: null,
          // Total Count includes everything
          totalCount: { $sum: 1 },
          
          // Total Amount should EXCLUDE Returned purchases (per user request)
          // We also exclude Cancelled usually.
          totalAmount: { 
            $sum: {
              $cond: [
                 { $or: [ { $eq: ["$effectiveStatus", "return"] }, { $eq: ["$effectiveStatus", "cancelled"] } ] },
                 0, 
                 "$totalAmount"
              ] 
            } 
          },
          
          // Completed = 'paid' or 'completed' AND NOT Returned
          completedCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $in: ["$effectiveStatus", ["paid", "completed", "partially_paid"]] }, // Wait, partially_paid is pending usually? User logic: Pending = unpaid/partially_paid. 
                    // Previous logic: Completed = PAID.
                    { $eq: ["$effectiveStatus", "paid"] }
                  ]
                }, 
                1, 
                0
              ]
            }
          },
          completedAmount: {
            $sum: {
              $cond: [{ $eq: ["$effectiveStatus", "paid"] }, "$totalAmount", 0]
            }
          },

          // "Cancelled Orders" card is now "Returned Orders" 
          // We will map 'cancelledCount' output to 'returned' logic, or repurpose the field name to avoid breaking frontend interface (which expects cancelledOrders object)
          // Actually, I'll calculate `returnedCount` here and map it to `cancelledOrders` in the response construction below.
          returnedCount: {
            $sum: {
              $cond: [{ $eq: ["$effectiveStatus", "return"] }, 1, 0]
            }
          },
          returnedAmount: {
             // User wants "Amount of Returned Purchase" 
             // If I return the whole purchase, is it the purchase total? Yes.
             $sum: {
               $cond: [{ $eq: ["$effectiveStatus", "return"] }, "$totalAmount", 0]
             }
          },

          // Pending = 'unpaid', 'partially_paid', 'new', 'draft'
          // And ensure it's not Returned or Cancelled
          pendingCount: {
            $sum: {
              $cond: [
                { $in: ["$effectiveStatus", ["unpaid", "partially_paid", "new", "draft", "pending"]] },
                1, 
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ["$effectiveStatus", ["unpaid", "partially_paid", "new", "draft", "pending"]] },
                "$totalAmount",
                0
              ]
            }
          }
        }
      }
    ]);

    const statResult = stats[0] || {
      totalCount: 0, totalAmount: 0,
      completedCount: 0, completedAmount: 0,
      returnedCount: 0, returnedAmount: 0,
      pendingCount: 0, pendingAmount: 0
    };

    // Build response
    const responseData = {
      totalPurchases: {
        count: statResult.totalCount,
        totalAmount: statResult.totalAmount, // This now excludes returned amounts
      },
      completedOrders: {
        count: statResult.completedCount,
        totalAmount: statResult.completedAmount,
      },
      cancelledOrders: { // Frontend expects this key, but we fill it with Returned data
        count: statResult.returnedCount,
        totalAmount: statResult.returnedAmount,
      },
      pendingOrders: {
        count: statResult.pendingCount,
        totalAmount: statResult.pendingAmount,
      },
    };

    res.status(200).json({
      success: true,
      message: 'Purchase report fetched successfully',
      data: responseData,
      records: allReport,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
      },
      pagination: {
        total: totalPurchases,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalPurchases / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase report:', error);
    res.status(500).json({
      message: 'Error generating purchase report',
      error: error.message,
    });
  }
};


const getDebitNoteReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // --- Build filters dynamically ---
    const filters = { isDeleted: false };

    // Date range filter
    if (startDate || endDate) {
      filters.debitNoteDate = {};
      if (startDate) filters.debitNoteDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.debitNoteDate.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [{ debitNoteId: regex }, { "items.name": regex }];
    }

    // Total count for pagination
    const totalAllNotes = await DebitNote.countDocuments(filters);

    // --- Month ranges (for trend comparisons) ---
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    // --- Fetch debit notes ---
    const [currentNotes, previousNotes, allNotesPaginated, allNotes] =
      await Promise.all([
        // Current month
        DebitNote.find({
          debitNoteDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
          isDeleted: false,
        })
          .populate("vendorId", "firstName lastName email phone profileImage"),
          // .populate("items.id", "name code category product_image"),

        // Previous month
        DebitNote.find({
          debitNoteDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
          isDeleted: false,
        })
          .populate("vendorId", "firstName lastName email phone profileImage"),
          // .populate("items.id", "name code category product_image"),

        // Paginated with filters
        DebitNote.find(filters)
          .populate("vendorId", "firstName lastName email phone profileImage")
          // .populate("items.id", "name code category product_image")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        // All filtered
        DebitNote.find(filters),
      ]);

    // --- Helper to process debit notes ---
    const processNotes = (notes) => {
      const report = [];
      const vendorMap = {};
      const productMap = {};
      let totalAmount = 0;

      notes.forEach((note) => {
        totalAmount += note.totalAmount;

        // Vendor aggregation
        if (note.vendorId) {
          const vendorId = note.vendorId._id.toString();
          if (!vendorMap[vendorId]) {
            vendorMap[vendorId] = {
              _id: vendorId,
              name: `${note.vendorId.firstName || ""} ${
                note.vendorId.lastName || ""
              }`.trim(),
              email: note.vendorId.email || null,
              phone: note.vendorId.phone || null,
              image: note.vendorId.profileImage || null,
              totalAmount: 0,
            };
          }
          vendorMap[vendorId].totalAmount += note.totalAmount;
        }

        // Product aggregation
        // note.items.forEach((item) => {
        //   const product = item.id;
        //   if (product) {
        //     const productId = product._id.toString();
        //     if (!productMap[productId]) {
        //       productMap[productId] = {
        //         _id: productId,
        //         name: product.name,
        //         sku: product.code,
        //         category: product.category?.name || "-",
        //         quantity: 0,
        //         totalAmount: 0,
        //         image: product.product_image
        //           ? `${process.env.BASE_URL}${product.product_image}`
        //           : "",
        //       };
        //     }
        //     productMap[productId].quantity += item.qty || 0;
        //     productMap[productId].totalAmount += item.amount || 0;
        //   }
        // });

        // Product aggregation (SAFE)
        note.items.forEach((item) => {
          // item.id is STRING now
          if (!item.id) return;

          const productId = item.id.toString();

          if (!productMap[productId]) {
            productMap[productId] = {
              _id: productId,
              name: item.name || "-",
              sku: "-",
              category: "-",
              quantity: 0,
              totalAmount: 0,
              image: "",
            };
          }

          productMap[productId].quantity += Number(item.qty) || 0;
          productMap[productId].totalAmount += Number(item.amount) || 0;
        });

        // Report row
        report.push({
          Id: note._id,
          debitNoteId: note.debitNoteId,
          vendor: note.vendorId
            ? {
                name: `${note.vendorId.firstName || ""} ${
                  note.vendorId.lastName || ""
                }`.trim(),
                email: note.vendorId.email,
                phone: note.vendorId.phone,
                image: note.vendorId.profileImage
                  ? `${process.env.BASE_URL}/${note.vendorId.profileImage}`
                  : ``,
              }
            : null,
          totalAmount: note.totalAmount,
          status: note.status,
          debitNoteDate: note.debitNoteDate,
          items: note.items.map((item) => ({
            name: item.name,
            // sku: item.id?.code || "-",
            sku: "-", // product code not stored in debit note
            quantity: item.qty || 0,
            amount: item.amount || 0,
            // image: item.id?.product_image
            //   ? `${process.env.BASE_URL}${item.id.product_image}`
            //   : "",
            image: "",
          })),
        });
      });

      return { report, totalAmount, vendorMap, productMap };
    };

    // --- Process results ---
    const { totalAmount: currentTotal, vendorMap: currentVendors, productMap: currentProducts } =
      processNotes(currentNotes);
    const { totalAmount: previousTotal } = processNotes(previousNotes);
    const { report: allNotesReport } = processNotes(allNotesPaginated);
    const { totalAmount: allFilteredTotal } = processNotes(allNotes);

    // --- Calculate % change ---
    const calculateChange = (previous, current) => {
      if (previous === 0 && current === 0) return { change: "0%", trend: "equal" };
      if (previous === 0) return { change: "100%", trend: "up" };
      const change = (((current - previous) / previous) * 100).toFixed(0);
      return {
        change: Number(change),
        trend: current > previous ? "up" : current < previous ? "down" : "equal",
      };
    };

    // Best vendor/product for current month
    const bestVendor = Object.values(currentVendors).reduce(
      (max, v) => (v.totalAmount > max.totalAmount ? v : max),
      { totalAmount: 0 }
    );
    const bestProduct = Object.values(currentProducts).reduce(
      (max, p) => (p.quantity > max.quantity ? p : max),
      { quantity: 0 }
    );

    // --- Build response ---
    res.status(200).json({
      success: true,
      message: "Debit note report fetched successfully",
      data: {
        TotalDebit: {
          currentMonthAmount: currentTotal,
          previousMonthAmount: previousTotal,
          allFilteredAmount: allFilteredTotal, // <-- now reflects filters
          ...calculateChange(previousTotal, currentTotal),
        },
        ActiveDebitNotes: {
          currentMonthCount: currentNotes.length,
          previousMonthCount: previousNotes.length,
          ...calculateChange(previousNotes.length, currentNotes.length),
        },
        BestVendor: {
          name: bestVendor.name || "-",
          currentMonthAmount: bestVendor.totalAmount || 0,
        },
        BestProduct: {
          name: bestProduct.name || "-",
          currentMonthQty: bestProduct.quantity || 0,
        },
      },
      records: allNotesReport,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
      },
      pagination: {
        total: totalAllNotes,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalAllNotes / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching debit note report:", error);
    res.status(500).json({
      message: "Error generating debit note report",
      error: error.message,
    });
  }
};


const getQuotationSalesReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // --- Build filters dynamically ---
    const filters = { isDeleted: false };

    // Date filter
    if (startDate || endDate) {
      filters.quotationDate = {};
      if (startDate) filters.quotationDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.quotationDate.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const regex = new RegExp(search, 'i');
      filters.$or = [{ quotationId: regex }, { 'items.name': regex }];
    }

    // --- Month ranges ---
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const totalQuotations = await Quotation.countDocuments(filters);

    // --- Fetch quotations ---
    const [currentQuotations, previousQuotations, allQuotations] = await Promise.all([
      Quotation.find({
        quotationDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        isDeleted: false,
      })
        .populate('billTo', 'name email phone image')
        .populate('items.id', 'name code category product_image'),

      Quotation.find({
        quotationDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
        isDeleted: false,
      })
        .populate('billTo', 'name email phone image')
        .populate('items.id', 'name code category product_image'),

      Quotation.find(filters)
        .populate('billTo', 'name email phone image')
        .populate('items.id', 'name code category product_image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    // --- Helper function ---
    const processQuotations = (quotations) => {
      const report = [];
      const customerMap = {};
      const productMap = {};
      let totalAmount = 0;

      quotations.forEach((quotation) => {
        totalAmount += quotation.TotalAmount || 0;

        // Aggregate customers (billTo)
        if (quotation.billTo) {
          const customerId = quotation.billTo._id.toString();
          if (!customerMap[customerId]) {
            customerMap[customerId] = {
              _id: customerId,
              name: quotation.billTo.name || '-',
              email: quotation.billTo.email || '',
              phone: quotation.billTo.phone || '',
              totalAmount: 0,
            };
          }
          customerMap[customerId].totalAmount += quotation.TotalAmount || 0;
        }

        // Aggregate products
        quotation.items.forEach((item) => {
          const product = item.id;
          if (product) {
            const productId = product._id.toString();
            if (!productMap[productId]) {
              productMap[productId] = {
                _id: productId,
                name: product.name,
                sku: product.code,
                category: product.category?.name || '-',
                quantity: 0,
                totalAmount: 0,
                image: product.product_image
                  ? `${process.env.BASE_URL}${product.product_image}`
                  : '',
              };
            }
            productMap[productId].quantity += item.qty || 0;
            productMap[productId].totalAmount += item.amount || 0;
          }
        });

        // Add formatted record
        report.push({
          quotationId: quotation.quotationId,
          customer: quotation.billTo
            ? {
                name: quotation.billTo.name,
                email: quotation.billTo.email,
                phone: quotation.billTo.phone,
                image: quotation.billTo.image
                  ? `${process.env.BASE_URL}/${quotation.billTo.image}`
                  : '',
              }
            : null,
          totalAmount: quotation.TotalAmount,
          status: quotation.status,
          quotationDate: quotation.quotationDate,
          expiryDate: quotation.expiryDate,
          items: quotation.items.map((item) => ({
            name: item.name,
            sku: item.id?.code || '-',
            quantity: item.qty || 0,
            amount: item.amount || 0,
            image: item.id?.product_image
              ? `${process.env.BASE_URL}${item.id.product_image}`
              : '',
          })),
        });
      });

      return { report, totalAmount, customerMap, productMap };
    };

    const calculateChange = (previous, current) => {
      if (previous === 0 && current === 0) return { percentage: 0, ratio: 'equal' };
      if (previous === 0) return { percentage: 100, ratio: 'up' };
      const percentage = (((current - previous) / previous) * 100).toFixed(0);
      return {
        percentage: Number(percentage),
        ratio: current > previous ? 'up' : current < previous ? 'down' : 'equal',
      };
    };

    const { report: currentReport, totalAmount: currentTotal } = processQuotations(currentQuotations);
    const { totalAmount: previousTotal } = processQuotations(previousQuotations);
    const { report: allReport } = processQuotations(allQuotations);

    // Status counts
    const getStatusCount = (quotations, status) =>
      quotations.filter((q) => q.status === status).length;

    const stats = {
      total: {
        current: currentTotal,
        previous: previousTotal,
        ...calculateChange(previousTotal, currentTotal),
      },
      pending: {
        current: getStatusCount(currentQuotations, 'pending'),
        previous: getStatusCount(previousQuotations, 'pending'),
        ...calculateChange(
          getStatusCount(previousQuotations, 'pending'),
          getStatusCount(currentQuotations, 'pending')
        ),
      },
      completed: {
        current: getStatusCount(currentQuotations, 'completed'),
        previous: getStatusCount(previousQuotations, 'completed'),
        ...calculateChange(
          getStatusCount(previousQuotations, 'completed'),
          getStatusCount(currentQuotations, 'completed')
        ),
      },
      cancelled: {
        current: getStatusCount(currentQuotations, 'cancelled'),
        previous: getStatusCount(previousQuotations, 'cancelled'),
        ...calculateChange(
          getStatusCount(previousQuotations, 'cancelled'),
          getStatusCount(currentQuotations, 'cancelled')
        ),
      },
    };

    res.status(200).json({
      success: true,
      message: 'Quotation sales report fetched successfully',
      data: stats,
      records: allReport,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || null,
      },
      pagination: {
        total: totalQuotations,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalQuotations / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quotation sales report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating quotation sales report',
      error: error.message,
    });
  }
};


// ===== EXPORT SALES REPORT TO EXCEL =====
const exportSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate, search = '' } = req.query;

    // Build query filter - exclude CANCELLED invoices
    const query = { 
      isDeleted: false, 
      status: { $ne: 'CANCELLED' } 
    };

    // Date filter
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { 'items.name': searchRegex }
      ];
    }

    // Fetch all matching invoices
    const invoices = await Invoice.find(query)
      .populate('billTo', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    // Get payments for all invoices
    const invoiceIds = invoices.map(inv => inv._id);
    const payments = await InvoicePayment.aggregate([
      { $match: { invoiceId: { $in: invoiceIds } } },
      {
        $group: {
          _id: '$invoiceId',
          totalPaid: { $sum: '$amount' }
        }
      }
    ]);

    // Map payments to invoice IDs
    const paymentMap = {};
    payments.forEach(p => {
      paymentMap[p._id.toString()] = p.totalPaid || 0;
    });

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Define columns
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
      { header: 'Date', key: 'invoiceDate', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'GST Type', key: 'gstType', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 18 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Variant', key: 'variant', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Rate', key: 'rate', width: 12 },
      { header: 'Tax', key: 'tax', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Item Total', key: 'itemTotal', width: 15 },
      { header: 'Invoice Total', key: 'invoiceTotal', width: 15 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
      { header: 'Balance', key: 'balance', width: 15 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add data rows - one row per invoice item
    invoices.forEach(invoice => {
      const customerName = invoice.billTo?.name || 'N/A';
      const customerPhone = invoice.billTo?.phone || 'N/A';
      const totalPaid = paymentMap[invoice._id.toString()] || 0;
      const balance = (invoice.TotalAmount || 0) - totalPaid;

      // Format date
      const formattedDate = invoice.invoiceDate
        ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB')
        : '';

      // If invoice has items, create a row for each item
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item, index) => {
          const variantInfo = [
            item.variantColor,
            item.variantSize
          ]
            .filter(Boolean)
            .join(' - ');

          worksheet.addRow({
            invoiceNumber: index === 0 ? invoice.invoiceNumber : '',
            invoiceDate: index === 0 ? formattedDate : '',
            customer: index === 0 ? customerName : '',
            phone: index === 0 ? customerPhone : '',
            taxType: index === 0 ? invoice.taxType || 'GST' : '',
            gstType: index === 0 ? invoice.gstType || 'N/A' : '',
            status: index === 0 ? invoice.status : '',
            paymentMethod: index === 0 ? invoice.payment_method || 'N/A' : '',
            productName: item.name || 'N/A',
            variant: variantInfo || 'N/A',
            quantity: item.qty || 0,
            rate: item.rate || 0,
            tax: item.tax || 0,
            discount: item.discount || 0,
            itemTotal: item.amount || 0,
            invoiceTotal: index === 0 ? invoice.TotalAmount || 0 : '',
            paidAmount: index === 0 ? totalPaid : '',
            balance: index === 0 ? balance : ''
          });
        });
      } else {
        // If no items, add a single row for the invoice
        worksheet.addRow({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: formattedDate,
          customer: customerName,
          phone: customerPhone,
          taxType: invoice.taxType || 'GST',
          gstType: invoice.gstType || 'N/A',
          status: invoice.status,
          paymentMethod: invoice.payment_method || 'N/A',
          productName: 'No Items',
          variant: 'N/A',
          quantity: 0,
          rate: 0,
          tax: 0,
          discount: 0,
          itemTotal: 0,
          invoiceTotal: invoice.TotalAmount || 0,
          paidAmount: totalPaid,
          balance: balance
        });
      }
    });

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `Sales_Report_Export_${today}.xlsx`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export sales report error:', err);
    res.status(500).json({
      success: false,
      message: 'Error exporting sales report',
      error: err.message
    });
  }
};

// ===== EXPORT PURCHASE REPORT TO EXCEL =====
const exportPurchaseReport = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;

    const query = { isDeleted: false };

    // Date range filter
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ purchaseId: regex }, { 'items.name': regex }];
    }

    // Fetch purchases with all necessary vendor details and payment mode
    // We populate User fields for basic info, but detailed info comes from Supplier model
    const purchases = await Purchase.find(query)
      .populate('vendorId', 'firstName lastName email phone') 
      .populate('paymentMode', 'name')
      .sort({ createdAt: -1 });
    
    // Fetch Supplier details for address/gst
    const vendorIds = purchases
        .map(p => p.vendorId ? p.vendorId._id : null)
        .filter(id => id !== null);
    
    const suppliers = await Supplier.find({ user_id: { $in: vendorIds } });
    const supplierMap = suppliers.reduce((acc, sup) => {
        if (sup.user_id) {
            acc[sup.user_id.toString()] = sup;
        }
        return acc;
    }, {});


    // Fetch debit notes for status calculation
    const debitNotes = await DebitNote.find({ isDeleted: false });
    const debitNoteMap = debitNotes.reduce((acc, note) => {
      const pId = note.purchaseId ? note.purchaseId.toString() : null;
      if (pId) {
        if (!acc[pId]) acc[pId] = 0;
        acc[pId] += note.totalAmount || 0;
      }
      return acc;
    }, {});

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchase Report');

    // Define columns as requested
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
      { header: 'Item Amount', key: 'itemAmount', width: 15 },

      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Mode', key: 'paymentMode', width: 20 },
      { header: 'Total Purchase Amount', key: 'totalAmount', width: 20 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
      { header: 'Balance', key: 'balanceAmount', width: 15 },
    ];

    // Styling header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add rows
    purchases.forEach((purchase) => {
      const purchaseIdStr = purchase._id.toString();
      const returnedAmount = debitNoteMap[purchaseIdStr] || 0;
      let status = purchase.status ? purchase.status.toUpperCase() : 'UNPAID';

      // Status Logic
      if (status === 'CANCELLED') {
         // keep cancelled
      } else if (returnedAmount >= purchase.totalAmount && purchase.totalAmount > 0) {
        status = 'RETURN';
      } else if (returnedAmount > 0) {
        status = 'PARTIALLY_RETURN';
      }

      const purchaseDate = purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString('en-GB') : '-';
      
      // Vendor Details (User + Supplier)
      const userVendor = purchase.vendorId;
      const supplierDetails = userVendor ? supplierMap[userVendor._id.toString()] : null;

      // prioritize Supplier model for company details, fallback to User model
      // Supplier Name: user prefers "Supplier Name". 
      // If Supplier model has company_name, maybe use that concatenated or distinct? 
      // Current UI uses user.firstName + lastName. I'll stick to that as base, or Supplier.company_name if exists?
      // Let's use User name as primary since that's what was working, but User might want company name if available.
      // I'll stick to User name for now to avoid regression on what's "seen", but feel free to switch if requested.
      const supplierName = userVendor ? `${userVendor.firstName || ''} ${userVendor.lastName || ''}`.trim() : 'N/A';
      
      const supplierPhone = supplierDetails?.phone_number || (userVendor ? userVendor.phone : 'N/A');
      const supplierAddress = supplierDetails?.company_address || (userVendor ? userVendor.address : 'N/A');
      const supplierCity = supplierDetails?.city || (userVendor && userVendor.city && userVendor.city.name ? userVendor.city.name : 'N/A');
      const supplierPincode = supplierDetails?.pin_code || (userVendor ? userVendor.postalCode : 'N/A');
      const supplierGst = supplierDetails?.gst_no || 'N/A';

      // Payment Mode Name
      const paymentModeName = purchase.paymentMode ? purchase.paymentMode.name : (purchase.payment_mode || 'N/A');

      // Iterate over items to create detailed rows
      if (purchase.items && purchase.items.length > 0) {
        purchase.items.forEach((item, index) => {
           worksheet.addRow({
              purchaseDate: index === 0 ? purchaseDate : '',
              purchaseId: index === 0 ? purchase.purchaseId : '',
              referenceNo: index === 0 ? (purchase.referenceNo || 'N/A') : '',
              supplierBillNumber: index === 0 ? (purchase.supplier_bill_number || 'N/A') : '',
              
              supplierName: index === 0 ? supplierName : '',
              supplierPhone: index === 0 ? supplierPhone : '',
              supplierAddress: index === 0 ? supplierAddress : '',
              supplierCity: index === 0 ? supplierCity : '',
              supplierPincode: index === 0 ? supplierPincode : '',
              supplierGst: index === 0 ? supplierGst : '',

              productName: item.name || 'N/A',
              variant: (item.variantColor || item.variantSize) ? `${item.variantColor || ''} ${item.variantSize || ''}`.trim() : 'N/A', 
              qty: item.qty || 0,
              rate: item.rate || 0,
              itemAmount: item.amount || 0,

              status: index === 0 ? status : '',
              paymentMode: index === 0 ? paymentModeName : '',
              totalAmount: index === 0 ? (purchase.totalAmount || 0) : '',
              paidAmount: index === 0 ? (purchase.paidAmount || 0) : '',
              balanceAmount: index === 0 ? (purchase.balance || 0) : '',
           });
        });
      } else {
         // No items case
         worksheet.addRow({
              purchaseDate: purchaseDate,
              purchaseId: purchase.purchaseId,
              referenceNo: purchase.referenceNo || 'N/A',
              supplierBillNumber: purchase.supplier_bill_number || 'N/A',
              
              supplierName: supplierName,
              supplierPhone: supplierPhone,
              supplierAddress: supplierAddress,
              supplierCity: supplierCity,
              supplierPincode: supplierPincode,
              supplierGst: supplierGst,

              productName: 'No Items',
              variant: '',
              qty: '',
              rate: '',
              itemAmount: '',

              status: status,
              paymentMode: paymentModeName,
              totalAmount: purchase.totalAmount || 0,
              paidAmount: purchase.paidAmount || 0,
              balanceAmount: purchase.balance || 0,
         });
      }

    });

    // Response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Purchase_Report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting purchase report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting purchase report',
      error: error.message,
    });
  }
};


module.exports = { 
  getInvoiceSalesReport,
  getCreditNoteSalesReport,
  getPurchaseReport,
  getDebitNoteReport,
  getQuotationSalesReport,
  exportSalesReportExcel,
  exportPurchaseReport,
};
