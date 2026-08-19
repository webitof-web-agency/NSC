const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const WhatsAppMessageLog = require('./whatsapp-module/models/WhatsAppMessageLog');
    const logs = await WhatsAppMessageLog.find().sort({ createdAt: -1 }).limit(5);
    console.log("Recent WhatsApp Logs:");
    logs.forEach(log => {
      console.log(`- Status: ${log.status}, Reason/Error: ${log.errorMessage || 'None'}, Phone: ${log.customerPhone}, Template: ${log.metadata?.templateName}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
