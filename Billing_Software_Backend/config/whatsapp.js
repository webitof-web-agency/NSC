const DEFAULT_WHATSAPP_API_VERSION = 'v18.0';

function normalizeEnvValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function getWhatsAppConfig() {
  const accessToken = normalizeEnvValue(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = normalizeEnvValue(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const businessAccountId = normalizeEnvValue(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
  const webhookVerifyToken = normalizeEnvValue(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const apiVersion =
    normalizeEnvValue(process.env.WHATSAPP_API_VERSION) || DEFAULT_WHATSAPP_API_VERSION;

  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
    webhookVerifyToken,
    apiVersion,
    isConfigured:
      Boolean(accessToken) &&
      Boolean(phoneNumberId) &&
      Boolean(businessAccountId) &&
      Boolean(webhookVerifyToken),
  };
}

function getWhatsAppConfigStatus() {
  const config = getWhatsAppConfig();

  return {
    apiVersion: config.apiVersion,
    accessToken: Boolean(config.accessToken),
    phoneNumberId: Boolean(config.phoneNumberId),
    businessAccountId: Boolean(config.businessAccountId),
    webhookVerifyToken: Boolean(config.webhookVerifyToken),
    isConfigured: config.isConfigured,
  };
}

module.exports = {
  DEFAULT_WHATSAPP_API_VERSION,
  getWhatsAppConfig,
  getWhatsAppConfigStatus,
};
