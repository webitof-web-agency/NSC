const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const CompanySettings = require('./models/CompanySettings');
    const settings = await CompanySettings.findOne();
    console.log(settings);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
