const Product = require('../models/Product');
const Unit = require('../models/Unit');
const Brand = require('../models/Brand');
const getFilePath = (file) => file ? `/uploads/products/${file.filename}` : null;
const TaxGroup = require('../models/TaxGroup');
const TaxRate = require('../models/TaxRate');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const ProductVariant = require('../models/ProductVariant');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const buildProductsExportWorksheet = async ({ workbook, rows, sheetName = 'Products Export' }) => {
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = [
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Opening Stock', key: 'opening_stock', width: 15 },
    { header: 'Purchase Price', key: 'purchase_price', width: 15 },
    { header: 'Sale Price', key: 'sale_price', width: 12 },
    { header: 'Min. Sale Price', key: 'min_sale_price', width: 16 },
    { header: 'MRP', key: 'mrp', width: 12 },
    { header: 'Brand - Design Number - Size', key: 'design_number', width: 32 },
    { header: 'Color', key: 'color', width: 12 },
    { header: 'HSN Code', key: 'hsn_code', width: 12 },
    { header: 'GST Tax Rate', key: 'gst_tax_rate', width: 16 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Reorder Limit', key: 'reorder_limit', width: 15 },
    { header: 'Barcode', key: 'barcode', width: 18 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' }
    };
  });

  rows.forEach((row) => worksheet.addRow(row));
  return worksheet;
};

