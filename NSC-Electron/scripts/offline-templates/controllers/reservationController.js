// local-backend/controllers/reservationController.js
'use strict';

exports.getReservationStatus = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        invoices: { current: 1, reservedUntil: 1000 },
        quotations: { current: 1, reservedUntil: 1000 },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addBlock = async (req, res) => {
  try {
    const { sequenceType, count = 10 } = req.body;
    res.status(200).json({
      success: true,
      message: 'Block added successfully',
      data: { sequenceType, count }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
