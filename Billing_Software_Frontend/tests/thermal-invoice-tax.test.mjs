import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

let calculateThermalTaxLine;
try {
  ({ calculateThermalTaxLine } = await import(
    "../src/utils/thermalInvoiceTax.ts"
  ));
} catch {
  calculateThermalTaxLine = undefined;
}

const createInvoiceSource = readFileSync(
  new URL("../src/pages/admin/invoices/CreateInvoice.tsx", import.meta.url),
  "utf8",
);

test("inclusive GST summary derives 5% from the pre-tax value", () => {
  assert.equal(typeof calculateThermalTaxLine, "function");

  const grossInclusive = 1885;
  const taxAmount = grossInclusive - grossInclusive / 1.05;
  const summary = calculateThermalTaxLine({
    qty: 1,
    rate: grossInclusive,
    discount: 0,
    taxAmount,
    configuredTaxRate: 0,
    isInclusive: true,
  });

  assert.equal(summary.taxRate, 5);
  assert.equal(summary.taxableAmount.toFixed(2), "1795.24");
});

test("exclusive GST summary continues to derive 5% from the taxable value", () => {
  assert.equal(typeof calculateThermalTaxLine, "function");

  const summary = calculateThermalTaxLine({
    qty: 1,
    rate: 1885,
    discount: 0,
    taxAmount: 94.25,
    configuredTaxRate: 0,
    isInclusive: false,
  });

  assert.equal(summary.taxRate, 5);
  assert.equal(summary.taxableAmount, 1885);
});

test("invoice quick-add and newly-created product paths retain HSN for immediate thermal printing", () => {
  const quickAddStart = createInvoiceSource.indexOf("const newItem = {");
  const quickAddEnd = createInvoiceSource.indexOf("const recalculatedNewItem", quickAddStart);
  const quickAddBlock = createInvoiceSource.slice(quickAddStart, quickAddEnd);

  const newProductStart = createInvoiceSource.indexOf("const handleNewProductCreated");
  const newProductEnd = createInvoiceSource.indexOf("const handleNewRow", newProductStart);
  const newProductBlock = createInvoiceSource.slice(newProductStart, newProductEnd);

  assert.match(
    quickAddBlock,
    /hsn_code:\s*completeProduct\.hsn_code\s*\|\|\s*product\.hsn_code\s*\|\|\s*["']{2}/,
  );
  assert.match(newProductBlock, /hsn_code:\s*product\.hsn_code\s*\|\|\s*["']{2}/);
});
