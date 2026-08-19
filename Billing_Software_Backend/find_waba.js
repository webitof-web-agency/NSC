require('dotenv').config();
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = "1299948366533710";
const targetTemplateId = "1042786815201690";

async function run() {
  // 1. Check the parent WABA of the configured phone number
  console.log("Checking phone number:", phoneId);
  try {
    const phoneRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=whatsapp_business_account`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const phoneData = await phoneRes.json();
    console.log("Phone parent WABA:", phoneData);
    
    if (phoneData.whatsapp_business_account) {
      const wabaId = phoneData.whatsapp_business_account.id;
      console.log(`Checking templates for WABA: ${wabaId}`);
      
      const tmplRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?name=invoice_template&fields=id,name,status,language,category`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tmplData = await tmplRes.json();
      console.log("Templates returned:", JSON.stringify(tmplData, null, 2));
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Scan all businesses accessible by token
  console.log("\nScanning all accessible businesses...");
  try {
    const bizRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const bizData = await bizRes.json();
    
    const businesses = bizData.data || [];
    for (const biz of businesses) {
      console.log(`Business: ${biz.name} (${biz.id})`);
      
      // Owned WABAs
      const ownedRes = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/owned_whatsapp_business_accounts?fields=id,name`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ownedData = await ownedRes.json();
      
      // Client WABAs
      const clientRes = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/client_whatsapp_business_accounts?fields=id,name`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const clientData = await clientRes.json();
      
      const wabas = [...(ownedData.data || []), ...(clientData.data || [])];
      for (const waba of wabas) {
        console.log(`\n  Checking WABA: ${waba.name || 'Unnamed'} (${waba.id})`);
        
        // Fetch phone numbers for WABA
        const pnRes = await fetch(`https://graph.facebook.com/v20.0/${waba.id}/phone_numbers?fields=display_phone_number`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const pnData = await pnRes.json();
        const phones = (pnData.data || []).map(p => {
          const num = p.display_phone_number || '';
          return num.slice(0, -5) + '*****' + num.slice(-5);
        });
        console.log(`  Attached Phones: ${phones.join(', ')}`);
        
        // Fetch specific template
        const tRes = await fetch(`https://graph.facebook.com/v20.0/${waba.id}/message_templates?name=invoice_template&fields=id,name,status,language,category`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tData = await tRes.json();
        const templates = tData.data || [];
        const match = templates.find(t => t.id === targetTemplateId);
        
        if (match) {
          console.log(`\n  ✅ MATCH FOUND IN WABA: ${waba.id} !`);
          console.log(`    WABA ID: ${waba.id}`);
          console.log(`    WABA name: ${waba.name || 'Unnamed'}`);
          console.log(`    Masked Phones: ${phones.join(', ')}`);
          console.log(`    Template ID: ${match.id}`);
          console.log(`    Template name: ${match.name}`);
          console.log(`    Language: ${match.language}`);
          console.log(`    Status: ${match.status}`);
        } else {
          console.log(`    Match not found in this WABA.`);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

run();
