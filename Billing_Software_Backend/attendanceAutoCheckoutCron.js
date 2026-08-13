const cron = require('node-cron');
const Attendance = require('./models/Attendance');
const GeneralSetting = require('./models/GeneralSetting');

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
    if (setting.key === ATTENDANCE_SCHEDULE_START_KEY) schedule.startTime = setting.value;
    if (setting.key === ATTENDANCE_SCHEDULE_END_KEY) schedule.endTime = setting.value;
  });

  return schedule;
};

const computeWorkingHoursWithSchedule = ({ checkInTime, checkOutTime, scheduleStart, scheduleEnd }) => {
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

  return { workingHours };
};

const runAttendanceAutoCheckout = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const schedule = await getAttendanceSchedule();
    const scheduleEnd = buildScheduleDateTime(today, schedule.endTime);

    if (!scheduleEnd || now < scheduleEnd) return;

    const pendingCheckOut = await Attendance.find({
      date: today,
      isDeleted: false,
      checkOutTime: { $in: [null, undefined] }
    });

    if (!pendingCheckOut.length) return;

    const scheduleStart = buildScheduleDateTime(today, schedule.startTime);

    for (const attendance of pendingCheckOut) {
      const checkInTime = new Date(attendance.checkInTime);
      const autoCheckOutTime = scheduleEnd > checkInTime ? scheduleEnd : checkInTime;

      const { workingHours } = computeWorkingHoursWithSchedule({
        checkInTime: attendance.checkInTime,
        checkOutTime: autoCheckOutTime,
        scheduleStart,
        scheduleEnd
      });

      attendance.checkOutTime = autoCheckOutTime;
      attendance.workingHours = Math.max(0, Number(workingHours.toFixed(2)));
      await attendance.save();
    }

    console.log(`[Attendance] Auto check-out completed for ${pendingCheckOut.length} record(s).`);
  } catch (error) {
    console.error('[Attendance] Auto check-out error:', error);
  }
};

// Run every 5 minutes
cron.schedule('*/5 * * * *', runAttendanceAutoCheckout);

module.exports = { runAttendanceAutoCheckout };
