const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Settings = require('./whatsapp-module/models/WhatsAppSettings');
    const settings = await Settings.find({});
    console.log("Settings:", JSON.stringify(settings, null, 2));
    
    const Assignments = require('./whatsapp-module/models/WhatsAppTemplateAssignment');
    const assigns = await Assignments.find({}).select('userId messageType');
    console.log("Assignments:", assigns);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
