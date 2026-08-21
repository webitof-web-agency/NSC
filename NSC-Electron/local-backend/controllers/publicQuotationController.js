const Quotation = require('../models/Quotation');
const CompanySettings = require('../models/CompanySettings');
const CustomerPortalBranding = require('../models/CustomerPortalBranding');
const { generateDocumentPdfBuffer } = require('../whatsapp-module/utils/pdfGenerator');
const {
  normalizePublicPortalBranding,
  getCustomerHistoryAvailability,
  toAbsoluteAssetUrl,
} = require('../utils/publicInvoicePortal');

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

function serializePublicQuotation(
  quotation,
  businessSettings,
  brandingSettings = {},
  assetBaseUrl = '',
) {
  const customer =
    quotation.billTo && typeof quotation.billTo === 'object'
      ? quotation.billTo
      : quotation.customerId && typeof quotation.customerId === 'object'
        ? quotation.customerId
        : null;

  const totalAmount = Number(quotation.TotalAmount ?? quotation.totalAmount ?? 0);
  const subtotal = Number(quotation.taxableAmount ?? quotation.subtotal ?? 0);
  const taxAmount = Number(quotation.vat ?? quotation.taxAmount ?? 0);
  const discountAmount = Number(quotation.totalDiscount ?? quotation.discountAmount ?? 0);
  
  const amountBeforeRoundOff = quotation.gstType === 'Inclusive'
    ? subtotal - discountAmount
    : subtotal + taxAmount - discountAmount;
  const roundOffAmount = quotation.roundOff
    ? Number((totalAmount - amountBeforeRoundOff).toFixed(2))
    : 0;
  
  const portalBranding = normalizePublicPortalBranding(brandingSettings, assetBaseUrl);

  return {
    quotationNumber: quotation.quotationNumber,
    date: quotation.quotationDate,
    status: quotation.status || 'Pending',
    taxType: quotation.taxType || 'GST',
    gstType: quotation.gstType || 'Exclusive',
    totalAmount,
    subtotal,
    taxAmount,
    discountAmount,
    roundOff: quotation.roundOff || false,
    roundOffAmount,
    termsAndCondition: quotation.termsAndCondition || '',
    notes: quotation.notes || '',
    customerGstin: quotation.customerGstin || '',
    shippingAddress: quotation.shippingAddress || null,

    customer: {
      name: customer?.name || quotation.customerName || '',
      phone: customer?.phone || customer?.phoneNumber || quotation.customerPhone || '',
      address: customer?.billingAddress?.addressLine1 || customer?.address || quotation.billingAddress || '',
      state: customer?.billingAddress?.state || customer?.state || '',
      gstNumber: customer?.gstin || customer?.gstNumber || quotation.customerGstin || '',
      billingAddress: customer?.billingAddress || null
    },

    items: (quotation.items || []).map(serializePublicItem),

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
    portalBranding,
    history: false, // Quotations don't show history
  };
}

exports.serializePublicQuotation = serializePublicQuotation;

exports.getPublicQuotation = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);
    const publicShareId = normalizeShareId(req.params.publicShareId);

    if (!isValidShareId(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = await Quotation.findOne({ 
      publicShareId, 
      publicShareEnabled: true,
      isDeleted: false,
    }).populate('billTo').lean();

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const ownerUserId = quotation.billTo?.userId || quotation.userId || quotation.billFrom;
    const [companySettings, brandingSettings] = await Promise.all([
      ownerUserId
        ? CompanySettings.findOne({ userId: ownerUserId }).lean()
        : Promise.resolve(null),
      ownerUserId
        ? CustomerPortalBranding.findOne({ userId: ownerUserId }).lean()
        : Promise.resolve(null),
    ]);

    const assetBaseUrl = `${req.protocol}://${req.get('host')}`;
    const publicDto = serializePublicQuotation(
      quotation,
      companySettings || {},
      brandingSettings || {},
      assetBaseUrl,
    );

    res.json({ success: true, data: publicDto });
  } catch (err) {
    console.error('Error fetching public quotation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.downloadPublicQuotationPdf = async (req, res) => {
  try {
    setPrivateResponseHeaders(res);
    const publicShareId = normalizeShareId(req.params.publicShareId);

    if (!isValidShareId(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = await Quotation.findOne({ 
      publicShareId, 
      publicShareEnabled: true,
      isDeleted: false,
    }).populate('billTo').lean();

    if (!quotation) {
      return res.status(404).send('Quotation not found');
    }

    const ownerUserId = quotation.billTo?.userId || quotation.userId || quotation.billFrom;
    const companySettings = ownerUserId
      ? (await CompanySettings.findOne({ userId: ownerUserId }).lean()) || {}
      : {};

    const publicQuotation = serializePublicQuotation(quotation, companySettings);

    const documentContext = {
      companyName: publicQuotation.business.name,
      documentLabel: 'Quotation',
      documentNumber: publicQuotation.quotationNumber,
      customerName: publicQuotation.customer.name,
      customerPhone: publicQuotation.customer.phone,
      date: publicQuotation.date ? new Date(publicQuotation.date).toLocaleDateString() : '',
      amount: publicQuotation.totalAmount,
      status: publicQuotation.status,
      items: publicQuotation.items.map(item => ({
        name: item.name,
        qty: item.quantity,
        rate: item.rate,
        amount: item.amount
      }))
    };

    const pdfBuffer = await generateDocumentPdfBuffer(documentContext);

    res.setHeader('Content-Type', 'application/pdf');
    const safeQuotationNumber = String(quotation.quotationNumber || 'quotation').replace(/[^A-Za-z0-9_-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename=Quotation-${safeQuotationNumber}.pdf`);
    
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating public quotation PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
