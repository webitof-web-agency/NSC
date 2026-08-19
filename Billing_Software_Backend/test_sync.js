const mongoose = require('mongoose');
require('dotenv').config();
const { getMessageTemplates } = require('./whatsapp-module/services/metaApiService');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const User = require('./models/User');
    const user = await User.findOne();
    if (!user) return console.log('no user');

    const metaData = await getMessageTemplates(user._id);
    const templates = metaData?.data || [];
    console.log('Templates found in API:', templates.length);
    templates.forEach(t => console.log(t.name, t.language, t.status));
    
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
