const cron = require('node-cron');
const WhatsAppSettings = require('./whatsapp-module/models/WhatsAppSettings');
const WhatsAppMessageLog = require('./whatsapp-module/models/WhatsAppMessageLog');
const { mergeConfig, getMessageStatus } = require('./whatsapp-module/services/whatsappService');

function mapGraphStatus(payload) {
  const status = String(payload?.message_status || payload?.status || '').toLowerCase();
  if (status === 'read') {
    return { status: 'read', readAt: new Date() };
  }
  if (status === 'delivered') {
    return { status: 'delivered', deliveredAt: new Date() };
  }
  if (status === 'sent') {
    return { status: 'sent' };
  }
  return null;
}

async function syncPendingWhatsAppStatuses() {
  const pendingLogs = await WhatsAppMessageLog.find({
    messageId: { $ne: '' },
    status: { $in: ['sent', 'delivered'] },
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  for (const log of pendingLogs) {
    try {
      const settings = await WhatsAppSettings.findOne({ userId: log.userId }).lean();
      const config = mergeConfig(settings || null);
      if (!config.accessToken || !config.phoneNumberId) {
        continue;
      }

      const payload = await getMessageStatus({
        config,
        messageId: log.messageId,
      });

      const update = mapGraphStatus(payload);
      if (update) {
        await WhatsAppMessageLog.findByIdAndUpdate(log._id, { $set: update });
      }
    } catch (error) {
      console.error('WhatsApp status sync failed:', log._id?.toString?.() || log._id, error.message);
    }
  }
}

cron.schedule('*/15 * * * *', () => {
  syncPendingWhatsAppStatuses().catch((error) => {
    console.error('WhatsApp cron sync failed:', error.message);
  });
});

module.exports = {
  syncPendingWhatsAppStatuses,
};
