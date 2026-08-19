const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Template = require('./whatsapp-module/models/WhatsAppMetaTemplate');
    const templates = await Template.find({});
    templates.forEach(t => {
      console.log(t.name);
      if (t.name !== 'hello_world') {
        console.log(JSON.stringify(t.components, null, 2));
      }
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
