const CustomField = require('../models/CustomField');
const mongoose = require('mongoose');

// Create a new custom field
exports.createCustomField = async (req, res) => {
  try {
    const { labelName, dataType, inputFormat, helpText, defaultValue, isMandatory, moduleName, options } = req.body;


    const customField = new CustomField({
      labelName,
      dataType,
      inputFormat,
      helpText,
      defaultValue,
      isMandatory,
      moduleName,
      options: options || [],
      createdBy: req.user,
    });

    const savedCustomField = await customField.save();
    
    res.status(201).json({
      message: 'Custom field created successfully',
      data: savedCustomField
    });
  } catch (err) {
    console.error('Error creating custom field:', err);
    res.status(500).json({
      message: 'Error creating custom field',
      error: err.message
    });
  }
};

// Get all custom fields for the authenticated user
exports.getAllCustomFields = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive, moduleName } = req.query;
    const query = { createdBy: req.user };

    // Add search filter
    if (search) {
      query.labelName = { $regex: search, $options: 'i' };
    }

    // Add active status filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Add module filter
    if (moduleName) {
      query.moduleName = moduleName;
    }

    const customFields = await CustomField.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await CustomField.countDocuments(query);

    res.json({
      data: customFields,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error fetching custom fields:', err);
    res.status(500).json({
      message: 'Error fetching custom fields',
      error: err.message
    });
  }
};

// Get a specific custom field by ID
exports.getCustomFieldById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field ID'
      });
    }

    const customField = await CustomField.findOne({
      _id: id,
      createdBy: req.user
    });

    if (!customField) {
      return res.status(404).json({
        message: 'Custom field not found'
      });
    }

    res.json({
      data: customField
    });
  } catch (err) {
    console.error('Error fetching custom field:', err);
    res.status(500).json({
      message: 'Error fetching custom field',
      error: err.message
    });
  }
};

// Update a custom field
exports.updateCustomField = async (req, res) => {
  try {
    const { id } = req.params;
    const { labelName, dataType, inputFormat, helpText, defaultValue, isMandatory, moduleName, options, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field ID'
      });
    }

    // Check if custom field exists and belongs to the user
    const existingField = await CustomField.findOne({
      _id: id,
      createdBy: req.user
    });

    if (!existingField) {
      return res.status(404).json({
        message: 'Custom field not found'
      });
    }


    const updateData = {};
    if (labelName !== undefined) updateData.labelName = labelName;
    if (dataType !== undefined) updateData.dataType = dataType;
    if (helpText !== undefined) updateData.helpText = helpText;
    if (inputFormat !== undefined) updateData.inputFormat = inputFormat;
    if (defaultValue !== undefined) updateData.defaultValue = defaultValue;
    if (isMandatory !== undefined) updateData.isMandatory = isMandatory;
    if (moduleName !== undefined) updateData.moduleName = moduleName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (options !== undefined) {
      updateData.options = inputFormat === 'select' || inputFormat === 'radio' ? options : [];
    }

    const updatedCustomField = await CustomField.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Custom field updated successfully',
      data: updatedCustomField
    });
  } catch (err) {
    console.error('Error updating custom field:', err);
    res.status(500).json({
      message: 'Error updating custom field',
      error: err.message
    });
  }
};

// Delete a custom field (hard delete - permanently remove from database)
exports.deleteCustomField = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field ID'
      });
    }

    const customField = await CustomField.findOneAndDelete(
      { _id: id, createdBy: req.user }
    );

    if (!customField) {
      return res.status(404).json({
        message: 'Custom field not found'
      });
    }

    res.json({
      message: 'Custom field deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting custom field:', err);
    res.status(500).json({
      message: 'Error deleting custom field',
      error: err.message
    });
  }
};

// Get custom fields for dropdown/select options
exports.getCustomFieldsMinimal = async (req, res) => {
  try {
    const { moduleName } = req.query;
    const query = {
      createdBy: req.user,
      isActive: true
    };

    if (moduleName) {
      query.moduleName = moduleName;
    }

    const customFields = await CustomField.find(query)
    .select('_id labelName inputFormat isMandatory moduleName')
    .sort({ labelName: 1 })
    .lean();

    res.json({
      data: customFields
    });
  } catch (err) {
    console.error('Error fetching custom fields minimal:', err);
    res.status(500).json({
      message: 'Error fetching custom fields',
      error: err.message
    });
  }
};
