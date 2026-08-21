function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDocumentHtml(documentContext = {}) {
  const items = Array.isArray(documentContext.items) ? documentContext.items : [];
  const itemsRows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name || '')}</td>
          <td>${escapeHtml(item.qty || 0)}</td>
          <td>${escapeHtml(item.rate || 0)}</td>
          <td>${escapeHtml(item.amount || 0)}</td>
        </tr>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 16px; }
          h1 { font-size: 18px; margin: 0 0 8px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f3f4f6; }
          .meta { margin-top: 12px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(documentContext.companyName || 'Your Company')}</h1>
        <p><strong>${escapeHtml(documentContext.documentLabel || 'Document')}:</strong> ${escapeHtml(documentContext.documentNumber || '')}</p>
        <p><strong>Customer:</strong> ${escapeHtml(documentContext.customerName || '')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(documentContext.customerPhone || '')}</p>
        <p><strong>Date:</strong> ${escapeHtml(documentContext.date || '')}</p>
        <div class="meta">
          <p><strong>Amount:</strong> Rs ${escapeHtml(documentContext.amount || 0)}</p>
          <p><strong>Status:</strong> ${escapeHtml(documentContext.status || '')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </body>
    </html>`;
}

async function generateDocumentPdfBuffer(documentContext = {}) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (error) {
    throw new Error('Puppeteer is not installed. Run npm install puppeteer before sending PDF documents.');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildDocumentHtml(documentContext), {
      waitUntil: 'networkidle0',
    });

    return await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: { top: '8mm', right: '6mm', bottom: '8mm', left: '6mm' },
    });
  } finally {
    await browser.close();
  }
}

module.exports = {
  buildDocumentHtml,
  generateDocumentPdfBuffer,
};
