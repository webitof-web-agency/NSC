const assert = require("node:assert/strict");
const test = require("node:test");

let enrichInvoicePrintItems;
try {
  ({ enrichInvoicePrintItems } = require("../utils/invoicePrintItems"));
} catch {
  enrichInvoicePrintItems = undefined;
}

test("print-item enrichment restores a missing HSN from the linked product", () => {
  assert.equal(typeof enrichInvoicePrintItems, "function");

  const result = enrichInvoicePrintItems(
    [{ product_id: "product-1", variantId: "variant-1", hsn_code: "" }],
    {
      variantMrpMap: new Map([["variant-1", 2736]]),
      productHsnMap: new Map([["product-1", "6209"]]),
    },
  );

  assert.equal(result[0].hsn_code, "6209");
  assert.equal(result[0].variantMrp, 2736);
});

test("print-item enrichment preserves the HSN snapshot stored on the invoice", () => {
  assert.equal(typeof enrichInvoicePrintItems, "function");

  const result = enrichInvoicePrintItems(
    [{ product_id: "product-1", hsn_code: "snapshot-hsn" }],
    { productHsnMap: new Map([["product-1", "current-product-hsn"]]) },
  );

  assert.equal(result[0].hsn_code, "snapshot-hsn");
});
