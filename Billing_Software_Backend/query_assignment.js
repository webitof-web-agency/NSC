const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Assignment = require('./whatsapp-module/models/WhatsAppTemplateAssignment');
    const assignments = await Assignment.find({});
    console.log(Object.keys(assignments[0].toObject()));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
