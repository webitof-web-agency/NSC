const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const WhatsAppTemplateAssignment = require('../models/WhatsAppTemplateAssignment');
const { configureWhatsAppModule } = require('../context');

test('invoice and exchange context use the document-aware public URL builder', () => {
  const serviceSource = readFileSync(require.resolve('./whatsappService'), 'utf8');

  assert.doesNotMatch(serviceSource, /buildPublicInvoiceUrl/);
  assert.match(
    serviceSource,
    /buildPublicDocumentUrl\(\s*publicShareId,\s*documentType === 'exchange' \? 'EXCHANGE' : 'INVOICE',?\s*\)/,
  );
});

test('document numbers never fall back to Mongo IDs', () => {
  const whatsappService = require('./whatsappService');
  assert.equal(typeof whatsappService.getDocumentNumber, 'function');
  assert.equal(
    whatsappService.getDocumentNumber('quotation', { _id: 'mongo-quotation-id', quotationId: 'QT-000123' }),
    'QT-000123',
  );
  assert.equal(
    whatsappService.getDocumentNumber('exchange', { _id: 'mongo-invoice-id', invoiceNumber: 'INV_27-26_000029' }),
    'INV_27-26_000029',
  );
  assert.equal(whatsappService.getDocumentNumber('quotation', { _id: 'mongo-quotation-id' }), '');
  assert.equal(whatsappService.getDocumentNumber('exchange', { _id: 'mongo-invoice-id' }), '');
});

const installSendHarness = (t, { documentType, context, variableMappings }) => {
  const originalSettingsFindOne = WhatsAppSettings.findOne;
  const originalLogCreate = WhatsAppMessageLog.create;
  const originalLogUpdate = WhatsAppMessageLog.findByIdAndUpdate;
  const originalAssignmentFindOne = WhatsAppTemplateAssignment.findOne;
  const originalFetch = global.fetch;

  t.after(() => {
    WhatsAppSettings.findOne = originalSettingsFindOne;
    WhatsAppMessageLog.create = originalLogCreate;
    WhatsAppMessageLog.findByIdAndUpdate = originalLogUpdate;
    WhatsAppTemplateAssignment.findOne = originalAssignmentFindOne;
    global.fetch = originalFetch;
  });

  configureWhatsAppModule({ resolveDocumentContext: async () => context, models: {} });
  WhatsAppSettings.findOne = async () => ({
    isEnabled: true,
    accessToken: 'test-access-token',
    phoneNumberId: 'phone-number-id',
    businessAccountId: 'business-account-id',
    webhookVerifyToken: 'verify-token',
    apiVersion: 'v25.0',
  });
  WhatsAppTemplateAssignment.findOne = (query) => {
    assert.equal(query.messageType, documentType.toUpperCase());
    return ({
      populate() {
        return this;
      },
      async lean() {
        return {
          _id: `${documentType}-assignment-id`,
          messageType: documentType.toUpperCase(),
          isEnabled: true,
          metaTemplateName: `${documentType}_template`,
          languageCode: 'en',
          metaTemplateId: {
            _id: 'meta-template-id',
            status: 'APPROVED',
            components: [
              {
                type: 'BODY',
                text: documentType === 'exchange'
                  ? 'Hello {{1}}, exchange invoice {{2}} from {{3}}.'
                  : 'Hello {{1}}, quotation {{2}} for {{3}} from {{4}}.',
              },
              {
                type: 'BUTTONS',
                buttons: [{
                  type: 'URL',
                  url: `https://app.nareshsareecollection.com/${documentType}/{{1}}`,
                }],
              },
            ],
          },
          headerMapping: { sourceType: 'NONE' },
          variableMappings,
        };
      },
    });
  };
  WhatsAppMessageLog.create = async () => ({ _id: `${documentType}-log-id` });
  WhatsAppMessageLog.findByIdAndUpdate = async () => {};

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ messages: [{ id: `${documentType}-message-id` }] }),
    };
  };

  return requests;
};

