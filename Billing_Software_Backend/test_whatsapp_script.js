require('dotenv').config();
const { sendTemplateMessage } = require('./whatsapp-module/services/whatsappService');
const { getWhatsAppConfig } = require('./config/whatsapp');

async function runTest() {
  const config = getWhatsAppConfig();
  if (!config.accessToken) {
    console.error('No WHATSAPP_ACCESS_TOKEN found in .env');
    return;
  }
  
  // Get test phone number from WhatsAppSettings in DB or from env
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const WhatsAppSettings = require('./whatsapp-module/models/WhatsAppSettings');
  const settings = await WhatsAppSettings.findOne();
  
  const recipient = settings?.testRecipientPhone || process.env.WHATSAPP_TEST_PHONE || '919876543210';
  const templateName = 'hello_world';
  
  console.log('--- Debug Information ---');
  console.log('Template Name:', templateName);
  console.log('Recipient:', recipient);
  
  try {
    const response = await sendTemplateMessage({
      config,
      phone: recipient,
      templateName,
      languageCode: 'en_US'
    });
    
    console.log('Meta HTTP Status: 200 OK');
    console.log('Response Body:', JSON.stringify(response, null, 2));
    console.log('wamid:', response?.messages?.[0]?.id || 'N/A');
    console.log('Message Accepted by WhatsApp');
  } catch (error) {
    console.error('Meta HTTP Status:', error.statusCode || 'Unknown');
    console.error('Safe Error Info:', {
      message: error.message,
      metaCode: error.metaCode,
      metaType: error.metaType,
      metaSubcode: error.metaSubcode,
      details: error.details,
      fbtrace_id: error.fbtrace_id
    });
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
