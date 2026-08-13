const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const GeneralSetting = require('../models/GeneralSetting');

const ATTENDANCE_SCHEDULE_START_KEY = 'attendanceScheduleStart';
const ATTENDANCE_SCHEDULE_END_KEY = 'attendanceScheduleEnd';

const buildScheduleDateTime = (date, timeValue) => {
  if (!timeValue) return null;
  const normalized = String(timeValue).trim();
  if (!normalized) return null;
  return new Date(`${date}T${normalized}:00`);
};

const getAttendanceSchedule = async () => {
  const settings = await GeneralSetting.find({
    key: { $in: [ATTENDANCE_SCHEDULE_START_KEY, ATTENDANCE_SCHEDULE_END_KEY] }
  }).lean();

  const schedule = { startTime: null, endTime: null };
  settings.forEach((setting) => {
    if (setting.key === ATTENDANCE_SCHEDULE_START_KEY) {
      schedule.startTime = setting.value;
    }
    if (setting.key === ATTENDANCE_SCHEDULE_END_KEY) {
      schedule.endTime = setting.value;
    }
  });

  return schedule;
};

const computeWorkingHoursWithSchedule = ({ checkInTime, checkOutTime, date, scheduleStart, scheduleEnd }) => {
  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);

  let effectiveCheckIn = checkIn;
  let effectiveCheckOut = checkOut;

  if (scheduleStart) {
    effectiveCheckIn = new Date(Math.max(checkIn.getTime(), scheduleStart.getTime()));
  }
  if (scheduleEnd) {
    effectiveCheckOut = new Date(Math.min(checkOut.getTime(), scheduleEnd.getTime()));
  }

  if (effectiveCheckOut.getTime() < effectiveCheckIn.getTime()) {
    effectiveCheckOut = effectiveCheckIn;
  }

  const diffMs = effectiveCheckOut - effectiveCheckIn;
  const workingHours = diffMs / (1000 * 60 * 60);

  return { workingHours, effectiveCheckIn, effectiveCheckOut };
};

const getNextAttendanceId = async () => {
  const last = await Attendance.findOne({})
    .sort({ createdAt: -1 })
    .select('attendanceId');
  if (!last || !last.attendanceId) return 'ATT-000001';
  const match = last.attendanceId.match(/ATT-(\d+)/);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  return `ATT-${String(nextNumber).padStart(6, '0')}`;
};

// Mark attendance (check-in)
exports.markAttendance = async (req, res) => {
  try {
    const { staffId, date, checkInTime, status, notes, location } = req.body;
    const markedBy = req.user; // Auth middleware sets req.user = decoded.id

    // Check if staff exists
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    // Check if attendance already exists for this staff on this date
    const existingAttendance = await Attendance.findOne({
      staffId,
      date,
      isDeleted: false,
    });

    if (existingAttendance) {
      if (!existingAttendance.checkInTime) {
        existingAttendance.checkInTime = checkInTime || new Date();
      }
      if (notes !== undefined) existingAttendance.notes = notes || '';
      if (location !== undefined) existingAttendance.location = location || '';
      if (status) existingAttendance.status = status;
      await existingAttendance.save();
      const populatedAttendance = await Attendance.findById(existingAttendance._id)
        .populate('staffId', 'firstName lastName email profileImage')
        .populate('markedBy', 'firstName lastName');
      return res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data: populatedAttendance,
      });
    }

    // Create new attendance record
    let attendanceId = await getNextAttendanceId();
    let attendance;
    try {
      attendance = await Attendance.create({
        attendanceId,
        staffId,
        date,
        checkInTime,
        status: status || 'PRESENT',
        notes: notes || '',
        location: location || '',
        markedBy,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        attendanceId = await getNextAttendanceId();
        attendance = await Attendance.create({
          attendanceId,
          staffId,
          date,
          checkInTime,
          status: status || 'PRESENT',
          notes: notes || '',
          location: location || '',
          markedBy,
        });
      } else {
        throw err;
      }
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('staffId', 'firstName lastName email profileImage')
      .populate('markedBy', 'firstName lastName');

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message,
    });
  }
};

