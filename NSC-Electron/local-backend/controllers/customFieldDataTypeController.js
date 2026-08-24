const CustomFieldDataType = require('../models/CustomFieldDataType');
const mongoose = require('mongoose');

// Create a new custom field data type
exports.createCustomFieldDataType = async (req, res) => {
  try {
    const { type, description } = req.body;

    // Check if a custom field data type with the same type already exists
    const existingDataType = await CustomFieldDataType.findOne({
      type: type,
      isActive: true
    });

    if (existingDataType) {
      return res.status(400).json({
        message: 'A custom field data type with this type already exists',
        error: 'DUPLICATE_TYPE'
      });
    }

    const customFieldDataType = new CustomFieldDataType({
      type,
      description,
      createdBy: req.user,
    });

    const savedCustomFieldDataType = await customFieldDataType.save();

    res.status(201).json({
      message: 'Custom field data type created successfully',
      data: savedCustomFieldDataType
    });
  } catch (err) {
    console.error('Error creating custom field data type:', err);
    res.status(500).json({
      message: 'Error creating custom field data type',
      error: err.message
    });
  }
};

// Get all custom field data types
exports.getAllCustomFieldDataTypes = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const query = {};

    // Add search filter
    if (search) {
      query.$or = [
        { type: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Add active status filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const customFieldDataTypes = await CustomFieldDataType.find(query)
      .populate('createdBy', 'name email')
      .sort({ type: 1 })
      .lean();

    res.json({
      data: customFieldDataTypes
    });
  } catch (err) {
    console.error('Error fetching custom field data types:', err);
    res.status(500).json({
      message: 'Error fetching custom field data types',
      error: err.message
    });
  }
};

// Get a specific custom field data type by ID
exports.getCustomFieldDataTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field data type ID'
      });
    }

    const customFieldDataType = await CustomFieldDataType.findById(id)
      .populate('createdBy', 'name email');

    if (!customFieldDataType) {
      return res.status(404).json({
        message: 'Custom field data type not found'
      });
    }

    res.json({
      data: customFieldDataType
    });
  } catch (err) {
    console.error('Error fetching custom field data type:', err);
    res.status(500).json({
      message: 'Error fetching custom field data type',
      error: err.message
    });
  }
};

// Update a custom field data type
exports.updateCustomFieldDataType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field data type ID'
      });
    }

    // Check if custom field data type exists
    const existingDataType = await CustomFieldDataType.findById(id);

    if (!existingDataType) {
      return res.status(404).json({
        message: 'Custom field data type not found'
      });
    }

    // Check for duplicate type (excluding current data type)
    if (type && type !== existingDataType.type) {
      const duplicateDataType = await CustomFieldDataType.findOne({
        type: type,
        isActive: true,
        _id: { $ne: id }
      });

      if (duplicateDataType) {
        return res.status(400).json({
          message: 'A custom field data type with this type already exists',
          error: 'DUPLICATE_TYPE'
        });
      }
    }

    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCustomFieldDataType = await CustomFieldDataType.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({
      message: 'Custom field data type updated successfully',
      data: updatedCustomFieldDataType
    });
  } catch (err) {
    console.error('Error updating custom field data type:', err);
    res.status(500).json({
      message: 'Error updating custom field data type',
      error: err.message
    });
  }
};

// Delete a custom field data type (soft delete by setting isActive to false)
exports.deleteCustomFieldDataType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid custom field data type ID'
      });
    }

    const customFieldDataType = await CustomFieldDataType.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!customFieldDataType) {
      return res.status(404).json({
        message: 'Custom field data type not found'
      });
    }

    res.json({
      message: 'Custom field data type deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting custom field data type:', err);
    res.status(500).json({
      message: 'Error deleting custom field data type',
      error: err.message
    });
  }
};

// Get custom field data types for dropdown/select options
exports.getCustomFieldDataTypesMinimal = async (req, res) => {
  try {
    const customFieldDataTypes = await CustomFieldDataType.find({ isActive: true })
      .select('_id type description')
      .sort({ type: 1 })
      .lean();

    res.json({
      data: customFieldDataTypes
    });
  } catch (err) {
    console.error('Error fetching custom field data types minimal:', err);
    res.status(500).json({
      message: 'Error fetching custom field data types',
      error: err.message
    });
  }
};
