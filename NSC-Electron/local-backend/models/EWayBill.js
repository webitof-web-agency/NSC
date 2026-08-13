// ===================== MODEL: models/EWayBill.model.js =====================
const mongoose = require('mongoose');

const eWayBillItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  hsnCode: { type: String, required: true },
  quantity: { type: Number, required: true },
  qtyUnit: { type: String, required: true },
  taxableAmount: { type: Number, required: true },
  cgstRate: Number,
  sgstRate: Number,
  igstRate: Number,
  cessRate: Number
});

const eWayBillSchema = new mongoose.Schema({
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },

  // Document details
  supplyType: { type: String, enum: ['OUTWARD', 'INWARD'], required: true },
  subSupplyType: { type: String, required: true },
  docType: { type: String, enum: ['INV', 'BIL', 'CHL'], required: true },
  docNo: { type: String, required: true },
  docDate: { type: Date, required: true },
  irn: { type: String, required: true },

  // From (Supplier)
  fromGstin: { type: String, required: true },
  fromTradeName: { type: String, required: true },
  fromAddr1: { type: String, required: true },
  fromPlace: { type: String, required: true },
  fromPincode: { type: Number, required: true },
  fromStateCode: { type: Number, required: true },

  // To (Recipient)
  toGstin: { type: String, required: true },
  toTradeName: { type: String, required: true },
  toAddr1: { type: String, required: true },
  toPlace: { type: String, required: true },
  toPincode: { type: Number, required: true },
  toStateCode: { type: Number, required: true },

  // Transport
  transMode: { type: String, enum: ['1', '2', '3', '4'], required: true },
  distance: { type: Number, required: true },
  vehicleType: { type: String, enum: ['R', 'O'], required: true },
  vehicleNo: String,
  transporterId: String,
  transporterName: String,
  lrNo: String,
  lrDate: Date,

  // Items
  itemList: [eWayBillItemSchema],

  // Mock response
  ewayBillNo: { type: String, required: true },
  validUpto: { type: Date, required: true },
  isMock: { type: Boolean, default: true },

  status: { type: String, enum: ['GENERATED', 'FAILED'], default: 'GENERATED' }
}, { timestamps: true });

module.exports = mongoose.model('EWayBill', eWayBillSchema);