const Outbox = require('../models/Outbox');
const { resolveReferences } = require('../utils/referenceResolver');

// Get pending outbox events
exports.getPendingEvents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = await Outbox.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    // Resolve local ObjectIds to global syncIds before returning
    for (let event of events) {
      if (event.payload && event.collectionName) {
        event.payload = await resolveReferences(event.collectionName, event.payload, true);
      }
    }

    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error fetching outbox events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outbox events',
      error: error.message
    });
  }
};

// Mark events as synced
exports.markEventsSynced = async (req, res) => {
  try {
    const { eventIds } = req.body;
    
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'eventIds array is required'
      });
    }

    await Outbox.updateMany(
      { eventId: { $in: eventIds } },
      { 
        $set: { 
          status: 'SYNCED',
          syncedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Events marked as synced'
    });
  } catch (error) {
    console.error('Error marking events synced:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark events as synced',
      error: error.message
    });
  }
};
