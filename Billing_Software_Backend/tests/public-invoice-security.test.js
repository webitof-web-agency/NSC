const assert = require('node:assert/strict');
const test = require('node:test');
const publicInvoiceController = require('../controllers/publicInvoiceController');
const { publicInvoiceRateLimit } = require('../middleware/publicInvoiceRateLimit');

const createResponse = () => ({
  headers: {},
  statusCode: 200,
  body: null,
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('malformed share IDs return the same generic not-found response before database lookup', async () => {
  const response = createResponse();
  await publicInvoiceController.getPublicInvoice({
    params: { publicShareId: 'short-and-invalid!' },
  }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { success: false, message: 'Invoice not found' });
  assert.match(response.headers['Cache-Control'], /private/);
  assert.equal(response.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('public invoice rate limiter returns a generic retry response after the fixed-window limit', () => {
  let limitedResponse;
  for (let requestNumber = 0; requestNumber < 121; requestNumber += 1) {
    const response = createResponse();
    publicInvoiceRateLimit(
      { ip: 'public-invoice-security-test' },
      response,
      () => {},
    );
    limitedResponse = response;
  }

  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.body.success, false);
  assert.ok(Number(limitedResponse.headers['Retry-After']) > 0);
});
