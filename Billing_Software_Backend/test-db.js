require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI);
const WhatsAppTemplateAssignment = require('./whatsapp-module/models/WhatsAppTemplateAssignment');
const WhatsAppMetaTemplate = require('./whatsapp-module/models/WhatsAppMetaTemplate');
async function run() {
  const assignments = await WhatsAppTemplateAssignment.find({ messageType: 'INVOICE' }).populate('metaTemplateId').lean();
  console.log(JSON.stringify(assignments, null, 2));
  process.exit(0);
}
run();
