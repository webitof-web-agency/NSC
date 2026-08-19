const test = require('node:test');
const assert = require('node:assert/strict');

const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const WhatsAppTemplateAssignment = require('../models/WhatsAppTemplateAssignment');
const { configureWhatsAppModule } = require('../context');

test('manual invoice send uses the assigned Meta template and mapped values', async (t) => {
  const originalSettingsFindOne = WhatsAppSettings.findOne;
  const originalLegacyTemplateFindOne = WhatsAppTemplate.findOne;
  const originalLogCreate = WhatsAppMessageLog.create;
  const originalLogUpdate = WhatsAppMessageLog.findByIdAndUpdate;
  const originalAssignmentFindOne = WhatsAppTemplateAssignment.findOne;
  const originalFetch = global.fetch;

  t.after(() => {
    WhatsAppSettings.findOne = originalSettingsFindOne;
    WhatsAppTemplate.findOne = originalLegacyTemplateFindOne;
    WhatsAppMessageLog.create = originalLogCreate;
    WhatsAppMessageLog.findByIdAndUpdate = originalLogUpdate;
    WhatsAppTemplateAssignment.findOne = originalAssignmentFindOne;
    global.fetch = originalFetch;
  });

  const invoice = {
    publicShareId: 'public-share-id',
    publicShareEnabled: true,
  };
  configureWhatsAppModule({
    resolveDocumentContext: async () => ({
      document: invoice,
      customerId: 'customer-id',
      customerName: 'Customer',
      customerPhone: '7582898186',
      documentNumber: 'INV_27-26_000059',
      amount: 1950,
      date: '19/08/2026',
      items: [],
      status: 'PAID',
      companyName: 'NARESH KIDS WEAR',
      documentLabel: 'Invoice',
    }),
    models: {
      InvoiceModel: {
        findById: async () => invoice,
      },
    },
  });

  WhatsAppSettings.findOne = async () => ({
    isEnabled: true,
    accessToken: 'test-access-token',
    phoneNumberId: 'phone-number-id',
    businessAccountId: 'business-account-id',
    webhookVerifyToken: 'verify-token',
    apiVersion: 'v25.0',
  });
  WhatsAppTemplate.findOne = () => {
    throw new Error('The legacy local template must not be read');
  };
  WhatsAppTemplateAssignment.findOne = () => ({
    populate() {
      return this;
    },
    async lean() {
      return {
        _id: 'assignment-id',
        isEnabled: true,
        metaTemplateName: 'invoice_template',
        languageCode: 'en',
        metaTemplateId: {
          _id: 'meta-template-id',
          status: 'APPROVED',
          components: [{ type: 'HEADER', format: 'IMAGE' }],
        },
        headerMapping: { sourceType: 'NONE' },
        variableMappings: [
          { component: 'BODY', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'customerName' },
          { component: 'BODY', parameterIndex: 2, sourceType: 'VARIABLE', sourceValue: 'documentNumber' },
          { component: 'BODY', parameterIndex: 3, sourceType: 'VARIABLE', sourceValue: 'amount' },
          { component: 'BODY', parameterIndex: 4, sourceType: 'VARIABLE', sourceValue: 'companyName' },
          { component: 'BUTTONS', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'publicShareId', buttonIndex: 0 },
        ],
      };
    },
  });

  let createdLog;
  let updatedLog;
  WhatsAppMessageLog.create = async (payload) => {
    createdLog = payload;
    assert.equal(payload.status, 'QUEUED');
    return { _id: 'message-log-id' };
  };
  WhatsAppMessageLog.findByIdAndUpdate = async (_id, update) => {
    updatedLog = update.$set;
  };

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ messages: [{ id: 'meta-message-id' }] }),
    };
  };

  const { triggerWhatsAppSend } = require('./whatsappService');
  const result = await triggerWhatsAppSend({
    documentType: 'invoice',
    documentId: 'invoice-id',
    userId: 'user-id',
    manual: true,
  });

  assert.equal(result.success, true);
  assert.equal(createdLog.metadata.templateName, 'invoice_template');
  assert.equal(updatedLog.status, 'ACCEPTED');
  assert.equal(updatedLog.messageId, 'meta-message-id');
  assert.equal(requests.length, 1, 'a template without a document header must not invoke PDF/media upload');

  const requestBody = JSON.parse(requests[0].options.body);
  assert.equal(requestBody.type, 'template');
  assert.equal(requestBody.template.name, 'invoice_template');
  assert.equal(requestBody.template.language.code, 'en');
  assert.deepEqual(
    requestBody.template.components.find((component) => component.type === 'header'),
    {
      type: 'header',
      parameters: [{
        type: 'image',
        image: {
          link: 'https://app.nareshsareecollection.com/landing/assets/img/apple-icon.png',
        },
      }],
    }
  );
  assert.deepEqual(
    requestBody.template.components.find((component) => component.type === 'body').parameters,
    [
      { type: 'text', text: 'Customer' },
      { type: 'text', text: 'INV_27-26_000059' },
      { type: 'text', text: '1950' },
      { type: 'text', text: 'NARESH KIDS WEAR' },
    ]
  );
  assert.deepEqual(
    requestBody.template.components.find((component) => component.type === 'button'),
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: 'public-share-id' }],
    }
  );
});

test('manual invoice send reports a missing Meta assignment instead of falling back', async (t) => {
  const originalSettingsFindOne = WhatsAppSettings.findOne;
  const originalLegacyTemplateFindOne = WhatsAppTemplate.findOne;
  const originalAssignmentFindOne = WhatsAppTemplateAssignment.findOne;

  t.after(() => {
    WhatsAppSettings.findOne = originalSettingsFindOne;
    WhatsAppTemplate.findOne = originalLegacyTemplateFindOne;
    WhatsAppTemplateAssignment.findOne = originalAssignmentFindOne;
  });

  WhatsAppSettings.findOne = async () => ({
    isEnabled: true,
    accessToken: 'test-access-token',
    phoneNumberId: 'phone-number-id',
    businessAccountId: 'business-account-id',
    webhookVerifyToken: 'verify-token',
  });
  WhatsAppTemplate.findOne = () => {
    throw new Error('The legacy local template must not be read');
  };
  WhatsAppTemplateAssignment.findOne = () => ({
    populate() {
      return this;
    },
    async lean() {
      return null;
    },
  });

  const { triggerWhatsAppSend } = require('./whatsappService');
  await assert.rejects(
    triggerWhatsAppSend({
      documentType: 'invoice',
      documentId: 'invoice-id',
      userId: 'user-id',
      manual: true,
    }),
    /No active Meta Template assignment found for INVOICE/
  );
});
