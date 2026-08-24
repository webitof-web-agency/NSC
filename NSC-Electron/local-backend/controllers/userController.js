const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const User = require("@models/User");
const Commission = require("@models/Commission");
const Attendance = require("@models/Attendance");
const Role = require("@models/Role");
const CommissionSystemSetting = require("../models/CommissionSystemSetting");

const createStaffUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateOfBirth,
      password,
      address,
      country,
      state,
      city,
      postalCode,
      roleId,
      commissionPercent,   // <-- ADD THIS
      amountPerDay,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered",
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }


    // Fetch system commission setting
    const setting = await CommissionSystemSetting.findOne({});
    const systemCommission = setting?.commissionPercent ?? 0;

    // Convert user input
    const userValue = parseFloat(commissionPercent);

    // If user input is 0, empty, undefined, invalid → use system default
    let finalCommissionValue =
      !isNaN(userValue) && userValue > 0
        ? userValue
        : systemCommission;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateOfBirth,
      password,
      address,
      country,
      state,
      city,
      postalCode,
      user_type: 3,
      roleId: roleId,
      commissionPercent: finalCommissionValue,  // <-- SAVE FINAL VALUE
      amountPerDay: amountPerDay ? parseFloat(amountPerDay) : 0,
      profileImage: req.file ? req.file.path : null,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Staff user created successfully",
      data: {
        id: newUser._id,
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: role.name,
        commissionPercent: newUser.commissionPercent,  // <-- RETURN IT
        amountPerDay: newUser.amountPerDay || 0,
        profileImage: newUser.profileImage
          ? `${req.protocol}://${req.get(
              "host"
            )}/${newUser.profileImage.replace(/\\/g, "/")}`
          : newUser.profileImageUrl,
      },
    });
  } catch (err) {
    console.error("Staff creation error:", err);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (fileErr) {
        console.error("Error cleaning up profile image:", fileErr);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error creating staff user",
      error: err.message,
    });
  }
};

const listStaffUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const query = { user_type: 3 };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .populate("roleId", "roleName")
      .sort({ firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const formattedUsers = users.map((user) => ({
      id: user._id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      gender: user.gender || "",
      dateOfBirth: user.dateOfBirth || null,
      address: user.address || "",
      roleid: user.roleId ? user.roleId._id.toString() : "",
      roleName: user.roleId ? user.roleId.roleName : "N/A", // <-- Add role name here
      profileImage: user.profileImage
        ? `${req.protocol}://${req.get("host")}/${user.profileImage.replace(
            /\\/g,
            "/"
          )}`
        : user.profileImageUrl || null,
      createdAt: user.createdAt,
      commissionPercent: user.commissionPercent ?? 0,    //  ADD THIS FIELD
      amountPerDay: user.amountPerDay ?? 0,
    }));

    res.status(200).json({
      success: true,
      message: "Staff users fetched successfully",
      data: {
        users: formattedUsers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("Error fetching staff users:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching staff users",
      error: err.message,
    });
  }
};

const updateStaffUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateOfBirth,
      password,
      address,
      country,
      state,
      city,
      postalCode,
      roleId,
      commissionPercent,   // <-- ADD THIS
      amountPerDay,
    } = req.body;

    // Check if the user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Staff user not found",
      });
    }

    // Check for email conflict if email is being updated
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email is already registered",
        });
      }
    }

    // Check role validity
    if (roleId) {
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }
      user.roleId = roleId;
    }

    // Update fields
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.gender = gender || user.gender;
    user.dateOfBirth = dateOfBirth || user.dateOfBirth;
    user.address = address || user.address;
    user.country = country || user.country;
    user.state = state || user.state;
    user.city = city || user.city;
    user.postalCode = postalCode || user.postalCode;

    //  NEW: Update commissionPercent
    if (commissionPercent !== undefined && commissionPercent !== null) {
      user.commissionPercent = parseFloat(commissionPercent);
    }
    if (amountPerDay !== undefined && amountPerDay !== null) {
      user.amountPerDay = parseFloat(amountPerDay);
    }

    // Update password if provided
    if (password) {
      user.password = password || user.password;
    }

    // Update profile image if a new one is uploaded
    if (req.file) {
      if (user.profileImage && fs.existsSync(user.profileImage)) {
        fs.unlinkSync(user.profileImage); // Delete old image
      }
      user.profileImage = req.file.path;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Staff user updated successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error updating staff user:", err);
    res.status(500).json({
      success: false,
      message: "Error updating staff user",
      error: err.message,
    });
  }
};

const deleteStaffUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Staff user not found",
      });
    }

    await Attendance.deleteMany({ staffId: id });
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Staff user permanently deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting staff user:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting staff user",
      error: err.message,
    });
  }
};

const deleteStaffUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    return false;
  }
  await Attendance.deleteMany({ staffId: id });
  await User.findByIdAndDelete(id);
  return true;
};

const bulkDeleteStaffUsers = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const users = await User.find({ user_type: 3 }).select('_id');
      targetIds = users.map(u => u._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: "Please provide staff user ids." });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteStaffUserById(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      success: true,
      message: "Staff users deleted",
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error deleting staff users",
      error: err.message,
    });
  }
};

const listCashiersRoleName = async (req, res) => {              // NEW
  try {
    // 1. Get the Cashier role row (case-insensitive)
    const cashierRole = await Role.findOne({
      roleName: { $regex: /^cashier$/i },
    });

    if (!cashierRole) {
      return res.status(404).json({
        success: false,
        message: "Cashier role not found",
      });
    }

    const cashiers = await User.find({
      roleId: cashierRole._id,
      isDeleted: false,
    }).select("firstName lastName email");

    const formatted = cashiers.map((u) => ({
      id: u._id,
      name: `${u.firstName} ${u.lastName}`,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const listStaffsRoleName = async (req, res) => {                // NEW
  try {
    // 1. Find the Staff role (case-insensitive)
    const staffRole = await Role.findOne({
      roleName: { $regex: /^staff$/i },
    });

    if (!staffRole) {
      return res.status(404).json({
        success: false,
        message: "Staff role not found",
      });
    }

    // 2. Get all users where roleId matches Staff role
    const staffUsers = await User.find({
      roleId: staffRole._id,
      isDeleted: false,
    }).select("firstName lastName email profileImage amountPerDay");

    const formatted = staffUsers.map((u) => ({
      id: u._id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      profileImage: u.profileImage || null,
      amountPerDay: u.amountPerDay || 0,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const listStaffCommissionData = async (req, res) => {              // NEW
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";

    // 1. Find Staff Role
    const staffRole = await Role.findOne({
      roleName: { $regex: /^staff$/i },
    });

    if (!staffRole) {
      return res.status(404).json({
        success: false,
        message: "Staff role not found",
      });
    }

    // 2. Build Search Filter
    let filter = {
      roleId: staffRole._id,
      isDeleted: false,
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    const total = await User.countDocuments(filter);

    // 3. Fetch Users
    const users = await User.find(filter)
      .populate("roleId", "roleName")
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 4. Format final list with commission details
    const formattedList = users.map((u) => {
      const todayRecord =
        u.dailyCommission?.find((d) => d.date === today) || null;
      const monthRecord =
        u.monthlyCommission?.find((m) => m.month === month) || null;

      return {
        id: u._id,
        staff: `${u.firstName} ${u.lastName}`,
        phone: u.phone || null,
        role: u.roleId?.roleName || "Staff",
        amountPerDay: u.amountPerDay || 0,

        todayCommission: todayRecord?.commission || 0,
        monthlyCommission: monthRecord?.commission || 0,
        totalEarned: u.commissionEarned || 0,

        createdAt: u.createdAt,
        profileImage: u.profileImage
          ? `${req.protocol}://${req.get("host")}/${u.profileImage.replace(
              /\\/g,
              "/"
            )}`
          : u.profileImageUrl || null,
      };
    });

    //  SORT HERE (highest commission first)
    formattedList.sort((a, b) => {
      if (b.todayCommission !== a.todayCommission)
        return b.todayCommission - a.todayCommission;

      if (b.monthlyCommission !== a.monthlyCommission)
        return b.monthlyCommission - a.monthlyCommission;

      return b.totalEarned - a.totalEarned;
    });

    // 5. Send Final Response
    res.json({
      success: true,
      data: {
        users: formattedList,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching staff commission list",
      error: err.message,
    });
  }
};

// FOR COMMISSION DASHBOARD

const getStaffDailyCommissionHistory = async (req, res) => {
  try {
    const staffId = req.params.id;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    let skip = (page - 1) * limit;

    const dateFilter = req.query.date || ""; // backward compatibility
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";
    const invoiceSearch = req.query.invoice || ""; // partial invoiceNumber

    const staff = await User.findById(staffId).select(
      "firstName lastName profileImageUrl"
    );
    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    // Base filter
    const filter = { staffId: new mongoose.Types.ObjectId(staffId) };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    } else if (dateFilter) {
      filter.date = dateFilter;
    }

    // Get ALL records for that staff + optional date range
    const allRecords = await Commission.find(filter)
      .sort({ date: -1 })
      .populate("items.productId", "name")
      .populate("items.variantId", "designNo")
      .populate("invoiceId", "invoiceNumber")
      .lean();

    // Client-side filter by invoice number (if provided)
    let filteredRecords = allRecords;
    if (invoiceSearch) {
      const searchLower = invoiceSearch.toLowerCase();
      filteredRecords = allRecords.filter(
        (r) =>
          r.invoiceId?.invoiceNumber &&
          r.invoiceId.invoiceNumber
            .toString()
            .toLowerCase()
            .includes(searchLower)
      );
    }

    const total = filteredRecords.length;
    const paginated = filteredRecords.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        staff: {
          id: staffId,
          name: `${staff.firstName} ${staff.lastName}`,
          image: staff.profileImageUrl || null,
        },
        records: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStaffMonthlyCommissionSummary = async (req, res) => {
  try {
    const staffId = req.params.id;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 12;
    let skip = (page - 1) * limit;

    // NEW: accept comma-separated months list
    const monthsList = req.query.months ? req.query.months.split(",") : [];

    const staff = await User.findById(staffId).select("firstName lastName");
    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    const matchStage = { staffId: new mongoose.Types.ObjectId(staffId) };

    // NEW: filter multiple months
    if (monthsList.length > 0) {
      matchStage.month = { $in: monthsList };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$month",
          commission: { $sum: { $ifNull: ["$totalCommissionAmount", "$commissionAmount"] } }, // Handle both new and old fields
          records: { $push: "$_id" },
        },
      },
      { $sort: { _id: -1 } },
    ];

    const all = await Commission.aggregate(pipeline);
    const total = all.length;

    const allTotalCommission = all.reduce(
      (sum, r) => sum + (r.commission || 0),
      0
    );
    const paginated = all.slice(skip, skip + limit);

    const summary = paginated.map((r) => ({
      month: r._id,
      commission: r.commission,
      records: r.records,
    }));

    res.json({
      success: true,
      data: {
        staff: {
          id: staffId,
          name: `${staff.firstName} ${staff.lastName}`,
        },
        summary,
        totalCommission: allTotalCommission,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStaffCommissionDashboard = async (req, res) => {
  try {
    const staffId = req.params.id;

    const staff = await User.findById(staffId).select(
      "firstName lastName email phone profileImageUrl commissionEarned dailyCommission monthlyCommission"
    );

    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);

    const todayCommission =
      staff.dailyCommission?.find((d) => d.date === today)?.commission || 0;
    const monthlyCommission =
      staff.monthlyCommission?.find((m) => m.month === month)?.commission || 0;

    const recentRecords = await Commission.find({ staffId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("items.productId", "name")
      .populate("items.variantId", "designNo")
      .populate("invoiceId", "invoiceNumber");

    res.json({
      success: true,
      data: {
        staff: {
          id: staffId,
          name: `${staff.firstName} ${staff.lastName}`,
          email: staff.email,
          phone: staff.phone,
          // image: staff.profileImageUrl
        },
        todayCommission,
        monthlyCommission,
        totalEarned: staff.commissionEarned,
        recentRecords,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDailyChartData = async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.params.id);
    const { from, to } = req.query;

    const pipeline = [
      {
        $match: {
          staffId: staffId,
          date: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: "$date",
          total: { $sum: { $ifNull: ["$totalCommissionAmount", "$commissionAmount"] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const dailyStats = await Commission.aggregate(pipeline);

    res.json({ success: true, data: dailyStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMonthlyChartData = async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.params.id);
    const year = req.query.year; // "2025"
    const regex = new RegExp(`^${year}-`);

    const pipeline = [
      {
        $match: {
          staffId: staffId,
          month: { $regex: regex },
        },
      },
      {
        $group: {
          _id: "$month",
          total: { $sum: { $ifNull: ["$totalCommissionAmount", "$commissionAmount"] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const monthlyStats = await Commission.aggregate(pipeline);

    res.json({ success: true, data: monthlyStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createStaffUser,
  listStaffUsers,
  updateStaffUser,
  deleteStaffUser,
  bulkDeleteStaffUsers,
  listCashiersRoleName,
  listStaffsRoleName,
  listStaffCommissionData,
  getStaffDailyCommissionHistory,
  getStaffMonthlyCommissionSummary,
  getStaffCommissionDashboard,
  getDailyChartData,
  getMonthlyChartData,
};
