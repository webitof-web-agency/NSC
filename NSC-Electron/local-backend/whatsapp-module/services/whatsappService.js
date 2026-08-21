const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const WhatsAppTemplateAssignment = require('../models/WhatsAppTemplateAssignment');
require('../models/WhatsAppMetaTemplate');
const { normalizePhoneNumber } = require('../utils/phoneFormatter');
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
    return document.quotationId || document.referenceNo || '';
  }

  return document.invoiceNumber || document.referenceNo || '';
}

function formatDocumentDate(documentType, document) {
  const rawDate = documentType === 'quotation' ? document.quotationDate : document.invoiceDate;
  return rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : '';
}

function buildDocumentLookup(documentId, userId) {
  const normalizedId = String(documentId || '').trim();
  const identity = /^[a-f\d]{24}$/i.test(normalizedId)
    ? { _id: normalizedId }
    : { syncId: normalizedId };
  return { ...identity, userId, isDeleted: false };
}

async function resolveDocumentContextFromModels({ documentType, documentId, userId, resolvePublicUrl = true }) {
  const { models } = getWhatsAppModuleConfig();
  const {
    CustomerModel,
    InvoiceModel,
    QuotationModel,
    CompanySettingsModel,
    InvoicePaymentModel,
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

  const document = await DocumentModel.findOne(buildDocumentLookup(documentId, userId)).lean();

  if (!document) {
    throw new Error(`${getDocumentLabel(documentType)} not found`);
  }

  const customerId = document.billTo || document.customerId || null;
  const customer = customerId && String(customerId) !== 'UNKNOWN'
    ? await CustomerModel.findOne({ _id: customerId, userId, isDeleted: false }).lean()
    : null;
  const companySettings = await CompanySettingsModel.findOne({ userId }).lean();

  let publicShareUrl = '';
  if (resolvePublicUrl && (documentType === 'invoice' || documentType === 'exchange' || documentType === 'payment_reminder')) {
    const publicShareService = require('../../services/publicShareService');
    const invoiceModelInstance = await InvoiceModel.findOne({ _id: document._id, userId, isDeleted: false });
    if (invoiceModelInstance) {
      const publicShareId = await publicShareService.getOrCreatePublicShareId(invoiceModelInstance);
      publicShareUrl = publicShareService.buildPublicDocumentUrl(
        publicShareId,
        documentType === 'exchange' ? 'EXCHANGE' : 'INVOICE',
      );
    }
  }

  let paidAmount = 0;
  let outstandingAmount = 0;
  if (documentType !== 'quotation' && InvoiceModel) {
    const { getInvoiceOutstandingAmount } = require('../../services/invoicePaymentService');
    const result = await getInvoiceOutstandingAmount(document._id, document);
    paidAmount = result.totalPaid;
    outstandingAmount = result.outstandingAmount;
  }

  return {
    document,
    customer,
    companySettings,
    customerId: customer?._id || null,
    customerName: customer?.name || 'Customer',
    customerPhone: customer?.phone || '',
    companyName: companySettings?.companyName || 'Your Company',
    companyPhone: companySettings?.phone || '',
    companyEmail: companySettings?.email || '',
    documentNumber: getDocumentNumber(documentType, document),
    amount: Number(document.TotalAmount || 0),
    date: formatDocumentDate(documentType, document),
    items: Array.isArray(document.items) ? document.items : [],
    status: document.status || '',
    documentLabel: getDocumentLabel(documentType),
    paidAmount,
    outstandingAmount,
    dueDate: document.dueDate ? formatDocumentDate(documentType, { invoiceDate: document.dueDate }) : '',
    invoicePublicUrl: publicShareUrl,
    exchangePublicUrl: publicShareUrl,
    
    // Exchange specific fields
    exchangeOldTotal: document.exchangeOldTotal || 0,
    exchangeNewTotal: document.exchangeNewTotal || 0,
    amountDifference: document.amountDifference || 0,
    returnedAmount: document.returned_amount || 0,
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

const PUBLIC_SHARE_CONTEXT_KEYS = {
  invoice: 'publicShareId',
  quotation: 'quotationPublicShareId',
  exchange: 'exchangePublicShareId',
};

const PUBLIC_SHARE_MAPPING_SOURCES = new Set([
  'publicShareId',
  'quotationPublicShareId',
  'exchangePublicShareId',
]);

async function ensurePublicShareMappingContext({ documentType, documentId, userId, assignment, context }) {
  const normalizedType = String(documentType || '').toLowerCase();
  const contextKey = PUBLIC_SHARE_CONTEXT_KEYS[normalizedType];
  const needsPublicShareId = assignment.variableMappings?.some(
    (mapping) => PUBLIC_SHARE_MAPPING_SOURCES.has(mapping.sourceValue),
  );

  if (!needsPublicShareId || !contextKey) return context;

  let publicShareId = context.document?.publicShareEnabled !== false
    ? String(context.document?.publicShareId || '')
    : '';

  if (!publicShareId) {
    const { InvoiceModel, QuotationModel } = getWhatsAppModuleConfig().models;
    const DocumentModel = normalizedType === 'quotation' ? QuotationModel : InvoiceModel;

    if (!DocumentModel) {
      throw new Error(`${getDocumentLabel(normalizedType)} model is unavailable while preparing the WhatsApp template link`);
    }

    const documentModelInstance = await DocumentModel.findOne(buildDocumentLookup(documentId, userId));
    if (!documentModelInstance) {
      throw new Error(`${getDocumentLabel(normalizedType)} not found while preparing the WhatsApp template link`);
    }

    const publicShareService = require('../../services/publicShareService');
    publicShareId = await publicShareService.getOrCreatePublicShareId(documentModelInstance);
  }

  // Keep the legacy invoice source working while exposing document-specific sources.
  context.publicShareId = publicShareId;
  context[contextKey] = publicShareId;
  return context;
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

async function sendTemplateMessage({ config, phone, templateName, languageCode, components = [] }) {
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
        components: components.length > 0 ? components : undefined,
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

function isMappingUsedByMetaTemplate(mapping, metaTemplate) {
  const components = Array.isArray(metaTemplate?.components) ? metaTemplate.components : [];
  const parameterToken = `{{${Number(mapping.parameterIndex)}}}`;

  if (mapping.component === 'BODY') {
    return components.some((component) => (
      component.type === 'BODY' && String(component.text || '').includes(parameterToken)
    ));
  }

  if (mapping.component === 'HEADER') {
    return components.some((component) => (
      component.type === 'HEADER'
      && component.format === 'TEXT'
      && String(component.text || '').includes(parameterToken)
    ));
  }

  if (mapping.component === 'BUTTONS') {
    const buttonsComponent = components.find((component) => component.type === 'BUTTONS');
    const button = buttonsComponent?.buttons?.[Number(mapping.buttonIndex || 0)];
    return button?.type === 'URL' && String(button.url || '').includes(parameterToken);
  }

  return false;
}

function buildTemplateComponents(assignment, context, mediaId = null, filename = null, documentType = '') {
  const components = [];

  // Group variables by component type
  const bodyParams = [];
  const headerParams = [];

  if (assignment.variableMappings && assignment.variableMappings.length > 0) {
    const sortedMappings = assignment.variableMappings
      .filter((mapping) => isMappingUsedByMetaTemplate(mapping, assignment.metaTemplateId))
      .sort((a, b) => a.parameterIndex - b.parameterIndex);

    for (const mapping of sortedMappings) {
      let resolvedValue = '';
      if (mapping.sourceType === 'FIXED') {
        resolvedValue = mapping.sourceValue;
      } else if (mapping.sourceType === 'VARIABLE') {
        resolvedValue = String(context[mapping.sourceValue] ?? '');
      }

      if (mapping.component === 'BODY') {
        bodyParams.push({ type: 'text', text: resolvedValue });
      } else if (mapping.component === 'HEADER') {
        headerParams.push({ type: 'text', text: resolvedValue });
      } else if (mapping.component === 'BUTTONS') {
        // Not perfectly mapped for all button types, assuming dynamic URL for now
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(mapping.buttonIndex || 0),
          parameters: [{ type: 'text', text: resolvedValue }]
        });
      }
    }
  }

  const headerComponentDef = assignment.metaTemplateId?.components?.find(c => c.type === 'HEADER');
  
  if (headerComponentDef) {
    if (headerComponentDef.format === 'IMAGE') {
      const isPdfHeader = assignment.headerMapping?.sourceType === 'DOCUMENT_PDF';
      
      if (isPdfHeader) {
        // Technically meta templates shouldn't have IMAGE format but use DOCUMENT for PDFs, 
        // but if someone forced it, we should throw error.
        throw new Error(`Assignment maps DOCUMENT_PDF but Meta template expects IMAGE header for ${assignment.messageType}`);
      }
      
      let imageUrl = null;
      if (assignment.headerMapping?.sourceType === 'IMAGE_URL' && assignment.headerMapping?.value) {
        imageUrl = assignment.headerMapping.value;
      } else if (context?.companySettings?.companyLogo) {
        imageUrl = context.companySettings.companyLogo;
      } else if (context?.companySettings?.siteLogo) {
        imageUrl = context.companySettings.siteLogo;
      }

      if (!imageUrl) {
        throw new Error(`Meta template expects IMAGE header, but no Assignment image or Company Logo fallback is available for ${assignment.messageType}`);
      }

      const publicBase = process.env.PUBLIC_BACKEND_URL;
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction && !publicBase) {
        throw new Error('PUBLIC_BACKEND_URL is required in production to resolve WhatsApp media URLs.');
      }

      const baseToUse = publicBase || 'https://server.nareshsareecollection.com';

      if (imageUrl.startsWith('/')) {
        imageUrl = `${baseToUse}${imageUrl}`;
      } else if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
        imageUrl = imageUrl.replace(/http:\/\/(localhost|127\.0\.0\.1):\d+/, baseToUse);
      }
                       
      components.push({
        type: 'header',
        parameters: [{
          type: 'image',
          image: {
            link: imageUrl
          }
        }]
      });
    } else if (headerComponentDef.format === 'DOCUMENT') {
      if (mediaId && assignment.headerMapping?.sourceType === 'DOCUMENT_PDF') {
        components.push({
          type: 'header',
          parameters: [{
            type: 'document',
            document: {
              id: mediaId,
              filename: filename || 'document.pdf',
            }
          }]
        });
      } else {
        throw new Error(`Meta template expects DOCUMENT header, but no mediaId/PDF provided for ${assignment.messageType}`);
      }
    } else if (headerComponentDef.format === 'VIDEO') {
      // Implement if needed in future
      throw new Error(`Meta template expects VIDEO header, which is not currently mapped for ${assignment.messageType}`);
    } else if (headerComponentDef.format === 'TEXT' || !headerComponentDef.format) {
      if (headerParams.length > 0) {
        components.push({
          type: 'header',
          parameters: headerParams,
        });
      }
    }
  }

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }

  return components;
}