// Mark check-out and calculate working hours
exports.markCheckOut = async (req, res) => {
  try {
    const { id } = req.params;
    const { checkOutTime, notes } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Check-out already marked for this attendance',
      });
    }

    const schedule = await getAttendanceSchedule();
    const scheduleStart = buildScheduleDateTime(attendance.date, schedule.startTime);
    const scheduleEnd = buildScheduleDateTime(attendance.date, schedule.endTime);

    const { workingHours } = computeWorkingHoursWithSchedule({
      checkInTime: attendance.checkInTime,
      checkOutTime,
      date: attendance.date,
      scheduleStart,
      scheduleEnd
    });

    attendance.checkOutTime = checkOutTime;
    attendance.workingHours = Math.max(0, Number(workingHours.toFixed(2)));
    if (notes) {
      attendance.notes = notes;
    }

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('staffId', 'firstName lastName email profileImage')
      .populate('markedBy', 'firstName lastName');

    return res.status(200).json({
      success: true,
      message: 'Check-out marked successfully',
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Error marking check-out:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark check-out',
      error: error.message,
    });
  }
};

// Get attendance for a specific staff member
exports.getStaffAttendance = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate, status, page = 1, limit = 50 } = req.query;

    const query = {
      staffId,
      isDeleted: false,
    };

    // Date range filter
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendances = await Attendance.find(query)
      .populate('staffId', 'firstName lastName email profileImage')
      .populate('markedBy', 'firstName lastName')
      .sort({ date: -1, checkInTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: attendances,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching staff attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message,
    });
  }
};

// Get all attendance records (admin view)
exports.getAllAttendance = async (req, res) => {
  try {
    const { date, status, staffId, page = 1, limit = 50 } = req.query;

    const query = { isDeleted: false };

    if (date) {
      query.date = date;
    }
    if (status) {
      query.status = status;
    }
    if (staffId) {
      query.staffId = staffId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendances = await Attendance.find(query)
      .populate('staffId', 'firstName lastName email profileImage roleId')
      .populate('markedBy', 'firstName lastName')
      .sort({ date: -1, checkInTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: attendances,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching all attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message,
    });
  }
};

// Get attendance for a specific date (all staff)
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const attendances = await Attendance.find({
      date,
      isDeleted: false,
    })
      .populate('staffId', 'firstName lastName email profileImage roleId')
      .populate('markedBy', 'firstName lastName')
      .sort({ checkInTime: 1 });

    // Get all staff to show who's absent (only user_type: 3)
    const allStaff = await User.find({
      user_type: 3,
      isDeleted: false,
    }).select('firstName lastName email profileImage roleId');

    const attendedStaffIds = attendances.map((a) => a.staffId._id.toString());
    const absentStaff = allStaff.filter((staff) => !attendedStaffIds.includes(staff._id.toString()));

    return res.status(200).json({
      success: true,
      data: {
        present: attendances,
        absent: absentStaff,
        summary: {
          totalStaff: allStaff.length,
          present: attendances.length,
          absent: absentStaff.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance for date',
      error: error.message,
    });
  }
};

// Get today's attendance
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const now = new Date();
    const schedule = await getAttendanceSchedule();
    const scheduleEnd = buildScheduleDateTime(today, schedule.endTime);

    const attendances = await Attendance.find({
      date: today,
      isDeleted: false,
    })
      .populate('staffId', 'firstName lastName email profileImage roleId')
      .populate('markedBy', 'firstName lastName')
      .sort({ checkInTime: 1 });

    // Get all staff (only user_type: 3)
    const allStaff = await User.find({
      user_type: 3,
      isDeleted: false,
    }).select('firstName lastName email profileImage roleId');

    const attendedStaffIds = attendances.map((a) => a.staffId._id.toString());
    const absentStaff = allStaff.filter((staff) => !attendedStaffIds.includes(staff._id.toString()));

    if (scheduleEnd && now >= scheduleEnd) {
      const pendingCheckOut = attendances.filter((attendance) => !attendance.checkOutTime);
      for (const attendance of pendingCheckOut) {
        const checkInTime = new Date(attendance.checkInTime);
        const autoCheckOutTime = scheduleEnd > checkInTime ? scheduleEnd : checkInTime;

        const scheduleStart = buildScheduleDateTime(attendance.date, schedule.startTime);
        const { workingHours } = computeWorkingHoursWithSchedule({
          checkInTime: attendance.checkInTime,
          checkOutTime: autoCheckOutTime,
          date: attendance.date,
          scheduleStart,
          scheduleEnd
        });

        attendance.checkOutTime = autoCheckOutTime;
        attendance.workingHours = Math.max(0, Number(workingHours.toFixed(2)));
        await attendance.save();
      }
    }

    // Categorize by status
    const checkedIn = attendances.filter((a) => !a.checkOutTime);
    const checkedOut = attendances.filter((a) => a.checkOutTime);

    return res.status(200).json({
      success: true,
      data: {
        date: today,
        checkedIn,
        checkedOut,
        notMarked: absentStaff,
        summary: {
          totalStaff: allStaff.length,
          present: attendances.length,
          checkedIn: checkedIn.length,
          checkedOut: checkedOut.length,
          notMarked: absentStaff.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today attendance',
      error: error.message,
    });
  }
};

// Update attendance status manually
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, checkInTime, checkOutTime } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    // Update fields if provided
    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;
    if (checkInTime) attendance.checkInTime = checkInTime;
    if (checkOutTime) {
      const schedule = await getAttendanceSchedule();
      const scheduleStart = buildScheduleDateTime(attendance.date, schedule.startTime);
      const scheduleEnd = buildScheduleDateTime(attendance.date, schedule.endTime);

      const { workingHours } = computeWorkingHoursWithSchedule({
        checkInTime: attendance.checkInTime,
        checkOutTime,
        date: attendance.date,
        scheduleStart,
        scheduleEnd
      });

      attendance.checkOutTime = checkOutTime;
      attendance.workingHours = Math.max(0, Number(workingHours.toFixed(2)));
    }

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('staffId', 'firstName lastName email profileImage')
      .populate('markedBy', 'firstName lastName');

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update attendance',
      error: error.message,
    });
  }
};

