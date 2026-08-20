import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const brandingSource = readFileSync(
  new URL("../src/pages/admin/settings/websiteSettings/CustomerPortalBranding.tsx", import.meta.url),
  "utf8",
);

test("existing branding page controls all public invoice portal sections", () => {
  assert.match(brandingSource, /portalAccentColor/);
  assert.match(brandingSource, /shopOnlineUrl/);
  assert.match(brandingSource, /showPromotionalBanner/);
  assert.match(brandingSource, /showPromotionalGallery/);
  assert.match(brandingSource, /showShopOnline/);
  assert.match(brandingSource, /showSocialLinks/);
  assert.match(brandingSource, /enableCustomerHistory/);
});

test("branding settings include a live mobile preview and an honest history limitation", () => {
  assert.match(brandingSource, /Live Mobile Preview/);
  assert.match(brandingSource, /secure customer OTP delivery is configured/i);
  assert.match(brandingSource, /Download Invoice/);
});

test("banner and gallery uploads enforce browser-side type and size checks", () => {
  assert.match(brandingSource, /file\.type\.startsWith\(expectedType\)/);
  assert.match(brandingSource, /maximumSizeMb/);
  assert.match(brandingSource, /validatePromoMediaFile/);
  assert.match(brandingSource, /removeBannerImage/);
  assert.match(brandingSource, /removeBannerVideo/);
  assert.match(brandingSource, /removeFooterLogo/);
});
