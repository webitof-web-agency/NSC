const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Customer = require('../../models/Customer');
const CompanySettings = require('../../models/CompanySettings');
const WhatsAppCampaign = require('../models/WhatsAppCampaign');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const WhatsAppMetaTemplate = require('../models/WhatsAppMetaTemplate');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const campaignController = require('./whatsappCampaignController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('eligibility uses the authenticated string user id and only excludes invalid phone numbers', async (t) => {
  const originalFind = Customer.find;
  let capturedQuery;

  t.after(() => {
    Customer.find = originalFind;
  });

  Customer.find = async (query) => {
    capturedQuery = query;
    return [
      {
        _id: 'eligible-id',
        name: 'Eligible Customer',
        phone: '7582898186',
        billingAddress: {},
        whatsappMarketingOptIn: true,
        whatsappMarketingOptOutAt: new Date(),
      },
      {
        _id: 'no-consent-id',
        name: 'No Consent Customer',
        phone: '9755100925',
        billingAddress: {},
        whatsappMarketingOptIn: false,
        whatsappMarketingOptOutAt: null,
      },
      {
        _id: 'invalid-id',
        name: 'Invalid Phone Customer',
        phone: '123',
        billingAddress: {},
        whatsappMarketingOptIn: true,
        whatsappMarketingOptOutAt: null,
      },
    ];
  };

  const response = createResponse();
  await campaignController.getEligibleCustomers(
    { user: '696f647d37958620faf6e2dd' },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedQuery.userId, '696f647d37958620faf6e2dd');
  assert.equal(response.body.stats.total, 3);
  assert.equal(response.body.stats.eligible, 2);
  assert.equal(response.body.stats.invalidPhone, 1);
  assert.equal(Object.hasOwn(response.body.stats, 'notOptedIn'), false);
  assert.equal(Object.hasOwn(response.body.stats, 'optedOut'), false);
  assert.equal(response.body.customers.length, 3);
  assert.equal(response.body.customers[0].eligibilityStatus, 'ELIGIBLE');
  assert.equal(response.body.customers[1].eligibilityStatus, 'ELIGIBLE');
  assert.equal(response.body.customers[2].eligibilityStatus, 'INVALID_PHONE');
  assert.deepEqual(
    response.body.eligibleCustomers.map((customer) => customer._id),
    ['eligible-id', 'no-consent-id']
  );
});

test('marketing consent fields and endpoints are not part of the application flow', () => {
  const files = [
    path.resolve(__dirname, '../routes/whatsappRoutes.js'),
    path.resolve(__dirname, './whatsappCampaignController.js'),
    path.resolve(__dirname, '../../models/Customer.js'),
    path.resolve(__dirname, '../../controllers/customerController.js'),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /whatsappMarketingOptIn|whatsappMarketingOptOut|updateMarketingConsent|customers\/:customerId\/consent/);
  }
});

