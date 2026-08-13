const Inventory = require('@models/Inventory');
const Product = require('@models/Product');
const ProductVariant = require('@models/ProductVariant')
const Unit = require('@models/Unit');
const mongoose = require('mongoose');

const listInventory = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, all = 'false' } = req.query;
    const userId = req.user; // from auth middleware

    const query = {
      isDeleted: false
    };

    // Optional search filter by product name or SKU
    if (search) {
      const productIds = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      // Find matching variants
      const variantIds = await ProductVariant.find({
        $or: [
          { designNo: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } },
          { size: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } }
        ]
      }).distinct("_id");

      query.$or = [
        { productId: { $in: productIds } },
        { variantId: { $in: variantIds } }
      ];
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const fetchAll = String(all).toLowerCase() === 'true' || limitNumber === 0;
    const skip = (pageNumber - 1) * limitNumber;

    // Aggregate with multiple lookups to fetch product details and unit information
    const inventoryList = await Inventory.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true
        }
      },

      // Join Variant Details
      {
        $lookup: {
          from: "productvariants",
          localField: "variantId",
          foreignField: "_id",
          as: "variantDetails"
        }
      },
      {
        $unwind: {
          path: "$variantDetails",
          preserveNullAndEmptyArrays: true
      }
    },
      {
        $lookup: {
          from: 'products',
          localField: 'variantDetails.productId',
          foreignField: '_id',
          as: 'variantProductDetails'
        }
      },
      {
        $addFields: {
          productDetails: {
            $ifNull: [
              '$productDetails',
              { $arrayElemAt: ['$variantProductDetails', 0] }
            ]
          }
        }
      },
      { $unset: 'variantProductDetails' },

      // Lookup to get unit details from unit model - CORRECTED FIELD NAME
      {
        $lookup: {
          from: 'units',
          localField: 'productDetails.unit', // Changed from unitId to unit
          foreignField: '_id',
          as: 'unitDetails'
        }
      },
      {
        $unwind: {
          path: '$unitDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          productId: 1,
          variantId: 1,
          quantity: 1,
          createdAt: 1,
          notes: 1,

          productDetails: {
            _id: '$productDetails._id',
            // item_type: '$productDetails.item_type',
            name: '$productDetails.name',
            code: '$productDetails.code',
            // selling_price: '$productDetails.selling_price',
            // purchase_price: '$productDetails.purchase_price',
            // alert_quantity: '$productDetails.alert_quantity',
            product_image: {
              $cond: {
                if: { $ne: ['$productDetails.product_image', null] },
                then: {
                  $concat: [
                    process.env.BASE_URL || 'http://localhost:3000',
                    '$productDetails.product_image'
                  ]
                },
                else: null
              }
            },
            unit_name: '$unitDetails.short_name', // Get unit_name from unit model
            // status: '$productDetails.status'
          },


          // VARIANT FIELDS
          variantDetails: {
            _id: "$variantDetails._id",
            designNo: "$variantDetails.designNo",
            size: "$variantDetails.size",
            color: "$variantDetails.color",
            sale_price: "$variantDetails.sale_price",
            purchase_price: "$variantDetails.purchase_price",
          }
        }
      },
      { $sort: { createdAt: -1 } },
      ...(fetchAll ? [] : [{ $skip: skip }, { $limit: limitNumber }])
    ]);

    // Total count for pagination
    const totalCount = await Inventory.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Inventory list fetched successfully',
      data: inventoryList,
      pagination: {
        total: totalCount,
        page: fetchAll ? 1 : pageNumber,
        limit: fetchAll ? totalCount : limitNumber,
        totalPages: fetchAll ? (totalCount ? 1 : 0) : Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (err) {
    console.error('Error fetching inventory list:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory list',
      error: err.message
    });
  }
};

