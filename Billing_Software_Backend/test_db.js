const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const WhatsAppSettings = require('./whatsapp-module/models/WhatsAppSettings');
    const settings = await WhatsAppSettings.findOne({ userId: "696f647d37958620faf6e2dd" }).lean();
    console.log(JSON.stringify(settings, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
