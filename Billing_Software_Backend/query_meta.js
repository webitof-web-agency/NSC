const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Settings = require('./whatsapp-module/models/WhatsAppSettings');
    const settings = await Settings.findOne({});
    const token = settings.accessToken;
    const wabaId = settings.businessAccountId;
    
    const response = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const invoiceTemplate = response.data.data.find(t => t.name === 'invoice_template');
    console.log(JSON.stringify(invoiceTemplate.components, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
