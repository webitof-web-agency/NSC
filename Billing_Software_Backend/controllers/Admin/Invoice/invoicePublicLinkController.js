const Invoice = require('../../../models/Invoice');
const publicShareService = require('../../../services/publicShareService');

exports.getOrCreatePublicLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const publicShareId = await publicShareService.getOrCreatePublicShareId(invoice);
    const publicUrl = publicShareService.buildPublicInvoiceUrl(publicShareId);

    res.json({
      success: true,
      publicUrl,
      enabled: invoice.publicShareEnabled,
      publicShareId
    });
  } catch (err) {
    console.error('Error generating public link:', err);
    res.status(500).json({ success: false, message: 'Failed to generate public link' });
  }
};

exports.regeneratePublicLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const publicShareId = await publicShareService.regeneratePublicShareId(invoice);
    const publicUrl = publicShareService.buildPublicInvoiceUrl(publicShareId);

    res.json({
      success: true,
      publicUrl,
      enabled: invoice.publicShareEnabled,
      publicShareId
    });
  } catch (err) {
    console.error('Error regenerating public link:', err);
    res.status(500).json({ success: false, message: 'Failed to regenerate public link' });
  }
};

exports.disablePublicLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await publicShareService.disablePublicShare(invoice);

    res.json({
      success: true,
      enabled: false,
      message: 'Public link disabled successfully'
    });
  } catch (err) {
    console.error('Error disabling public link:', err);
    res.status(500).json({ success: false, message: 'Failed to disable public link' });
  }
};
