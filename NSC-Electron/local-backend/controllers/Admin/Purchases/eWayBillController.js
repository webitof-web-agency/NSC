const EWayBill = require('../../../models/EWayBill');
const Purchase = require('../../../models/Purchase');
const ProductVariant = require('../../../models/ProductVariant');
const Product = require('../../../models/Product');
const { generateMockEWayBill } = require('../../../utils/ewayBillService');

exports.generateEWayBillFromPurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const transport = req.body;

    // 1️⃣ Fetch Purchase
    const purchase = await Purchase.findById(purchaseId)
      .populate('billFrom billTo');

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // 2️⃣ Prevent duplicate EWB
    const existing = await EWayBill.findOne({ purchaseId: purchase._id });
    if (existing) {
      return res.status(400).json({
        message: 'E-Way Bill already generated for this purchase',
        data: existing
      });
    }

    // 3️⃣ Build ITEM LIST using ProductVariant + Product
    const itemList = [];

    for (const item of purchase.items) {
      const variant = await ProductVariant.findById(item.variantId);
      if (!variant) {
        throw new Error(`Variant not found for item ${item.name}`);
      }

      const product = await Product.findById(variant.productId);
      if (!product) {
        throw new Error(`Product not found for variant ${variant._id}`);
      }

      itemList.push({
        productName: product.name,
        hsnCode: variant.hsn_code,
        quantity: item.qty,
        qtyUnit: item.unit || 'PCS',
        taxableAmount: item.rate * item.qty,
        igstRate: item.tax > 0 ? (item.tax / item.rate) * 100 : 0
      });
    }

    // 4️⃣ Build EWB payload
    const payload = {
      purchaseId: purchase._id,

      // Document
      supplyType: transport.supplyType,
      subSupplyType: transport.subSupplyType,
      docType: 'INV',
      docNo: purchase.purchaseId,
      docDate: purchase.purchaseDate,
      irn: 'MOCK-IRN-' + purchase.purchaseId, // replace later with real IRN

      // FROM (Supplier)
      fromGstin: purchase.billTo.gstin,
      fromTradeName: purchase.billTo.businessName,
      fromAddr1: purchase.billTo.address,
      fromPlace: purchase.billTo.city,
      fromPincode: purchase.billTo.pincode,
      fromStateCode: purchase.billTo.stateCode,

      // TO (Your Company)
      toGstin: purchase.billFrom.gstin,
      toTradeName: purchase.billFrom.companyName,
      toAddr1: purchase.billFrom.address,
      toPlace: purchase.billFrom.city,
      toPincode: purchase.billFrom.pincode,
      toStateCode: purchase.billFrom.stateCode,

      // Transport
      transMode: transport.transMode,
      distance: transport.distance,
      vehicleType: transport.vehicleType,
      vehicleNo: transport.vehicleNo,
      transporterName: transport.transporterName,

      // Items
      itemList
    };

    // 5️⃣ Generate MOCK EWB
    const mock = generateMockEWayBill(payload);

    // 6️⃣ Save EWB
    const ewb = new EWayBill({
      ...payload,
      ewayBillNo: mock.ewayBillNo,
      validUpto: mock.validUpto,
      isMock: true
    });

    await ewb.save();

    return res.status(201).json({
      message: 'E-Way Bill generated from Purchase (MOCK)',
      data: ewb
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to generate E-Way Bill',
      error: error.message
    });
  }
};