test('campaign creation scopes templates, customers, and ownership to the authenticated string user id', async (t) => {
  const originals = {
    templateFindOne: WhatsAppMetaTemplate.findOne,
    customerFind: Customer.find,
    campaignFindOne: WhatsAppCampaign.findOne,
    campaignCreate: WhatsAppCampaign.create,
    campaignFindById: WhatsAppCampaign.findById,
    insertMany: WhatsAppMessageLog.insertMany,
  };
  let templateQuery;
  let customerQuery;
  let createPayload;

  t.after(() => {
    WhatsAppMetaTemplate.findOne = originals.templateFindOne;
    Customer.find = originals.customerFind;
    WhatsAppCampaign.findOne = originals.campaignFindOne;
    WhatsAppCampaign.create = originals.campaignCreate;
    WhatsAppCampaign.findById = originals.campaignFindById;
    WhatsAppMessageLog.insertMany = originals.insertMany;
  });

  WhatsAppCampaign.findOne = async () => null;
  WhatsAppMetaTemplate.findOne = async (query) => {
    templateQuery = query;
    return {
      metaId: 'meta-template-id',
      name: 'marketing_template',
      language: 'en',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [],
    };
  };
  Customer.find = async (query) => {
    customerQuery = query;
    return [{
      _id: 'customer-id',
      name: 'Customer',
      phone: '7582898186',
      whatsappMarketingOptIn: false,
      whatsappMarketingOptOutAt: new Date(),
    }];
  };
  WhatsAppCampaign.create = async (payload) => {
    createPayload = payload;
    return {
      _id: 'campaign-id',
      ...payload,
    };
  };
  WhatsAppMessageLog.insertMany = async () => [];
  WhatsAppCampaign.findById = async () => null;

  const response = createResponse();
  await campaignController.createCampaign(
    {
      user: '696f647d37958620faf6e2dd',
      headers: { 'idempotency-key': 'campaign-key' },
      body: {
        name: 'Campaign',
        metaTemplateId: 'meta-template-id',
        sendToAllEligible: true,
        selectedCustomerIds: [],
        variableMappings: [],
      },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(templateQuery, {
    userId: '696f647d37958620faf6e2dd',
    metaId: 'meta-template-id',
  });
  assert.deepEqual(customerQuery, {
    userId: '696f647d37958620faf6e2dd',
    isDeleted: false,
    status: 'Active',
  });
  assert.equal(createPayload.userId, '696f647d37958620faf6e2dd');
  assert.equal(createPayload.createdBy, '696f647d37958620faf6e2dd');
});

test('campaign template components include the approved Meta structure and company logo fallback', () => {
  assert.equal(typeof campaignController.buildCampaignTemplateComponents, 'function');

  const components = campaignController.buildCampaignTemplateComponents({
    campaign: {
      variableMappings: [{
        component: 'BODY',
        parameterIndex: 1,
        sourceType: 'VARIABLE',
        sourceValue: 'customerName',
      }],
      headerMapping: { sourceType: 'NONE' },
    },
    template: {
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Hello {{1}}' },
      ],
    },
    customer: {
      name: 'Customer',
      phone: '7582898186',
    },
    companySettings: {
      companyName: 'NARESH KIDS WEAR',
      companyLogo: '/uploads/company-logo.png',
    },
  });

  assert.deepEqual(components, [
    {
      type: 'header',
      parameters: [{
        type: 'image',
        image: { link: 'https://server.nareshsareecollection.com/uploads/company-logo.png' },
      }],
    },
    {
      type: 'body',
      parameters: [{ type: 'text', text: 'Customer' }],
    },
  ]);
});

test('campaign worker waits for a scheduled transient retry and then completes it', async (t) => {
  const originals = {
    campaignFindById: WhatsAppCampaign.findById,
    campaignFindByIdAndUpdate: WhatsAppCampaign.findByIdAndUpdate,
    templateFindOne: WhatsAppMetaTemplate.findOne,
    settingsFindOne: WhatsAppSettings.findOne,
    companyFindOne: CompanySettings.findOne,
    logFind: WhatsAppMessageLog.find,
    logUpdateMany: WhatsAppMessageLog.updateMany,
    logFindByIdAndUpdate: WhatsAppMessageLog.findByIdAndUpdate,
    logCountDocuments: WhatsAppMessageLog.countDocuments,
    customerFindById: Customer.findById,
    fetch: global.fetch,
  };

  t.after(() => {
    WhatsAppCampaign.findById = originals.campaignFindById;
    WhatsAppCampaign.findByIdAndUpdate = originals.campaignFindByIdAndUpdate;
    WhatsAppMetaTemplate.findOne = originals.templateFindOne;
    WhatsAppSettings.findOne = originals.settingsFindOne;
    CompanySettings.findOne = originals.companyFindOne;
    WhatsAppMessageLog.find = originals.logFind;
    WhatsAppMessageLog.updateMany = originals.logUpdateMany;
    WhatsAppMessageLog.findByIdAndUpdate = originals.logFindByIdAndUpdate;
    WhatsAppMessageLog.countDocuments = originals.logCountDocuments;
    Customer.findById = originals.customerFindById;
    global.fetch = originals.fetch;
  });

  const campaign = {
    _id: 'campaign-id',
    userId: '696f647d37958620faf6e2dd',
    status: 'QUEUED',
    template: {
      metaTemplateId: 'meta-template-id',
      name: 'marketing_template',
      language: 'en',
    },
    variableMappings: [],
    headerMapping: { sourceType: 'NONE' },
    acceptedCount: 0,
    failedCount: 0,
    queuedCount: 1,
    async save() {},
  };
  const log = {
    _id: 'log-id',
    customerId: 'customer-id',
    customerPhone: '917582898186',
    status: 'QUEUED',
    nextRetryAt: new Date(0),
    requestStartedAt: null,
    processingBy: null,
    attemptCount: 0,
  };

  WhatsAppCampaign.findById = async () => campaign;
  WhatsAppCampaign.findByIdAndUpdate = async (_id, update) => {
    for (const [field, amount] of Object.entries(update.$inc || {})) {
      campaign[field] += amount;
    }
  };
  WhatsAppMetaTemplate.findOne = async () => ({
    status: 'APPROVED',
    category: 'MARKETING',
    components: [],
  });
  WhatsAppSettings.findOne = async () => ({
    isEnabled: true,
    accessToken: 'token',
    phoneNumberId: 'phone-id',
    businessAccountId: 'business-id',
    webhookVerifyToken: 'verify-token',
    apiVersion: 'v25.0',
  });
  CompanySettings.findOne = () => ({
    lean: async () => ({ companyName: 'NARESH KIDS WEAR' }),
  });
  WhatsAppMessageLog.find = (query) => {
    if (query.$or) {
      return {
        limit: async () => (
          log.status === 'QUEUED' && log.nextRetryAt <= new Date() ? [log] : []
        ),
      };
    }
    if (query.processingBy) {
      return Promise.resolve(log.processingBy === query.processingBy ? [log] : []);
    }
    return Promise.resolve([]);
  };
  WhatsAppMessageLog.updateMany = async (_query, update) => {
    Object.assign(log, update.$set || {});
    return { modifiedCount: 1 };
  };
  WhatsAppMessageLog.findByIdAndUpdate = async (_id, update) => {
    Object.assign(log, update.$set || {});
  };
  WhatsAppMessageLog.countDocuments = async () => (
    ['QUEUED', 'PROCESSING'].includes(log.status) ? 1 : 0
  );
  Customer.findById = async () => ({
    _id: 'customer-id',
    name: 'Customer',
    phone: '7582898186',
  });

  let sendAttempts = 0;
  global.fetch = async () => {
    sendAttempts += 1;
    if (sendAttempts === 1) {
      return {
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: { message: 'Temporary Meta outage' } }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ messages: [{ id: 'wamid-success' }] }),
    };
  };

  await campaignController.processCampaign('campaign-id');

  assert.equal(sendAttempts, 2);
  assert.equal(log.status, 'ACCEPTED');
  assert.equal(campaign.status, 'COMPLETED');
  assert.equal(campaign.acceptedCount, 1);
});
