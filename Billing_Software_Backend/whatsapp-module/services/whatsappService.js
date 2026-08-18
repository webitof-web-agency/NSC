const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { normalizePhoneNumber } = require('../utils/phoneFormatter');
const { renderWhatsAppMessage } = require('../utils/templateRenderer');
const { generateDocumentPdfBuffer } = require('../utils/pdfGenerator');
const { decryptValue } = require('../utils/credentialCrypto');
const { getWhatsAppConfig } = require('../../config/whatsapp');
const { getWhatsAppModuleConfig } = require('../context');

const MAX_SEND_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function getGraphBaseUrl(apiVersion, phoneNumberId, path) {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/${path}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableWhatsAppError(error) {
  if (!error) return false;
  if (RETRYABLE_STATUS_CODES.has(Number(error.statusCode))) return true;

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  );
}

async function callWhatsAppApi({ url, method = 'GET', token, body, isFormData = false }) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMsg = payload?.error?.message || (typeof payload === 'string' ? payload : 'WhatsApp API request failed');
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.metaCode = payload?.error?.code;
    error.metaType = payload?.error?.type;
    error.metaSubcode = payload?.error?.error_subcode;
    error.details = payload?.error?.error_data?.details;
    error.fbtrace_id = payload?.error?.fbtrace_id;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function withRetry(operation) {
  let attempt = 0;
  let lastError;

  while (attempt < MAX_SEND_RETRIES) {
    attempt += 1;
    try {
      const result = await operation(attempt);
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_SEND_RETRIES || !isRetryableWhatsAppError(error)) {
        error.attempts = attempt;
        throw error;
      }
      await sleep(500 * Math.pow(2, attempt - 1));
    }
  }

  lastError.attempts = MAX_SEND_RETRIES;
  throw lastError;
}

function mergeConfig(settingsDoc) {
  const envConfig = getWhatsAppConfig();

  return {
    isEnabled: settingsDoc?.isEnabled === true,
    accessToken: settingsDoc?.accessToken ? decryptValue(settingsDoc.accessToken) : envConfig.accessToken,
    phoneNumberId: settingsDoc?.phoneNumberId || envConfig.phoneNumberId,
    businessAccountId: settingsDoc?.businessAccountId || envConfig.businessAccountId,
    webhookVerifyToken: settingsDoc?.webhookVerifyToken || envConfig.webhookVerifyToken,
    appSecret: settingsDoc?.appSecret ? decryptValue(settingsDoc.appSecret) : envConfig.appSecret,
    apiVersion: settingsDoc?.apiVersion || envConfig.apiVersion,
    autoSendOnInvoice: settingsDoc?.autoSendOnInvoice !== false,
    autoSendOnExchange: settingsDoc?.autoSendOnExchange !== false,
    autoSendOnQuotation: settingsDoc?.autoSendOnQuotation !== false,
  };
}

function getDocumentLabel(documentType) {
  if (documentType === 'quotation') return 'Quotation';
  if (documentType === 'exchange') return 'Exchange Invoice';
  return 'Invoice';
}

function getDocumentNumber(documentType, document) {
  if (documentType === 'quotation') {
    return document.quotationId || document.referenceNo || String(document._id);
  }

  return document.invoiceNumber || document.referenceNo || String(document._id);
}

function formatDocumentDate(documentType, document) {
  const rawDate = documentType === 'quotation' ? document.quotationDate : document.invoiceDate;
  return rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : '';
}

