const jwt = require('jsonwebtoken');

const HISTORY_SESSION_COOKIE = 'customer_history_session';
const HISTORY_SESSION_AUDIENCE = 'customer-invoice-history';

const parseCookieHeader = (header = '') => String(header)
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .reduce((cookies, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) return cookies;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) return cookies;

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});

const verifyCustomerHistorySessionToken = (token, secret = process.env.JWT_SECRET) => {
  if (!token || !secret) {
    throw new Error('Invalid history session');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret, { audience: HISTORY_SESSION_AUDIENCE });
  } catch {
    throw new Error('Invalid history session');
  }

  if (
    decoded?.type !== 'customer-history'
    || !decoded?.customerId
    || !decoded?.ownerUserId
    || !decoded?.otpVerifiedAt
  ) {
    throw new Error('Invalid history session');
  }

  return decoded;
};

const requireCustomerHistorySession = (req, res, next) => {
  try {
    const cookies = parseCookieHeader(req.headers.cookie);
    const session = verifyCustomerHistorySessionToken(cookies[HISTORY_SESSION_COOKIE]);
    req.customerHistorySession = {
      customerId: session.customerId,
      ownerUserId: session.ownerUserId,
      otpVerifiedAt: session.otpVerifiedAt,
    };
    return next();
  } catch {
    res.set('Cache-Control', 'private, no-store');
    return res.status(401).json({
      success: false,
      message: 'Customer verification is required.',
    });
  }
};

module.exports = {
  HISTORY_SESSION_COOKIE,
  HISTORY_SESSION_AUDIENCE,
  parseCookieHeader,
  verifyCustomerHistorySessionToken,
  requireCustomerHistorySession,
};
