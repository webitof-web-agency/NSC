const mongoose = require('mongoose');
const Product = require('@models/Product');
const Inventory = require('@models/Inventory');
const Unit = require('@models/Unit');
const Category = require('@models/Category');
const ProductVariant = require('@models/ProductVariant');

// const getInventoryStockSummary = async (req, res) => {
//   try {
//     const { search = '', startDate, endDate, prevStartDate, prevEndDate } = req.query;
//     const userId = req.user;

//     // Base query
//     const query = {
//       isDeleted: false
//     };

//     // Search filter
//     if (search) {
//       const productIds = await Product.find({
//         $or: [
//           { name: { $regex: search, $options: 'i' } },
//           { sku: { $regex: search, $options: 'i' } }
//         ]
//       }).distinct('_id');

//       query.productId = { $in: productIds };
//     }

//     // Date filter (current period)
//     if (startDate && endDate) {
//       query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
//     }

//     // === Get Current Period Data ===
//     const inventoryData = await Inventory.aggregate([
//       { $match: query },
//       {
//         $lookup: {
//           from: 'products',
//           localField: 'productId',
//           foreignField: '_id',
//           as: 'productDetails'
//         }
//       },
//       { $unwind: '$productDetails' },
//       {
//         $project: {
//           productId: 1,
//           quantity: 1,
//           'productDetails.name': 1,
//           'productDetails.sku': 1,
//           'productDetails.alert_quantity': 1,
//           'productDetails.purchase_price': 1,
//           'productDetails.selling_price': 1,
//           'productDetails.status': 1,
//           'productDetails.category': 1,
//           'productDetails.unit': 1,
//           'productDetails.product_image': 1
//         }
//       }
//     ]);

//     // === Calculate Summary ===
//     let totalStockValue = 0;
//     let lowStockItems = 0;
//     let outOfStockItems = 0;

//     inventoryData.forEach(item => {
//       totalStockValue += (item.quantity || 0) * (item.productDetails?.purchase_price || 0);

//       if (item.quantity === 0) outOfStockItems++;
//       if (item.quantity > 0 && item.quantity <= (item.productDetails?.alert_quantity || 0))
//         lowStockItems++;
//     });

//     // Placeholder for pending reorders
//     const pendingReorders = 0;

//     // === Get Previous Period Data (for percentage change) ===
//     let percentageChange = {
//       totalStockValue: { change: 0, direction: 'neutral' },
//       lowStockItems: { change: 0, direction: 'neutral' },
//       outOfStockItems: { change: 0, direction: 'neutral' },
//       pendingReorders: { change: 0, direction: 'neutral' }
//     };

//     if (prevStartDate && prevEndDate) {
//       const prevQuery = { ...query, createdAt: { $gte: new Date(prevStartDate), $lte: new Date(prevEndDate) } };

//       const prevInventoryData = await Inventory.aggregate([
//         { $match: prevQuery },
//         {
//           $lookup: {
//             from: 'products',
//             localField: 'productId',
//             foreignField: '_id',
//             as: 'productDetails'
//           }
//         },
//         { $unwind: '$productDetails' }
//       ]);

//       let prevStockValue = 0;
//       let prevLowStock = 0;
//       let prevOutStock = 0;

//       prevInventoryData.forEach(item => {
//         prevStockValue += (item.quantity || 0) * (item.productDetails?.purchase_price || 0);
//         if (item.quantity === 0) prevOutStock++;
//         if (item.quantity > 0 && item.quantity <= (item.productDetails?.alert_quantity || 0))
//           prevLowStock++;
//       });

//       const calcChange = (current, previous) => {
//         if (previous === 0 && current === 0) return { change: 0, direction: 'neutral' };
//         if (previous === 0) return { change: 100, direction: 'up' };
//         const change = ((current - previous) / previous) * 100;
//         return { change: Math.round(change), direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' };
//       };

//       percentageChange = {
//         totalStockValue: calcChange(totalStockValue, prevStockValue),
//         lowStockItems: calcChange(lowStockItems, prevLowStock),
//         outOfStockItems: calcChange(outOfStockItems, prevOutStock),
//         pendingReorders: { change: 0, direction: 'neutral' }
//       };
//     }

//     // === Prepare Data List ===
//     const dataList = inventoryData.map(item => ({
//       _id: item._id,
//       type: 'product',
//       name: item.productDetails?.name || '',
//       sku: item.productDetails?.sku || '',
//       quantity: item.quantity || 0,
//       sellingPrice: item.productDetails?.selling_price || 0,
//       purchasePrice: item.productDetails?.purchase_price || 0,
//       alertQuantity: item.productDetails?.alert_quantity || 0,
//       status: item.productDetails?.status || 'inactive',
//       productImage: item.productDetails?.product_image || '',
//       category: item.productDetails?.category || '',
//       unit: item.productDetails?.unit || ''
//     }));