const getInventoryHistory = async (req, res) => {
  try {
    const { id } = req.params; // inventory ID from URL parameter

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inventory ID'
      });
    }

      const inventory = await Inventory.findById(id)
        .populate({
          path: 'inventory_history.createdBy',
          select: 'name email',
          model: 'User'
        })
        .populate({
          path: 'productId',
          select: 'name code unit',
          model: 'Product',
          populate: { // populate unit from product
            path: 'unit',
            select: 'unit_name',
            model: 'Unit'
          }
        })
        .populate({
          path: 'variantId',
          select: 'designNo color size productId',
          model: 'ProductVariant',
          populate: {
            path: 'productId',
            select: 'name code unit',
            model: 'Product',
            populate: {
              path: 'unit',
              select: 'unit_name',
              model: 'Unit'
            }
          }
        })
        .select('inventory_history productId variantId quantity isDeleted');

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found'
      });
    }

    if (inventory.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Inventory has been deleted'
      });
    }

    const resolvedProduct = inventory.productId || inventory.variantId?.productId || null;
    const defaultUnitName = resolvedProduct?.unit?.unit_name || null;

    const historyData = await Promise.all(
      inventory.inventory_history.map(async (history) => {
        let unitName = defaultUnitName;

        if (history.unitId && mongoose.Types.ObjectId.isValid(history.unitId)) {
          const unit = await Unit.findById(history.unitId).select('unit_name');
          if (unit) {
            unitName = unit.unit_name;
          }
        }

        return {
          _id: history._id,
          unitId: history.unitId,
          unitName, // Added unit name here
          quantity: history.quantity,
          notes: history.notes,
          type: history.type,
          adjustment: history.adjustment,
          referenceId: history.referenceId,
          referenceType: history.referenceType,
          createdBy: history.createdBy
            ? {
              _id: history.createdBy._id,
              name: history.createdBy.name,
              email: history.createdBy.email
            }
            : null,
          createdAt: history.createdAt,
          updatedAt: history.updatedAt
        };
      })
    );

    historyData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(200).json({
        success: true,
        message: 'Inventory history fetched successfully',
        data: {
          inventoryId: inventory._id,
          productId: resolvedProduct
            ? {
                _id: resolvedProduct._id,
                name: resolvedProduct.name,
                code: resolvedProduct.code,
                unitName: defaultUnitName
              }
            : null,
          variantDetails: inventory.variantId
            ? {
                _id: inventory.variantId._id,
                designNo: inventory.variantId.designNo,
                color: inventory.variantId.color,
                size: inventory.variantId.size
              }
            : null,
          currentQuantity: inventory.quantity,
          history: historyData
        }
      });
  } catch (err) {
    console.error('Error fetching inventory history:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory history',
      error: err.message
    });
  }
};


const updateStock = async (req, res) => {
  try {
    const { productId, variantId, quantity, type, notes } = req.body;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid variantId' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
    }

    if (!['stock_in', 'stock_out', 'adjustment'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid stock update type' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variant = await ProductVariant.findById(variantId);
    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }


    // Detect if inventory exists already
    let inventory = await Inventory.findOne({ productId, variantId, userId, isDeleted: false });

    if (!inventory) {
      inventory = new Inventory({
        productId,
        variantId,       // NEW
        quantity: 0,
        // quantity,     // NEW
        userId,
        inventory_history: [],
        notes: ''
      });
    }

    const previousQuantity = inventory.quantity;
    let adjustmentValue = quantity;

    if (type === 'stock_in') {
      inventory.quantity += quantity;
    } else if (type === 'stock_out') {
      if (inventory.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Not enough stock to remove',
          currentStock: inventory.quantity,
          requested: quantity
        });
      }
      inventory.quantity -= quantity;
      adjustmentValue = -quantity;
    } else if (type === 'adjustment') {
      inventory.quantity += quantity;
    }

    inventory.inventory_history.push({
      unitId: product.unit || null,
      quantity: previousQuantity,
      notes: notes || `${type.replace('_', ' ').toUpperCase()} performed`,
      type,
      adjustment: adjustmentValue,
      referenceId: null,
      referenceType: 'adjustment',
      createdBy: userId
    });

    await inventory.save();

    return res.status(200).json({
      success: true,
      message: inventory.isNew
        ? 'Inventory created and stock added successfully'
        : 'Stock updated successfully',
      data: {
        _id: inventory._id,
        productId: inventory.productId,
        previousQuantity: previousQuantity,
        newQuantity: inventory.quantity,
        adjustment: adjustmentValue,
        type
      }
    });

  } catch (err) {
    console.error('Error updating stock:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: err.message
    });
  }
};


//     // CASE A: Inventory is NEW (initial create)


//     // CASE B: Inventory EXISTS (treat this as a real stock movement)

//     // Update variant and inventory as per stock_in / stock_out / adjustment rules


module.exports =
{
  listInventory,
  getInventoryHistory,
  updateStock,
};
