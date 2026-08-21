const { getWhatsAppConfig } = require('../../config/whatsapp');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const { decryptValue } = require('../utils/credentialCrypto');

function getGraphBaseUrl(apiVersion, wabaId, path) {
  return `https://graph.facebook.com/${apiVersion}/${wabaId}/${path}`;
}

async function getAdminConfig(userId) {
  const envConfig = getWhatsAppConfig();
  const settingsDoc = await WhatsAppSettings.findOne({ userId }).lean();
  
  const accessToken = settingsDoc?.accessToken ? decryptValue(settingsDoc.accessToken) : envConfig.accessToken;
  const businessAccountId = settingsDoc?.businessAccountId || envConfig.businessAccountId;
  const apiVersion = settingsDoc?.apiVersion || envConfig.apiVersion;

  if (!accessToken || !businessAccountId) {
    throw new Error('WhatsApp Business Account credentials not fully configured.');
  }

  return { accessToken, businessAccountId, apiVersion };
}

async function callWhatsAppApi({ url, method = 'GET', token, body }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMsg = payload?.error?.message || (typeof payload === 'string' ? payload : 'Meta API request failed');
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.metaCode = payload?.error?.code;
    error.metaType = payload?.error?.type;
    error.metaSubcode = payload?.error?.error_subcode;
    error.details = payload?.error?.error_data?.details;
    error.fbtrace_id = payload?.error?.fbtrace_id;
    throw error;
  }

  return payload;
}

async function getMessageTemplates(userId, limit = 100) {
  const config = await getAdminConfig(userId);
  let url = getGraphBaseUrl(config.apiVersion, config.businessAccountId, `message_templates?limit=${limit}`);
  
  let allTemplates = [];
  let hasNext = true;

  while (hasNext) {
    const payload = await callWhatsAppApi({
      url,
      method: 'GET',
      token: config.accessToken,
    });

    if (payload.data && payload.data.length > 0) {
      allTemplates = allTemplates.concat(payload.data);
    }

    if (payload.paging && payload.paging.cursors && payload.paging.cursors.after) {
      url = getGraphBaseUrl(config.apiVersion, config.businessAccountId, `message_templates?limit=${limit}&after=${payload.paging.cursors.after}`);
    } else if (payload.paging && payload.paging.next) {
      url = payload.paging.next;
    } else {
      hasNext = false;
    }
  }

  return { data: allTemplates };
}
async function createMessageTemplate(userId, templatePayload) {
  const config = await getAdminConfig(userId);
  const url = getGraphBaseUrl(config.apiVersion, config.businessAccountId, 'message_templates');

  return await callWhatsAppApi({
    url,
    method: 'POST',
    token: config.accessToken,
    body: templatePayload,
  });
}

module.exports = {
  getMessageTemplates,
  createMessageTemplate,
};
