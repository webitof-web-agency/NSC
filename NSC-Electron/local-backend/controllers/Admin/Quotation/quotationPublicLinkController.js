const Quotation = require('../../../models/Quotation');
const publicShareService = require('../../../services/publicShareService');
const crypto = require('crypto');

function generateSecureToken() {
  return crypto.randomBytes(24).toString('base64url');
}

exports.getOrCreatePublicLink = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).lean();
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // If already has an enabled link, return it directly
    if (quotation.publicShareId && quotation.publicShareEnabled) {
      const publicUrl = publicShareService.buildPublicDocumentUrl(quotation.publicShareId, 'QUOTATION');
      return res.json({
        success: true,
        publicUrl,
        enabled: true,
        publicShareId: quotation.publicShareId
      });
    }

    // Use updateOne with $set to bypass full-document validation
    const newToken = generateSecureToken();
    await Quotation.updateOne(
      { _id: quotation._id },
      {
        $set: {
          publicShareId: newToken,
          publicShareEnabled: true,
          publicShareCreatedAt: quotation.publicShareCreatedAt || new Date(),
        }
      }
    );

    const publicUrl = publicShareService.buildPublicDocumentUrl(newToken, 'QUOTATION');
    res.json({
      success: true,
      publicUrl,
      enabled: true,
      publicShareId: newToken
    });
  } catch (err) {
    console.error('Error generating public link:', err);
    res.status(500).json({ success: false, message: 'Failed to generate public link' });
  }
};

exports.regeneratePublicLink = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).lean();
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const newToken = generateSecureToken();
    await Quotation.updateOne(
      { _id: quotation._id },
      {
        $set: {
          publicShareId: newToken,
          publicShareEnabled: true,
          publicShareRegeneratedAt: new Date(),
          publicShareCreatedAt: quotation.publicShareCreatedAt || new Date(),
        }
      }
    );

    const publicUrl = publicShareService.buildPublicDocumentUrl(newToken, 'QUOTATION');
    res.json({
      success: true,
      publicUrl,
      enabled: true,
      publicShareId: newToken
    });
  } catch (err) {
    console.error('Error regenerating public link:', err);
    res.status(500).json({ success: false, message: 'Failed to regenerate public link' });
  }
};

exports.disablePublicLink = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).lean();
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    await Quotation.updateOne(
      { _id: quotation._id },
      { $set: { publicShareEnabled: false } }
    );

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
