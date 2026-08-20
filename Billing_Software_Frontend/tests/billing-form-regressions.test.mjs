import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const createInvoiceSource = readSource(
  "../src/pages/admin/invoices/CreateInvoice.tsx",
);
const quotationSource = readSource(
  "../src/pages/admin/quotations/CreateNewQuotation.tsx",
);
const debitNoteSource = readSource(
  "../src/pages/admin/purchases/CreateDebitNote.tsx",
);
const customerCardSource = readSource(
  "../src/components/admin/CustomerCard.tsx",
);

const between = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
};

test("invoice manual and quick-add rows are inserted at the top", () => {
  const manualAdd = between(
    createInvoiceSource,
    "const handleNewRow",
    "const addVariantToInvoice",
  );
  const quickAdd = between(
    createInvoiceSource,
    "const handleConfirmQuickAddQuantity",
    "const handleEditItemAction",
  );

  assert.ok(
    manualAdd.indexOf("id: newId") < manualAdd.indexOf("...prev.items"),
    "the new blank row must be placed before existing rows",
  );
  assert.ok(
    quickAdd.indexOf("recalculatedNewItem") <
      quickAdd.lastIndexOf("...prev.items"),
    "the quick-added item must be placed before existing rows",
  );
});

test("quotation item search focuses on load and after the item modal closes", () => {
  assert.match(quotationSource, /quickAddInputRef\s*=\s*useRef<HTMLInputElement>/);
  assert.match(quotationSource, /ref=\{quickAddInputRef\}/);
  assert.match(quotationSource, /autoFocus/);
  assert.match(quotationSource, /quickAddInputRef\.current\?\.focus\(\)/);
});

test("quotation customer search shows identity details and accepts name or phone", () => {
  assert.match(quotationSource, /name:\s*c\.name\s*\|\|\s*c\.phone/);
  assert.match(quotationSource, /showItemDetails/);
  assert.doesNotMatch(
    between(quotationSource, '<div key="billTo"', "];\n\n    const titleActions"),
    /sanitizeInput=|maxLength=/,
  );
  assert.match(quotationSource, /email=\{customerDetails\.email\}/);
  assert.match(quotationSource, /variant="detailed"/);
  assert.match(quotationSource, /address=\{/);
  assert.match(customerCardSource, /Selected customer/i);
  assert.match(customerCardSource, /Mail/);
  assert.match(customerCardSource, /MapPin/);
});

test("debit-note supplier clear accepts null and clears both supplier searches", () => {
  const supplierHandler = between(
    debitNoteSource,
    "const handleSupplierChange",
    "const handlePurchaseSelection",
  );
  assert.match(supplierHandler, /OptionType\s*\|\s*null/);
  assert.ok(
    supplierHandler.indexOf("if (!user)") < supplierHandler.indexOf("user.id"),
    "the null supplier guard must run before user.id is accessed",
  );
  assert.match(supplierHandler, /setSupplierSearchInput\(''\)/);
  assert.match(supplierHandler, /setPurchaseSupplierSearchInput\(''\)/);
});
