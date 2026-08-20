const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const {
  parseCookieHeader,
  verifyCustomerHistorySessionToken,
} = require('../middleware/customerHistorySession');

test('history session parser reads the dedicated HttpOnly cookie value', () => {
  assert.deepEqual(parseCookieHeader('theme=dark; customer_history_session=abc.def; x=1'), {
    theme: 'dark',
    customer_history_session: 'abc.def',
    x: '1',
  });
});

test('history session accepts only OTP-verified customer history tokens', () => {
  const secret = 'unit-test-secret';
  const validToken = jwt.sign({
    type: 'customer-history',
    customerId: 'customer-1',
    ownerUserId: 'owner-1',
    otpVerifiedAt: new Date().toISOString(),
  }, secret, { audience: 'customer-invoice-history', expiresIn: '10m' });

  const verified = verifyCustomerHistorySessionToken(validToken, secret);
  assert.equal(verified.customerId, 'customer-1');
  assert.equal(verified.ownerUserId, 'owner-1');

  const ordinaryCustomerToken = jwt.sign({
    type: 'customer',
    id: 'customer-1',
  }, secret, { expiresIn: '10m' });

  assert.throws(
    () => verifyCustomerHistorySessionToken(ordinaryCustomerToken, secret),
    /Invalid history session/,
  );
});
