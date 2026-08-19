const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Template = require('./whatsapp-module/models/WhatsAppMetaTemplate');
    const invoiceTemplate = await Template.findOne({ name: 'invoice_template' });
    console.log(JSON.stringify(invoiceTemplate.components, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
