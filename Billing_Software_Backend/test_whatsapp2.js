const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    require('./whatsapp-module/models/WhatsAppMetaTemplate');
    const { triggerWhatsAppSend } = require('./whatsapp-module/services/whatsappService');
    const Invoice = require('./models/Invoice');
    
    // get latest invoice
    const invoice = await Invoice.findOne().sort({ createdAt: -1 });
    
    // Temporarily patch triggerWhatsAppSend to inject the image header if missing
    // We will do this in the actual code later.
    const axios = require('axios');
    const Settings = require('./whatsapp-module/models/WhatsAppSettings');
    const Assignment = require('./whatsapp-module/models/WhatsAppTemplateAssignment');
    
    const settings = await Settings.findOne({ userId: "696f647d37958620faf6e2dd" });
    const assignment = await Assignment.findOne({ messageType: 'INVOICE' }).populate('metaTemplateId');
    
    // Build parameters manually to test Meta API
    const url = `https://graph.facebook.com/${settings.apiVersion}/${settings.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: "917582898186", // Replace with valid test number if needed, or use the one from invoice
      type: "template",
      template: {
        name: assignment.metaTemplateName,
        language: { code: assignment.languageCode },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://app.nareshsareecollection.com/logo.png" // Placeholder logo link
                }
              }
            ]
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: "Customer Name" },
              { type: "text", text: "INV-0001" },
              { type: "text", text: "1000" },
              { type: "text", text: "Naresh Saree Collection" }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: "sample-id-123" }
            ]
          }
        ]
      }
    };
    
    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("Success:", res.data);
    } catch (err) {
      console.error("Error:", err.response?.data || err.message);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
