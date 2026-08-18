require('module-alias/register');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getWhatsAppConfigStatus } = require('./config/whatsapp');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const syncRoutes = require('./routes/syncRoutes');
const publicRoutes = require('./routes/publicRoutes');
const Invoice = require('@models/Invoice');
const Quotation = require('@models/Quotation');
const Customer = require('@models/Customer');
const CompanySettings = require('@models/CompanySettings');
const { configureWhatsAppModule, whatsappRoutes } = require('./whatsapp-module');

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED PROMISE REJECTION:', err);
  console.error('   Stack:', err.stack);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('   Stack:', err.stack);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

const app = express();

configureWhatsAppModule({
  models: {
    InvoiceModel: Invoice,
    QuotationModel: Quotation,
    CustomerModel: Customer,
    CompanySettingsModel: CompanySettings,
  },
});

console.log('═══════════════════════════════════════════════════════════');
console.log('🚀 Starting NSC Backend Server...');
console.log('═══════════════════════════════════════════════════════════');
console.log('📦 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', process.env.PORT || 3001);
console.log('🔗 MONGO_URI:', process.env.MONGO_URI ? '✅ SET' : '❌ NOT SET');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('🌐 BASE_URL:', process.env.BASE_URL || 'NOT SET');
const whatsappConfigStatus = getWhatsAppConfigStatus();
console.log(
  'WhatsApp Config:',
  whatsappConfigStatus.isConfigured ? 'READY' : 'INCOMPLETE'
);
console.log('   WHATSAPP_ACCESS_TOKEN:', whatsappConfigStatus.accessToken ? 'SET' : 'NOT SET');
console.log(
  '   WHATSAPP_PHONE_NUMBER_ID:',
  whatsappConfigStatus.phoneNumberId ? 'SET' : 'NOT SET'
);
console.log(
  '   WHATSAPP_BUSINESS_ACCOUNT_ID:',
  whatsappConfigStatus.businessAccountId ? 'SET' : 'NOT SET'
);
console.log(
  '   WHATSAPP_WEBHOOK_VERIFY_TOKEN:',
  whatsappConfigStatus.webhookVerifyToken ? 'SET' : 'NOT SET'
);
console.log('   WHATSAPP_API_VERSION:', whatsappConfigStatus.apiVersion);
console.log('═══════════════════════════════════════════════════════════');

if (!process.env.MONGO_URI) {
  console.error('❌ FATAL: MONGO_URI is not set!');
  console.error('   Please configure environment variables on Hostinger');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET) {
  console.error('⚠️  WARNING: JWT_SECRET is not set!');
}

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/whatsapp/webhook')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'NSC Backend deployed successfully 🚀',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    server: 'running',
    db: states[mongoose.connection.readyState],
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

console.log('🛣️  Setting up routes...');

const whatsappWebhook = require('./whatsapp-module/webhooks/whatsappWebhook');
app.get('/api/whatsapp/webhook', whatsappWebhook.verifyWebhook);
app.post('/api/whatsapp/webhook', whatsappWebhook.handleWebhook);

app.use('/api/auth', authRoutes);
app.use('/api/admin/whatsapp', whatsappRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/sync', syncRoutes);
console.log('✅ Routes configured');

const PORT = process.env.PORT || 3001;
const startServer = async () => {
  try {
    await connectDB();

    require('./attendanceAutoCheckoutCron');
    require('./invoiceCreditNotificationCron');
    require('./variantRetentionCron');

    app.listen(PORT, () => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ BACKEND IS RUNNING SUCCESSFULLY ON PORT ${PORT}`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📍 Health Check: http://localhost:' + PORT + '/health');
      console.log('📍 API Base URL:', process.env.BASE_URL || `http://localhost:${PORT}`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ Database connected before accepting requests');
    });
  } catch (error) {
    console.error('❌ Backend startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