//     // === Final Response ===
//     res.status(200).json({
//       success: true,
//       message: 'Inventory Stock Summary fetched successfully',
//       total: {
//         totalStockValue,
//         lowStockItems,
//         outOfStockItems,
//         pendingReorders
//       },
//       percentageChange,
//       data: dataList
//     });
//   } catch (error) {
//     console.error('Error generating inventory stock summary:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error generating inventory stock summary',
//       error: error.message
//     });
//   }
// };

const getInventoryStockSummary = async (req, res) => {
  try {
    const { search = '', startDate, endDate, prevStartDate, prevEndDate } = req.query;

    const matchQuery = { isDeleted: false };

    // ---------- SEARCH ----------
    if (search) {
      const productIds = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      const variantIds = await ProductVariant.find({
        $or: [
          { designNo: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } },
          { size: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      matchQuery.$or = [
        { productId: { $in: productIds } },
        { variantId: { $in: variantIds } }
      ];
    }

    // ---------- DATE FILTER ----------
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // ---------- AGGREGATION ----------
    const inventoryData = await Inventory.aggregate([
      { $match: matchQuery },

      // Product
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },

      // Variant
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },

      // Category
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

      // Unit
      {
        $lookup: {
          from: 'units',
          localField: 'product.unit',
          foreignField: '_id',
          as: 'unit'
        }
      },
      { $unwind: { path: '$unit', preserveNullAndEmptyArrays: true } },

      // ---------- COMPUTED ----------
      {
        $addFields: {
          purchasePrice: {
            $ifNull: ['$variant.purchase_price', '$product.purchase_price']
          },
          sellingPrice: {
            $ifNull: ['$variant.sale_price', '$product.selling_price']
          },
          stockValue: {
            $multiply: [
              '$quantity',
              { $ifNull: ['$variant.purchase_price', '$product.purchase_price'] }
            ]
          },
          alertQuantity: {
            $ifNull: ['$variant.reorder_limit', 0]
          }
        }
      },

      {
        $project: {
          _id: 1,
          quantity: 1,
          stockValue: 1,

          name: '$product.name',
          sku: '$product.code',
          alertQuantity: '$product.alert_quantity',
          sellingPrice: 1,
          purchasePrice: 1,

          category: '$category.category_name',
          unit: '$unit.short_name',

          variant: {
            designNo: '$variant.designNo',
            color: '$variant.color',
            size: '$variant.size'
          }
        }
      }
    ]);

    // ---------- SUMMARY ----------
    let totalStockValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    inventoryData.forEach(item => {
      totalStockValue += item.stockValue || 0;

      if (item.quantity === 0) outOfStockItems++;
      if (item.quantity > 0 && item.quantity <= item.alertQuantity) {
        lowStockItems++;
      }
    });

    res.status(200).json({
      success: true,
      message: 'Inventory Stock Summary fetched successfully',
      total: {
        totalStockValue,
        lowStockItems,
        outOfStockItems,
        pendingReorders: 0
      },
      data: inventoryData
    });

  } catch (error) {
    console.error('Error generating inventory stock summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating inventory stock summary',
      error: error.message
    });
  }
};

// const getInventoryReport = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search = '', startDate, endDate } = req.query;
//     const skip = (Number(page) - 1) * Number(limit);

//     // Product search filter
//     const productFilter = {
//       status: true,
//       ...(search
//         ? {
//             $or: [
//               { name: { $regex: search, $options: 'i' } },
//               { code: { $regex: search, $options: 'i' } },
//             ],
//           }
//         : {}),
//     };

//     // ----------------------------
//     // 1. Aggregation for totals
//     // ----------------------------
//     const totalsAgg = await Product.aggregate([
//       { $match: productFilter },
//       {
//         $lookup: {
//           from: "inventories",
//           let: { productId: "$_id" },
//           pipeline: [
//             { $match: { $expr: { $eq: ["$productId", "$$productId"] }, isDeleted: false } },
//             { $project: { quantity: 1, inventory_history: 1 } },
//           ],
//           as: "inventory",
//         },
//       },
//       {
//         $addFields: {
//           stockQty: { $ifNull: [{ $arrayElemAt: ["$inventory.quantity", 0] }, 0] },
//         },
//       },
//       {
//         $addFields: {
//           value: { $multiply: ["$stockQty", "$selling_price"] },
//           isLowStock: {
//             $cond: [
//               { $and: [{ $gt: ["$stockQty", 0] }, { $lte: ["$stockQty", "$alert_quantity"] }] },
//               1,
//               0,
//             ],
//           },
//           isOutOfStock: { $cond: [{ $eq: ["$stockQty", 0] }, 1, 0] },
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalValues: { $sum: "$value" },
//           lowStockItems: { $sum: "$isLowStock" },
//           outOfStockItems: { $sum: "$isOutOfStock" },
//           totalProducts: { $sum: 1 },
//         },
//       },
//     ]);

//     const totals = totalsAgg.length ? totalsAgg[0] : {
//       totalValues: 0,
//       lowStockItems: 0,
//       outOfStockItems: 0,
//       totalProducts: 0,
//     };