test('quotation send maps four BODY values and sends only quotation.publicShareId in the URL button', async (t) => {
  const quotation = { publicShareId: 'quotation-share-token', publicShareEnabled: true };
  const context = {
    document: quotation,
    customerId: 'customer-id',
    customerName: 'Quotation Customer',
    customerPhone: '7582898186',
    documentNumber: 'QT-000123',
    amount: 4160,
    date: '21/08/2026',
    items: [],
    status: 'sent',
    companyName: 'NARESH KIDS WEAR',
    documentLabel: 'Quotation',
  };
  const requests = installSendHarness(t, {
    documentType: 'quotation',
    context,
    variableMappings: [
      { component: 'BODY', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'customerName' },
      { component: 'BODY', parameterIndex: 2, sourceType: 'VARIABLE', sourceValue: 'documentNumber' },
      { component: 'BODY', parameterIndex: 3, sourceType: 'VARIABLE', sourceValue: 'amount' },
      { component: 'BODY', parameterIndex: 4, sourceType: 'VARIABLE', sourceValue: 'companyName' },
      { component: 'BUTTONS', parameterIndex: 1, buttonIndex: 0, sourceType: 'VARIABLE', sourceValue: 'quotationPublicShareId' },
    ],
  });

  const { triggerWhatsAppSend } = require('./whatsappService');
  await triggerWhatsAppSend({ documentType: 'quotation', documentId: 'quotation-id', userId: 'user-id', manual: true });

  const payload = JSON.parse(requests[0].options.body);
  assert.deepEqual(payload.template.components.find((component) => component.type === 'body').parameters, [
    { type: 'text', text: 'Quotation Customer' },
    { type: 'text', text: 'QT-000123' },
    { type: 'text', text: '4160' },
    { type: 'text', text: 'NARESH KIDS WEAR' },
  ]);
  assert.deepEqual(payload.template.components.find((component) => component.type === 'button').parameters, [
    { type: 'text', text: 'quotation-share-token' },
  ]);
});

test('exchange send selects its assignment, uses the invoice number, and sends only publicShareId', async (t) => {
  const exchangeInvoice = { publicShareId: 'exchange-share-token', publicShareEnabled: true };
  const context = {
    document: exchangeInvoice,
    customerId: 'customer-id',
    customerName: 'Exchange Customer',
    customerPhone: '7582898186',
    documentNumber: 'INV_27-26_000029',
    amount: 4160,
    date: '21/08/2026',
    items: [],
    status: 'EXCHANGE',
    companyName: 'NARESH KIDS WEAR',
    documentLabel: 'Exchange Invoice',
  };
  const requests = installSendHarness(t, {
    documentType: 'exchange',
    context,
    variableMappings: [
      { component: 'BODY', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'customerName' },
      { component: 'BODY', parameterIndex: 2, sourceType: 'VARIABLE', sourceValue: 'documentNumber' },
      { component: 'BODY', parameterIndex: 3, sourceType: 'VARIABLE', sourceValue: 'companyName' },
      { component: 'BUTTONS', parameterIndex: 1, buttonIndex: 0, sourceType: 'VARIABLE', sourceValue: 'exchangePublicShareId' },
    ],
  });

  const { triggerWhatsAppSend } = require('./whatsappService');
  await triggerWhatsAppSend({ documentType: 'exchange', documentId: 'invoice-id', userId: 'user-id', manual: true });

  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.template.name, 'exchange_template');
  assert.deepEqual(payload.template.components.find((component) => component.type === 'body').parameters, [
    { type: 'text', text: 'Exchange Customer' },
    { type: 'text', text: 'INV_27-26_000029' },
    { type: 'text', text: 'NARESH KIDS WEAR' },
  ]);
  assert.deepEqual(payload.template.components.find((component) => component.type === 'button').parameters, [
    { type: 'text', text: 'exchange-share-token' },
  ]);
});
