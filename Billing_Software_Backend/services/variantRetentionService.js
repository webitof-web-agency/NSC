const mongoose = require("mongoose");
const ProductVariant = require("@models/ProductVariant");
const Inventory = require("@models/Inventory");
const Invoice = require("@models/Invoice");
const Purchase = require("@models/Purchase");
const Quotation = require("@models/Quotation");
const DebitNote = require("@models/DebitNote");
const Commission = require("@models/Commission");

const ONE_YEAR_IN_DAYS = 365;

const getCutoffDate = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ONE_YEAR_IN_DAYS);
  return cutoff;
};

const isVariantReferenced = async (variantId) => {
  const variantObjectId =
    variantId instanceof mongoose.Types.ObjectId
      ? variantId
      : new mongoose.Types.ObjectId(String(variantId));

  const checks = await Promise.all([
    Invoice.exists({
      $or: [
        { "items.variantId": variantObjectId },
        { "exchangeOriginalItems.variantId": variantObjectId },
      ],
    }),
    Purchase.exists({ "items.variantId": variantObjectId }),
    Quotation.exists({ "items.variantId": variantObjectId }),
    DebitNote.exists({
      $or: [
        { "items.variantId": variantObjectId },
        { "replacementItems.variantId": variantObjectId },
      ],
    }),
    Commission.exists({ "items.variantId": variantObjectId }),
  ]);

  return checks.some(Boolean);
};

const getLastActivityDate = (variant, inventory) => {
  const activityDates = [];

  if (variant?.updatedAt) activityDates.push(new Date(variant.updatedAt));
  if (inventory?.updatedAt) activityDates.push(new Date(inventory.updatedAt));

  for (const historyItem of inventory?.inventory_history || []) {
    if (historyItem?.createdAt) {
      activityDates.push(new Date(historyItem.createdAt));
    }
  }

  if (activityDates.length === 0) {
    return null;
  }

  return activityDates.reduce((latest, current) =>
    current > latest ? current : latest
  );
};

const isLowOrOutOfStock = (variant, inventory) => {
  const quantity = Number(inventory?.quantity || 0);
  const reorderLimit = Math.max(Number(variant?.reorder_limit || 0), 0);
  return quantity <= reorderLimit;
};

const deleteInactiveLowStockVariants = async () => {
  const cutoffDate = getCutoffDate();
  const variants = await ProductVariant.find({}).lean();

  let deletedCount = 0;
  const deletedVariantIds = [];
  const skipped = [];

  for (const variant of variants) {
    const inventory = await Inventory.findOne({
      variantId: variant._id,
      isDeleted: false,
    }).lean();

    if (!isLowOrOutOfStock(variant, inventory)) {
      continue;
    }

    const lastActivityDate = getLastActivityDate(variant, inventory);
    if (lastActivityDate && lastActivityDate > cutoffDate) {
      continue;
    }

    const referenced = await isVariantReferenced(variant._id);
    if (referenced) {
      skipped.push({
        variantId: String(variant._id),
        barcode: variant.barcode || "",
        reason: "Referenced in transactional records",
      });
      continue;
    }

    await Inventory.deleteMany({ variantId: variant._id });
    await ProductVariant.deleteOne({ _id: variant._id });

    deletedCount += 1;
    deletedVariantIds.push(String(variant._id));
  }

  return {
    checkedCount: variants.length,
    deletedCount,
    deletedVariantIds,
    skipped,
    cutoffDate,
  };
};

module.exports = {
  deleteInactiveLowStockVariants,
};
