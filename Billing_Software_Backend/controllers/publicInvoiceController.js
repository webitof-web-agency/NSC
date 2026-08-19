const Invoice = require('../models/Invoice');
const CompanySettings = require('../models/CompanySettings');
const { generateDocumentPdfBuffer } = require('../whatsapp-module/utils/pdfGenerator');

function serializePublicInvoice(invoice, businessSettings) {
  // Return ONLY safe fields necessary for the public page
  return {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    totalAmount: invoice.totalAmount,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    discountAmount: invoice.discountAmount,
    roundOff: invoice.roundOff,
    
    // Customer info (only what's printed on invoice)
    customer: {
      name: invoice.customer?.name || invoice.customerName,
      phone: invoice.customer?.phoneNumber || invoice.customerPhone,
      address: invoice.billingAddress || invoice.customer?.address,
      state: invoice.customer?.state,
      gstNumber: invoice.customer?.gstNumber
    },
    
    // Items
    items: (invoice.products || []).map(p => ({
      name: p.productName || p.product?.name,
      quantity: p.quantity,
      rate: p.unitPrice || p.rate,
      amount: p.totalPrice || p.amount,
      discount: p.discount,
      taxAmount: p.taxAmount,
      hsnCode: p.hsnCode || p.product?.hsnCode
    })),
    
    // Business info
    business: {
      name: businessSettings?.companyName || 'Naresh Saree Collection',
      logo: businessSettings?.companyLogo,
      phone: businessSettings?.contactNumber,
      email: businessSettings?.email,
      address: businessSettings?.address,
      state: businessSettings?.state,
      gstNumber: businessSettings?.gstNumber,
      instagram: businessSettings?.socialLinks?.instagram || businessSettings?.instagramUrl,
      website: businessSettings?.website
    }
  };
}

exports.getPublicInvoice = async (req, res) => {
  try {
    const { publicShareId } = req.params;
    
    // Basic validation of the token (base64url is alphanumeric + hyphens + underscores)
    if (!publicShareId || publicShareId.length < 20 || !/^[A-Za-z0-9_-]+$/.test(publicShareId)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true 
    }).populate('customer').populate('products.product');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Attempt to get business settings
    const companySettings = await CompanySettings.findOne() || {};

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
    const { publicShareId } = req.params;
    
    // Basic validation of the token
    if (!publicShareId || publicShareId.length < 20 || !/^[A-Za-z0-9_-]+$/.test(publicShareId)) {
      return res.status(404).send('Invoice not found');
    }

    const invoice = await Invoice.findOne({ 
      publicShareId, 
      publicShareEnabled: true 
    }).populate('customer').populate('products.product');

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const companySettings = await CompanySettings.findOne() || {};

    // Build the document context for the existing generator
    const documentContext = {
      companyName: companySettings?.companyName || 'Naresh Saree Collection',
      documentLabel: 'Invoice',
      documentNumber: invoice.invoiceNumber,
      customerName: invoice.customer?.name || invoice.customerName,
      customerPhone: invoice.customer?.phoneNumber || invoice.customerPhone,
      date: invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '',
      amount: invoice.totalAmount,
      status: invoice.status,
      items: (invoice.products || []).map(p => ({
        name: p.productName || p.product?.name,
        qty: p.quantity,
        rate: p.unitPrice || p.rate,
        amount: p.totalPrice || p.amount
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
