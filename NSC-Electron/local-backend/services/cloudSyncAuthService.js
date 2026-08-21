'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const LocalConfig = require('../models/LocalConfig');

function isFreshToken(token, minimumValiditySeconds = 300) {
  if (!token) return false;
  const decoded = jwt.decode(token);
  return Boolean(decoded?.exp && decoded.exp > Math.floor(Date.now() / 1000) + minimumValiditySeconds);
}

async function getConfigValue(tokenStore, key) {
  const entry = await tokenStore.findOne({ key });
  return entry?.value || null;
}

async function setConfigValue(tokenStore, key, value) {
  await tokenStore.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true },
  );
}

async function ensureCloudSyncToken({
  email,
  password,
  remoteBackendUrl,
  forceRefresh = false,
  httpClient = axios,
  tokenStore = LocalConfig,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cachedToken = await getConfigValue(tokenStore, 'syncToken');
  const cachedEmail = await getConfigValue(tokenStore, 'syncTokenEmail');

  if (!forceRefresh && cachedEmail === normalizedEmail && isFreshToken(cachedToken)) {
    return { token: cachedToken, user: null, source: 'cache' };
  }

  const response = await httpClient.post(
    `${remoteBackendUrl}/api/auth/login`,
    { email, password },
    { timeout: 10000 },
  );
  const { token, user } = response.data || {};
  if (!token) throw new Error('Cloud login did not return a sync token');

  await setConfigValue(tokenStore, 'syncToken', token);
  await setConfigValue(tokenStore, 'syncTokenEmail', normalizedEmail);

  return { token, user, source: 'cloud' };
}

module.exports = {
  ensureCloudSyncToken,
  isFreshToken,
};
