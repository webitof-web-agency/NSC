// local-backend/controllers/outboxController.js
'use strict';

const Outbox = require('../models/Outbox');

exports.getPendingEvents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '500', 10);
    const events = await Outbox.find({
      status: 'PENDING',
      processed: { $ne: true },
    })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();

    res.status(200).json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markEventsSynced = async (req, res) => {
  try {
    const { eventIds } = req.body;
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ success: false, message: 'eventIds array required' });
    }

    const result = await Outbox.updateMany(
      { eventId: { $in: eventIds } },
      {
        $set: {
          status: 'SYNCED',
          processed: true,
          syncedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      updated: result.modifiedCount,
      message: `Marked ${result.modifiedCount} outbox events as SYNCED`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
