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
    const name = normalizeName(req.body.name || '');
    if (!name) {
      return res.status(400).json({ success: false, message: 'Size name is required' });
    }
    const existing = await Size.findOne({ nameLower: name.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Size already exists' });
    }
    const created = await Size.create({ name, nameLower: name.toLowerCase() });
    res.status(201).json({
      success: true,
      message: 'Size created',
      data: { id: created._id, name: created.name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create size' });
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
    const name = normalizeName(req.body.name || '');
    const hexCode = req.body.hexCode ? String(req.body.hexCode).trim() : null;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Color name is required' });
    }
    const existing = await Color.findOne({ nameLower: name.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Color already exists' });
    }
    const created = await Color.create({ name, nameLower: name.toLowerCase(), hexCode });
    res.status(201).json({
      success: true,
      message: 'Color created',
      data: { id: created._id, name: created.name, hexCode: created.hexCode || null },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create color' });
  }
};

module.exports = {
  listSizes,
  createSize,
  listColors,
  createColor,
};
