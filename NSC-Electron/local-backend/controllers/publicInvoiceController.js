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

function serializePublicInvoice(
  invoice,
  businessSettings,
  brandingSettings = {},
  paymentSummary = {},
  assetBaseUrl = '',
) {
  const customer =
    invoice.billTo && typeof invoice.billTo === 'object'
      ? invoice.billTo
      : invoice.customerId && typeof invoice.customerId === 'object'
        ? invoice.customerId
        : null;

  const totalAmount = Number(invoice.TotalAmount ?? invoice.totalAmount ?? 0);
  const subtotal = Number(invoice.taxableAmount ?? invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.vat ?? invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.totalDiscount ?? invoice.discountAmount ?? 0);
  const hasPaymentRecords = paymentSummary.hasPaymentRecords === true;
  const recordedPaid = Number(paymentSummary.totalPaid || 0);
  const totalPaid = hasPaymentRecords
    ? recordedPaid
    : ['PAID', 'EXCHANGE'].includes(invoice.status) ? totalAmount : 0;
  const balanceAmount = Math.max(totalAmount - totalPaid, 0);
  const amountBeforeRoundOff = invoice.gstType === 'Inclusive'
    ? subtotal - discountAmount
    : subtotal + taxAmount - discountAmount;
  const roundOffAmount = invoice.roundOff
    ? Number((totalAmount - amountBeforeRoundOff).toFixed(2))
    : 0;
  const portalBranding = normalizePublicPortalBranding(brandingSettings, assetBaseUrl);

  // Return only the safe fields required by the public portal and formal print view.
  return {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    paymentMethod: invoice.payment_method || '',
    taxType: invoice.taxType || 'GST',
    gstType: invoice.gstType || 'Exclusive',
    totalAmount,
    subtotal,
    taxAmount,
    discountAmount,
    roundOff: invoice.roundOff || false,
    roundOffAmount,
    termsAndCondition: invoice.termsAndCondition || '',
    notes: invoice.notes || '',
    customerGstin: invoice.customerGstin || '',
    ewayBillNumber: invoice.ewayBillNumber || '',
    shippingAddress: invoice.shippingAddress || null,
    exchangeOldTotal: invoice.exchangeOldTotal ?? null,
    exchangeNewTotal: invoice.exchangeNewTotal ?? null,

    customer: {
      name: customer?.name || invoice.customerName || '',
      phone: customer?.phone || customer?.phoneNumber || invoice.customerPhone || '',
      address: customer?.billingAddress?.addressLine1 || customer?.address || invoice.billingAddress || '',
      state: customer?.billingAddress?.state || customer?.state || '',
      gstNumber: customer?.gstin || customer?.gstNumber || invoice.customerGstin || '',
      billingAddress: customer?.billingAddress || null
    },

    items: (invoice.items || []).map(serializePublicItem),
    exchangeOriginalItems: (invoice.exchangeOriginalItems || []).map(serializePublicItem),

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
      method: invoice.payment_method || '',
      totalPaid,
      balanceAmount,
    },
    portalBranding,
    history: getCustomerHistoryAvailability(portalBranding),
  };
}

exports.serializePublicInvoice = serializePublicInvoice;

exports.getPublicInvoice = async (req, res) => {
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

    if (!invoice || resolveDocumentType(invoice) !== 'invoice') {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
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
    const publicDto = serializePublicInvoice(
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
    console.error('Error fetching public invoice:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.listVerifiedCustomerInvoiceHistory = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);

    const { customerId, ownerUserId } = req.customerHistorySession;
    const [branding, customerExists] = await Promise.all([
      CustomerPortalBranding.findOne({ userId: ownerUserId })
        .select('enableCustomerHistory')
        .lean(),
      Customer.exists({
        _id: customerId,
        userId: ownerUserId,
        isDeleted: false,
        portalEnabled: { $ne: false },
      }),
    ]);

    if (!customerExists) {
      return res.status(401).json({
        success: false,
        message: 'Customer verification is required.',
      });
    }

    if (branding?.enableCustomerHistory !== true) {
      return res.status(403).json({
        success: false,
        message: 'Invoice history is not available.',
      });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 20);
    const query = {
      billTo: customerId,
      isDeleted: false,
      parentInvoice: null,
      publicShareEnabled: true,
      publicShareId: { $type: 'string', $ne: '' },
    };

    const [total, invoices] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.find(query)
        .select('_id invoiceNumber invoiceDate dueDate status TotalAmount publicShareId')
        .sort({ invoiceDate: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const paymentRows = invoiceIds.length
      ? await InvoicePayment.aggregate([
          { $match: { invoiceId: { $in: invoiceIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$invoiceId', totalPaid: { $sum: { $ifNull: ['$amount', 0] } } } },
        ])
      : [];
    const paymentMap = new Map(
      paymentRows.map((row) => [String(row._id), Number(row.totalPaid || 0)]),
    );

    return res.status(200).json({
      success: true,
      data: {
        invoices: invoices.map((invoice) => {
          const totalAmount = Number(invoice.TotalAmount || 0);
          const recordedPaid = paymentMap.get(String(invoice._id));
          const totalPaid = recordedPaid === undefined && invoice.status === 'PAID'
            ? totalAmount
            : Number(recordedPaid || 0);
          return {
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status: invoice.status,
            totalAmount,
            totalPaid,
            balanceAmount: Math.max(totalAmount - totalPaid, 0),
            publicShareId: invoice.publicShareId,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching customer invoice history:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.downloadPublicInvoicePdf = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);
    const publicShareId = normalizeShareId(req.params.publicShareId);

    // Basic validation of the token
    if (!isValidShareId(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true,
      isDeleted: false,
    }).populate('billTo').lean();

    if (!invoice || resolveDocumentType(invoice) !== 'invoice') {
      return res.status(404).send('Invoice not found');
    }


    const ownerUserId = invoice.billTo?.userId || invoice.userId || invoice.billFrom;
    const companySettings = ownerUserId
      ? (await CompanySettings.findOne({ userId: ownerUserId }).lean()) || {}
      : {};

    const publicInvoice = serializePublicInvoice(invoice, companySettings);

    // Build the document context for the existing generator
    const documentContext = {
      companyName: publicInvoice.business.name,
      documentLabel: 'Invoice',
      documentNumber: publicInvoice.invoiceNumber,
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
    const safeInvoiceNumber = String(invoice.invoiceNumber || 'invoice').replace(/[^A-Za-z0-9_-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${safeInvoiceNumber}.pdf`);
    
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating public invoice PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
