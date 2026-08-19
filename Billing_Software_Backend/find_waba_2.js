require('dotenv').config();
const token = process.env.WHATSAPP_ACCESS_TOKEN;

async function run() {
  console.log("\nScanning all accessible businesses...");
  try {
    const bizRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const bizData = await bizRes.json();
    console.log("bizData:", bizData);
  } catch (e) {
    console.error(e);
  }
}
run();
