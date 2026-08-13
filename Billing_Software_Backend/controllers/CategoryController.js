const Category = require('../models/Category');
const Product = require('../models/Product');

exports.createCategory = async (req, res) => {
    try {
        const { category_name, status, defaultUnitId, defaultTaxId } = req.body;
        const rawSlug = req.body.slug;
        const nameSlug = (category_name || "").trim().replace(/\s+/g, "-").toLowerCase();
        const slug = rawSlug && String(rawSlug).trim()
            ? String(rawSlug).trim()
            : nameSlug;

        const category_image = req.file ? req.file.filename : null;

        const category = new Category({
            category_name: category_name,
            slug: slug,
            category_image: category_image,
            status: status,
            defaultUnitId: defaultUnitId || null,
            defaultTaxId: defaultTaxId || null,
        });

        await category.save();
        res.status(201).json({ message: 'Category created', data: category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        // Build search query
        const searchQuery = {
            $or: [
                { category_name: { $regex: search, $options: 'i' } },
                { category_description: { $regex: search, $options: 'i' } }
            ]
        };

        // Get total count for pagination
        const total = await Category.countDocuments(searchQuery);

        // Get paginated results
        const categories = await Category.find(searchQuery)
            .populate("defaultUnitId", "unit_name short_name")
            .populate("defaultTaxId", "tax_name total_tax_rate")
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.status(200).json({
            message: 'Categories fetched successfully',
            data: {
                categories,
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
            message: 'Error fetching categories',
            error: err.message
        });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
            .populate("defaultUnitId", "unit_name short_name")
            .populate("defaultTaxId", "tax_name total_tax_rate");
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { category_name, slug, status, defaultUnitId, defaultTaxId } = req.body;
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        if (category_name) {
            category.category_name = category_name;
            if (!slug || !String(slug).trim()) {
                category.slug = String(category_name).trim().replace(/\s+/g, "-").toLowerCase();
            }
        }
        if (slug && String(slug).trim()) category.slug = String(slug).trim();
        if (status !== undefined) category.status = status;
        if (req.file) category.category_image = req.file.filename;
        if (defaultUnitId !== undefined) {
            category.defaultUnitId = defaultUnitId || null;
        }
        let taxChanged = false;
        if (defaultTaxId !== undefined) {
            const nextTaxId = defaultTaxId || null;
            taxChanged = String(category.defaultTaxId || '') !== String(nextTaxId || '');
            category.defaultTaxId = nextTaxId;
        }

        await category.save();
        if (taxChanged) {
            await Product.updateMany(
                { category: category._id },
                { $set: { tax: category.defaultTaxId || null } }
            );
        }
        res.json({ message: 'Category updated', data: category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.bulkDeleteCategories = async (req, res) => {
    const { ids, all } = req.body;
    try {
        if (all) {
            const result = await Category.deleteMany({});
            return res.status(200).json({
                message: 'Categories deleted successfully',
                deletedCount: result.deletedCount || 0
            });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide category ids.' });
        }
        const result = await Category.deleteMany({ _id: { $in: ids } });
        res.status(200).json({
            message: 'Categories deleted successfully',
            deletedCount: result.deletedCount || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
