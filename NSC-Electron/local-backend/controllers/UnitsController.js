const Unit = require('../models/Unit');

// @desc Get all units
exports.getUnits = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    // Build search query
    const searchQuery = {
      $or: [
        { unit_name: { $regex: search, $options: 'i' } },
        { unit_code: { $regex: search, $options: 'i' } },
        { unit_description: { $regex: search, $options: 'i' } }
      ]
    };

    // Get total count for pagination
    const total = await Unit.countDocuments(searchQuery);

    // Get paginated results
    const units = await Unit.find(searchQuery)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      message: 'Units fetched successfully',
      data: {
        units,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Failed to fetch units',
      error: err.message 
    });
  }
};

// @desc Create new unit
exports.createUnit = async (req, res) => {
  const { unit_name, short_name, status } = req.body;

  try {
    const resolvedShortName = (short_name && String(short_name).trim()) || (unit_name || '').trim();
    const unit = new Unit({ unit_name, short_name: resolvedShortName, status });
    await unit.save();
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create unit' });
  }
};

// @desc Get a single unit by ID
exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unit' });
  }
};


// @desc Update unit
exports.updateUnit = async (req, res) => {
  const { id } = req.params;

  if (!id || id.length !== 24) {
    return res.status(400).json({ message: 'Invalid unit ID' });
  }

  try {
    const payload = { ...req.body };
    if (payload.short_name !== undefined) {
      payload.short_name =
        (payload.short_name && String(payload.short_name).trim()) ||
        (payload.unit_name || '').trim();
    } else if (payload.unit_name) {
      payload.short_name = String(payload.unit_name).trim();
    }
    const unit = await Unit.findByIdAndUpdate(id, payload, { new: true });

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.json({
      message: 'Unit updated successfully',
      data: unit,
    })
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Failed to update unit' });
  }
};

// @desc Delete unit
exports.deleteUnit = async (req, res) => {
  const { id } = req.params;

  try {
    const unit = await Unit.findByIdAndDelete(id);

    if (!unit) return res.status(404).json({ message: 'Unit not found' });

    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete unit' });
  }
};

// @desc Bulk delete units
exports.bulkDeleteUnits = async (req, res) => {
  const { ids, all } = req.body;

  try {
    if (all) {
      const result = await Unit.deleteMany({});
      return res.status(200).json({
        message: 'Units deleted successfully',
        deletedCount: result.deletedCount || 0
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide unit ids.' });
    }

    const result = await Unit.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({
      message: 'Units deleted successfully',
      deletedCount: result.deletedCount || 0
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to bulk delete units', error: err.message });
  }
};