async function resolveDocumentContextFromModels({ documentType, documentId, userId }) {
  const { models } = getWhatsAppModuleConfig();
  const {
    CustomerModel,
    InvoiceModel,
    QuotationModel,
    CompanySettingsModel,
  } = models;

  const DocumentModel = documentType === 'quotation' ? QuotationModel : InvoiceModel;

  if (!DocumentModel || !CustomerModel || !CompanySettingsModel) {
    throw new Error(
      'WhatsApp module is not configured. Provide models or a custom resolveDocumentContext adapter before sending messages.'
    );
  }

  if (documentType === 'quotation' && !QuotationModel) {
    throw new Error('WhatsApp module is missing a Quotation model adapter.');
  }

  const document = await DocumentModel.findOne({ _id: documentId, userId, isDeleted: false }).lean();

  if (!document) {
    throw new Error(`${getDocumentLabel(documentType)} not found`);
  }

  const customerId = document.billTo || document.customerId || null;
  const customer = customerId && String(customerId) !== 'UNKNOWN'
    ? await CustomerModel.findOne({ _id: customerId, userId, isDeleted: false }).lean()
    : null;
  const companySettings = await CompanySettingsModel.findOne({ userId }).lean();

  return {
    document,
    customer,
    companySettings,
    customerId: customer?._id || null,
    customerName: customer?.name || 'Customer',
    customerPhone: customer?.phone || '',
    documentNumber: getDocumentNumber(documentType, document),
    amount: Number(document.TotalAmount || 0),
    date: formatDocumentDate(documentType, document),
    items: Array.isArray(document.items) ? document.items : [],
    status: document.status || '',
    companyName: companySettings?.companyName || 'Your Company',
    documentLabel: getDocumentLabel(documentType),
  };
}

async function resolveDocumentContext(params) {
  const { resolveDocumentContext: customResolver } = getWhatsAppModuleConfig();

  if (typeof customResolver === 'function') {
    const resolved = await customResolver(params);
    if (!resolved || typeof resolved !== 'object') {
      throw new Error('Custom resolveDocumentContext adapter must return a context object.');
    }
    return resolved;
  }

  return resolveDocumentContextFromModels(params);
}

async function uploadMediaToWhatsApp({ config, pdfBuffer, filename }) {
  const form = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  form.append('file', blob, filename);
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');

  return await callWhatsAppApi({
    url: getGraphBaseUrl(config.apiVersion, config.phoneNumberId, 'media'),
    method: 'POST',
    token: config.accessToken,
    body: form,
    isFormData: true,
  });
}

async function sendTextMessage({ config, phone, text }) {
  return await callWhatsAppApi({
    url: getGraphBaseUrl(config.apiVersion, config.phoneNumberId, 'messages'),
    method: 'POST',
    token: config.accessToken,
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    },
  });
}

async function sendTemplateMessage({ config, phone, templateName, languageCode }) {
  return await callWhatsAppApi({
    url: getGraphBaseUrl(config.apiVersion, config.phoneNumberId, 'messages'),
    method: 'POST',
    token: config.accessToken,
    body: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    },
  });
}

async function sendDocumentMessage({ config, phone, mediaId, filename, caption }) {
  return await callWhatsAppApi({
    url: getGraphBaseUrl(config.apiVersion, config.phoneNumberId, 'messages'),
    method: 'POST',
    token: config.accessToken,
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        caption,
      },
    },
  });
}

async function getMessageStatus({ config, messageId }) {
  return await callWhatsAppApi({
    url: `https://graph.facebook.com/${config.apiVersion}/${messageId}`,
    method: 'GET',
    token: config.accessToken,
  });
}

async function fetchConversationReplies() {
  return [];
}

function shouldAutoSend(config, documentType) {
  if (documentType === 'quotation') return config.autoSendOnQuotation;
  if (documentType === 'exchange') return config.autoSendOnExchange;
  return config.autoSendOnInvoice;
}

