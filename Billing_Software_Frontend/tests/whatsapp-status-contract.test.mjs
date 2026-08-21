import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedSource = readFileSync(
  new URL('../src/pages/admin/whatsapp/WhatsAppShared.tsx', import.meta.url),
  'utf8',
);
const messagesSource = readFileSync(
  new URL('../src/pages/admin/whatsapp/WhatsAppMessages.tsx', import.meta.url),
  'utf8',
);
const adminRouteSource = readFileSync(
  new URL('../src/routes/AdminRoute.tsx', import.meta.url),
  'utf8',
);
const sidebarSource = readFileSync(
  new URL('../src/components/admin/Sidebar.tsx', import.meta.url),
  'utf8',
);

test('WhatsApp message types match the uppercase backend status enum', () => {
  for (const status of ['QUEUED', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'REPLIED']) {
    assert.match(sharedSource, new RegExp(`'${status}'`));
  }
});

test('message summary handles uppercase statuses returned by the API', () => {
  assert.match(messagesSource, /WHATSAPP_MESSAGE_STATS_URL/);
  assert.match(messagesSource, />Delivered</);
  assert.match(messagesSource, />Read</);
  assert.match(messagesSource, /applyStatusFilter\('delivered'\)/);
  assert.match(messagesSource, /applyStatusFilter\('read'\)/);
});

test('WhatsApp navigation exposes one Messages destination without Delivered or Read tabs', () => {
  assert.match(sharedSource, /to: '\/admin\/whatsapp\/messages', label: 'Messages'/);
  assert.doesNotMatch(sharedSource, /label: 'Delivered'|label: 'Read'/);
  assert.doesNotMatch(sidebarSource, /WhatsApp Delivered|WhatsApp Read/);
});

test('legacy Delivered and Read URLs redirect to filtered Messages views', () => {
  assert.doesNotMatch(adminRouteSource, /import WhatsAppDelivered|import WhatsAppRead/);
  assert.match(adminRouteSource, /whatsapp\/delivered[\s\S]*Navigate to="\/admin\/whatsapp\/messages\?status=delivered"/);
  assert.match(adminRouteSource, /whatsapp\/read[\s\S]*Navigate to="\/admin\/whatsapp\/messages\?status=read"/);
});

test('standalone Delivered and Read message pages are removed', () => {
  assert.equal(existsSync(new URL('../src/pages/admin/whatsapp/WhatsAppDelivered.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/pages/admin/whatsapp/WhatsAppRead.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/pages/admin/whatsapp/WhatsAppAnalyticsPage.tsx', import.meta.url)), false);
});
