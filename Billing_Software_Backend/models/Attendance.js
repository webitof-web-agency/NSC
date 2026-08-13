const offlineSyncPlugin = require('../middleware/offlineSync');
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      unique: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE'],
      default: 'PRESENT',
    },
    workingHours: {
      type: Number, // In hours (decimal, e.g., 8.5 for 8 hours 30 minutes)
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: String,
      default: '', // For future GPS/location tracking
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-generate attendanceId before saving
attendanceSchema.pre('save', async function (next) {
  try {
    if (!this.attendanceId) {
      const count = await this.constructor.countDocuments();
      this.attendanceId = `ATT-${String(count + 1).padStart(6, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Index for faster queries
attendanceSchema.index({ staffId: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });

attendanceSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('Attendance', attendanceSchema);
