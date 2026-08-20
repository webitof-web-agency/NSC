import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const publicInvoiceController = require(
  "../../Billing_Software_Backend/controllers/publicInvoiceController.js",
);

const publicInvoiceSource = readFileSync(
  new URL("../src/pages/public/PublicInvoice.tsx", import.meta.url),
  "utf8",
);
const publicInvoiceControllerSource = readFileSync(
  new URL(
    "../../Billing_Software_Backend/controllers/publicInvoiceController.js",
    import.meta.url,
  ),
  "utf8",
);

test("public invoice renders the NSC invoice template instead of the basic thank-you card", () => {
  assert.match(publicInvoiceSource, /import InvoiceTemplateB from/);
  assert.match(publicInvoiceSource, /<InvoiceTemplateB/);
  assert.doesNotMatch(publicInvoiceSource, /Thank You!/);
});

test("public invoice prints the rendered NSC template instead of downloading the basic PDF", () => {
  assert.match(publicInvoiceSource, /useReactToPrint/);
  assert.match(publicInvoiceSource, /Print \/ Save as PDF/);
  assert.doesNotMatch(publicInvoiceSource, /\/pdf`/);
});

test("public invoice response provides the fields required by the NSC template", () => {
  assert.match(publicInvoiceControllerSource, /termsAndCondition:/);
  assert.match(publicInvoiceControllerSource, /variantName:/);
  assert.match(publicInvoiceControllerSource, /siteLogo/);
  assert.match(publicInvoiceControllerSource, /populate\(['"]billTo['"]\)/);
});

test("public invoice serializer maps stored NSC invoice fields into the template response", () => {
  assert.equal(typeof publicInvoiceController.serializePublicInvoice, "function");

  const result = publicInvoiceController.serializePublicInvoice(
    {
      invoiceNumber: "INV-42",
      invoiceDate: "2026-08-20T00:00:00.000Z",
      status: "PAID",
      payment_method: "CASH",
      TotalAmount: 1170,
      taxableAmount: 1114,
      vat: 56,
      totalDiscount: 0,
      termsAndCondition: "No returns after seven days.",
      billTo: {
        name: "Customer Name",
        phone: "7000491118",
        billingAddress: { state: "Chhattisgarh" },
      },
      items: [
        {
          rowId: "line-1",
          name: "VARLAXMI",
          variantName: "MASAKALI",
          qty: 1,
          rate: 1170,
          amount: 1170,
          tax: 56,
        },
      ],
    },
    {
      companyName: "NARESH KIDS WEAR",
      siteLogo: "/uploads/nsc-logo.png",
      phone: "7000491118",
      address: "Raipur",
    },
  );

  assert.equal(result.customer.name, "Customer Name");
  assert.equal(result.items[0].variantName, "MASAKALI");
  assert.equal(result.items[0].taxAmount, 56);
  assert.equal(result.taxAmount, 56);
  assert.equal(result.termsAndCondition, "No returns after seven days.");
  assert.equal(result.business.logo, "/uploads/nsc-logo.png");
});
