const generateDocumentPdfBuffer = require('./whatsapp-module/utils/pdfGenerator').generateDocumentPdfBuffer;

(async () => {
  try {
    const buffer = await generateDocumentPdfBuffer({
      companyName: 'Test Company',
      documentLabel: 'Invoice',
      documentNumber: 'INV-001',
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      date: new Date(),
      amount: 100.00,
      status: 'PAID',
      items: [{ name: 'Test Item', quantity: 1, rate: 100, amount: 100 }]
    });
    console.log("PDF generated successfully. Length:", buffer.length);
    process.exit(0);
  } catch (err) {
    console.error("Error generating PDF:", err);
    process.exit(1);
  }
})();
