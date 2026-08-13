const CompanySettings = require('@models/CompanySettings');

/**
 * Get UPI settings for the logged-in user's organization
 */
exports.getUpiSettings = async (req, res) => {
  try {
    const userId = req.user;

    const settings = await CompanySettings.findOne({ userId });

    // If settings don't exist yet, return null upiId (not an error)
    if (!settings) {
      return res.status(200).json({
        success: true,
        data: {
          upiId: null,
          phonePeEnabled: false,
          gstMode: 'Exclusive'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        upiId: settings.upiId || null,
        phonePeEnabled: settings.phonePeEnabled || false,
        gstMode: settings.gstMode || 'Exclusive'
      }
    });
  } catch (error) {
    console.error('Get UPI Settings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving UPI settings',
      error: error.message
    });
  }
};

/**
 * Update UPI settings for the logged-in user's organization
 */
exports.updateUpiSettings = async (req, res) => {
  try {
    const userId = req.user;
    const { upiId, phonePeEnabled, gstMode } = req.body;

    // Basic UPI ID validation (format: username@bankcode)
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UPI ID format. Expected format: username@bankcode'
      });
    }

    // Prepare update object
    const updateFields = {};
    if (upiId !== undefined) {
      updateFields.upiId = upiId || null;
    }
    if (phonePeEnabled !== undefined) {
      updateFields.phonePeEnabled = Boolean(phonePeEnabled);
    }
    if (gstMode !== undefined) {
      if (!['Inclusive', 'Exclusive'].includes(gstMode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GST Mode. Must be either Inclusive or Exclusive'
        });
      }
      updateFields.gstMode = gstMode;
    }

    const settings = await CompanySettings.findOneAndUpdate(
      { userId },
      updateFields,
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'UPI settings updated successfully',
      data: {
        upiId: settings.upiId,
        phonePeEnabled: settings.phonePeEnabled,
        gstMode: settings.gstMode
      }
    });
  } catch (error) {
    console.error('Update UPI Settings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating UPI settings',
      error: error.message
    });
  }
};
