const Invoice = require('../models/Invoice');
const InvoicePayment = require('../models/InvoicePayment');
const Customer = require('../models/Customer');
const CompanySettings = require('../models/CompanySettings');
const CustomerPortalBranding = require('../models/CustomerPortalBranding');
const { generateDocumentPdfBuffer } = require('../whatsapp-module/utils/pdfGenerator');
const {
  normalizePublicPortalBranding,
  getCustomerHistoryAvailability,
  toAbsoluteAssetUrl,
} = require('../utils/publicInvoicePortal');
const { resolveDocumentType } = require('../services/documentResolver');


const setPrivateResponseHeaders = (res) => {
  res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('X-Robots-Tag', 'noindex, nofollow');
};

const normalizeShareId = (value) => {
  const shareId = String(value || '');
  return shareId.startsWith(':id') ? shareId.substring(3) : shareId;
};

const isValidShareId = (value) => (
  value.length >= 20 && /^[A-Za-z0-9_-]+$/.test(value)
);

function serializePublicItem(item) {
  return {
    id: item._id || item.rowId || '',
    name: item.name || item.productName || '',
    variantName: item.variantName || '',
    designNumber: item.variantDesignNo || '',
    color: item.variantColor || '',
    size: item.variantSize || '',
    unit: item.unit || '',
    quantity: Number(item.qty ?? item.quantity ?? 0),
    rate: Number(item.rate ?? item.unitPrice ?? 0),
    amount: Number(item.amount ?? item.totalAmount ?? item.totalPrice ?? 0),
    discount: Number(item.discount ?? 0),
    taxAmount: Number(item.tax ?? item.taxAmount ?? 0),
    taxGroupId: item.tax_group_id || '',
    discountType: item.discount_type || 'Fixed',
    discountValue: item.discount_value ?? null,
    hsnCode: item.hsn_code || item.hsnCode || ''
  };
}

function serializePublicExchange(
  exchange,
  businessSettings,
  brandingSettings = {},
  paymentSummary = {},
  assetBaseUrl = '',
) {
  const customer =
    exchange.billTo && typeof exchange.billTo === 'object'
      ? exchange.billTo
      : exchange.customerId && typeof exchange.customerId === 'object'
        ? exchange.customerId
        : null;

  const totalAmount = Number(exchange.TotalAmount ?? exchange.totalAmount ?? 0);
  const subtotal = Number(exchange.taxableAmount ?? exchange.subtotal ?? 0);
  const taxAmount = Number(exchange.vat ?? exchange.taxAmount ?? 0);
  const discountAmount = Number(exchange.totalDiscount ?? exchange.discountAmount ?? 0);
  const hasPaymentRecords = paymentSummary.hasPaymentRecords === true;
  const recordedPaid = Number(paymentSummary.totalPaid || 0);
  const totalPaid = hasPaymentRecords
    ? recordedPaid
    : totalAmount;
  const balanceAmount = Math.max(totalAmount - totalPaid, 0);
  const amountBeforeRoundOff = exchange.gstType === 'Inclusive'
    ? subtotal - discountAmount
    : subtotal + taxAmount - discountAmount;
  const roundOffAmount = exchange.roundOff
    ? Number((totalAmount - amountBeforeRoundOff).toFixed(2))
    : 0;
  const portalBranding = normalizePublicPortalBranding(brandingSettings, assetBaseUrl);

  return {
    exchangeNumber: exchange.invoiceNumber, // Used as exchange number
    date: exchange.invoiceDate,
    dueDate: exchange.dueDate,
    status: exchange.status,
    paymentMethod: exchange.payment_method || '',
    taxType: exchange.taxType || 'GST',
    gstType: exchange.gstType || 'Exclusive',
    totalAmount,
    subtotal,
    taxAmount,
    discountAmount,
    roundOff: exchange.roundOff || false,
    roundOffAmount,
    termsAndCondition: exchange.termsAndCondition || '',
    notes: exchange.notes || '',
    customerGstin: exchange.customerGstin || '',
    ewayBillNumber: exchange.ewayBillNumber || '',
    shippingAddress: exchange.shippingAddress || null,
    
    // Exchange specific fields
    exchangeOldTotal: exchange.exchangeOldTotal ?? null,
    exchangeNewTotal: exchange.exchangeNewTotal ?? null,
    amountDifference: exchange.amountDifference ?? null,
    returnedAmount: exchange.returned_amount ?? null,

    customer: {
      name: customer?.name || exchange.customerName || '',
      phone: customer?.phone || customer?.phoneNumber || exchange.customerPhone || '',
      address: customer?.billingAddress?.addressLine1 || customer?.address || exchange.billingAddress || '',
      state: customer?.billingAddress?.state || customer?.state || '',
      gstNumber: customer?.gstin || customer?.gstNumber || exchange.customerGstin || '',
      billingAddress: customer?.billingAddress || null
    },

    items: (exchange.items || []).map(serializePublicItem),
    exchangeOriginalItems: (exchange.exchangeOriginalItems || []).map(serializePublicItem),

    business: {
      name: businessSettings?.companyName || 'Naresh Saree Collection',
      logo: toAbsoluteAssetUrl(
        businessSettings?.siteLogo || businessSettings?.favicon || businessSettings?.companyLogo || '',
        assetBaseUrl,
      ),
      phone: businessSettings?.phone || businessSettings?.contactNumber || '',
      email: businessSettings?.email || '',
      address: businessSettings?.address || '',
      state: businessSettings?.state || '',
      gstNumber: businessSettings?.gstin || businessSettings?.gstNumber || ''
    },
    payment: {
      method: exchange.payment_method || '',
      totalPaid,
      balanceAmount,
    },
    portalBranding,
    history: getCustomerHistoryAvailability(portalBranding),
  };
}

