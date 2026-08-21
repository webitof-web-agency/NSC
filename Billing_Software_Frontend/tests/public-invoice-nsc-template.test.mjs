import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import * as publicInvoicePortalUtils from "../src/pages/public/publicDocumentPortalUtils.ts";
import {
  getFooterAddressLines,
  getSafeHttpUrl,
  getUniquePhoneNumbers,
  getValidEmail,
  getWhatsAppNumber,
} from "../src/pages/public/publicDocumentPortalUtils.ts";

const require = createRequire(import.meta.url);
const publicInvoiceController = require(
  "../../Billing_Software_Backend/controllers/publicInvoiceController.js",
);

const publicInvoiceSource = readFileSync(
  new URL("../src/pages/public/PublicInvoice.tsx", import.meta.url),
  "utf8",
);
const portalSource = readFileSync(
  new URL("../src/pages/public/PublicDocumentPortal.tsx", import.meta.url),
  "utf8",
);
const publicDetailsSource = readFileSync(
  new URL("../src/pages/public/PublicInvoiceDetails.tsx", import.meta.url),
  "utf8",
);
const invoiceTemplateSource = readFileSync(
  new URL("../src/pages/admin/invoices/InvoiceTemplateB.tsx", import.meta.url),
  "utf8",
);
const publicInvoiceControllerSource = readFileSync(
  new URL(
    "../../Billing_Software_Backend/controllers/publicInvoiceController.js",
    import.meta.url,
  ),
  "utf8",
);
const publicRoutesSource = readFileSync(
  new URL(
    "../../Billing_Software_Backend/routes/publicRoutes.js",
    import.meta.url,
  ),
  "utf8",
);
const publicPortalUtilitySource = readFileSync(
  new URL(
    "../../Billing_Software_Backend/utils/publicInvoicePortal.js",
    import.meta.url,
  ),
  "utf8",
);

test("public route renders a compact customer portal while retaining the formal template only for print", () => {
  assert.match(publicInvoiceSource, /import PublicDocumentPortal,/);
  assert.match(publicInvoiceSource, /<PublicDocumentPortal/);
  assert.match(publicInvoiceSource, /import InvoiceTemplateB from/);
  assert.match(publicInvoiceSource, /portal-print-document/);
  assert.match(publicInvoiceSource, /useReactToPrint/);
  assert.doesNotMatch(portalSource, /<InvoiceTemplateB/);
});

test("portal provides compact line items, totals, payment details and authenticated navigation", () => {
  assert.match(publicDetailsSource, /Item details/);
  assert.match(publicDetailsSource, /Design/);
  assert.match(publicDetailsSource, /Size/);
  assert.match(publicDetailsSource, /HSN/);
  assert.match(publicDetailsSource, /Amount paid/);
  assert.match(publicDetailsSource, /Amount due/);
  assert.match(portalSource, /aria-label="Customer invoice navigation"/);
  assert.match(portalSource, /documentType === 'INVOICE' \? 'Invoice'/);
  assert.match(portalSource, />History</);
  assert.match(portalSource, />Login</);
  assert.match(portalSource, /to="\/customer\/profile"/);
  assert.match(portalSource, /to="\/customer\/login"/);
  assert.match(portalSource, /state=\{\{ from: location\.pathname \}\}/);
  assert.match(portalSource, /getCustomerInitials\(customer\?\.name\)/);
  assert.doesNotMatch(portalSource, />Order Online</);
  assert.match(portalSource, /max-w-\[520px\]/);
  assert.match(portalSource, /env\(safe-area-inset-bottom\)/);
});

test("portal footer removes address numbering and renders only usable, unique contact data", () => {
  assert.deepEqual(
    getFooterAddressLines(
      "1. NARESH SAREE COLLECTION ADARSH NAGAR 2. NARESH KIDS WEAR PAHADI CHOWK",
    ),
    [
      "NARESH SAREE COLLECTION ADARSH NAGAR",
      "NARESH KIDS WEAR PAHADI CHOWK",
    ],
  );
  assert.deepEqual(getFooterAddressLines("  Raipur, Chhattisgarh  "), [
    "Raipur, Chhattisgarh",
  ]);

  assert.deepEqual(
    getUniquePhoneNumbers(["70004 91118", "7000491118", " "]),
    [{ display: "70004 91118", dial: "7000491118" }],
  );
  assert.equal(getValidEmail("not-an-email"), "");
  assert.equal(getValidEmail(" sales@example.com "), "sales@example.com");
  assert.equal(getSafeHttpUrl("javascript:alert(1)"), "");
  assert.equal(getSafeHttpUrl("https://example.com"), "https://example.com/");
  assert.equal(getWhatsAppNumber("not configured"), "");
  assert.equal(getWhatsAppNumber("+91 70004-91118"), "917000491118");

  assert.match(portalSource, /footerAddressLines\.map/);
  assert.match(portalSource, /footerPhoneNumbers\.map/);
});

