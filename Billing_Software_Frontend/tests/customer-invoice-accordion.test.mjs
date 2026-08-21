import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) => {
  const sourceUrl = new URL(relativePath, import.meta.url);
  return existsSync(sourceUrl) ? readFileSync(sourceUrl, "utf8") : "";
};

const loginSource = readSource("../src/pages/customer/auth/CustomerLogin.tsx");
const dashboardSource = readSource("../src/pages/customer/CustomerDashboard.tsx");
const invoicesSource = readSource("../src/pages/customer/CustomerInvoices.tsx");
const accordionSource = readSource("../src/components/customer/CustomerInvoiceAccordion.tsx");
const publicPortalSource = readSource("../src/pages/public/PublicDocumentPortal.tsx");
const publicDetailsSource = readSource("../src/pages/public/PublicInvoiceDetails.tsx");

test("mobile login hides the promotional information panel", () => {
  assert.match(loginSource, /data-testid="customer-login-info"/);
  assert.match(loginSource, /data-testid="customer-login-info"[\s\S]*?className="hidden[^"]*lg:flex/);
});

test("mobile login centers the sign-in content vertically", () => {
  assert.match(loginSource, /className="flex-1 flex flex-col items-center justify-center[^"]*"/);
  assert.doesNotMatch(loginSource, /items-center justify-start lg:justify-center/);
});

test("customer invoice lists expand inline without navigating to invoice detail routes", () => {
  assert.match(invoicesSource, /<CustomerInvoiceAccordion/);
  assert.doesNotMatch(invoicesSource, /navigate\(`\/customer\/invoices\/\$\{inv\.id\}`\)/);

  assert.match(dashboardSource, /<CustomerInvoiceAccordion/);
  assert.doesNotMatch(dashboardSource, /navigate\(`\/customer\/invoices\/\$\{invoice\.id\}`\)/);
  assert.match(dashboardSource, /whitespace-nowrap/);

  assert.match(publicPortalSource, /<CustomerInvoiceAccordion/);
  assert.doesNotMatch(publicPortalSource, /to=\{`\/customer\/invoices\/\$\{historyInvoice\.id\}`\}/);
});

test("invoice accordion is accessible, lazy-loads details, and reuses the public mobile template", () => {
  assert.match(accordionSource, /aria-expanded=\{expanded\}/);
  assert.match(accordionSource, /aria-controls=/);
  assert.match(accordionSource, /CUSTOMER_PORTAL_INVOICES_URL/);
  assert.match(accordionSource, /<PublicInvoiceDetails/);
  assert.match(accordionSource, /useReactToPrint/);

  assert.match(publicPortalSource, /<PublicInvoiceDetails/);
  assert.match(publicDetailsSource, /aria-label="Item details"/);
  assert.match(publicDetailsSource, /Amount paid/);
  assert.match(publicDetailsSource, /Amount due/);
});

test("invoice history prints with the formal NSC tax invoice template", () => {
  assert.match(accordionSource, /import InvoiceTemplateB from/);
  assert.match(accordionSource, /import type \{ InvoiceData/);
  assert.match(accordionSource, /contentRef: formalPrintRef/);
  assert.match(accordionSource, /portal-print-document/);
  assert.match(accordionSource, /<InvoiceTemplateB/);
  assert.match(accordionSource, /<PublicInvoiceDetails/);
});
