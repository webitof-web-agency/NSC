require('dotenv').config();

async function checkTemplates() {
  const version = 'v21.0';
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !wabaId) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env');
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates?limit=100`;
  console.log(`Fetching from ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.error) {
      console.error('Error fetching templates:', data.error);
      return;
    }

    const approved = data.data.filter(t => t.status === 'APPROVED');
    console.log('Approved templates:');
    approved.forEach(t => {
      console.log(`- Name: ${t.name}, Language: ${t.language}, Category: ${t.category}`);
    });

  } catch (err) {
    console.error(err);
  }
}

checkTemplates();
