const assert = require("node:assert/strict");
const test = require("node:test");

const { addVariantToIndex, isDuplicateVariant } = require("../utils/variantImportDedupe");

const existing = {
  designNo: "MOSKO 99535",
  size: "XL",
  color: "Red",
  purchase_price: 500,
  sale_price: 900,
  mrp: 1200,
  barcode: "123456789012",
};

const indexWith = (...variants) => {
  const index = new Map();
  variants.forEach((v) => addVariantToIndex(index, v));
  return index;
};

test("re-importing the same row is a duplicate", () => {
  assert.equal(isDuplicateVariant(indexWith(existing), { ...existing }), true);
});

test("case and spacing differences are still a duplicate", () => {
  const row = { ...existing, designNo: " mosko 99535 ", size: "xl", color: "RED " };
  assert.equal(isDuplicateVariant(indexWith(existing), row), true);
});

test("changed min sale price, reorder limit or discount is still a duplicate", () => {
  const row = { ...existing, min_sale_price: 850, reorder_limit: 5, discount_value: 10 };
  assert.equal(isDuplicateVariant(indexWith(existing), row), true);
});

test("different color, size or pricing is a new variant", () => {
  const index = indexWith(existing);
  assert.equal(isDuplicateVariant(index, { ...existing, color: "Blue" }), false);
  assert.equal(isDuplicateVariant(index, { ...existing, size: "L" }), false);
  assert.equal(isDuplicateVariant(index, { ...existing, sale_price: 950 }), false);
  assert.equal(isDuplicateVariant(index, { ...existing, mrp: "1300" }), false);
});

test("numbers read as text from the sheet match stored numbers", () => {
  const row = { ...existing, purchase_price: "500", sale_price: "900", mrp: "1200" };
  assert.equal(isDuplicateVariant(indexWith(existing), row), true);
});

test("a row with its own barcode only matches a variant with that barcode", () => {
  const index = indexWith(existing);
  assert.equal(isDuplicateVariant(index, existing, "123456789012"), true);
  assert.equal(isDuplicateVariant(index, existing, "999999999999"), false);
});

test("missing color on an old variant matches an empty color cell", () => {
  const { color, ...noColor } = existing;
  assert.equal(isDuplicateVariant(indexWith(noColor), { ...existing, color: "" }), true);
});