//     // ----------------------------
//     // 2. Paginated records
//     // ----------------------------
//     const products = await Product.find(productFilter)
//       .populate('unit', 'unit_name short_name')
//       .populate('category', 'category_name slug category_image status')
//       .skip(skip)
//       .limit(Number(limit))
//       .lean();

//     // Instead of querying all inventories, just fetch for current page products
//     const productIds = products.map((p) => p._id);
//     const inventories = await Inventory.find({
//       productId: { $in: productIds },
//       isDeleted: false,
//     }).lean();

//     const inventoryMap = {};
//     inventories.forEach((inv) => {
//       inventoryMap[inv.productId.toString()] = inv;
//     });

//     // Map products with inventory info
//     const data = products.map((product) => {
//       const inventoryInfo = inventoryMap[product._id.toString()] || null;
//       const stockQty = inventoryInfo ? inventoryInfo.quantity : 0;

//       return {
//         _id: product._id,
//         type: product.item_type.toLowerCase(),
//         name: product.name,
//         sku: product.code,
//         sellingPrice: product.selling_price,
//         purchasePrice: product.purchase_price,
//         alertQuantity: product.alert_quantity,
//         thumbnail: product.product_image
//           ? `${process.env.BASE_URL}${product.product_image}`
//           : null,
//         unit: product.unit ? product.unit.unit_name  : null,
//         categoryName: product.category
//           ? product.category.category_name
//           : '',
//         stock: inventoryInfo
//           ? stockQty
//           : 0,
//       };
//     });

//     // ----------------------------
//     // 3. Response
//     // ----------------------------
//     res.status(200).json({
//       success: true,
//       message: 'Inventory report fetched successfully',
//       filters: {
//         startDate: startDate || null,
//         endDate: endDate || null,
//         search: search || null,
//       },
//       data: {
//         totalValues: totals.totalValues,
//         lowStockItems: totals.lowStockItems,
//         outOfStockItems: totals.outOfStockItems,
//       },
//       records: data,
//       pagination: {
//         total: totals.totalProducts,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(totals.totalProducts / Number(limit)),
//       },
//     });
//   } catch (error) {
//     console.error('Error generating inventory report:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error generating inventory report',
//       error: error.message,
//     });
//   }
// };

