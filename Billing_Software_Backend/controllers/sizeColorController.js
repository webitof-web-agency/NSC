const Size = require('../models/Size');
const Color = require('../models/Color');

const normalizeName = (name = '') => name.trim();

const listSizes = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const query = {};
    if (search) {
      query.nameLower = { $regex: search.trim().toLowerCase(), $options: 'i' };
    }
    const sizes = await Size.find(query).sort({ nameLower: 1 });
    res.status(200).json({
      success: true,
      message: 'Sizes fetched',
      data: sizes.map(s => ({ id: s._id, name: s.name })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch sizes' });
  }
};

const createSize = async (req, res) => {
  try {
    const rawName = req.body.name || '';
    if (!rawName) {
      return res.status(400).json({ success: false, message: 'Size name is required' });
    }

    const items = rawName.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid size name is required' });
    }

    const createdItems = [];
    for (const itemName of items) {
      const existing = await Size.findOne({ nameLower: itemName.toLowerCase() });
      if (!existing) {
        const created = await Size.create({ name: itemName, nameLower: itemName.toLowerCase() });
        createdItems.push({ id: created._id, name: created.name });
      } else if (items.length === 1) {
        return res.status(409).json({ success: false, message: 'Size already exists' });
      }
    }

    if (createdItems.length === 0 && items.length > 1) {
        return res.status(409).json({ success: false, message: 'All sizes already exist' });
    }

    res.status(201).json({
      success: true,
      message: items.length > 1 ? `Created ${createdItems.length} sizes` : 'Size created',
      data: items.length > 1 ? createdItems : createdItems[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create size' });
  }
};

const deleteSize = async (req, res) => {
  try {
    const deleted = await Size.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }
    res.status(200).json({ success: true, message: 'Size deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete size' });
  }
};

const listColors = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const query = {};
    if (search) {
      query.nameLower = { $regex: search.trim().toLowerCase(), $options: 'i' };
    }
    const colors = await Color.find(query).sort({ nameLower: 1 });
    res.status(200).json({
      success: true,
      message: 'Colors fetched',
      data: colors.map(c => ({ id: c._id, name: c.name, hexCode: c.hexCode || null })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch colors' });
  }
};

const createColor = async (req, res) => {
  try {
    const rawName = req.body.name || '';
    const hexCode = req.body.hexCode ? String(req.body.hexCode).trim() : null;
    if (!rawName) {
      return res.status(400).json({ success: false, message: 'Color name is required' });
    }

    const items = rawName.split(',').map(c => c.trim()).filter(Boolean);
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid color name is required' });
    }

    const createdItems = [];
    for (const itemName of items) {
      const existing = await Color.findOne({ nameLower: itemName.toLowerCase() });
      if (!existing) {
        const created = await Color.create({ name: itemName, nameLower: itemName.toLowerCase(), hexCode });
        createdItems.push({ id: created._id, name: created.name, hexCode: created.hexCode || null });
      } else if (items.length === 1) {
        return res.status(409).json({ success: false, message: 'Color already exists' });
      }
    }

    if (createdItems.length === 0 && items.length > 1) {
        return res.status(409).json({ success: false, message: 'All colors already exist' });
    }

    res.status(201).json({
      success: true,
      message: items.length > 1 ? `Created ${createdItems.length} colors` : 'Color created',
      data: items.length > 1 ? createdItems : createdItems[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create color' });
  }
};

const deleteColor = async (req, res) => {
  try {
    const deleted = await Color.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Color not found' });
    }
    res.status(200).json({ success: true, message: 'Color deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete color' });
  }
};

module.exports = {
  listSizes,
  createSize,
  deleteSize,
  listColors,
  createColor,
  deleteColor,
};
