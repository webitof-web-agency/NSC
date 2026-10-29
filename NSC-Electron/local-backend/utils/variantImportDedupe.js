// Duplicate detection for product variants during Excel/CSV import.
// A variant is the same as an existing one when it belongs to the same product and has the
// same design no, size, color and pricing (purchase/sale/MRP), ignoring case and spacing.
// Settings like min sale price, reorder limit and discount do not make a new variant.

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const buildVariantIdentityKey = (variant) =>
  [
    lower(variant.designNo),
    lower(variant.size),
    lower(variant.color),
    number(variant.purchase_price),
    number(variant.sale_price),
    number(variant.mrp)
  ].join('|');

// index: Map<identityKey, Set<barcode>> for one product
const addVariantToIndex = (index, variant) => {
  const key = buildVariantIdentityKey(variant);
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(text(variant.barcode));
};

// A row with its own barcode only duplicates a variant carrying that same barcode.
const isDuplicateVariant = (index, variant, providedBarcode = '') => {
  const barcodes = index.get(buildVariantIdentityKey(variant));
  if (!barcodes) return false;
  return !text(providedBarcode) || barcodes.has(text(providedBarcode));
};

module.exports = {
  buildVariantIdentityKey,
  addVariantToIndex,
  isDuplicateVariant
};
