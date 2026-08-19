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
    
    console.log("Triggering WhatsApp Send for invoice:", invoice._id);
    const result = await triggerWhatsAppSend({
      documentType: 'invoice',
      documentId: invoice._id,
      userId: "696f647d37958620faf6e2dd",
      manual: true
    });
    console.log("Result:", result);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
