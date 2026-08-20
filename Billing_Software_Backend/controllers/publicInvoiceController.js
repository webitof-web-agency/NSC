const Invoice = require('../models/Invoice');
const CompanySettings = require('../models/CompanySettings');
const { generateDocumentPdfBuffer } = require('../whatsapp-module/utils/pdfGenerator');

function serializePublicItem(item) {
  return {
    id: item._id || item.rowId || '',
    name: item.name || item.productName || '',
    variantName: item.variantName || '',
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

function serializePublicInvoice(invoice, businessSettings) {
  const customer =
    invoice.billTo && typeof invoice.billTo === 'object'
      ? invoice.billTo
      : invoice.customerId && typeof invoice.customerId === 'object'
        ? invoice.customerId
        : null;

  // Return only the safe invoice fields required by the public NSC template.
  return {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    paymentMethod: invoice.payment_method || '',
    totalAmount: Number(invoice.TotalAmount ?? invoice.totalAmount ?? 0),
    subtotal: Number(invoice.taxableAmount ?? invoice.subtotal ?? 0),
    taxAmount: Number(invoice.vat ?? invoice.taxAmount ?? 0),
    discountAmount: Number(invoice.totalDiscount ?? invoice.discountAmount ?? 0),
    roundOff: invoice.roundOff || false,
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
      logo: businessSettings?.siteLogo || businessSettings?.favicon || businessSettings?.companyLogo || '',
      phone: businessSettings?.phone || businessSettings?.contactNumber || '',
      email: businessSettings?.email || '',
      address: businessSettings?.address || '',
      state: businessSettings?.state || '',
      gstNumber: businessSettings?.gstin || businessSettings?.gstNumber || ''
    }
  };
}

exports.serializePublicInvoice = serializePublicInvoice;

exports.getPublicInvoice = async (req, res) => {
  try {
    let { publicShareId } = req.params;

    // Handle case where Meta Template hardcodes `:id` before the dynamic parameter
    // e.g. https://app.nareshsareecollection.com/invoice/:idABCXYZ
    if (publicShareId && publicShareId.startsWith(':id')) {
      publicShareId = publicShareId.substring(3);
    }

    // Basic validation of the token (base64url is alphanumeric + hyphens + underscores)
    if (!publicShareId || publicShareId.length < 20 || !/^[A-Za-z0-9_-]+$/.test(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true 
    }).populate('billTo').lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Attempt to get business settings
    const companySettings = (await CompanySettings.findOne()
      .sort({ createdAt: -1 })
      .lean()) || {};

    const publicDto = serializePublicInvoice(invoice, companySettings);

    // Set cache headers to prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('X-Robots-Tag', 'noindex, nofollow');

    res.json({ success: true, data: publicDto });
  } catch (err) {
    console.error('Error fetching public invoice:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.downloadPublicInvoicePdf = async (req, res) => {
  try {
    let { publicShareId } = req.params;

    if (publicShareId && publicShareId.startsWith(':id')) {
      publicShareId = publicShareId.substring(3);
    }

    // Basic validation of the token
    if (!publicShareId || publicShareId.length < 20 || !/^[A-Za-z0-9_-]+$/.test(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true 
    }).populate('billTo').lean();

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const companySettings = (await CompanySettings.findOne()
      .sort({ createdAt: -1 })
      .lean()) || {};

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

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);
    
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating public invoice PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
