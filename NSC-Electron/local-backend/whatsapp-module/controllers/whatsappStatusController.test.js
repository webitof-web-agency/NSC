const test = require('node:test');
const assert = require('node:assert/strict');

const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { listMessages, getMessageStats } = require('./whatsappController');

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

test('message list treats delivered and read filters as cumulative delivery states', async (t) => {
  const originalFind = WhatsAppMessageLog.find;
  const capturedQueries = [];

  t.after(() => {
    WhatsAppMessageLog.find = originalFind;
  });

  WhatsAppMessageLog.find = (query) => {
    capturedQueries.push(query);
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  };

  const response = createResponse();
  await listMessages(
    { user: '696f647d37958620faf6e2dd', query: { status: 'delivered' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedQueries[0].status, { $in: ['DELIVERED', 'READ', 'REPLIED'] });

  await listMessages(
    { user: '696f647d37958620faf6e2dd', query: { status: 'read' } },
    response
  );

  assert.deepEqual(capturedQueries[1].status, { $in: ['READ', 'REPLIED'] });
});

test('message stats aggregate over the uppercase stored statuses', async (t) => {
  const originalAggregate = WhatsAppMessageLog.aggregate;
  let capturedPipeline;

  t.after(() => {
    WhatsAppMessageLog.aggregate = originalAggregate;
  });

  WhatsAppMessageLog.aggregate = async (pipeline) => {
    capturedPipeline = pipeline;
    return [];
  };

  const response = createResponse();
  await getMessageStats(
    { user: '696f647d37958620faf6e2dd' },
    response
  );

  assert.equal(response.statusCode, 200);
  const serializedPipeline = JSON.stringify(capturedPipeline);
  assert.match(serializedPipeline, /"DELIVERED"/);
  assert.match(serializedPipeline, /"READ"/);
  assert.match(serializedPipeline, /"REPLIED"/);
  assert.doesNotMatch(serializedPipeline, /\["\$status",\["delivered"/);
  assert.doesNotMatch(serializedPipeline, /\["\$status",\["read"/);
  assert.doesNotMatch(serializedPipeline, /\["\$status","replied"\]/);
});
