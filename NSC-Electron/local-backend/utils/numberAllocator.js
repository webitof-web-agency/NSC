const LocalNumberReservation = require('../models/LocalNumberReservation');
const axios = require('axios');

// Fallback logic in case completely exhausted offline
const crypto = require('crypto');
function getOfflineFallback(type) {
  const shortId = crypto.randomBytes(3).toString('hex').toUpperCase();
  const prefix = type === 'INVOICE' ? 'INV' : (type === 'QUOTATION' ? 'QTN' : type);
  return `${prefix}-OFF-${shortId}`;
}

exports.getNextNumber = async (type) => {
  // 1. Atomically increment the current value, as long as it does not exceed the endValue
  const reservation = await LocalNumberReservation.findOneAndUpdate(
    { 
      type, 
      $expr: { $lt: ["$currentValue", "$endValue"] } 
    },
    { $inc: { currentValue: 1 } },
    { new: true }
  );

  if (!reservation) {
    // We are out of numbers!
    console.warn(`[NumberAllocator] Exhausted numbers for ${type}! Using offline fallback.`);
    return getOfflineFallback(type);
  }

  // 2. Format the number
  const numStr = String(reservation.currentValue).padStart(reservation.padding, '0');
  const formattedNumber = `${reservation.prefix}${numStr}`;

  // 3. Return the formatted number
  return formattedNumber;
};
