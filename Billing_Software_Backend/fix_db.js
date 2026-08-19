const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    require('./whatsapp-module/models/WhatsAppMetaTemplate');
    const Assignment = require('./whatsapp-module/models/WhatsAppTemplateAssignment');
    const MetaTemplate = require('./whatsapp-module/models/WhatsAppMetaTemplate');
    
    const userId = "696f647d37958620faf6e2dd";
    
    await Assignment.updateMany({ userId: null }, { $set: { userId } });
    await MetaTemplate.updateMany({ userId: null }, { $set: { userId } });
    
    console.log("Database fixed!");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
