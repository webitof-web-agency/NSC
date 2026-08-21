const test = require('node:test');
const assert = require('node:assert/strict');

const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { handleWebhook } = require('./whatsappWebhook');

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

test('incoming customer replies use the uppercase message-log status enum', async (t) => {
  const originalFindOneAndUpdate = WhatsAppMessageLog.findOneAndUpdate;
  let capturedUpdate;

  t.after(() => {
    WhatsAppMessageLog.findOneAndUpdate = originalFindOneAndUpdate;
  });

  WhatsAppMessageLog.findOneAndUpdate = async (_query, update) => {
    capturedUpdate = update;
  };

  const request = {
    headers: {},
    query: {},
    body: {
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{ from: '917582898186', text: { body: 'Received, thank you' } }],
          },
        }],
      }],
    },
  };
  const response = createResponse();

  await handleWebhook(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(capturedUpdate.$set.status, 'REPLIED');
  assert.equal(capturedUpdate.$set.replyText, 'Received, thank you');
});

test('Meta delivered and read callbacks update their matching message log', async (t) => {
  const originalFindOne = WhatsAppMessageLog.findOne;
  const originalFindByIdAndUpdate = WhatsAppMessageLog.findByIdAndUpdate;
  const updates = [];

  t.after(() => {
    WhatsAppMessageLog.findOne = originalFindOne;
    WhatsAppMessageLog.findByIdAndUpdate = originalFindByIdAndUpdate;
  });

  WhatsAppMessageLog.findOne = async ({ messageId }) => ({
    _id: `log-${messageId}`,
    messageId,
    status: 'ACCEPTED',
    campaignId: null,
  });
  WhatsAppMessageLog.findByIdAndUpdate = async (_id, update) => {
    updates.push(update.$set);
  };

  const request = {
    headers: {},
    query: {},
    body: {
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            statuses: [
              { id: 'wamid-delivered', status: 'delivered' },
              { id: 'wamid-read', status: 'read' },
            ],
          },
        }],
      }],
    },
  };
  const response = createResponse();

  await handleWebhook(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(updates[0].status, 'DELIVERED');
  assert.ok(updates[0].deliveredAt instanceof Date);
  assert.equal(updates[1].status, 'READ');
  assert.ok(updates[1].readAt instanceof Date);
});
