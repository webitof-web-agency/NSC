import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketingSource = readFileSync(
  new URL('../src/pages/admin/whatsapp/WhatsAppMarketing.tsx', import.meta.url),
  'utf8',
);

test('campaign creation sends the Meta template id instead of the local Mongo record id', () => {
  assert.match(marketingSource, /metaTemplateId:\s*selectedTemplate\.metaId/);
  assert.doesNotMatch(marketingSource, /metaTemplateId:\s*selectedTemplateId/);
});

test('customer selection shows all owned customers while selecting only eligible recipients', () => {
  assert.match(marketingSource, /response\.data\?\.customers/);
  assert.match(marketingSource, /filter\(\(customer\) => customer\.eligible\)/);
  assert.match(marketingSource, /customer\.eligibilityStatus/);
});

test('marketing page has no consent system or consent eligibility counters', () => {
  assert.doesNotMatch(marketingSource, /consent/i);
  assert.doesNotMatch(marketingSource, /whatsappMarketingOptIn|NOT_OPTED_IN|OPTED_OUT|notOptedIn|optedOut/);
});

test('campaign send is disabled when its resolved recipient count is zero', () => {
  assert.match(marketingSource, /targetCount === 0/);
});