async function triggerWhatsAppSend({ documentType, documentId, userId, manual = false }) {
  const settingsDoc = await WhatsAppSettings.findOne({ userId });
  const config = mergeConfig(settingsDoc);

  if (!config.isEnabled && !manual) {
    return { skipped: true, reason: 'WhatsApp is disabled' };
  }

  if (!shouldAutoSend(config, documentType) && !manual) {
    return { skipped: true, reason: `Auto-send disabled for ${documentType}` };
  }

  const context = await resolveDocumentContext({ documentType, documentId, userId });

  const template =
    (await WhatsAppTemplate.findOne({ userId, type: documentType, isActive: true }).lean()) ||
    {
      type: documentType,
      includeDocument: true,
    };

  const rendered = renderWhatsAppMessage({
    template,
    context: {
      customerName: context.customerName,
      customerPhone: context.customerPhone,
      documentNumber: context.documentNumber,
      amount: context.amount,
      date: context.date,
      companyName: context.companyName,
      documentType,
    },
  });

  const log = await WhatsAppMessageLog.create({
    userId,
    customerId: context.customerId,
    customerPhone: context.customerPhone || '',
    customerName: context.customerName,
    documentType,
    documentId,
    documentNumber: context.documentNumber,
    status: 'queued',
    renderedMessage: rendered.text,
    amount: context.amount,
    lastAttemptAt: new Date(),
    metadata: {
      manual,
    },
  });

  try {
    if (!config.isEnabled && manual) {
      throw new Error('WhatsApp is disabled in settings');
    }

    if (!config.accessToken || !config.phoneNumberId || !config.businessAccountId || !config.webhookVerifyToken) {
      throw new Error('WhatsApp credentials are incomplete');
    }

    if (!String(context.customerPhone || '').trim()) {
      await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
        $set: {
          status: 'failed',
          errorMessage: 'Customer phone number is missing',
          lastAttemptAt: new Date(),
        },
      });
      return { skipped: true, logId: log._id, reason: 'Customer phone number is missing' };
    }

    const phone = normalizePhoneNumber(context.customerPhone);
    const sendOutcome = await withRetry(async () => {
      if (template.includeDocument) {
        const pdfBuffer = await generateDocumentPdfBuffer({
          companyName: context.companyName,
          documentLabel: context.documentLabel,
          documentNumber: context.documentNumber,
          customerName: context.customerName,
          customerPhone: phone,
          date: context.date,
          amount: context.amount.toFixed ? context.amount.toFixed(2) : String(context.amount),
          status: context.status,
          items: context.items,
        });

        const filename = `${documentType}-${context.documentNumber || documentId}.pdf`;
        const mediaUpload = await uploadMediaToWhatsApp({ config, pdfBuffer, filename });
        const mediaId = mediaUpload.id || '';
        const response = await sendDocumentMessage({
          config,
          phone,
          mediaId,
          filename,
          caption: rendered.text,
        });

        return { response, mediaId };
      }

      const response = await sendTextMessage({
        config,
        phone,
        text: rendered.text,
      });

      return { response, mediaId: '' };
    });

    const messageId = sendOutcome.result?.response?.messages?.[0]?.id || '';

    await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
      $set: {
        customerPhone: phone,
        messageId,
        mediaId: sendOutcome.result.mediaId,
        status: 'sent',
        sentAt: new Date(),
        lastAttemptAt: new Date(),
        retryCount: Math.max(sendOutcome.attempts - 1, 0),
        errorMessage: '',
      },
    });

    return {
      success: true,
      logId: log._id,
      messageId,
      retryCount: Math.max(sendOutcome.attempts - 1, 0),
    };
  } catch (error) {
    await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
      $set: {
        status: 'failed',
        errorMessage: error.message,
        lastAttemptAt: new Date(),
        retryCount: Math.max((error.attempts || 1) - 1, 0),
      },
    });

    throw error;
  }
}

module.exports = {
  MAX_SEND_RETRIES,
  mergeConfig,
  resolveDocumentContext,
  resolveDocumentContextFromModels,
  uploadMediaToWhatsApp,
  sendDocumentMessage,
  sendTextMessage,
  sendTemplateMessage,
  getMessageStatus,
  fetchConversationReplies,
  isRetryableWhatsAppError,
  triggerWhatsAppSend,
};
