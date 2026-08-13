const Brand = require('../models/Brand');

exports.createBrand = async (req, res) => {
    try {
        const { brand_name, status, hsn_code } = req.body;
        const brand_image = req.file ? req.file.filename : null;

        const brand = new Brand({
            brand_name: brand_name,
            brand_image,
            hsn_code,
            status,
        });

        await brand.save();
        res.status(201).json({ message: 'Brand created', data: brand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllBrands = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        // Build search query
        const searchQuery = {
            $or: [
                { brand_name: { $regex: search, $options: 'i' } },
                { brand_description: { $regex: search, $options: 'i' } }
            ]
        };

        // Get total count for pagination
        const total = await Brand.countDocuments(searchQuery);

        // Get paginated results
        const brands = await Brand.find(searchQuery)
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.status(200).json({
            message: 'Brands fetched successfully',
            data: {
                brands,
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
            message: 'Error fetching brands',
            error: err.message 
        });
    }
};

exports.getBrandById = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });
        res.json(brand);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        const { brand_name, status, hsn_code } = req.body;
        const brand = await Brand.findById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });

        if (brand_name) brand.brand_name = brand_name;
        if (status !== undefined) brand.status = status;
        if (hsn_code !== undefined) brand.hsn_code = hsn_code;
        if (req.file) brand.brand_image = req.file.filename;

        await brand.save();
        res.json({ message: 'Brand updated', data: brand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const brand = await Brand.findByIdAndDelete(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });
        res.json({ message: 'Brand deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.bulkDeleteBrands = async (req, res) => {
    const { ids, all } = req.body;
    try {
        if (all) {
            const result = await Brand.deleteMany({});
            return res.status(200).json({
                message: 'Brands deleted successfully',
                deletedCount: result.deletedCount || 0
            });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide brand ids.' });
        }
        const result = await Brand.deleteMany({ _id: { $in: ids } });
        res.status(200).json({
            message: 'Brands deleted successfully',
            deletedCount: result.deletedCount || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