const getInventoryReport = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const matchQuery = { isDeleted: false };

    // ---------- SEARCH ----------
    if (search) {
      const productIds = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      const variantIds = await ProductVariant.find({
        $or: [
          { designNo: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } },
          { size: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      matchQuery.$or = [
        { productId: { $in: productIds } },
        { variantId: { $in: variantIds } }
      ];
    }

    // ---------- AGGREGATION ----------
    const inventoryAgg = await Inventory.aggregate([
      { $match: matchQuery },

      // Product
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },

      // Category
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      },

      // Variant
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      {
        $unwind: {
          path: '$variant',
          preserveNullAndEmptyArrays: true
        }
      },

      // Unit
      {
        $lookup: {
          from: 'units',
          localField: 'product.unit',
          foreignField: '_id',
          as: 'unit'
        }
      },
      {
        $unwind: {
          path: '$unit',
          preserveNullAndEmptyArrays: true
        }
      },

      // ---------- COMPUTED FIELDS ----------
      {
        $addFields: {
          stock: '$quantity',
          sellingPrice: {
            $ifNull: ['$variant.sale_price', '$product.selling_price']
          },
          purchasePrice: {
            $ifNull: ['$variant.purchase_price', '$product.purchase_price']
          },
          stockValue: {
            $multiply: [
              '$quantity',
              { $ifNull: ['$variant.sale_price', '$product.selling_price'] }
            ]
          },
          isLowStock: {
            $cond: [
              {
                $and: [
                  { $gt: ['$quantity', 0] },
                  // { $lte: ['$quantity', '$product.alert_quantity'] }
                  {
                    $lte: [
                      '$quantity',
                      { $ifNull: ['$variant.reorder_limit', 0] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          },
          isOutOfStock: {
            $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
          }
        }
      },

      // ---------- PROJECT ----------
      {
        $project: {
          _id: 1,
          name: '$product.name',
          sku: '$product.code',
          type: { $toLower: '$product.item_type' },
          categoryName: '$category.category_name',
          unit: '$unit.short_name',
          purchasePrice: 1,
          sellingPrice: 1,
          stock: 1,
          stockValue: 1,
          isLowStock: 1,
          isOutOfStock: 1,

          // ✅ ADD VARIANT OBJECT
          variant: {
            _id: '$variant._id',
            designNo: '$variant.designNo',
            color: '$variant.color',
            size: '$variant.size'
          },

          thumbnail: {
            $cond: {
              if: { $ne: ['$product.product_image', null] },
              then: { $concat: [process.env.BASE_URL, '$product.product_image'] },
              else: null
            }
          }
        }
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) }
    ]);

    // ---------- TOTALS ----------
    // const totalsAgg = await Inventory.aggregate([
    //   { $match: matchQuery },
    //   {
    //     $lookup: {
    //       from: 'products',
    //       localField: 'productId',
    //       foreignField: '_id',
    //       as: 'product'
    //     }
    //   },
    //   { $unwind: '$product' },
    //   {
    //     $group: {
    //       _id: null,
    //       totalValues: {
    //         $sum: {
    //           $multiply: ['$quantity', '$product.selling_price']
    //         }
    //       },
    //       lowStockItems: {
    //         $sum: {
    //           $cond: [
    //             {
    //               $and: [
    //                 { $gt: ['$quantity', 0] },
    //                 { $lte: ['$quantity', '$product.alert_quantity'] }
    //               ]
    //             },
    //             1,
    //             0
    //           ]
    //         }
    //       },
    //       outOfStockItems: {
    //         $sum: {
    //           $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
    //         }
    //       }
    //     }
    //   }
    // ]);

    const totalsAgg = await Inventory.aggregate([
      { $match: matchQuery },

      // Product
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },

      // Variant
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      {
        $unwind: {
          path: '$variant',
          preserveNullAndEmptyArrays: true
        }
      },

      // ---------- COMPUTED ----------
      {
        $addFields: {
          sellingPrice: {
            $ifNull: ['$variant.sale_price', '$product.selling_price']
          }
        }
      },

      // ---------- GROUP ----------
      // {
      //   $group: {
      //     _id: null,

      //     totalValues: {
      //       $sum: {
      //         $multiply: ['$quantity', '$sellingPrice']
      //       }
      //     },

      //     lowStockItems: {
      //       $sum: {
      //         $cond: [
      //           {
      //             $and: [
      //               { $gt: ['$quantity', 0] },
      //               { $lte: ['$quantity', '$product.alert_quantity'] }
      //             ]
      //           },
      //           1,
      //           0
      //         ]
      //       }
      //     },

      //     outOfStockItems: {
      //       $sum: {
      //         $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
      //       }
      //     }
      //   }
      // }

      {
        $group: {
          _id: null,
          totalValues: {
            $sum: {
              $multiply: [
                '$quantity',
                { $ifNull: ['$variant.sale_price', '$product.selling_price'] }
              ]
            }
          },
          lowStockItems: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$quantity', 0] },
                    { $lte: ['$quantity', '$variant.reorder_limit'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          outOfStockItems: {
            $sum: {
              $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totals = totalsAgg[0] || {
      totalValues: 0,
      lowStockItems: 0,
      outOfStockItems: 0
    };

    const totalRecords = await Inventory.countDocuments(matchQuery);

    // ---------- RESPONSE ----------
    res.status(200).json({
      success: true,
      message: 'Inventory report fetched successfully',
      data: {
        totalValues: totals.totalValues,
        lowStockItems: totals.lowStockItems,
        outOfStockItems: totals.outOfStockItems
      },
      records: inventoryAgg,
      pagination: {
        total: totalRecords,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRecords / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating inventory report',
      error: error.message
    });
  }
};

const getBestSellerReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Date ranges for current and previous months
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // If custom date range provided, override filters
    const customDateFilter = startDate && endDate
      ? {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        }
      : null;

    // Search filter
    const productFilter = {
      status: true,
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { code: { $regex: search, $options: 'i' } },
            ],
          }
        : {}),
    };

    // Fetch products with pagination
    const products = await Product.find(productFilter)
      .populate('category', 'category_name')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalProducts = await Product.countDocuments(productFilter);

    // Get inventory data
    const productIds = products.map((p) => p._id);
    const inventories = await Inventory.find({
      productId: { $in: productIds },
      isDeleted: false,
    }).lean();

    // Map inventories by productId
    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[inv.productId.toString()] = inv;
    });

    // Metrics initialization
    let totalSalesCurrent = 0;
    let totalSalesPrevious = 0;

    const data = products.map((product) => {
      const inventoryInfo = inventoryMap[product._id.toString()] || null;
      const history = inventoryInfo?.inventory_history || [];

      // Filter history based on date ranges
      const filterHistory = (entries, start, end) =>
        entries.filter(
          (h) =>
            h.type === 'stock_out' &&
            new Date(h.createdAt) >= start &&
            new Date(h.createdAt) <= end
        );

      const currentHistory = customDateFilter
        ? history.filter(
            (h) =>
              h.type === 'stock_out' &&
              new Date(h.createdAt) >= new Date(startDate) &&
              new Date(h.createdAt) <= new Date(endDate)
          )
        : filterHistory(history, startOfCurrentMonth, endOfCurrentMonth);

      const previousHistory = customDateFilter
        ? []
        : filterHistory(history, startOfPreviousMonth, endOfPreviousMonth);

      const soldQtyCurrent = currentHistory.reduce(
        (sum, h) => sum + Math.abs(h.adjustment),
        0
      );
      const soldQtyPrevious = previousHistory.reduce(
        (sum, h) => sum + Math.abs(h.adjustment),
        0
      );

      const soldAmountCurrent = soldQtyCurrent * product.selling_price;
      const soldAmountPrevious = soldQtyPrevious * product.selling_price;

      totalSalesCurrent += soldAmountCurrent;
      totalSalesPrevious += soldAmountPrevious;

      return {
        sku: product.code,
        product: product.name,
        category: product.category?.category_name || 'N/A',
        sold_amount: soldAmountCurrent.toFixed(2),
        sold_quantity: soldQtyCurrent,
        due_date: currentHistory.length
          ? new Date(
              currentHistory[currentHistory.length - 1].createdAt
            ).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A',
        payment_mode: 'Cash', // You can adjust if payment mode is tracked in history
        image: product.product_image
          ? `${process.env.BASE_URL}${product.product_image}`
          : '',
      };
    });

    // Average sales
    const avgSalesCurrent =
      products.length > 0 ? totalSalesCurrent / products.length : 0;
    const avgSalesPrevious =
      products.length > 0 ? totalSalesPrevious / products.length : 0;

    // Determine change and direction
    const calcChange = (current, previous) => {
      if (previous === 0 && current === 0) return { change: '0.00', direction: 'neutral' };
      if (previous === 0 && current > 0) return { change: '100.00', direction: 'up' };
      const percent = (((current - previous) / previous) * 100).toFixed(2);
      return {
        change: percent,
        direction: current >= previous ? 'up' : 'down',
      };
    };

    const totalChange = calcChange(totalSalesCurrent, totalSalesPrevious);
    const avgChange = calcChange(avgSalesCurrent, avgSalesPrevious);

    // Highest selling product
    const highestProduct =
      data.length > 0
        ? data.reduce((max, p) =>
            parseFloat(p.sold_amount) > parseFloat(max.sold_amount) ? p : max
          ).product
        : 'N/A';

    // Response
    const response = {
      totalSales: {
        value: totalSalesCurrent.toFixed(2),
        previous: totalSalesPrevious.toFixed(2),
        change: totalChange.change,
        direction: totalChange.direction,
      },
      averageSales: {
        value: avgSalesCurrent.toFixed(2),
        previous: avgSalesPrevious.toFixed(2),
        change: avgChange.change,
        direction: avgChange.direction,
      },
      accessoriesSales: {
        value: '0.00',
        previous: '0.00',
        change: '100.00',
        direction: 'up',
      },
      highestProduct,
      pagination: {
        total: totalProducts,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalProducts / Number(limit)),
      },
      data,
    };

    res.status(200).json({
      success: true,
      message: 'Best seller report fetched',
      report: response,
    });
  } catch (error) {
    console.error('Error generating best seller report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating best seller report',
      error: error.message,
    });
  }
};

// const getLowStockReport = async (req, res) => {
//   try {
//     let { page = 1, limit = 10, search = '', startDate, endDate } = req.query;
//     page = Number(page);
//     limit = Number(limit);
//     const skip = (page - 1) * limit;

//     // Optional date range filter for inventory history
//     const customDateFilter = {};
//     if (startDate && endDate) {
//       customDateFilter.createdAt = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate),
//       };
//     }

//     // Product search filter
//     const productFilter = {
//       status: true,
//       ...(search
//         ? {
//             $or: [
//               { name: { $regex: search, $options: 'i' } },
//               { code: { $regex: search, $options: 'i' } },
//             ],
//           }
//         : {}),
//     };

//     // Fetch all products
//     const allProducts = await Product.find(productFilter)
//       .populate('unit', 'unit_name short_name')
//       .populate('category', 'category_name slug category_image status')
//       .lean();

//     const allProductIds = allProducts.map((p) => p._id);

//     // Fetch inventories
//     const allInventories = await Inventory.find({
//       productId: { $in: allProductIds },
//       isDeleted: false,
//     }).lean();

//     // Map inventories by productId
//     const inventoryMap = {};
//     allInventories.forEach((inv) => {
//       inventoryMap[inv.productId.toString()] = inv;
//     });

//     // Filter low stock + out of stock separately
//     const lowStockProducts = [];
//     let totalLowStock = 0;
//     let totalOutOfStock = 0;

//     for (const product of allProducts) {
//       const inventoryInfo = inventoryMap[product._id.toString()] || null;
//       const stockQty = inventoryInfo ? inventoryInfo.quantity : 0;

//       if (stockQty > 0 && stockQty <= product.alert_quantity) {
//         totalLowStock++;
//         lowStockProducts.push({ product, inventoryInfo, stockQty });
//       }

//       if (stockQty === 0) {
//         totalOutOfStock++;
//         // ❌ don't push into lowStockProducts here anymore
//       }
//     }

//     // Apply pagination only to low stock list
//     const paginatedProducts = lowStockProducts.slice(skip, skip + limit);

//     // Map for response
//     const data = paginatedProducts.map(({ product, stockQty }) => ({
//       _id: product._id,
//       type: product.item_type.toLowerCase(),
//       name: product.name,
//       sku: product.code,
//       sellingPrice: product.selling_price,
//       purchasePrice: product.purchase_price,
//       alertQuantity: product.alert_quantity,
//       thumbnail: product.product_image
//         ? `${process.env.BASE_URL}${product.product_image}`
//         : '',
//       unit: product.unit ? product.unit.unit_name : null,
//       categoryName: product.category.category_name ?? "",
//       stock: stockQty,
//     }));

//     res.status(200).json({
//       success: true,
//       message: 'Low stock report fetched successfully',
//       filters: {
//         startDate: startDate || null,
//         endDate: endDate || null,
//         search: search || null,
//       },
//       data: {
//         lowStockItems: totalLowStock,
//         outOfStockItems: totalOutOfStock,
//       },
//       // ✅ now records only shows low stock items, not out of stock
//       records: data,
//       pagination: {
//         total: lowStockProducts.length,
//         page,
//         limit,
//         totalPages: Math.ceil(lowStockProducts.length / limit),
//       },
//     });
//   } catch (error) {
//     console.error('Error generating low stock report:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error generating low stock report',
//       error: error.message,
//     });
//   }
// };

const getLowStockReport = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '' } = req.query;
    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const matchQuery = { isDeleted: false };

    // ---------- SEARCH ----------
    if (search) {
      const productIds = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      const variantIds = await ProductVariant.find({
        $or: [
          { designNo: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } },
          { size: { $regex: search, $options: 'i' } },
        ]
      }).distinct('_id');

      matchQuery.$or = [
        { productId: { $in: productIds } },
        { variantId: { $in: variantIds } }
      ];
    }

    // ---------- AGGREGATION ----------
    const inventoryAgg = await Inventory.aggregate([
      { $match: matchQuery },

      // Product
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },

      // Category
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      },

      // Variant
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },

      // Unit
      {
        $lookup: {
          from: 'units',
          localField: 'product.unit',
          foreignField: '_id',
          as: 'unit'
        }
      },
      { $unwind: { path: '$unit', preserveNullAndEmptyArrays: true } },

      // ---------- LOW STOCK CONDITION ----------
      {
        $match: {
          $expr: {
            $and: [
              { $gt: ['$quantity', 0] },
              // { $lte: ['$quantity', '$product.alert_quantity'] }
              { $lte: ['$quantity', '$variant.reorder_limit'] }
            ]
          }
        }
      },

      // ---------- PROJECT ----------
      {
        $project: {
          _id: 1,
          name: '$product.name',
          sku: '$product.code',
          type: { $toLower: '$product.item_type' },
          // categoryName: '$product.category_name',
          categoryName: '$category.category_name',
          unit: '$unit.short_name',
          sellingPrice: {
            $ifNull: ['$variant.sale_price', '$product.selling_price']
          },
          purchasePrice: {
            $ifNull: ['$variant.purchase_price', '$product.purchase_price']
          },
          alertQuantity: '$product.alert_quantity',
          stock: '$quantity',

          variant: {
            designNo: '$variant.designNo',
            color: '$variant.color',
            size: '$variant.size'
          },

          thumbnail: {
            $cond: {
              if: { $ne: ['$product.product_image', null] },
              then: { $concat: [process.env.BASE_URL, '$product.product_image'] },
              else: null
            }
          }
        }
      },

      { $sort: { stock: 1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // ---------- COUNTS ----------
    const countsAgg = await Inventory.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          lowStockItems: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$quantity', 0] },
                    { $lte: ['$quantity', '$product.alert_quantity'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          outOfStockItems: {
            $sum: {
              $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    const counts = countsAgg[0] || { lowStockItems: 0, outOfStockItems: 0 };

    res.status(200).json({
      success: true,
      message: 'Low stock report fetched successfully',
      data: {
        lowStockItems: counts.lowStockItems,
        outOfStockItems: counts.outOfStockItems
      },
      records: inventoryAgg,
      pagination: {
        total: counts.lowStockItems,
        page,
        limit,
        totalPages: Math.ceil(counts.lowStockItems / limit)
      }
    });

  } catch (error) {
    console.error('Error generating low stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating low stock report',
      error: error.message
    });
  }
};

// const getOutStockReport = async (req, res) => {
//   try {
//     let { page = 1, limit = 10, search = '', startDate, endDate } = req.query;
//     page = Number(page);
//     limit = Number(limit);
//     const skip = (page - 1) * limit;

//     const customDateFilter = {};
//     if (startDate && endDate) {
//       customDateFilter.createdAt = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate),
//       };
//     }

//     // Product search filter
//     const productFilter = {
//       status: true,
//       ...(search
//         ? {
//             $or: [
//               { name: { $regex: search, $options: 'i' } },
//               { code: { $regex: search, $options: 'i' } },
//             ],
//           }
//         : {}),
//     };

//     // Fetch all products
//     const allProducts = await Product.find(productFilter)
//       .populate('unit', 'unit_name short_name')
//       .populate('category', 'category_name slug category_image status')
//       .lean();

//     const allProductIds = allProducts.map((p) => p._id);

//     // Fetch inventories
//     const allInventories = await Inventory.find({
//       productId: { $in: allProductIds },
//       isDeleted: false,
//     }).lean();

//     // Map inventories by productId
//     const inventoryMap = {};
//     allInventories.forEach((inv) => {
//       inventoryMap[inv.productId.toString()] = inv;
//     });

//     // Collect only out-of-stock products
//     const outOfStockProducts = [];
//     let totalOutOfStock = 0;

//     for (const product of allProducts) {
//       const inventoryInfo = inventoryMap[product._id.toString()] || null;
//       const stockQty = inventoryInfo ? inventoryInfo.quantity : 0;

//       if (stockQty === 0) {
//         totalOutOfStock++;
//         outOfStockProducts.push({ product, stockQty });
//       }
//     }

//     // Apply pagination only to out of stock
//     const paginatedProducts = outOfStockProducts.slice(skip, skip + limit);

//     // Map for response
//     const data = paginatedProducts.map(({ product, stockQty }) => ({
//       _id: product._id,
//       type: product.item_type.toLowerCase(),
//       name: product.name,
//       sku: product.code,
//       sellingPrice: product.selling_price,
//       purchasePrice: product.purchase_price,
//       alertQuantity: product.alert_quantity,
//       thumbnail: product.product_image
//         ? `${process.env.BASE_URL}${product.product_image}`
//         : '',
//       unit: product.unit ? product.unit.unit_name : null,
//       categoryName: product.category.category_name ?? "",
//       stock: stockQty,
//     }));

//     res.status(200).json({
//       success: true,
//       message: 'Out of stock report fetched successfully',
//       filters: {
//         startDate: startDate || null,
//         endDate: endDate || null,
//         search: search || null,
//       },
//       data: {
//         outOfStockItems: totalOutOfStock,
//       },
//       records: data,
//       pagination: {
//         total: outOfStockProducts.length,
//         page,
//         limit,
//         totalPages: Math.ceil(outOfStockProducts.length / limit),
//       },
//     });
//   } catch (error) {
//     console.error('Error generating out of stock report:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error generating out of stock report',
//       error: error.message,
//     });
//   }
// };

const getOutStockReport = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '' } = req.query;
    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const productFilter = {
      status: true,
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { code: { $regex: search, $options: 'i' } },
            ],
          }
        : {}),
    };

    // 1️⃣ Fetch products
    const products = await Product.find(productFilter)
      .populate('unit', 'short_name')
      .populate('category', 'category_name')
      .lean();

    const productIds = products.map(p => p._id);

    // 2️⃣ Fetch inventories
    const inventories = await Inventory.find({
      productId: { $in: productIds },
      isDeleted: false,
    }).lean();

    const inventoryMap = {};
    inventories.forEach(inv => {
      inventoryMap[inv.productId.toString()] = inv;
    });

    // 3️⃣ OUT OF STOCK = product quantity === 0
    const outOfStockProducts = products.filter(p => {
      const inv = inventoryMap[p._id.toString()];
      return !inv || inv.quantity === 0;
    });

    const paginated = outOfStockProducts.slice(skip, skip + limit);

    // 4️⃣ Fetch variants ONLY for display/prices
    const variants = await ProductVariant.find({
      productId: { $in: paginated.map(p => p._id) }
    }).lean();

    const variantMap = {};
    variants.forEach(v => {
      if (!variantMap[v.productId]) variantMap[v.productId] = [];
      variantMap[v.productId].push(v);
    });

    // 5️⃣ Map response
    const records = paginated.map(product => {
      const variant = variantMap[product._id]?.[0] || null;

      return {
        _id: product._id,
        type: product.item_type.toLowerCase(),
        name: product.name,
        sku: product.code,
        categoryName: product.category?.category_name || '',
        unit: product.unit?.short_name || '',
        purchasePrice: variant?.purchase_price ?? product.purchase_price,
        sellingPrice: variant?.sale_price ?? product.selling_price,
        stock: 0,

        variant: variant
          ? {
              designNo: variant.designNo,
              color: variant.color,
              size: variant.size,
            }
          : null,

        thumbnail: product.product_image
          ? `${process.env.BASE_URL}${product.product_image}`
          : null,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Out of stock report fetched successfully',
      records,
      pagination: {
        total: outOfStockProducts.length,
        page,
        limit,
        totalPages: Math.ceil(outOfStockProducts.length / limit),
      },
    });

  } catch (error) {
    console.error('Error generating out of stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating out of stock report',
      error: error.message,
    });
  }
};

