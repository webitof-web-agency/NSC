const mongoose = require("mongoose");
const User = require("@models/User");
const Attendance = require("@models/Attendance");
const Role = require("@models/Role");
const StaffSalary = require("@models/StaffSalary");
const ExcelJS = require("exceljs");

const STATUS_WEIGHTS = {
  PRESENT: 1,
  LATE: 1,
  HALF_DAY: 0.5,
  ON_LEAVE: 0,
  ABSENT: 0,
};

const getPayableDays = (counts) => {
  return Object.keys(STATUS_WEIGHTS).reduce((sum, key) => {
    const count = Number(counts[key] || 0);
    return sum + count * STATUS_WEIGHTS[key];
  }, 0);
};

const getMonthParam = (month) => {
  if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) return month;
  return new Date().toISOString().slice(0, 7);
};

const parseDateInput = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDateString = (date) => date.toISOString().slice(0, 10);

const getDateRange = (fromDate, toDate) => {
  const from = parseDateInput(fromDate);
  const to = parseDateInput(toDate);
  if (!from && !to) return null;
  if (from && to && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
};

const getMonthKeysBetween = (fromDate, toDate) => {
  const from = parseDateInput(fromDate);
  const to = parseDateInput(toDate);
  if (!from || !to) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const months = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
};

const buildAttendanceMap = async (staffIds, month, dateRange) => {
  if (!staffIds.length) return {};
  const match = {
    staffId: { $in: staffIds },
  };
  if (dateRange?.from || dateRange?.to) {
    match.date = {};
    if (dateRange.from) match.date.$gte = toDateString(dateRange.from);
    if (dateRange.to) match.date.$lte = toDateString(dateRange.to);
  } else {
    match.date = { $regex: `^${month}` };
  }
  const rows = await Attendance.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: { staffId: "$staffId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = {};
  rows.forEach((row) => {
    const staffId = row._id.staffId.toString();
    if (!map[staffId]) map[staffId] = {};
    map[staffId][row._id.status] = row.count;
  });
  return map;
};

const buildPaidMap = async (staffIds, month) => {
  if (!staffIds.length) return {};
  const rows = await StaffSalary.aggregate([
    { $match: { staffId: { $in: staffIds }, month } },
    { $group: { _id: "$staffId", totalPaid: { $sum: "$paidAmount" } } },
  ]);
  const map = {};
  rows.forEach((row) => {
    map[row._id.toString()] = row.totalPaid || 0;
  });
  return map;
};

const buildPaidSummaryMap = async (staffIds, month, dateRange) => {
  if (!staffIds.length) return {};
  const match = { staffId: { $in: staffIds } };
  if (dateRange?.from || dateRange?.to) {
    match.paymentDate = {};
    if (dateRange.from) match.paymentDate.$gte = dateRange.from;
    if (dateRange.to) match.paymentDate.$lte = dateRange.to;
  } else {
    match.month = month;
  }
  const rows = await StaffSalary.aggregate([
    { $match: match },
    { $sort: { paymentDate: -1 } },
    {
      $group: {
        _id: "$staffId",
        totalPaid: { $sum: "$paidAmount" },
        lastPaymentDate: { $first: "$paymentDate" },
        lastPaymentMethod: { $first: "$paymentMethod" },
      },
    },
  ]);
  const map = {};
  rows.forEach((row) => {
    map[row._id.toString()] = {
      totalPaid: row.totalPaid || 0,
      lastPaymentDate: row.lastPaymentDate || null,
      lastPaymentMethod: row.lastPaymentMethod || "",
    };
  });
  return map;
};

const getStaffSalarySummary = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", month, fromDate, toDate } = req.query;
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const monthKey = getMonthParam(month);
    const dateRange = getDateRange(fromDate, toDate);
    const monthKeys = dateRange ? getMonthKeysBetween(fromDate, toDate) : [monthKey];

    const staffRole = await Role.findOne({
      roleName: { $regex: /^staff$/i },
    });
    if (!staffRole) {
      return res.status(404).json({
        success: false,
        message: "Staff role not found",
      });
    }

    const filter = {
      roleId: staffRole._id,
      isDeleted: false,
    };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("firstName lastName email phone amountPerDay monthlyCommission")
      .sort({ firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const staffIds = users.map((u) => u._id);
    const attendanceMap = await buildAttendanceMap(staffIds, monthKey, dateRange);
    const paidSummaryMap = await buildPaidSummaryMap(staffIds, monthKey, dateRange);

    const summary = users.map((u) => {
      const counts = attendanceMap[u._id.toString()] || {};
      const present = counts.PRESENT || 0;
      const late = counts.LATE || 0;
      const halfDay = counts.HALF_DAY || 0;
      const onLeave = counts.ON_LEAVE || 0;
      const absent = counts.ABSENT || 0;
      const payableDays = getPayableDays(counts);
      const amountPerDay = Number(u.amountPerDay || 0);
      const baseSalary = payableDays * amountPerDay;
      let commission = 0;
      if (Array.isArray(u.monthlyCommission)) {
        commission = u.monthlyCommission
          .filter((m) => monthKeys.includes(m.month))
          .reduce((sum, m) => sum + Number(m.commission || 0), 0);
      }
      const totalSalary = baseSalary + commission;
      const paidSummary = paidSummaryMap[u._id.toString()] || {
        totalPaid: 0,
        lastPaymentDate: null,
        lastPaymentMethod: "",
      };
      const paidToDate = paidSummary.totalPaid || 0;
      const balanceDue = Math.max(totalSalary - paidToDate, 0);

      return {
        id: u._id,
        staff: `${u.firstName} ${u.lastName}`,
        phone: u.phone || null,
        amountPerDay,
        attendance: { present, late, halfDay, onLeave, absent, payableDays },
        baseSalary,
        commission,
        totalSalary,
        paidToDate,
        balanceDue,
        month: monthKey,
      };
    });

    res.json({
      success: true,
      data: {
        users: summary,
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

const listStaffSalaryPayments = async (req, res) => {
  try {
    const { staffId, month, fromDate, toDate } = req.query;
    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid staffId is required" });
    }
    const monthKey = getMonthParam(month);
    const dateRange = getDateRange(fromDate, toDate);
    const filter = { staffId };
    if (dateRange?.from || dateRange?.to) {
      filter.paymentDate = {};
      if (dateRange.from) filter.paymentDate.$gte = dateRange.from;
      if (dateRange.to) filter.paymentDate.$lte = dateRange.to;
    } else {
      filter.month = monthKey;
    }

    const records = await StaffSalary.find(filter)
      .sort({ paymentDate: -1 })
      .lean();

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createStaffSalaryPayment = async (req, res) => {
  try {
    const {
      staffId,
      month,
      paymentType,
      paymentMethod,
      paidAmount,
      notes,
      paymentDate,
    } = req.body;

    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid staffId is required" });
    }

    const monthKey = getMonthParam(month);

    if (!paymentType || !["ADVANCE", "FULL"].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: "Payment type must be ADVANCE or FULL",
      });
    }

    if (!paymentMethod || !["CASH", "UPI", "BANK", "CHEQUE"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be CASH, UPI, BANK, or CHEQUE",
      });
    }

    const user = await User.findById(staffId).select(
      "firstName lastName amountPerDay monthlyCommission"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Staff user not found",
      });
    }

    const attendanceMap = await buildAttendanceMap([user._id], monthKey);
    const counts = attendanceMap[user._id.toString()] || {};
    const present = counts.PRESENT || 0;
    const late = counts.LATE || 0;
    const halfDay = counts.HALF_DAY || 0;
    const onLeave = counts.ON_LEAVE || 0;
    const absent = counts.ABSENT || 0;
    const payableDays = getPayableDays(counts);
    const amountPerDayValue = Number(user.amountPerDay || 0);
    const baseSalary = payableDays * amountPerDayValue;
    const commission =
      user.monthlyCommission?.find((m) => m.month === monthKey)?.commission ||
      0;
    const totalSalary = baseSalary + commission;

    const paidMap = await buildPaidMap([user._id], monthKey);
    const paidBefore = paidMap[user._id.toString()] || 0;
    const balanceDue = Math.max(totalSalary - paidBefore, 0);

    let finalPaidAmount = Number(paidAmount);
    if (paymentType === "FULL") {
      if (!paidAmount) {
        finalPaidAmount = balanceDue;
      }
    }

    if (isNaN(finalPaidAmount) || finalPaidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Paid amount must be greater than 0",
      });
    }

    if (finalPaidAmount > balanceDue) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot exceed remaining balance",
      });
    }

    const balanceAfter = Math.max(totalSalary - (paidBefore + finalPaidAmount), 0);

    const record = await StaffSalary.create({
      staffId,
      month: monthKey,
      attendance: { present, late, halfDay, onLeave, absent, payableDays },
      amountPerDay: amountPerDayValue,
      baseSalary,
      commissionAmount: commission,
      totalSalary,
      paymentType,
      paymentMethod,
      paidAmount: finalPaidAmount,
      paidBefore,
      balanceAfter,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes || "",
      createdBy: req.user,
    });

    res.status(201).json({
      success: true,
      message: "Staff salary record saved successfully",
      data: record,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const exportStaffSalaryExcel = async (req, res) => {
  try {
    const { search = "", month, balance = "ALL", fromDate, toDate } = req.query;
    const monthKey = getMonthParam(month);
    const dateRange = getDateRange(fromDate, toDate);
    const monthKeys = dateRange ? getMonthKeysBetween(fromDate, toDate) : [monthKey];

    const staffRole = await Role.findOne({
      roleName: { $regex: /^staff$/i },
    });
    if (!staffRole) {
      return res.status(404).json({
        success: false,
        message: "Staff role not found",
      });
    }

    const filter = {
      roleId: staffRole._id,
      isDeleted: false,
    };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("firstName lastName email phone amountPerDay monthlyCommission")
      .sort({ firstName: 1 })
      .lean();

    const staffIds = users.map((u) => u._id);
    const attendanceMap = await buildAttendanceMap(staffIds, monthKey, dateRange);
    const paidSummaryMap = await buildPaidSummaryMap(staffIds, monthKey, dateRange);

    let summary = users.map((u) => {
      const counts = attendanceMap[u._id.toString()] || {};
      const present = counts.PRESENT || 0;
      const late = counts.LATE || 0;
      const halfDay = counts.HALF_DAY || 0;
      const onLeave = counts.ON_LEAVE || 0;
      const absent = counts.ABSENT || 0;
      const payableDays = getPayableDays(counts);
      const amountPerDay = Number(u.amountPerDay || 0);
      const baseSalary = payableDays * amountPerDay;
      let commission = 0;
      if (Array.isArray(u.monthlyCommission)) {
        commission = u.monthlyCommission
          .filter((m) => monthKeys.includes(m.month))
          .reduce((sum, m) => sum + Number(m.commission || 0), 0);
      }
      const totalSalary = baseSalary + commission;
      const paidSummary = paidSummaryMap[u._id.toString()] || {
        totalPaid: 0,
        lastPaymentDate: null,
        lastPaymentMethod: "",
      };
      const paidToDate = paidSummary.totalPaid || 0;
      const lastPaymentDate = paidSummary.lastPaymentDate
        ? new Date(paidSummary.lastPaymentDate).toISOString().slice(0, 10)
        : "";
      const lastPaymentMethod = paidSummary.lastPaymentMethod || "";
      const balanceDue = Math.max(totalSalary - paidToDate, 0);

      return {
        staff: `${u.firstName} ${u.lastName}`,
        phone: u.phone || "",
        amountPerDay,
        present,
        payableDays,
        baseSalary,
        commission,
        totalSalary,
        paidToDate: lastPaymentDate,
        paidAmount: paidToDate,
        paymentMethod: lastPaymentMethod,
        balanceDue,
        month: dateRange ? `${toDateString(dateRange.from || new Date())} to ${toDateString(dateRange.to || new Date())}` : monthKey,
      };
    });

    if (balance === "DUE") {
      summary = summary.filter((s) => s.balanceDue > 0);
    } else if (balance === "PAID") {
      summary = summary.filter((s) => s.balanceDue <= 0);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Staff Salary");

    worksheet.columns = [
      { header: "Staff", key: "staff", width: 24 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Amount/Day", key: "amountPerDay", width: 14 },
      { header: "Present", key: "present", width: 10 },
      { header: "Payable Days", key: "payableDays", width: 14 },
      { header: "Base Salary", key: "baseSalary", width: 14 },
      { header: "Commission", key: "commission", width: 12 },
      { header: "Total Salary", key: "totalSalary", width: 14 },
      { header: "Paid To Date", key: "paidToDate", width: 14 },
      { header: "Paid Amount", key: "paidAmount", width: 14 },
      { header: "Payment Method", key: "paymentMethod", width: 14 },
      { header: "Balance Due", key: "balanceDue", width: 14 },
      { header: "Month", key: "month", width: 10 },
    ];

    summary.forEach((row) => {
      worksheet.addRow(row);
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const fileSuffix = dateRange
      ? `${toDateString(dateRange.from || new Date())}_to_${toDateString(dateRange.to || new Date())}`
      : monthKey;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Staff_Salary_${fileSuffix}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getStaffSalarySummary,
  listStaffSalaryPayments,
  createStaffSalaryPayment,
  exportStaffSalaryExcel,
};