// Get attendance report for a staff member
exports.getAttendanceReport = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required',
      });
    }

    // Calculate date range for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;

    const attendances = await Attendance.find({
      staffId,
      date: { $gte: startDate, $lte: endDate },
      isDeleted: false,
    }).sort({ date: 1 });

    const staff = await User.findById(staffId).select("amountPerDay");

    // Calculate statistics
    const stats = {
      totalDays: attendances.length,
      present: attendances.filter((a) => a.status === 'PRESENT').length,
      absent: attendances.filter((a) => a.status === 'ABSENT').length,
      halfDay: attendances.filter((a) => a.status === 'HALF_DAY').length,
      late: attendances.filter((a) => a.status === 'LATE').length,
      onLeave: attendances.filter((a) => a.status === 'ON_LEAVE').length,
      totalWorkingHours: attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0).toFixed(2),
      averageWorkingHours: (
        attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0) / (attendances.length || 1)
      ).toFixed(2),
    };

    return res.status(200).json({
      success: true,
      data: {
        month,
        year,
        staffId,
        amountPerDay: staff?.amountPerDay || 0,
        attendances,
        statistics: stats,
      },
    });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report',
      error: error.message,
    });
  }
};

// Get attendance summary for a staff member
exports.getStaffAttendanceSummary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    const query = {
      staffId,
      isDeleted: false,
    };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(query);
    const staff = await User.findById(staffId).select("amountPerDay");

    const summary = {
      totalDays: attendances.length,
      present: attendances.filter((a) => a.status === 'PRESENT').length,
      absent: attendances.filter((a) => a.status === 'ABSENT').length,
      halfDay: attendances.filter((a) => a.status === 'HALF_DAY').length,
      late: attendances.filter((a) => a.status === 'LATE').length,
      onLeave: attendances.filter((a) => a.status === 'ON_LEAVE').length,
      totalWorkingHours: attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0).toFixed(2),
      averageWorkingHours: (
        attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0) / (attendances.length || 1)
      ).toFixed(2),
    };

    return res.status(200).json({
      success: true,
      data: {
        ...summary,
        amountPerDay: staff?.amountPerDay || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance summary',
      error: error.message,
    });
  }
};
