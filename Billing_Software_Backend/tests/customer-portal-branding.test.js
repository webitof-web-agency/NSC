const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const CustomerPortalBranding = require('../models/CustomerPortalBranding');
const {
  normalizePublicPortalBranding,
  sanitizeHttpUrl,
} = require('../utils/publicInvoicePortal');
const { generatePublicShareId } = require('../services/publicShareService');

test('branding schema adds portal controls without duplicating the branding model', () => {
  const branding = new CustomerPortalBranding({ userId: '507f1f77bcf86cd799439011' });
  assert.equal(branding.portalAccentColor, '#A43275');
  assert.equal(branding.showPromotionalBanner, true);
  assert.equal(branding.showPromotionalGallery, true);
  assert.equal(branding.showShopOnline, true);
  assert.equal(branding.showSocialLinks, true);
  assert.equal(branding.enableCustomerHistory, false);
});

test('public branding accepts only safe web URLs and preserves configured ordering', () => {
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeHttpUrl('https://shop.example.com'), 'https://shop.example.com/');

  const result = normalizePublicPortalBranding({
    promoGallery: [
      { _id: 'second', type: 'image', url: '/uploads/second.webp', order: 2 },
      { _id: 'first', type: 'video', url: '/uploads/first.mp4', order: 1 },
    ],
  }, 'https://api.example.com');

  assert.deepEqual(result.promoGallery.map((item) => item.id), ['first', 'second']);
  assert.equal(result.promoGallery[0].url, 'https://api.example.com/uploads/first.mp4');
});

test('public invoice tokens retain 192 bits of random entropy', () => {
  const token = generatePublicShareId();
  assert.equal(token.length, 32);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test('public invoice resolves company and branding by the invoice owner', () => {
  const source = readFileSync(
    path.join(__dirname, '../controllers/publicInvoiceController.js'),
    'utf8',
  );
  assert.match(source, /CompanySettings\.findOne\(\{ userId: ownerUserId \}\)/);
  assert.match(source, /CustomerPortalBranding\.findOne\(\{ userId: ownerUserId \}\)/);
  assert.doesNotMatch(source, /CompanySettings\.findOne\(\)\.sort/);
});
