# WhatsApp Module

Reusable WhatsApp Cloud API module for billing-style apps that need to send invoices, exchange invoices, or quotations with a PDF attachment and track message delivery analytics.

## What this module exports

```js
const {
  configureWhatsAppModule,
  triggerWhatsAppSend,
  whatsappRoutes,
  WhatsAppSettings,
  WhatsAppTemplate,
  WhatsAppMessageLog,
} = require('./whatsapp-module');
```

## Install requirements

1. Install backend dependencies:
   ```bash
   npm install puppeteer axios
   ```
2. Add WhatsApp environment variables:
   ```env
   WHATSAPP_ACCESS_TOKEN=EAAxxxxxx
   WHATSAPP_PHONE_NUMBER_ID=123456789
   WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_custom_secret
   WHATSAPP_API_VERSION=v18.0
   ```

## Plug it into a project

### 1. Configure the module with your app models

Do this once during server startup before any controller calls `triggerWhatsAppSend`.

```js
const Invoice = require('@models/Invoice');
const Quotation = require('@models/Quotation');
const Customer = require('@models/Customer');
const CompanySettings = require('@models/CompanySettings');
const { configureWhatsAppModule, whatsappRoutes } = require('./whatsapp-module');

configureWhatsAppModule({
  models: {
    InvoiceModel: Invoice,
    QuotationModel: Quotation,
    CustomerModel: Customer,
    CompanySettingsModel: CompanySettings,
  },
});
```

### 2. Register the module routes

```js
app.use('/api/admin/whatsapp', whatsappRoutes);
```

If your app needs different auth or middleware, apply that on the route mount.

### 3. Trigger WhatsApp sending from your own controllers

```js
const { triggerWhatsAppSend } = require('../../whatsapp-module');

triggerWhatsAppSend({
  documentType: 'invoice',
  documentId: savedInvoice._id,
  userId: req.user._id,
}).catch((error) => {
  console.error('WhatsApp trigger failed:', error.message);
});
```

Supported `documentType` values:
- `invoice`
- `exchange`
- `quotation`

## Portability options

### Model adapter mode

The default portability path is to inject your app models through `configureWhatsAppModule()`.

Expected model roles:
- `InvoiceModel`: used for invoice and exchange documents
- `QuotationModel`: used for quotation documents
- `CustomerModel`: used to look up the customer by `billTo` or `customerId`
- `CompanySettingsModel`: used to read `companyName`

### Custom resolver mode

If your app structure differs, pass a custom resolver instead of relying on the default model adapter logic.

```js
configureWhatsAppModule({
  resolveDocumentContext: async ({ documentType, documentId, userId }) => {
    return {
      document: {},
      customer: {},
      companySettings: {},
      customerId: null,
      customerName: 'Customer',
      customerPhone: '919999999999',
      documentNumber: 'INV-001',
      amount: 1200,
      date: '03/07/2026',
      items: [],
      status: 'paid',
      companyName: 'Your Company',
      documentLabel: 'Invoice',
    };
  },
});
```

## Available endpoints

- `GET /settings`
- `POST /settings`
- `GET /templates`
- `POST /templates`
- `PUT /templates/:id`
- `GET /messages`
- `GET /messages/stats`
- `GET /messages/:id`
- `POST /send-manual`
- `POST /test-send`
- `GET /webhook`
- `POST /webhook`

## Frontend portability

The frontend WhatsApp pages are designed to point at a single base URL constant:

```ts
Constants.WHATSAPP_BASE_URL
```

All WhatsApp settings, templates, messages, stats, manual-send, and test-send URLs derive from that base path.

## Notes

- This module does not require credentials at implementation time. Credentials can be added later in env or through the settings UI.
- PDF sending requires `puppeteer` to be installed in the backend project.
- The current PDF generator is generic HTML-based. If another project wants a different bill layout, replace or extend `utils/pdfGenerator.js`.

