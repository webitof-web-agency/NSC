const axios = require('axios');
const mongoose = require('mongoose');

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/billing_software');
  
  const Invoice = require('./models/Invoice');
  const Quotation = require('./models/Quotation');
  
  const invoice = await Invoice.findOne({ status: { $ne: 'EXCHANGE' }, isExchange: { $ne: true }, publicShareEnabled: true });
  const exchange = await Invoice.findOne({ $or: [{ status: 'EXCHANGE' }, { isExchange: true }], publicShareEnabled: true });
  const quotation = await Quotation.findOne({ publicShareEnabled: true });
  
  console.log("Invoice publicShareId:", invoice?.publicShareId);
  console.log("Exchange publicShareId:", exchange?.publicShareId);
  console.log("Quotation publicShareId:", quotation?.publicShareId);
  
  // Test 1: Route Isolation
  if (invoice) {
    try {
      const res = await axios.get(`http://localhost:5000/api/public/invoices/${invoice.publicShareId}`);
      console.log("Invoice via /invoices/:id ->", res.status);
    } catch(e) { console.log("Invoice via /invoices/:id ->", e.response?.status); }
    try {
      const res = await axios.get(`http://localhost:5000/api/public/exchanges/${invoice.publicShareId}`);
      console.log("Invoice via /exchanges/:id ->", res.status);
    } catch(e) { console.log("Invoice via /exchanges/:id ->", e.response?.status); }
  }
  
  if (exchange) {
    try {
      const res = await axios.get(`http://localhost:5000/api/public/exchanges/${exchange.publicShareId}`);
      console.log("Exchange via /exchanges/:id ->", res.status);
    } catch(e) { console.log("Exchange via /exchanges/:id ->", e.response?.status); }
    try {
      const res = await axios.get(`http://localhost:5000/api/public/invoices/${exchange.publicShareId}`);
      console.log("Exchange via /invoices/:id ->", res.status);
    } catch(e) { console.log("Exchange via /invoices/:id ->", e.response?.status); }
  }
  
  if (quotation) {
    try {
      const res = await axios.get(`http://localhost:5000/api/public/quotations/${quotation.publicShareId}`);
      console.log("Quotation via /quotations/:id ->", res.status);
    } catch(e) { console.log("Quotation via /quotations/:id ->", e.response?.status); }
    try {
      const res = await axios.get(`http://localhost:5000/api/public/quotations/${quotation.quotationNumber}`);
      console.log("Quotation via number ->", res.status);
    } catch(e) { console.log("Quotation via number ->", e.response?.status); }
    try {
      const res = await axios.get(`http://localhost:5000/api/public/quotations/${quotation._id}`);
      console.log("Quotation via _id ->", res.status);
    } catch(e) { console.log("Quotation via _id ->", e.response?.status); }
  }
  
  console.log("Done");
  process.exit(0);
}

require('dotenv').config();
runTests().catch(console.error);
