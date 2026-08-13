const MonthlyExpense = require('@models/MonthlyExpense');
const ExpenseCategory = require('@models/ExpenseCategory');
const Purchase = require('@models/Purchase');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const buildPurchaseExpenseMetaMap = async (expenses = []) => {
  const purchaseSourceIds = Array.from(
    new Set(
      expenses
        .filter((expense) => expense?.sourceType === 'PURCHASE' && expense?.sourceId)
        .map((expense) => String(expense.sourceId))
    )
  );

  if (!purchaseSourceIds.length) {
    return {};
  }

  const validObjectIds = purchaseSourceIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const purchaseCodeIds = purchaseSourceIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));

  const purchaseQuery = {
    $or: [
      ...(validObjectIds.length ? [{ _id: { $in: validObjectIds } }] : []),
      ...(purchaseCodeIds.length ? [{ purchaseId: { $in: purchaseCodeIds } }] : []),
    ],
  };

  if (!purchaseQuery.$or.length) {
    return {};
  }

  const purchases = await Purchase.find(purchaseQuery)
    .select('_id purchaseId supplier_bill_number supplierName billTo')
    .populate('billTo', 'firstName lastName')
    .lean();

  return purchases.reduce((acc, purchase) => {
    const supplierFromBillTo = purchase.billTo
      ? `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim()
      : '';
    const supplierName = purchase.supplierName || supplierFromBillTo || null;

    acc[String(purchase._id)] = {
      purchaseId: purchase.purchaseId || null,
      supplierBillNumber: purchase.supplier_bill_number || null,
      supplierName,
    };

    if (purchase.purchaseId) {
      acc[String(purchase.purchaseId)] = acc[String(purchase._id)];
    }

    return acc;
  }, {});
};

// Create a new monthly expense
const createMonthlyExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      expenseCategory,
      amount,
      expenseDate,
      description,
      paymentMode,
      paymentDate,
      paymentDueDate,
      customFields,
      sourceType,
      sourceId,
    } = req.body;


    const userId = req.user;

    // Validate expense category exists
    const category = await ExpenseCategory.findById(expenseCategory);
    if (!category) {
      return res.status(404).json({ message: 'Expense category not found' });
    }

    const monthlyExpense = new MonthlyExpense({
      userId,
      expenseCategory,
      amount,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      description: description || '',
      paymentMode: paymentMode || '',
      customFields: customFields || [],
      paymentDate: paymentDate ? new Date(paymentDate) : null,
      paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
      sourceType: sourceType || '',
      sourceId: sourceId || '',
      createdBy: userId,
    });

    await monthlyExpense.save();

    // Populate the expense category before sending response
    await monthlyExpense.populate('expenseCategory', 'title');

    res.status(201).json({
      message: 'Monthly expense created successfully',
      data: monthlyExpense,
    });
  } catch (error) {
    console.error('Error creating monthly expense:', error);
    res.status(500).json({ message: 'Error creating monthly expense', error: error.message });
  }
};

// Get all monthly expenses with filtering
const getAllMonthlyExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      expenseCategory,
      startDate,
      endDate,
      paymentMode,
      search = '',
      sourceType,
      sourceId,
    } = req.query;

    const userId = req.user;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      userId,
      isDeleted: false,
    };

    // Filter by expense category
    if (expenseCategory) {
      query.expenseCategory = expenseCategory;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) {
        query.expenseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.expenseDate.$lte = new Date(endDate);
      }
    }

    // Filter by payment mode
    if (paymentMode) {
      query.paymentMode = paymentMode;
    }

    if (sourceType) {
      query.sourceType = sourceType;
    }
    if (sourceId) {
      query.sourceId = sourceId;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');

      // 1. Find categories that match the search term
      const matchingCategories = await ExpenseCategory.find({
        title: { $regex: searchRegex }
      }).select('_id');
      const matchingCategoryIds = matchingCategories.map(cat => cat._id);

      // 2. Build the $or array
      const orConditions = [
        { description: { $regex: searchRegex } },
        { expenseCategory: { $in: matchingCategoryIds } }, // Search by Category Title effectively
        { paymentMode: { $regex: searchRegex } } // Search by Payment Mode
      ];

      // 3. Check if search is a valid date (e.g. "2023-10-25" or "10/25/2023")
      const dateSearch = new Date(search);
      if (!isNaN(dateSearch.getTime())) {
        // Create start and end of that day
        const startOfDay = new Date(dateSearch);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateSearch);
        endOfDay.setHours(23, 59, 59, 999);

        orConditions.push({
          expenseDate: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });
      }

      query.$or = orConditions;
    }

    // Get total count
    const total = await MonthlyExpense.countDocuments(query);

    // Fetch expenses with pagination
    const expenses = await MonthlyExpense.find(query)
      .populate('expenseCategory', 'title')
      .populate('createdBy', 'firstName lastName')
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    const purchaseExpenseMetaMap = await buildPurchaseExpenseMetaMap(expenses);
    const enrichedExpenses = expenses.map((expense) => {
      const expenseObject = expense.toObject();
      const purchaseMeta =
        expenseObject.sourceType === 'PURCHASE'
          ? purchaseExpenseMetaMap[String(expenseObject.sourceId)] || null
          : null;

      return {
        ...expenseObject,
        purchase: purchaseMeta,
      };
    });

    res.status(200).json({
      message: 'Monthly expenses retrieved successfully',
      data: enrichedExpenses,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching monthly expenses:', error);
    res.status(500).json({ message: 'Error fetching monthly expenses', error: error.message });
  }
};

// Get a single monthly expense by ID
const getMonthlyExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const expense = await MonthlyExpense.findOne({
      _id: id,
      userId,
      isDeleted: false,
    })
      .populate('expenseCategory', 'title')
      .populate('createdBy', 'firstName lastName');

    if (!expense) {
      return res.status(404).json({ message: 'Monthly expense not found' });
    }

    const purchaseExpenseMetaMap = await buildPurchaseExpenseMetaMap([expense]);
    const expenseObject = expense.toObject();
    const purchaseMeta =
      expenseObject.sourceType === 'PURCHASE'
        ? purchaseExpenseMetaMap[String(expenseObject.sourceId)] || null
        : null;

    res.status(200).json({
      message: 'Monthly expense retrieved successfully',
      data: {
        ...expenseObject,
        purchase: purchaseMeta,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly expense:', error);
    res.status(500).json({ message: 'Error fetching monthly expense', error: error.message });
  }
};

// Update a monthly expense
const updateMonthlyExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const userId = req.user;

    const {
      expenseCategory,
      amount,
      expenseDate,
      description,
      paymentMode,
      paymentDate,
      paymentDueDate,
      customFields,
      sourceType,
      sourceId,
    } = req.body;

    console.log('Updating expense with customFields:', customFields);

    // Find expense
    const expense = await MonthlyExpense.findOne({
      _id: id,
      userId,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Monthly expense not found' });
    }

    // Validate expense category if changed
    if (expenseCategory) {
      const category = await ExpenseCategory.findById(expenseCategory);
      if (!category) {
        return res.status(404).json({ message: 'Expense category not found' });
      }
      expense.expenseCategory = expenseCategory;
    }

    // Update fields
    if (amount !== undefined) expense.amount = amount;
    if (expenseDate) expense.expenseDate = new Date(expenseDate);
    if (description !== undefined) expense.description = description;
    if (paymentMode !== undefined) expense.paymentMode = paymentMode;
    if (customFields !== undefined) expense.customFields = customFields;
    if (paymentDate) expense.paymentDate = new Date(paymentDate);
    else if (paymentDate === null) expense.paymentDate = null;
    if (paymentDueDate) expense.paymentDueDate = new Date(paymentDueDate);
    else if (paymentDueDate === null) expense.paymentDueDate = null;
    if (sourceType !== undefined) expense.sourceType = sourceType || '';
    if (sourceId !== undefined) expense.sourceId = sourceId || '';

    await expense.save();

    // Populate before sending response
    await expense.populate('expenseCategory', 'title');
    await expense.populate('createdBy', 'firstName lastName');

    res.status(200).json({
      message: 'Monthly expense updated successfully',
      data: expense,
    });
  } catch (error) {
    console.error('Error updating monthly expense:', error);
    res.status(500).json({ message: 'Error updating monthly expense', error: error.message });
  }
};

// Delete a monthly expense (permanent delete)
const deleteMonthlyExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    // Find and permanently delete the expense
    const expense = await MonthlyExpense.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Monthly expense not found' });
    }

    res.status(200).json({
      message: 'Monthly expense deleted permanently',
    });
  } catch (error) {
    console.error('Error deleting monthly expense:', error);
    res.status(500).json({ message: 'Error deleting monthly expense', error: error.message });
  }
};

// Get expense summary (total by category)
const getExpenseSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user;

    const matchQuery = {
      userId,
      isDeleted: false,
    };

    if (startDate || endDate) {
      matchQuery.expenseDate = {};
      if (startDate) matchQuery.expenseDate.$gte = new Date(startDate);
      if (endDate) matchQuery.expenseDate.$lte = new Date(endDate);
    }


    // Convert userId to ObjectId if it's a string
    const mongoose = require('mongoose');
    if (typeof userId === 'string') {
      matchQuery.userId = new mongoose.Types.ObjectId(userId);
    }

    // Check total documents for debugging
    const totalDocs = await MonthlyExpense.countDocuments({ isDeleted: false });
    const userDocs = await MonthlyExpense.countDocuments(matchQuery);

    const summary = await MonthlyExpense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$expenseCategory',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          _id: 1,
          categoryName: '$category.title',
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const grandTotal = summary.reduce((sum, item) => sum + item.totalAmount, 0);


    res.status(200).json({
      message: 'Expense summary retrieved successfully',
      data: {
        summary,
        grandTotal,
      },
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ message: 'Error fetching expense summary', error: error.message });
  }
};

// Validation middleware
const validateMonthlyExpense = [
  body('expenseCategory').notEmpty().withMessage('Expense category is required'),
  body('amount').isNumeric().withMessage('Amount must be a number').notEmpty().withMessage('Amount is required'),
  body('expenseDate').optional().isISO8601().withMessage('Invalid expense date'),
  body('paymentMode')
    .optional()
    .isIn(['Cash', 'Online', 'Cheque', 'RTGS/NEFT', ''])
    .withMessage('Invalid payment mode'),
  body('paymentDate').optional().isISO8601().withMessage('Invalid payment date'),
  body('paymentDueDate').optional().isISO8601().withMessage('Invalid payment due date'),
];

module.exports = {
  createMonthlyExpense,
  getAllMonthlyExpenses,
  getMonthlyExpenseById,
  updateMonthlyExpense,
  deleteMonthlyExpense,
  getExpenseSummary,
  validateMonthlyExpense,
};