function skipOrRejectManualSend(manual, reason, extra = {}) {
  if (manual) {
    throw new Error(reason);
  }

  return { skipped: true, reason, ...extra };
}

async function triggerWhatsAppSend({ documentType, documentId, userId, manual = false }) {
  const settingsDoc = await WhatsAppSettings.findOne({ userId });
  const config = mergeConfig(settingsDoc);

  if (!config.isEnabled) {
    return skipOrRejectManualSend(manual, 'WhatsApp is disabled');
  }

  // Find the Assignment
  const messageType = String(documentType).toUpperCase();
  const assignment = await WhatsAppTemplateAssignment.findOne({ userId, messageType, isEnabled: true })
    .populate('metaTemplateId').lean();

  if (!assignment || !assignment.metaTemplateId) {
    return skipOrRejectManualSend(manual, `No active Meta Template assignment found for ${messageType}`);
  }

  if (assignment.metaTemplateId.status !== 'APPROVED') {
    return skipOrRejectManualSend(
      manual,
      `Assigned Meta Template is not APPROVED (status: ${assignment.metaTemplateId.status})`
    );
  }

  const context = await resolveDocumentContext({ documentType, documentId, userId });
  await ensurePublicShareMappingContext({ documentType, documentId, userId, assignment, context });

  // Resolve the actual body text for the log by substituting variable mappings
  const metaComponents = Array.isArray(assignment.metaTemplateId?.components)
    ? assignment.metaTemplateId.components
    : [];
  const bodyComponentDef = metaComponents.find((c) => c.type === 'BODY');
  const footerComponentDef = metaComponents.find((c) => c.type === 'FOOTER');
  const buttonsComponentDef = metaComponents.find((c) => c.type === 'BUTTONS');
  const headerComponentDef2 = metaComponents.find((c) => c.type === 'HEADER');

  let resolvedBodyText = bodyComponentDef?.text || '';
  if (resolvedBodyText && assignment.variableMappings?.length) {
    for (const mapping of assignment.variableMappings) {
      if (mapping.component !== 'BODY') continue;
      const value = mapping.sourceType === 'FIXED'
        ? mapping.sourceValue
        : String(context[mapping.sourceValue] ?? '');
      resolvedBodyText = resolvedBodyText.replace(
        new RegExp(`\\{\\{${mapping.parameterIndex}\\}\\}`, 'g'),
        value
      );
    }
  }

  const log = await WhatsAppMessageLog.create({
    userId,
    customerId: context.customerId,
    customerPhone: context.customerPhone || '',
    customerName: context.customerName,
    documentType,
    documentId: context.document._id,
    documentNumber: context.documentNumber,
    status: 'QUEUED',
    renderedMessage: resolvedBodyText || `Template: ${assignment.metaTemplateName}`,
    amount: context.amount,
    lastAttemptAt: new Date(),
    metadata: {
      manual,
      assignmentId: assignment._id,
      templateName: assignment.metaTemplateName,
      templateComponents: {
        headerFormat: headerComponentDef2?.format || null,
        headerText: headerComponentDef2?.text || null,
        body: resolvedBodyText || null,
        footer: footerComponentDef?.text || null,
        buttons: (buttonsComponentDef?.buttons || []).map((btn) => ({
          type: btn.type,
          text: btn.text || null,
        })),
      },
    },
  });
  let normalizedCustomerPhone = '';

  try {
    if (!config.isEnabled && manual) {
      throw new Error('WhatsApp is disabled in settings');
    }

    if (!config.accessToken || !config.phoneNumberId || !config.businessAccountId || !config.webhookVerifyToken) {
      throw new Error('WhatsApp credentials are incomplete');
    }

    if (!String(context.customerPhone || '').trim()) {
      await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
        $set: { status: 'FAILED', errorMessage: 'Customer phone number is missing', lastAttemptAt: new Date() },
      });
      return skipOrRejectManualSend(manual, 'Customer phone number is missing', { logId: log._id });
    }

    const phone = normalizePhoneNumber(context.customerPhone);
    normalizedCustomerPhone = phone;
    const sendOutcome = await withRetry(async () => {
      let mediaId = null;
      let filename = null;

      if (assignment.headerMapping?.sourceType === 'DOCUMENT_PDF') {
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

        filename = `${documentType}-${context.documentNumber || documentId}.pdf`;
        const mediaUpload = await uploadMediaToWhatsApp({ config, pdfBuffer, filename });
        mediaId = mediaUpload.id || '';
      }

      const components = buildTemplateComponents(assignment, context, mediaId, filename, documentType);

      const response = await sendTemplateMessage({
        config,
        phone,
        templateName: assignment.metaTemplateName,
        languageCode: assignment.languageCode,
        components,
      });

      return { response, mediaId };
    });

    const messageId = sendOutcome.result?.response?.messages?.[0]?.id || '';

    await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
      $set: {
        customerPhone: phone,
        messageId,
        mediaId: sendOutcome.result.mediaId || '',
        status: 'ACCEPTED',
        acceptedAt: new Date(),
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
        customerPhone: normalizedCustomerPhone || context.customerPhone || '',
        status: 'FAILED',
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
  getDocumentNumber,
  buildDocumentLookup,
  resolveDocumentContext,
  resolveDocumentContextFromModels,
  uploadMediaToWhatsApp,
  sendDocumentMessage,
  sendTextMessage,
  sendTemplateMessage,
  getMessageStatus,
  fetchConversationReplies,
  isRetryableWhatsAppError,
  buildTemplateComponents,
  ensurePublicShareMappingContext,
  triggerWhatsAppSend,
};
