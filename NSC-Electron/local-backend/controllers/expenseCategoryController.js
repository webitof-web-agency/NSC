const ExpenseCategory = require('@models/ExpenseCategory');

// Create Expense Category
exports.createExpenseCategory = async (req, res) => {
  try {
    const { title, description, status = true } = req.body;

    const category = new ExpenseCategory({
      title,
      description,
      status
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: "Expense Category created successfully",
      data: {
        id: category._id,
        title: category.title,
        description: category.description,
        status: category.status,
        createdAt: category.createdAt
      }
    });
  } catch (err) {
    console.error("Error creating expense category:", err);
    res.status(500).json({
      success: false,
      message: "Error creating expense category",
      error: err.message
    });
  }
};

// Get All Expense Categories (with pagination, search, filter)
exports.getAllExpenseCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status
    } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (status !== undefined) {
      query.status = status === 'true';
    }

    const total = await ExpenseCategory.countDocuments(query);

    const categories = await ExpenseCategory.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const formatted = categories.map(cat => ({
      id: cat._id,
      title: cat.title,
      description: cat.description,
      status: cat.status,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Expense Categories fetched successfully",
      data: {
        categories: formatted,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: err.message
    });
  }
};

exports.listExpenseCategories = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const limit = 10; 

    // Build query
    const query = { isDeleted: false };
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Fetch categories
    const categories = await ExpenseCategory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    // Format response
    const formatted = categories.map(cat => ({
      id: cat._id,
      title: cat.title,
      description: cat.description,
      status: cat.status,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Expense Categories fetched successfully',
      data: formatted
    });

  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: err.message
    });
  }
};

// Get Single Expense Category
exports.getExpenseCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ExpenseCategory.findOne({ _id: id, isDeleted: false });

    if (!category) {
      return res.status(404).json({ success: false, message: "Expense Category not found" });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (err) {
    console.error("Error fetching expense category:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching expense category",
      error: err.message
    });
  }
};

// Update Expense Category
exports.updateExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    const category = await ExpenseCategory.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { title, status, description } },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Expense Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Expense Category updated successfully",
      data: category
    });
  } catch (err) {
    console.error("Error updating expense category:", err);
    res.status(500).json({
      success: false,
      message: "Error updating expense category",
      error: err.message
    });
  }
};

// Soft Delete Expense Category
exports.deleteExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ExpenseCategory.findOneAndDelete(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Expense Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Expense Category deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting expense category:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting expense category",
      error: err.message
    });
  }
};
