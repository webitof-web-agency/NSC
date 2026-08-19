const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const { getMessageTemplates } = require('./whatsapp-module/services/metaApiService');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo');

  const user = await User.findOne();
  if (!user) {
    console.log('No user found');
    process.exit(1);
  }

  try {
    const rawData = await getMessageTemplates(user._id, 100);
    console.log('Total templates returned in first page:', rawData?.data?.length);

    rawData?.data?.forEach(tmpl => {
      console.log(`- ${tmpl.name} | ${tmpl.language} | ${tmpl.category} | ${tmpl.status}`);
    });
    
    console.log('\nPaging:', JSON.stringify(rawData?.paging, null, 2));

  } catch (err) {
    console.error('Error fetching templates:', err);
  }

  process.exit(0);
}

run();
