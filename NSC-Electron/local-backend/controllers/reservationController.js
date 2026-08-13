const LocalNumberReservation = require('../models/LocalNumberReservation');

// GET /api/local/number-reservations/status
exports.getReservationStatus = async (req, res) => {
  try {
    const types = ['INVOICE', 'QUOTATION'];
    const statuses = [];

    for (const type of types) {
      const resv = await LocalNumberReservation.findOne({ type }).lean();
      
      if (!resv) {
        statuses.push({ type, needsAllocation: true, remaining: 0 });
      } else {
        const remaining = resv.endValue - resv.currentValue;
        // If remaining is less than 10, request more
        statuses.push({ type, needsAllocation: remaining < 10, remaining });
      }
    }

    res.status(200).json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/local/number-reservations/add-block
exports.addBlock = async (req, res) => {
  try {
    const { type, prefix, padding, startValue, endValue } = req.body;

    // We only update if the new block is strictly greater than the current one
    // Or we just overwrite it since we explicitly requested this new block from the cloud.
    // If we overwrite, we might lose local un-used numbers, but that's perfectly fine. 
    // They just become skipped numbers, which is acceptable in most jurisdictions unless strict sequentiality without gaps is mandated.
    // To prevent gaps, we only append. But appending means we only update the `endValue`.
    
    let resv = await LocalNumberReservation.findOne({ type });
    if (!resv) {
      resv = new LocalNumberReservation({
        type,
        prefix,
        padding,
        currentValue: startValue - 1, // Next getNextNumber increments by 1
        endValue
      });
    } else {
      // If we already have a reservation, we extend the endValue
      // (assuming the cloud gave us the next contiguous block)
      resv.endValue = endValue;
      
      // If our current value somehow fell behind the new block's start
      // (e.g. database wipe), fast-forward it.
      if (resv.currentValue < startValue - 1) {
        resv.currentValue = startValue - 1;
      }
    }

    await resv.save();
    res.status(200).json({ success: true, data: resv });

  } catch (err) {
    console.error('Failed to add number block:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