const getStockHistoryReport = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '', startDate, endDate } = req.query;
    page = Number(page);
    limit = Number(limit);

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Apply date filters if provided
    const startFilter = startDate ? new Date(startDate) : startOfCurrentMonth;
    const endFilter = endDate ? new Date(endDate) : endOfCurrentMonth;

    // Helper for calculating percentage change
    const calculateChange = (previous, current) => {
      if (previous === 0 && current === 0) return 0;
      if (previous === 0) return 100;
      return Math.round(((Math.abs(current - previous)) / previous) * 100);
    };

    // Function to count stock movements
    const calculateStockTransactions = async (start, end) => {
      const pipeline = [
        { $unwind: '$inventory_history' },
        {
          $match: {
            'inventory_history.createdAt': { $gte: start, $lte: end },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$inventory_history.type',
            total: { $sum: 1 }
          }
        }
      ];
      const results = await Inventory.aggregate(pipeline);
      return results.reduce((acc, record) => {
        acc[record._id] = record.total;
        return acc;
      }, { stock_in: 0, stock_out: 0, adjustment: 0 });
    };

    // Get transactions for current and previous months
    const currentTransactions = await calculateStockTransactions(startOfCurrentMonth, endOfCurrentMonth);
    const previousTransactions = await calculateStockTransactions(startOfPreviousMonth, endOfPreviousMonth);

    const totalCurrent = currentTransactions.stock_in + currentTransactions.stock_out + currentTransactions.adjustment;
    const totalPrevious = previousTransactions.stock_in + previousTransactions.stock_out + previousTransactions.adjustment;

    // Build match query for products
    const matchQuery = { isDeleted: false };
    if (search) {
      matchQuery.$or = [
        { 'product.name': { $regex: search, $options: 'i' } },
        { 'product.code': { $regex: search, $options: 'i' } }
      ];
    }

    // Aggregate inventory with product details
    const inventoryData = await Inventory.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: startFilter, $lte: endFilter }
        }
      },
      {
        $project: {
          name: '$product.name',
          sku: '$product.code',
          sellingPrice: '$product.selling_price',
          categporyName: '$category.category_name',
          addedQuantity: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$inventory_history',
                    as: 'history',
                    cond: { $eq: ['$$history.type', 'stock_in'] }
                  }
                },
                as: 'stock',
                in: '$$stock.quantity'
              }
            }
          },
          soldQuantity: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$inventory_history',
                    as: 'history',
                    cond: { $eq: ['$$history.type', 'stock_out'] }
                  }
                },
                as: 'stock',
                in: '$$stock.quantity'
              }
            }
          },
          defectiveQuantity: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$inventory_history',
                    as: 'history',
                    cond: { $eq: ['$$history.type', 'adjustment'] }
                  }
                },
                as: 'stock',
                in: '$$stock.quantity'
              }
            }
          },
          finalQuantity: '$quantity',
          image: '$product.product_image'
        }
      },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]);

    return res.status(200).json({
      status: true,
      message: 'Stock history report fetched',
      summary: {
        totalTransactions: {
          current: totalCurrent,
          previous: totalPrevious,
          percentage: calculateChange(totalPrevious, totalCurrent),
          direction: totalCurrent > totalPrevious ? 'up' : totalCurrent < totalPrevious ? 'down' : 'equal'
        },
        stockIn: {
          current: currentTransactions.stock_in,
          previous: previousTransactions.stock_in,
          percentage: calculateChange(previousTransactions.stock_in, currentTransactions.stock_in),
          direction: currentTransactions.stock_in > previousTransactions.stock_in ? 'up' : currentTransactions.stock_in < previousTransactions.stock_in ? 'down' : 'equal'
        },
        stockOut: {
          current: currentTransactions.stock_out,
          previous: previousTransactions.stock_out,
          percentage: calculateChange(previousTransactions.stock_out, currentTransactions.stock_out),
          direction: currentTransactions.stock_out > previousTransactions.stock_out ? 'up' : currentTransactions.stock_out < previousTransactions.stock_out ? 'down' : 'equal'
        },
        creditNotes: {
          current: currentTransactions.adjustment,
          previous: previousTransactions.adjustment,
          percentage: calculateChange(previousTransactions.adjustment, currentTransactions.adjustment),
          direction: currentTransactions.adjustment > previousTransactions.adjustment ? 'up' : currentTransactions.adjustment < previousTransactions.adjustment ? 'down' : 'equal'
        }
      },
      data: inventoryData.map(item => ({
        _id: item._id,
        name: item.name,
        sku: item.sku,
        sellingPrice: item.sellingPrice,
        categporyName: item.categporyName || 'Uncategorized',
        addedQuantity: item.addedQuantity,
        soldQuantity: item.soldQuantity,
        defectiveQuantity: item.defectiveQuantity,
        finalQuantity: item.finalQuantity,
        image: item.image
          ? `${process.env.BASE_URL}${item.image}`
          : ''
      })),
      pagination: {
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Error generating stock history report:', error);
    return res.status(500).json({
      status: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

module.exports = { 
  getInventoryStockSummary, 
  getInventoryReport,
  getBestSellerReport,
  getLowStockReport,
  getOutStockReport,
  getStockHistoryReport
};
