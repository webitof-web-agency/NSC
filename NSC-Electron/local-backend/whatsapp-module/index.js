const whatsappRoutes = require('./routes/whatsappRoutes');
const WhatsAppSettings = require('./models/WhatsAppSettings');
const WhatsAppTemplate = require('./models/WhatsAppTemplate');
const WhatsAppMessageLog = require('./models/WhatsAppMessageLog');
const { configureWhatsAppModule } = require('./context');
const {
  triggerWhatsAppSend,
  resolveDocumentContext,
  resolveDocumentContextFromModels,
} = require('./services/whatsappService');

module.exports = {
  configureWhatsAppModule,
  triggerWhatsAppSend,
  resolveDocumentContext,
  resolveDocumentContextFromModels,
  whatsappRoutes,
  WhatsAppSettings,
  WhatsAppTemplate,
  WhatsAppMessageLog,
};
