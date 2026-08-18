const crypto = require('crypto');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { getWhatsAppConfig } = require('../../config/whatsapp');
const { decryptValue } = require('../utils/credentialCrypto');

async function resolveVerifyToken(userId) {
  if (userId) {
    const settings = await WhatsAppSettings.findOne({ userId }).lean();
    if (settings?.webhookVerifyToken) {
      return settings.webhookVerifyToken;
    }
  }

  const latestSettings = await WhatsAppSettings.findOne({ webhookVerifyToken: { $ne: '' } })
    .sort({ updatedAt: -1 })
    .lean();

  return latestSettings?.webhookVerifyToken || getWhatsAppConfig().webhookVerifyToken;
}

async function resolveAppSecret(userId) {
  if (userId) {
    const settings = await WhatsAppSettings.findOne({ userId }).lean();
    if (settings?.appSecret) {
      return decryptValue(settings.appSecret);
    }
  }

  const latestSettings = await WhatsAppSettings.findOne({ appSecret: { $ne: '' } })
    .sort({ updatedAt: -1 })
    .lean();

  return latestSettings?.appSecret ? decryptValue(latestSettings.appSecret) : getWhatsAppConfig().appSecret;
}

async function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = await resolveVerifyToken(req.query.userId);

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: 'Webhook verification failed' });
}

async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    if (signature) {
      const appSecret = await resolveAppSecret(req.query.userId);
      if (appSecret && req.rawBody) {
        const hmac = crypto.createHmac('sha256', appSecret);
        const digest = Buffer.from('sha256=' + hmac.update(req.rawBody).digest('hex'), 'utf8');
        const checksum = Buffer.from(signature, 'utf8');
        
        if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
          console.error('WhatsApp Webhook signature verification failed');
          return res.status(401).send('Invalid signature');
        }
      }
    }

    const entries = Array.isArray(req.body.entry) ? req.body.entry : [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const statuses = change?.value?.statuses || [];
        for (const statusEntry of statuses) {
          const update = {};
          if (statusEntry.status === 'sent') update.status = 'sent';
          if (statusEntry.status === 'delivered') {
            update.status = 'delivered';
            update.deliveredAt = new Date();
          }
          if (statusEntry.status === 'read') {
            update.status = 'read';
            update.readAt = new Date();
          }
          if (statusEntry.errors?.length) {
            update.status = 'failed';
            update.errorMessage = statusEntry.errors.map((item) => item.title || item.message).join(', ');
          }

          if (Object.keys(update).length) {
            await WhatsAppMessageLog.findOneAndUpdate({ messageId: statusEntry.id }, { $set: update });
          }
        }

        const messages = change?.value?.messages || [];
        for (const incoming of messages) {
          const from = incoming.from || '';
          const replyText = incoming?.text?.body || '';
          if (!from || !replyText) continue;

          await WhatsAppMessageLog.findOneAndUpdate(
            { customerPhone: { $regex: `${from}$` } },
            {
              $set: {
                status: 'replied',
                replyText,
                repliedAt: new Date(),
              },
            },
            { sort: { createdAt: -1 } }
          );
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};
