const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const WhatsAppSettings = require('./whatsapp-module/models/WhatsAppSettings');
    const { decryptValue } = require('./whatsapp-module/utils/encryption');
    const settings = await WhatsAppSettings.findOne({ userId: "696f647d37958620faf6e2dd" }).lean();
    
    const appSecret = decryptValue(settings.appSecret);
    console.log("App secret decrypted successfully.");
    
    // Grab the ID of the last sent message
    const MessageLog = require('./whatsapp-module/models/WhatsAppMessageLog');
    const lastMessage = await MessageLog.findOne({ status: 'ACCEPTED' }).sort({ createdAt: -1 });
    
    if (!lastMessage) {
      console.log("No ACCEPTED message found to test.");
      process.exit(0);
    }
    
    const testPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "1405743491510453",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "1234567890",
              phone_number_id: "1299948366533710"
            },
            statuses: [{
              id: lastMessage.messageId,
              status: "delivered",
              timestamp: Math.floor(Date.now() / 1000).toString(),
              recipient_id: lastMessage.customerPhone
            }]
          },
          field: "messages"
        }]
      }]
    };
    
    const rawBody = JSON.stringify(testPayload);
    const hmac = crypto.createHmac('sha256', appSecret);
    const signature = 'sha256=' + hmac.update(rawBody).digest('hex');
    
    console.log("Sending POST to live server...");
    try {
      const response = await axios.post('https://server.nareshsareecollection.com/api/whatsapp/webhook', rawBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature
        }
      });
      console.log("Response:", response.status, response.data);
    } catch (err) {
      console.error("Error posting to webhook:", err.response ? err.response.status : err.message);
    }
    process.exit(0);
  });