exports.createProduct = async (req, res) => {
  try {

    let reused = false;
    let product = await Product.findOne({
      category: req.body.category,
      brand: req.body.brand
    });
    if (product) reused = true;

    if (!product) {
      product = new Product({
        item_type: req.body.item_type,
        name: req.body.name || "",
        code: req.body.code,
        hsn_code: req.body.hsn_code,
        category: req.body.category,
        brand: req.body.brand,
        unit: req.body.unit,
        tax: req.body.tax,
        status: true,
      });

      await product.save();
    }

    product = await Product.findById(product._id)
      .populate("category", "category_name")
      .populate("brand", "brand_name")
      .populate("unit", "unit_name short_name")
      .populate("tax", "tax_name")
      .lean();

    res.status(201).json({
      message: reused ? "Product reused successfully" : "Product created successfully",
      data: {
        id: product._id,
        item_type: product.item_type,
        name: product.name,
        code: product.code,
        hsn_code: product.hsn_code,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        tax: product.tax,
        status: product.status,
        createdAt: product.createdAt,
      },
    });
  } catch (err) {
    console.error("Create Product Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    const query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');

      const productSearch = {
        $or: [
          { name: searchRegex },
          { code: searchRegex },
          { description: searchRegex },
          { barcode: searchRegex }
        ]
      };

      const [matchingBrands, matchingCategories] = await Promise.all([
        Brand.find({ brand_name: searchRegex }).select('_id'),
        Category.find({ category_name: searchRegex }).select('_id')
      ]);

      const brandIds = matchingBrands.map(b => b._id);
      const categoryIds = matchingCategories.map(c => c._id);

      query.$or = [
        productSearch,
        brandIds.length ? { brand: { $in: brandIds } } : null,
        categoryIds.length ? { category: { $in: categoryIds } } : null
      ].filter(condition => condition !== null);
    }

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate({
        path: 'category',
        select: 'category_name'
      })
      .populate({
        path: 'brand',
        select: 'brand_name'
      })
      .populate({
        path: 'tax',
        select: 'name total_tax_rate'
      })
      .populate({
        path: 'unit',
        select: 'name'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.getProductsForInvoice = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    let query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');

      const [matchingBrands, matchingCategories] = await Promise.all([
        Brand.find({ brand_name: searchRegex }).select('_id'),
        Category.find({ category_name: searchRegex }).select('_id')
      ]);

      const brandIds = matchingBrands.map((brand) => brand._id);
      const categoryIds = matchingCategories.map((category) => category._id);

      query.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { barcode: searchRegex },
        brandIds.length ? { brand: { $in: brandIds } } : null,
        categoryIds.length ? { category: { $in: categoryIds } } : null
      ].filter(Boolean);
    }

    const total = await Product.countDocuments(query);

    let products = await Product.find(query)
      .populate({
        path: "unit",
        select: "short_name"
      })
      .populate({
        path: "category",
        select: "category_name"
      })
      .populate({
        path: "brand",
        select: "brand_name"
      })
      .populate({
        path: "tax",
        populate: { path: "tax_rate_ids", model: "TaxRate" }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    products = products.map(p => {
      const totalTaxRate =
        p.tax?.tax_rate_ids?.reduce((sum, t) => sum + (t.tax_rate || 0), 0) || 0;

      return {
        id: p._id,
        item_type: p.item_type,
        name: p.name,
        code: p.code,
        hsn_code: p.hsn_code || "",
        barcode: p.barcode,
        unit: p.unit
          ? { id: p.unit._id, name: p.unit.short_name }
          : null,
        category: p.category
          ? { _id: p.category._id, category_name: p.category.category_name }
          : null,
        brand: p.brand
          ? { _id: p.brand._id, brand_name: p.brand.brand_name }
          : null,
        prices: {
          selling: p.selling_price,
          purchase: p.purchase_price
        },
        discount: {
          type: p.discount_type,
          value: p.discount_value
        },
        tax: {
          group_id: p.tax?._id,
          group_name: p.tax?.tax_name,
          total_rate: totalTaxRate
        },
        quantity: p.stock,
        rate: p.selling_price,
        amount: p.selling_price
      };
    });

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category brand unit tax');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updateData = {
      item_type: req.body.item_type,
      name: req.body.name ?? existingProduct.name ?? "",
      code: req.body.code,
      hsn_code: req.body.hsn_code,
      category: req.body.category,
      brand: req.body.brand,
      unit: req.body.unit,
      tax: req.body.tax,
      status: req.body.status ?? existingProduct.status,
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("category", "category_name")
      .populate("brand", "brand_name")
      .populate("unit", "unit_name short_name")
      .populate("tax", "tax_name")
      .lean();

    res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteProductAndRelated = async (productId) => {
  const deleted = await Product.findByIdAndDelete(productId);
  if (!deleted) {
    return false;
  }

  const variants = await ProductVariant.find({ productId: deleted._id }).select('_id');
  const variantIds = variants.map(v => v._id);

  await ProductVariant.deleteMany({ productId: deleted._id });

  await Inventory.deleteMany({
    $or: [
      { productId: deleted._id },
      { variantId: { $in: variantIds } }
    ]
  });

  return true;
};

exports.deleteProduct = async (req, res) => {
  try {
    const ok = await deleteProductAndRelated(req.params.id);
    if (!ok) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.bulkDeleteProducts = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const products = await Product.find({}).select('_id');
      targetIds = products.map(p => p._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide product ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteProductAndRelated(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: 'Products deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllProductCategories = async (req, res) => {
  try {
    const { search = '', status } = req.query;

    const query = {};

    if (search) {
      query.category_name = { $regex: search, $options: 'i' };
    }

    if (status !== undefined) {
      query.status = status === 'true';
    } else {
      query.status = true;
    }

    const categories = await Category.find(query)
      .populate("defaultUnitId", "unit_name short_name")
      .populate("defaultTaxId", "tax_name total_tax_rate")
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 10);

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formattedCategories = categories.map(cat => ({
      id: cat._id,
      categoryName: cat.category_name,
      categoryImage: cat.category_image
        ? `${baseUrl}uploads/${cat.category_image.replace(/\\/g, '/')}`
        : null,
      defaultUnitId: cat.defaultUnitId?._id || null,
      defaultUnitName: cat.defaultUnitId?.unit_name || null,
      defaultTaxId: cat.defaultTaxId?._id || null,
      defaultTaxName: cat.defaultTaxId?.tax_name || null,
      defaultTaxRate: cat.defaultTaxId?.total_tax_rate ?? null,
      status: cat.status,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: search ? 'Search results for categories' : 'Last 10 categories retrieved',
      data: formattedCategories,
      count: formattedCategories.length
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.getAllProductBrands = async (req, res) => {
  try {
    const { search = '', status } = req.query;

    const query = {};

    if (search) {
      query.brand_name = { $regex: search, $options: 'i' };
    }

    if (status !== undefined) {
      query.status = status === 'true';
    } else {
      query.status = true;
    }

    const brands = await Brand.find(query)
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 10);

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formattedBrands = brands.map(brand => ({
      id: brand._id,
      brandName: brand.brand_name,
      hsnCode: brand.hsn_code,
      brandImage: brand.brand_image
        ? `${baseUrl}uploads/${brand.brand_image.replace(/\\/g, '/')}`
        : null,
      status: brand.status,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: search ? 'Search results for brands' : 'Last 10 brands retrieved',
      data: formattedBrands,
      count: formattedBrands.length
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brands',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.getAllUnits = async (req, res) => {
  try {
    const { search = '', status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { unit_name: { $regex: search, $options: 'i' } },
        { short_name: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== undefined) {
      query.status = status === 'true';
    } else {
      query.status = true;
    }

    const units = await Unit.find(query)
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 10);

    const formattedUnits = units.map(unit => ({
      id: unit._id,
      unitName: unit.unit_name,
      shortName: unit.short_name,
      status: unit.status,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: search ? 'Search results for units' : 'Last 10 units retrieved',
      data: formattedUnits,
      count: formattedUnits.length
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching units',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.getAllTaxGroups = async (req, res) => {
  try {
    const { search = '', status } = req.query;

    const query = {};

    if (search) {
      query.tax_name = { $regex: search, $options: 'i' };
    }

    if (status !== undefined) {
      query.status = status === 'true';
    } else {
      query.status = true;
    }

    const taxes = await TaxGroup.find(query)
      .sort({ createdAt: -1 })
      .limit(search ? 0 : 10);

    const formattedTaxes = taxes.map(tax => ({
      id: tax._id,
      taxGroupName: tax.tax_name,
      taxRate: tax.tax_rate_ids,
      status: tax.status,
      createdAt: tax.createdAt,
      updatedAt: tax.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: search ? 'Search results for tax groups' : 'Last 10 tax groups retrieved',
      data: formattedTaxes,
      count: formattedTaxes.length
    });
  } catch (error) {
    console.error('Error fetching tax groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tax groups',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.createProductVariant = async (req, res) => {
  try {
    const {
      productId,
      designNo,
      color,
      size,
      purchase_price,
      sale_price,
      mrp,
      min_sale_price,
      reorder_limit,
      discount_value,
      barcode
    } = req.body;

    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const normalizeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const barcodeKey = [
      String(designNo || "").trim(),
      String(size || "").trim().toLowerCase(),
      normalizeNum(purchase_price),
      normalizeNum(sale_price),
      normalizeNum(mrp),
    ].join("|");

    const hash32 = (str, seed = 0) => {
      let h = seed >>> 0;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i);
        h >>>= 0;
      }
      return h >>> 0;
    };

    const makeBarcode = (key) => {
      const h1 = hash32(key, 0).toString().padStart(10, "0");
      const h2 = (hash32(key, 7) % 100).toString().padStart(2, "0");
      return `${h1}${h2}`.slice(0, 12);
    };

    let resolvedBarcode = barcode && String(barcode).trim();
    const existingByKey = await ProductVariant.findOne({
      $or: [
        { barcodeKey },
        {
          designNo: String(designNo || "").trim(),
          size: String(size || "").trim(),
          purchase_price: normalizeNum(purchase_price),
          sale_price: normalizeNum(sale_price),
          mrp: normalizeNum(mrp),
        },
      ],
    }).select("barcode");

    if (existingByKey?.barcode) {
      resolvedBarcode = existingByKey.barcode;
    }

    if (!resolvedBarcode) {
      resolvedBarcode = makeBarcode(barcodeKey);
    }

    const existingVariant = await ProductVariant.findOne({ barcode: resolvedBarcode });
    if (existingVariant && String(existingVariant.barcodeKey || "") !== String(barcodeKey)) {
      resolvedBarcode = makeBarcode(`${barcodeKey}#${existingVariant._id}`);
    }

    const variant = new ProductVariant({
      productId,
      designNo,
      color,
      size,
      purchase_price,
      sale_price,
      mrp,
      min_sale_price,
      reorder_limit,
      discount_value,
      barcode: resolvedBarcode,
      barcodeKey,
      createdBy: req.user || null
    });

    await variant.save();

    res.status(201).json({
      message: "Product Variant created successfully",
      data: {
        id: variant._id,
        productId: variant.productId,
        designNo: variant.designNo,
        color: variant.color,
        size: variant.size,
        purchase_price: variant.purchase_price,
        sale_price: variant.sale_price,
        mrp: variant.mrp,
        min_sale_price: variant.min_sale_price,
        reorder_limit: variant.reorder_limit,
        discount_value: variant.discount_value,
        barcode: variant.barcode,
        createdAt: variant.createdAt
      }
    });

  } catch (error) {
    console.error("Create Variant Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getProductVariantById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(200).json({
        message: "Invalid product id",
        data: []
      });
    }

    const variants = await ProductVariant.find({ productId: id })
      .populate({
        path: "productId",
        select: "name code hsn_code category brand unit tax",
        populate: [
          { path: "category", select: "category_name" },
          { path: "brand", select: "brand_name" },
          { path: "unit", select: "unit_name short_name" },
          {
            path: "tax",
            populate: { path: "tax_rate_ids", model: "TaxRate" }
          }
        ]
      });

    const validVariants = (variants || []).filter((variant) => !!variant.productId);

    if (!validVariants.length) {
      return res.status(200).json({
        message: "No variants found for this product",
        data: []
      });
    }

    return res.status(200).json({
      message: "Product variants fetched successfully",
      data: validVariants
    });

  } catch (error) {
    console.error("Get Product Variants Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.updateProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = {
      designNo: req.body.designNo,
      color: req.body.color,
      size: req.body.size,
      purchase_price: req.body.purchase_price,
      sale_price: req.body.sale_price,
      mrp: req.body.mrp,
      min_sale_price: req.body.min_sale_price,
      reorder_limit: req.body.reorder_limit,
      discount_value: req.body.discount_value,
      barcode: req.body.barcode
    };

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("productId");

    if (!updatedVariant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    res.status(200).json({
      message: "Variant updated successfully",
      data: updatedVariant
    });

  } catch (error) {
    console.error("Update Variant Error:", error);

    if (error.code === 11000 && error.keyPattern?.barcode) {
      return res.status(422).json({ message: "Barcode already exists" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid product variant id",
      });
    }

    const deletedVariant = await ProductVariant.findByIdAndDelete(id);

    if (!deletedVariant) {
      return res.status(404).json({
        message: "Product variant not found",
      });
    }

    await Inventory.deleteMany({ variantId: deletedVariant._id });

    res.status(200).json({
      message: "Product variant deleted successfully",
      data: deletedVariant
    });

  } catch (error) {
    console.error("Delete Variant Error:", error);

    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.bulkDeleteProductVariants = async (req, res) => {
  const { ids, all } = req.body;
  try {
    if (all) {
      const variants = await ProductVariant.find({}).select('_id');
      const variantIds = variants.map(v => v._id);
      const result = await ProductVariant.deleteMany({});
      if (variantIds.length > 0) {
        await Inventory.deleteMany({ variantId: { $in: variantIds } });
      }
      return res.status(200).json({
        message: "Product variants deleted successfully",
        deletedCount: result.deletedCount || 0
      });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Please provide variant ids." });
    }
    const result = await ProductVariant.deleteMany({ _id: { $in: ids } });
    await Inventory.deleteMany({ variantId: { $in: ids } });
    return res.status(200).json({
      message: "Product variants deleted successfully",
      deletedCount: result.deletedCount || 0
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.getAllProductVariants = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      all = "false",
      ids = "",
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const fetchAll = String(all).toLowerCase() === "true" || limitNumber === 0;
    const hasIdsFilter = String(ids || "").trim().length > 0;
    const selectedIds = String(ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const trimmedSearch = String(search || '').trim();
    const searchRegex = trimmedSearch ? new RegExp(trimmedSearch, "i") : null;
    let matchingProductIds = [];

    if (searchRegex && !hasIdsFilter) {
      const matchingBrands = await Brand.find({ brand_name: searchRegex }).select('_id');
      const matchingBrandIds = matchingBrands.map((brand) => brand._id);

      if (matchingBrandIds.length) {
        matchingProductIds = await Product.find({ brand: { $in: matchingBrandIds } }).distinct('_id');
      }
    }

    const searchQuery = hasIdsFilter
      ? { _id: { $in: selectedIds } }
      : searchRegex
        ? {
        $or: [
          { designNo: searchRegex },
          { color: searchRegex },
          { size: searchRegex },
          { barcode: searchRegex },
          ...(matchingProductIds.length ? [{ productId: { $in: matchingProductIds } }] : []),
        ],
      }
        : {};

    const total = await ProductVariant.countDocuments(searchQuery);

    let query = ProductVariant.find(searchQuery)
      .populate({
        path: 'productId',
        select: 'name code hsn_code category brand unit tax purchase_price',
        populate: [
          {
            path: 'category',
            select: 'category_name',
          },
          {
            path: 'brand',
            select: 'brand_name',
          },
          {
            path: 'unit',
            select: 'unit_name short_name',
          },
          {
            path: 'tax',
            select: 'tax_name tax_rate_ids',
            populate: {
              path: 'tax_rate_ids',
              model: 'TaxRate',
            },
          },
        ],
      })
      .sort({ createdAt: -1 });

    if (!fetchAll) {
      query = query.skip(skip).limit(limitNumber);
    }

    const variants = await query;

    res.status(200).json({
      success: true,
      message: "Product variants fetched successfully",
      data: {
        variants,
        pagination: fetchAll
          ? {
            total,
            page: 1,
            limit: total,
            totalPages: total ? 1 : 0,
          }
          : {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
          },
      },
    });
  } catch (error) {
    console.error("Get Product Variants Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product variants",
    });
  }
};

// POST /products-variants/by-ids — accepts IDs in body to avoid URL length limits
exports.getVariantsByIds = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an array of ids." });
    }

    const validIds = ids
      .map((id) => String(id).trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid ids provided." });
    }

    const variants = await ProductVariant.find({ _id: { $in: validIds } })
      .populate({
        path: 'productId',
        select: 'name code hsn_code category brand unit tax purchase_price',
        populate: [
          { path: 'category', select: 'category_name' },
          { path: 'brand', select: 'brand_name' },
          { path: 'unit', select: 'unit_name short_name' },
          {
            path: 'tax',
            select: 'tax_name tax_rate_ids',
            populate: { path: 'tax_rate_ids', model: 'TaxRate' },
          },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Product variants fetched successfully",
      data: {
        variants,
        pagination: {
          total: variants.length,
          page: 1,
          limit: variants.length,
          totalPages: variants.length ? 1 : 0,
        },
      },
    });
  } catch (error) {
    console.error("Get Variants By Ids Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product variants",
    });
  }
};

const findOrCreateCategory = async (categoryName, defaultUnitId = null, defaultTaxId = null) => {
  if (!categoryName || categoryName.trim() === '') {
    throw new Error('Category name is required');
  }

  const name = categoryName.trim();
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const regex = new RegExp(`^${name}$`, 'i');

  let category = await Category.findOne({ category_name: { $regex: regex } });
  let isExisting = !!category;

  if (!category) {
    try {
      category = await Category.create({
        category_name: name,
        slug,
        status: true,
        ...(defaultUnitId ? { defaultUnitId } : {}),
        ...(defaultTaxId ? { defaultTaxId } : {})
      });
      isExisting = false;
    } catch (error) {
      if (error.code === 11000) {
        category = await Category.findOne({ category_name: { $regex: regex } });
        if (!category) {
          category = await Category.findOne({ slug: slug });
        }
        isExisting = true;
        if (!category) throw error;
      } else {
        throw error;
      }
    }
  }

  if (category) {
    let needsSave = false;
    if (!category.defaultUnitId && defaultUnitId) {
      category.defaultUnitId = defaultUnitId;
      needsSave = true;
    }
    if (defaultTaxId && String(category.defaultTaxId || "") !== String(defaultTaxId)) {
      category.defaultTaxId = defaultTaxId;
      needsSave = true;
    }
    if (needsSave) await category.save();
  }

  return {
    categoryId: category._id,
    isExisting,
    defaultTaxId: category.defaultTaxId || null,
  };
};

const findOrCreateBrand = async (brandName, hsnCode) => {
  if (!brandName || brandName.trim() === '') {
    throw new Error('Brand name is required');
  }
  const name = brandName.trim();
  const regex = new RegExp(`^${name}$`, 'i');

  let brand = await Brand.findOne({ brand_name: { $regex: regex } });

  if (!brand) {
    try {
      brand = await Brand.create({
        brand_name: name,
        hsn_code: hsnCode || '',
        status: true
      });
    } catch (error) {
      if (error.code === 11000) {
        brand = await Brand.findOne({ brand_name: { $regex: regex } });
        if (!brand) throw error;
      } else {
        throw error;
      }
    }
  } else if (hsnCode && !brand.hsn_code) {
    brand.hsn_code = hsnCode;
    await brand.save();
  }

  return brand._id;
};

const findOrCreateUnit = async (unitName, shortName) => {
  if (!unitName || unitName.trim() === '') {
    throw new Error('Unit name is required');
  }
  const resolvedShortName = (shortName && shortName.trim()) || unitName.trim();

  const name = unitName.trim();
  const regex = new RegExp(`^${name}$`, 'i');

  let unit = await Unit.findOne({ unit_name: { $regex: regex } });

  if (!unit) {
    try {
      unit = await Unit.create({
        unit_name: name,
        short_name: resolvedShortName,
        status: true
      });
    } catch (error) {
      if (error.code === 11000) {
        unit = await Unit.findOne({ unit_name: { $regex: regex } });
        if (!unit) throw error;
      } else {
        throw error;
      }
    }
  }

  return unit._id;
};

const findOrCreateTaxGroupByRate = async (gstRate) => {
  const rateNumber = Number(gstRate);
  if (!Number.isFinite(rateNumber) || rateNumber <= 0) return null;

  const rateLabel = `GST ${rateNumber}%`;

  let taxRate = await TaxRate.findOne({
    tax_rate: rateNumber,
    tax_name: { $regex: new RegExp(`^${rateLabel}$`, 'i') }
  });

  if (!taxRate) {
    taxRate = await TaxRate.create({
      tax_name: rateLabel,
      tax_rate: rateNumber,
      status: true
    });
  }

  let taxGroup = await TaxGroup.findOne({
    tax_name: { $regex: new RegExp(`^${rateLabel}$`, 'i') }
  });

  if (!taxGroup) {
    taxGroup = await TaxGroup.create({
      tax_name: rateLabel,
      tax_rate_ids: [taxRate._id],
      status: true
    });
  } else if (!taxGroup.tax_rate_ids?.length) {
    taxGroup.tax_rate_ids = [taxRate._id];
    await taxGroup.save();
  }

  return taxGroup._id;
};

const normalizeUploadText = (value) => String(value || '').trim();
const normalizeUploadTextLower = (value) => normalizeUploadText(value).toLowerCase();
const normalizeUploadNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatBrandDesignSize = ({ brand, designNo, size }) =>
  [brand, designNo, size]
    .map((part) => normalizeUploadText(part))
    .filter(Boolean)
    .join(' - ');

const parseBrandDesignSize = (value, fallbackBrand = '') => {
  const text = normalizeUploadText(value);
  const fallback = normalizeUploadText(fallbackBrand);

  if (!text) {
    return { brandName: fallback, designNo: '', size: '' };
  }

  const parts = text
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      brandName: parts[0],
      designNo: parts.slice(1, -1).join(' - '),
      size: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    return {
      brandName: fallback,
      designNo: parts[0],
      size: parts[1],
    };
  }

  return {
    brandName: fallback,
    designNo: text,
    size: '',
  };
};

const buildUploadProductKey = ({ categoryName, brandName, unitName, hsnCode, gstRate }) =>
  [
    normalizeUploadTextLower(categoryName),
    normalizeUploadTextLower(brandName),
    normalizeUploadTextLower(unitName),
    normalizeUploadTextLower(hsnCode),
    normalizeUploadNumber(gstRate)
  ].join('|');

const buildVariantDuplicateKey = (payload) =>
  [
    normalizeUploadTextLower(payload.designNo),
    normalizeUploadTextLower(payload.color),
    normalizeUploadTextLower(payload.size),
    normalizeUploadNumber(payload.purchase_price),
    normalizeUploadNumber(payload.sale_price),
    normalizeUploadNumber(payload.mrp),
    normalizeUploadNumber(payload.min_sale_price),
    normalizeUploadNumber(payload.reorder_limit),
    normalizeUploadNumber(payload.discount_value),
    normalizeUploadText(payload.barcode)
  ].join('|');

const generateUniqueProductCode = async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `PROD-${Math.random().toString(36).substring(2, 11).toUpperCase()}${Date.now()
      .toString()
      .slice(-4)}`.slice(0, 18);
    const exists = await Product.exists({ code });
    if (!exists) {
      return code;
    }
  }

  return `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

exports.uploadProductsExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(422).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fs = require('fs');
    const workbook = new ExcelJS.Workbook();
    const isCsv = req.file.originalname.toLowerCase().endsWith('.csv');

    if (isCsv) {
      await workbook.csv.readFile(req.file.path);
    } else {
      await workbook.xlsx.readFile(req.file.path);
    }

    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return res.status(422).json({
        success: false,
        message: 'Excel file is empty or invalid'
      });
    }

    const results = {
      success: [],
      errors: [],
      skippedDuplicates: []
    };

    let lastProductContext = null;
    const productCache = new Map();
    const seenVariantKeys = new Set();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row.hasValues) continue;

      let name = '';
      let code = '';

      try {
        const category_name = normalizeUploadText(row.getCell(1).value);
        const brandColumnName = normalizeUploadText(row.getCell(2).value);
        const unit_name = normalizeUploadText(row.getCell(3).value);

        const opening_stock = normalizeUploadNumber(row.getCell(4).value);
        const purchase_price = normalizeUploadNumber(row.getCell(5).value);
        const sale_price = normalizeUploadNumber(row.getCell(6).value);
        const min_sale_price = normalizeUploadNumber(row.getCell(7).value);
        const mrp = normalizeUploadNumber(row.getCell(8).value);
        const brandDesignSize = parseBrandDesignSize(row.getCell(9).value, brandColumnName);
        const brand_name = brandDesignSize.brandName || brandColumnName;
        const designNo = brandDesignSize.designNo;
        const size = brandDesignSize.size;
        const color = normalizeUploadText(row.getCell(10).value);
        const hsn_code = normalizeUploadText(row.getCell(11).value);
        const gst_tax_rate = normalizeUploadNumber(
          String(row.getCell(12).value ?? '').replace('%', '').trim()
        );
        const discount_value = normalizeUploadNumber(row.getCell(13).value);
        const reorder_limit = normalizeUploadNumber(row.getCell(14).value);
        const providedBarcode = normalizeUploadText(row.getCell(15).value);

        const hasProductColumns = !!hsn_code || !!category_name || !!brand_name || !!unit_name;

        const effectiveHsn = hsn_code || lastProductContext?.hsn_code || '';
        const effectiveCategory = category_name || lastProductContext?.category_name;
        const effectiveBrand = brand_name || lastProductContext?.brand_name;
        const effectiveUnit = unit_name || lastProductContext?.unit_name;
        const effectiveGstRate = gst_tax_rate || lastProductContext?.gst_tax_rate || 0;
        const effectiveUnitShort = lastProductContext?.unit_short_name || effectiveUnit;
        const productUploadKey = buildUploadProductKey({
          categoryName: effectiveCategory,
          brandName: effectiveBrand,
          unitName: effectiveUnit,
          hsnCode: effectiveHsn,
          gstRate: effectiveGstRate
        });

        if (hasProductColumns && (!effectiveCategory || !effectiveBrand || !effectiveUnit)) {
          throw new Error('Category, Brand, and Unit name are required for a new product row');
        }

        let product = null;
        if (!hasProductColumns && lastProductContext?.productId) {
          product = await Product.findById(lastProductContext.productId);
        }

        if (!product) {
          if (!effectiveCategory) throw new Error('Category name is required');
          if (!effectiveBrand) throw new Error('Brand name is required');
          if (!effectiveUnit) throw new Error('Unit name is required');

          const unitId = await findOrCreateUnit(effectiveUnit, effectiveUnitShort);
          const taxGroupId = await findOrCreateTaxGroupByRate(effectiveGstRate);
          const categoryInfo = await findOrCreateCategory(effectiveCategory, unitId, taxGroupId);
          const categoryId = categoryInfo.categoryId;
          const brandId = await findOrCreateBrand(effectiveBrand, effectiveHsn);

          product =
            productCache.get(productUploadKey) ||
            (await Product.findOne({
              category: categoryId,
              brand: brandId,
              unit: unitId,
              hsn_code: effectiveHsn || ''
            }).sort({ createdAt: 1 }));

          if (!product) {
            code = await generateUniqueProductCode();
            product = await Product.create({
              item_type: 'Product',
              name: '',
              code,
              hsn_code: effectiveHsn || '',
              category: categoryId,
              brand: brandId,
              unit: unitId,
              tax: taxGroupId || (categoryInfo.isExisting ? categoryInfo.defaultTaxId : null),
              status: true
            });
          } else {
            let needsSave = false;

            if (!product.code) {
              product.code = await generateUniqueProductCode();
              needsSave = true;
            }
            if (String(product.category || '') !== String(categoryId)) {
              product.category = categoryId;
              needsSave = true;
            }
            if (String(product.brand || '') !== String(brandId)) {
              product.brand = brandId;
              needsSave = true;
            }
            if (String(product.unit || '') !== String(unitId)) {
              product.unit = unitId;
              needsSave = true;
            }
            if ((product.hsn_code || '') !== (effectiveHsn || '')) {
              product.hsn_code = effectiveHsn || '';
              needsSave = true;
            }
            if (taxGroupId && String(product.tax || '') !== String(taxGroupId)) {
              product.tax = taxGroupId;
              needsSave = true;
            } else if (!product.tax && categoryInfo.isExisting && categoryInfo.defaultTaxId) {
              product.tax = categoryInfo.defaultTaxId;
              needsSave = true;
            }

            if (needsSave) await product.save();
          }

          productCache.set(productUploadKey, product);
        } else if (!product.code) {
          product.code = await generateUniqueProductCode();
          await product.save();
        }

        code = product.code;
        name = product.name || '';

        lastProductContext = {
          productId: product._id,
          hsn_code: effectiveHsn,
          category_name: effectiveCategory,
          brand_name: effectiveBrand,
          unit_name: effectiveUnit,
          unit_short_name: effectiveUnitShort,
          gst_tax_rate: effectiveGstRate
        };

        const hasVariantData =
          designNo || color || size ||
          purchase_price || sale_price || mrp || min_sale_price ||
          reorder_limit || discount_value || opening_stock || providedBarcode;

        if (hasVariantData) {
          const barcodeKey = [
            normalizeUploadText(designNo),
            normalizeUploadTextLower(size),
            normalizeUploadNumber(purchase_price),
            normalizeUploadNumber(sale_price),
            normalizeUploadNumber(mrp)
          ].join('|');

          const variantPayload = {
            designNo,
            color,
            size,
            purchase_price,
            sale_price,
            mrp,
            min_sale_price,
            reorder_limit,
            discount_value,
            barcode: providedBarcode
          };

          const variantDuplicateKey = `${String(product._id)}|${buildVariantDuplicateKey(variantPayload)}`;
          const existingDuplicateVariant = await ProductVariant.findOne({
            productId: product._id,
            designNo,
            color,
            size,
            purchase_price,
            sale_price,
            mrp,
            min_sale_price,
            reorder_limit,
            discount_value,
            ...(providedBarcode ? { barcode: providedBarcode } : {})
          }).select('_id barcode');

          if (seenVariantKeys.has(variantDuplicateKey) || existingDuplicateVariant) {
            results.skippedDuplicates.push({
              row: rowNumber,
              designNo: designNo || '',
              category: effectiveCategory || '',
              brand: effectiveBrand || '',
              reason: 'Duplicate variant skipped'
            });
            continue;
          }

          const hash32 = (str, seed = 0) => {
            let h = seed >>> 0;
            for (let i = 0; i < str.length; i++) {
              h = Math.imul(31, h) + str.charCodeAt(i);
              h >>>= 0;
            }
            return h >>> 0;
          };

          const makeBarcode = (key) => {
            const h1 = hash32(key, 0).toString().padStart(10, '0');
            const h2 = (hash32(key, 7) % 100).toString().padStart(2, '0');
            return `${h1}${h2}`.slice(0, 12);
          };

          let resolvedBarcode = providedBarcode || '';
          const existingByKey = await ProductVariant.findOne({
            $or: [
              { productId: product._id, barcodeKey },
              {
                productId: product._id,
                designNo: normalizeUploadText(designNo),
                size: normalizeUploadText(size),
                purchase_price: normalizeUploadNumber(purchase_price),
                sale_price: normalizeUploadNumber(sale_price),
                mrp: normalizeUploadNumber(mrp)
              }
            ]
          }).select('barcode');

          if (!resolvedBarcode && existingByKey?.barcode) {
            resolvedBarcode = existingByKey.barcode;
          }

          if (!resolvedBarcode) {
            resolvedBarcode = makeBarcode(`${String(product._id)}|${barcodeKey}`);
          }

          if (!providedBarcode) {
            const existingBarcode = await ProductVariant.findOne({ barcode: resolvedBarcode });
            if (
              existingBarcode &&
              String(existingBarcode.productId || '') !== String(product._id) &&
              String(existingBarcode.barcodeKey || '') !== String(barcodeKey)
            ) {
              resolvedBarcode = makeBarcode(`${String(product._id)}|${barcodeKey}#${existingBarcode._id}`);
            }
          }

          const variant = await ProductVariant.create({
            productId: product._id,
            designNo,
            color,
            size,
            purchase_price,
            sale_price,
            mrp,
            min_sale_price,
            reorder_limit,
            discount_value,
            barcode: resolvedBarcode,
            barcodeKey
          });
          seenVariantKeys.add(variantDuplicateKey);

          if (opening_stock > 0) {
            const userId = req.user;
            let inventory = await Inventory.findOne({
              productId: product._id,
              variantId: variant._id,
              userId,
              isDeleted: false
            });

            if (!inventory) {
              inventory = new Inventory({
                productId: product._id,
                variantId: variant._id,
                quantity: 0,
                userId,
                inventory_history: []
              });
            }

            const previousQuantity = inventory.quantity;
            inventory.quantity += opening_stock;
            inventory.inventory_history.push({
              unitId: product.unit || null,
              quantity: previousQuantity,
              notes: 'Opening stock from Excel upload',
              type: 'stock_in',
              adjustment: opening_stock,
              referenceId: null,
              referenceType: 'opening_stock',
              createdBy: userId
            });

            await inventory.save();
          }
        }

        results.success.push({
          row: rowNumber,
          designNo: designNo || '',
          category: effectiveCategory || '',
          brand: effectiveBrand || '',
          productCode: code || ''
        });
      } catch (error) {
        let errorMessage = error.message;

        if (error.code === 11000) {
          if (error.keyPattern?.name) {
            errorMessage = `Product name "${name}" already exists`;
          } else if (error.keyPattern?.code) {
            errorMessage = `Product code "${code}" already exists`;
          } else {
            errorMessage = 'Product already exists (Duplicate entry)';
          }
        }

        results.errors.push({
          row: rowNumber,
          error: errorMessage
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Upload completed. ${results.success.length} rows processed, ${results.skippedDuplicates.length} duplicates skipped, ${results.errors.length} errors`,
      data: {
        successCount: results.success.length,
        skippedDuplicateCount: results.skippedDuplicates.length,
        errorCount: results.errors.length,
        successes: results.success,
        skippedDuplicates: results.skippedDuplicates,
        errors: results.errors
      }
    });
  } catch (error) {
    console.error('Product upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing Excel file',
      error: error.message
    });
  }
};

exports.downloadProductExcelTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products Import');

    worksheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Unit', key: 'unit', width: 12 },
      { header: 'Opening Stock', key: 'opening_stock', width: 15 },
      { header: 'Purchase Price', key: 'purchase_price', width: 15 },
      { header: 'Sale Price', key: 'sale_price', width: 12 },
      { header: 'Min. Sale Price', key: 'min_sale_price', width: 16 },
      { header: 'MRP', key: 'mrp', width: 12 },
      { header: 'Brand - Design Number - Size', key: 'design_number', width: 32 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'HSN Code', key: 'hsn_code', width: 12 },
      { header: 'GST Tax Rate', key: 'gst_tax_rate', width: 16 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Reorder Limit', key: 'reorder_limit', width: 15 },
      { header: 'Barcode', key: 'barcode', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
    });

    worksheet.addRow({
      category: 'Electronics',
      brand: 'Samsung',
      unit: 'Piece',
      opening_stock: 25,
      purchase_price: 45000,
      sale_price: 52000,
      min_sale_price: 50000,
      mrp: 55000,
      design_number: 'Samsung - DG-001 - 128GB',
      color: 'Black',
      hsn_code: '85171200',
      gst_tax_rate: 18,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Electronics',
      brand: 'Samsung',
      unit: 'Piece',
      opening_stock: 10,
      purchase_price: 52000,
      sale_price: 59000,
      min_sale_price: 56000,
      mrp: 62000,
      design_number: 'Samsung - DG-002 - 256GB',
      color: 'Green',
      hsn_code: '85171200',
      gst_tax_rate: 18,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Electronics',
      brand: 'Samsung',
      unit: 'Piece',
      opening_stock: 0,
      purchase_price: 60000,
      sale_price: 69000,
      min_sale_price: 65000,
      mrp: 72000,
      design_number: 'Samsung - DG-003 - 512GB',
      color: 'Cream',
      hsn_code: '85171200',
      gst_tax_rate: 18,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Electronics',
      brand: 'Samsung',
      unit: 'Piece',
      opening_stock: 0,
      purchase_price: 60000,
      sale_price: 69000,
      min_sale_price: 65000,
      mrp: 72000,
      design_number: 'Samsung - DG-004 - 512GB',
      color: 'Lavender',
      hsn_code: '85171200',
      gst_tax_rate: 18,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Furniture',
      brand: 'Ikea',
      unit: 'Piece',
      opening_stock: 50,
      purchase_price: 2000,
      sale_price: 2500,
      min_sale_price: 0,
      mrp: 2800,
      design_number: 'Ikea - CH-101 - Standard',
      color: 'Black',
      hsn_code: '94013000',
      gst_tax_rate: 18,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Home & Living',
      brand: 'Raymond',
      unit: 'Piece',
      opening_stock: 30,
      purchase_price: 500,
      sale_price: 650,
      min_sale_price: 0,
      mrp: 700,
      design_number: 'Raymond - BS-201 - King',
      color: 'Blue',
      hsn_code: '63029300',
      gst_tax_rate: 12,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    worksheet.addRow({
      category: 'Stationery',
      brand: 'Classmate',
      unit: 'Dozen',
      opening_stock: 100,
      purchase_price: 120,
      sale_price: 150,
      min_sale_price: 0,
      mrp: 180,
      design_number: 'Classmate - NB-01 - A4',
      color: 'Multi',
      hsn_code: '48201090',
      gst_tax_rate: 5,
      discount: '',
      reorder_limit: '',
      barcode: ''
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=product_upload_template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating product template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: error.message
    });
  }
};

exports.exportProductsExcel = async (req, res) => {
  try {
    const { search = '', ids = '' } = req.query;

    const query = {};
    const selectedIds = String(ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (selectedIds.length > 0) {
      query._id = { $in: selectedIds };
    }
    if (!query._id && search && String(search).trim() !== '') {
      const searchRegex = new RegExp(String(search).trim(), 'i');

      const productSearch = {
        $or: [
          { name: searchRegex },
          { code: searchRegex },
          { description: searchRegex },
          { barcode: searchRegex }
        ]
      };

      const [matchingBrands, matchingCategories] = await Promise.all([
        Brand.find({ brand_name: searchRegex }).select('_id'),
        Category.find({ category_name: searchRegex }).select('_id')
      ]);

      const brandIds = matchingBrands.map(b => b._id);
      const categoryIds = matchingCategories.map(c => c._id);

      query.$or = [
        productSearch,
        brandIds.length ? { brand: { $in: brandIds } } : null,
        categoryIds.length ? { category: { $in: categoryIds } } : null
      ].filter(Boolean);
    }

    const products = await Product.find(query)
      .populate({ path: 'brand', select: 'brand_name' })
      .populate({ path: 'category', select: 'category_name' })
      .populate({ path: 'unit', select: 'unit_name short_name name symbol' })
      .populate({ path: 'tax', select: 'tax_rate_ids', populate: { path: 'tax_rate_ids', select: 'tax_rate' } })
      .sort({ createdAt: -1 })
      .lean();

    const productIds = products.map(p => p._id);
    const variants = productIds.length
      ? await ProductVariant.find({ productId: { $in: productIds } }).lean()
      : [];
    const variantIds = variants.map(v => v._id);

    const inventories = variantIds.length
      ? await Inventory.find({ variantId: { $in: variantIds }, isDeleted: false }).select('variantId quantity').lean()
      : [];

    const variantsByProduct = new Map();
    variants.forEach(v => {
      const key = String(v.productId);
      if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
      variantsByProduct.get(key).push(v);
    });

    const inventoryByVariant = new Map();
    inventories.forEach(inv => {
      inventoryByVariant.set(String(inv.variantId), Number(inv.quantity || 0));
    });
    const workbook = new ExcelJS.Workbook();

    const getTaxRate = (product) => {
      const taxRates = product?.tax?.tax_rate_ids || [];
      if (!Array.isArray(taxRates)) return 0;
      return taxRates.reduce((sum, r) => sum + Number(r?.tax_rate || 0), 0);
    };

    const exportRows = [];

    products.forEach((product) => {
      const brand = product?.brand?.brand_name || '';
      const category = product?.category?.category_name || '';
      const unit =
        product?.unit?.unit_name ||
        product?.unit?.short_name ||
        product?.unit?.name ||
        '';
      const hsn_code = product?.hsn_code || '';
      const gst_tax_rate = getTaxRate(product);

      const productVariants = variantsByProduct.get(String(product._id)) || [];

      if (productVariants.length === 0) {
        exportRows.push({
          category,
          brand,
          unit,
          opening_stock: '',
          purchase_price: '',
          sale_price: '',
          min_sale_price: '',
          mrp: '',
          design_number: '',
          color: '',
          hsn_code,
          gst_tax_rate,
          discount: '',
          reorder_limit: '',
          barcode: ''
        });
        return;
      }

      productVariants.forEach((variant) => {
        const openingStock = inventoryByVariant.get(String(variant._id));
        exportRows.push({
          category,
          brand,
          unit,
          opening_stock: openingStock ?? '',
          purchase_price: variant.purchase_price ?? '',
          sale_price: variant.sale_price ?? '',
          min_sale_price: variant.min_sale_price ?? '',
          mrp: variant.mrp ?? '',
          design_number: formatBrandDesignSize({
            brand,
            designNo: variant.designNo,
            size: variant.size,
          }),
          color: variant.color || '',
          hsn_code,
          gst_tax_rate,
          discount: Number(variant.discount_value || 0) > 0 ? Number(variant.discount_value) : '',
          reorder_limit: Number(variant.reorder_limit || 0) > 0 ? Number(variant.reorder_limit) : '',
          barcode: variant.barcode || ''
        });
      });
    });

    await buildProductsExportWorksheet({ workbook, rows: exportRows, sheetName: 'Products Export' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting products',
      error: error.message
    });
  }
};

exports.exportProductVariantsExcel = async (req, res) => {
  try {
    const { search = '', ids = '' } = req.query;

    const selectedIds = String(ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const trimmedSearch = String(search || '').trim();
    const searchRegex = trimmedSearch ? new RegExp(trimmedSearch, 'i') : null;

    let matchingProductIds = [];
    if (searchRegex) {
      const matchingBrands = await Brand.find({ brand_name: searchRegex }).select('_id');
      const matchingBrandIds = matchingBrands.map((brand) => brand._id);

      if (matchingBrandIds.length) {
        matchingProductIds = await Product.find({ brand: { $in: matchingBrandIds } }).distinct('_id');
      }
    }

    const variantQuery = {};
    if (selectedIds.length > 0) {
      variantQuery._id = { $in: selectedIds };
    } else if (searchRegex) {
      variantQuery.$or = [
        { designNo: searchRegex },
        { color: searchRegex },
        { size: searchRegex },
        { barcode: searchRegex },
        ...(matchingProductIds.length ? [{ productId: { $in: matchingProductIds } }] : []),
      ];
    }

    const variants = await ProductVariant.find(variantQuery)
      .populate({
        path: 'productId',
        select: 'hsn_code category brand unit tax',
        populate: [
          { path: 'category', select: 'category_name' },
          { path: 'brand', select: 'brand_name' },
          { path: 'unit', select: 'unit_name short_name name symbol' },
          { path: 'tax', select: 'tax_rate_ids', populate: { path: 'tax_rate_ids', select: 'tax_rate' } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const variantIds = variants.map((variant) => variant._id);
    const inventories = variantIds.length
      ? await Inventory.find({ variantId: { $in: variantIds }, isDeleted: false }).select('variantId quantity').lean()
      : [];

    const inventoryByVariant = new Map();
    inventories.forEach((inventory) => {
      inventoryByVariant.set(String(inventory.variantId), Number(inventory.quantity || 0));
    });

    const getTaxRate = (product) => {
      const taxRates = product?.tax?.tax_rate_ids || [];
      if (!Array.isArray(taxRates)) return 0;
      return taxRates.reduce((sum, rate) => sum + Number(rate?.tax_rate || 0), 0);
    };

    const rows = variants.map((variant) => {
      const product = variant?.productId || {};
      const brand = product?.brand?.brand_name || '';
      const category = product?.category?.category_name || '';
      const unit = product?.unit?.unit_name || product?.unit?.short_name || product?.unit?.name || '';

      return {
        category,
        brand,
        unit,
        opening_stock: inventoryByVariant.get(String(variant._id)) ?? '',
        purchase_price: variant.purchase_price ?? '',
        sale_price: variant.sale_price ?? '',
        min_sale_price: variant.min_sale_price ?? '',
        mrp: variant.mrp ?? '',
        design_number: formatBrandDesignSize({
          brand,
          designNo: variant.designNo,
          size: variant.size,
        }),
        color: variant.color || '',
        hsn_code: product?.hsn_code || '',
        gst_tax_rate: getTaxRate(product),
        discount: Number(variant.discount_value || 0) > 0 ? Number(variant.discount_value) : '',
        reorder_limit: Number(variant.reorder_limit || 0) > 0 ? Number(variant.reorder_limit) : '',
        barcode: variant.barcode || '',
      };
    });

    const workbook = new ExcelJS.Workbook();
    await buildProductsExportWorksheet({ workbook, rows, sheetName: 'Product Variants Export' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_variants_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting product variants:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting product variants',
      error: error.message,
    });
  }
};

exports.exportDraftProductsExcel = async (req, res) => {
  try {
    const { categoryName = '', brandName = '', unitName = '', hsnCode = '', taxGroupId = '', gstTaxRate = '', variants = [] } = req.body || {};

    if (!String(categoryName).trim() || !String(brandName).trim()) {
      return res.status(400).json({ success: false, message: 'Category and Brand are required' });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one variant is required' });
    }

    let resolvedGstRate = Number(gstTaxRate || 0);
    if ((!resolvedGstRate || resolvedGstRate < 0) && taxGroupId && mongoose.Types.ObjectId.isValid(String(taxGroupId))) {
      const taxGroup = await TaxGroup.findById(taxGroupId)
        .populate({ path: 'tax_rate_ids', select: 'tax_rate' })
        .lean();
      const taxRates = taxGroup?.tax_rate_ids || [];
      resolvedGstRate = Array.isArray(taxRates)
        ? taxRates.reduce((sum, rate) => sum + Number(rate?.tax_rate || 0), 0)
        : 0;
    }

    const rows = variants.map((variant) => ({
      category: String(categoryName || '').trim(),
      brand: String(brandName || '').trim(),
      unit: String(unitName || '').trim(),
      opening_stock: Number(variant.opening_stock || 0) > 0 ? Number(variant.opening_stock) : '',
      purchase_price: Number(variant.purchase_price || 0) > 0 ? Number(variant.purchase_price) : '',
      sale_price: Number(variant.sale_price || 0) > 0 ? Number(variant.sale_price) : '',
      min_sale_price: Number(variant.min_sale_price || 0) > 0 ? Number(variant.min_sale_price) : 0,
      mrp: Number(variant.mrp || 0) > 0 ? Number(variant.mrp) : '',
      design_number: formatBrandDesignSize({
        brand: brandName,
        designNo: variant.designNo,
        size: variant.size,
      }),
      color: String(variant.color || '').trim(),
      hsn_code: String(hsnCode || '').trim(),
      gst_tax_rate: resolvedGstRate || '',
      discount: Number(variant.discount_value || 0) > 0 ? Number(variant.discount_value) : '',
      reorder_limit: Number(variant.reorder_limit || 0) > 0 ? Number(variant.reorder_limit) : '',
      barcode: String(variant.barcode || '').trim()
    }));

    const workbook = new ExcelJS.Workbook();
    await buildProductsExportWorksheet({ workbook, rows, sheetName: 'Products Export' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products_draft_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting draft products:', error);
    res.status(500).json({ success: false, message: 'Error exporting draft products', error: error.message });
  }
};
