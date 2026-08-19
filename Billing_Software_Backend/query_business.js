const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const BusinessSettings = require('./models/BusinessSettings');
    const b = await BusinessSettings.findOne();
    console.log(b);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