exports.serializePublicExchange = serializePublicExchange;

exports.getPublicExchange = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);
    const publicShareId = normalizeShareId(req.params.publicShareId);

    // Basic validation of the token (base64url is alphanumeric + hyphens + underscores)
    if (!isValidShareId(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true,
      isDeleted: false,
    }).populate('billTo').lean();

    if (!invoice || resolveDocumentType(invoice) !== 'exchange') {
      return res.status(404).json({ success: false, message: 'Exchange not found' });
    }


    const ownerUserId = invoice.billTo?.userId || invoice.userId || invoice.billFrom;
    const [companySettings, brandingSettings, paymentRows] = await Promise.all([
      ownerUserId
        ? CompanySettings.findOne({ userId: ownerUserId }).lean()
        : Promise.resolve(null),
      ownerUserId
        ? CustomerPortalBranding.findOne({ userId: ownerUserId }).lean()
        : Promise.resolve(null),
      InvoicePayment.aggregate([
        { $match: { invoiceId: invoice._id, isDeleted: { $ne: true } } },
        { $group: { _id: '$invoiceId', totalPaid: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } },
      ]),
    ]);

    const assetBaseUrl = `${req.protocol}://${req.get('host')}`;
    const publicDto = serializePublicExchange(
      invoice,
      companySettings || {},
      brandingSettings || {},
      {
        totalPaid: Number(paymentRows[0]?.totalPaid || 0),
        hasPaymentRecords: Number(paymentRows[0]?.count || 0) > 0,
      },
      assetBaseUrl,
    );

    res.json({ success: true, data: publicDto });
  } catch (err) {
    console.error('Error fetching public exchange:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.downloadPublicExchangePdf = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);
    const publicShareId = normalizeShareId(req.params.publicShareId);

    // Basic validation of the token
    if (!isValidShareId(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Exchange not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true,
      isDeleted: false,
    }).populate('billTo').lean();

    if (!invoice || resolveDocumentType(invoice) !== 'exchange') {
      return res.status(404).send('Exchange not found');
    }


    const ownerUserId = invoice.billTo?.userId || invoice.userId || invoice.billFrom;
    const companySettings = ownerUserId
      ? (await CompanySettings.findOne({ userId: ownerUserId }).lean()) || {}
      : {};

    const publicInvoice = serializePublicExchange(invoice, companySettings);

    // Build the document context for the existing generator
    const documentContext = {
      companyName: publicInvoice.business.name,
      documentLabel: 'Exchange',
      documentNumber: publicInvoice.exchangeNumber,
      customerName: publicInvoice.customer.name,
      customerPhone: publicInvoice.customer.phone,
      date: publicInvoice.date ? new Date(publicInvoice.date).toLocaleDateString() : '',
      amount: publicInvoice.totalAmount,
      status: publicInvoice.status,
      items: publicInvoice.items.map(item => ({
        name: item.name,
        qty: item.quantity,
        rate: item.rate,
        amount: item.amount
      }))
    };

    const pdfBuffer = await generateDocumentPdfBuffer(documentContext);

    res.setHeader('Content-Type', 'application/pdf');
    const safeInvoiceNumber = String(invoice.invoiceNumber || 'exchange').replace(/[^A-Za-z0-9_-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename=Exchange-${safeInvoiceNumber}.pdf`);
    
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating public exchange PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