test("customer initials provide a compact circular profile fallback", () => {
  assert.equal(typeof publicInvoicePortalUtils.getCustomerInitials, "function");
  assert.equal(publicInvoicePortalUtils.getCustomerInitials?.("Naresh Kids Wear"), "NK");
  assert.equal(publicInvoicePortalUtils.getCustomerInitials?.(" Naresh "), "N");
  assert.equal(publicInvoicePortalUtils.getCustomerInitials?.(""), "C");
});

test("portal media is configured, ordered, accessible and lazy below the invoice", () => {
  assert.match(portalSource, /activeBannerType === "image"/);
  assert.match(portalSource, /activeBannerType === "video"/);
  assert.match(portalSource, /loading="lazy"/);
  assert.match(portalSource, /preload="metadata"/);
  assert.match(portalSource, /scroll-snap-type/);
  assert.match(portalSource, /showPromotionalGallery/);
  assert.match(portalSource, /showSocialLinks/);
  assert.match(portalSource, /shopOnlineUrl/);
  assert.match(portalSource, /className="aspect-square w-full overflow-hidden/);
  assert.match(portalSource, /h-full w-full object-contain/);
});

test("history uses the saved customer Bearer token and never the invoice share token", () => {
  assert.match(portalSource, /state\.customerAuth/);
  assert.match(portalSource, /isTokenExpired\(token\)/);
  assert.match(portalSource, /CUSTOMER_PORTAL_INVOICES_URL/);
  assert.match(portalSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(portalSource, /<CustomerInvoiceAccordion/);
  assert.doesNotMatch(portalSource, /\/customer\/invoices\/\$\{historyInvoice\.id\}/);
  assert.doesNotMatch(portalSource, /publicShareId/);
  assert.match(publicPortalUtilitySource, /OTP_DELIVERY_NOT_CONFIGURED/);
  assert.match(publicRoutesSource, /requireCustomerHistorySession/);
  assert.match(publicRoutesSource, /customer-history\/invoices/);
  assert.doesNotMatch(publicRoutesSource, /customer-history\/invoices\/:publicShareId/);
});

test("public invoice keeps no-index and private no-store protections", () => {
  assert.match(publicInvoiceSource, /noindex,nofollow/);
  assert.match(publicInvoiceControllerSource, /Cache-Control/);
  assert.match(publicInvoiceControllerSource, /no-store/);
  assert.match(publicInvoiceControllerSource, /X-Robots-Tag/);
});

test("formal NSC invoice remains responsive and printable", () => {
  assert.match(invoiceTemplateSource, /@media screen and \(max-width: 640px\)/);
  assert.match(invoiceTemplateSource, /@media print/);
});

test("formal NSC invoice renders saved multiline terms without an empty numbered row", () => {
  assert.match(invoiceTemplateSource, /termsAndConditions/);
  assert.match(invoiceTemplateSource, /split\(\/\\r\?\\n\//);
  assert.match(invoiceTemplateSource, /termsAndConditions\.length > 0/);
  assert.match(invoiceTemplateSource, /termsAndConditions\.map/);
});

test("public serializer maps compact portal, payment and branding data", () => {
  assert.equal(typeof publicInvoiceController.serializePublicInvoice, "function");

  const result = publicInvoiceController.serializePublicInvoice(
    {
      invoiceNumber: "INV-42",
      invoiceDate: "2026-08-20T00:00:00.000Z",
      status: "PARTIALLY_PAID",
      payment_method: "UPI",
      TotalAmount: 1170,
      taxableAmount: 1114,
      vat: 56,
      totalDiscount: 0,
      roundOff: true,
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
          variantDesignNo: "D-101",
          variantSize: "XL",
          hsn_code: "5208",
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
    {
      portalAccentColor: "#14532D",
      shopOnlineUrl: "https://shop.example.com",
      instagramUrl: "javascript:alert(1)",
      showPromotionalGallery: false,
      enableCustomerHistory: true,
    },
    { totalPaid: 700, hasPaymentRecords: true },
    "https://api.example.com",
  );

  assert.equal(result.items[0].designNumber, "D-101");
  assert.equal(result.items[0].size, "XL");
  assert.equal(result.items[0].hsnCode, "5208");
  assert.equal(result.payment.totalPaid, 700);
  assert.equal(result.payment.balanceAmount, 470);
  assert.equal(result.portalBranding.portalAccentColor, "#14532D");
  assert.equal(result.portalBranding.showPromotionalGallery, false);
  assert.equal(result.portalBranding.shopOnlineUrl, "https://shop.example.com/");
  assert.equal(result.portalBranding.instagramUrl, "");
  assert.equal(result.business.logo, "https://api.example.com/uploads/nsc-logo.png");
  assert.equal(result.history.enabled, false);
  assert.equal(result.history.code, "OTP_DELIVERY_NOT_CONFIGURED");
});
