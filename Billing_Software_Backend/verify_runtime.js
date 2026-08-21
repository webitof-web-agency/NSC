#!/usr/bin/env node
/**
 * Runtime Verification Script
 * Tests all verification criteria against the live backend.
 */
require('module-alias/register');
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
// Pre-register all models needed
require('./models/User');
require('./models/Invoice');
require('./models/Quotation');

const BASE = 'http://localhost:5000';
const results = [];

function pass(id, detail = '') { results.push({ id, status: 'PASS', detail }); console.log(`  ✅ PASS [${id}]${detail ? ': ' + detail : ''}`); }
function fail(id, detail = '') { results.push({ id, status: 'FAIL', detail }); console.log(`  ❌ FAIL [${id}]: ${detail}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function get(url, expectedStatus = 200) {
  try {
    const r = await axios.get(url, { validateStatus: () => true });
    return { status: r.status, data: r.data };
  } catch(e) {
    return { status: 0, error: e.message };
  }
}

async function adminLogin() {
  try {
    const User = mongoose.model('User');
    const admin = await User.findOne({}).lean();
    if (!admin) { info('No user found in DB'); return null; }
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    info(`Got admin token for user: ${admin.email || admin._id}`);
    return token;
  } catch(e) {
    info(`adminLogin error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('\n=== NSC Public Document Portal - Runtime Verification ===\n');
  
  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/NSC');
  info('Connected to MongoDB');
  
  const Invoice = require('./models/Invoice');
  const Quotation = require('./models/Quotation');
  
  // ─── Get Test Documents ────────────────────────────────────────────
  const invoice = await Invoice.findOne({ 
    $nor: [{ status: 'EXCHANGE' }, { isExchange: true }],
    publicShareId: { $exists: true, $ne: null }
  });
  const exchange = await Invoice.findOne({ 
    $or: [{ status: 'EXCHANGE' }, { isExchange: true }],
    publicShareId: { $exists: true, $ne: null }
  });
  // Quotations may not have a publicShareId yet; we'll generate one via API
  const quotation = await Quotation.findOne({ publicShareId: { $exists: true, $ne: null } }) 
    || await Quotation.findOne({});

  info(`Invoice with publicShareId: ${invoice ? invoice.publicShareId : 'NONE FOUND'}`);
  info(`Exchange with publicShareId: ${exchange ? exchange.publicShareId : 'NONE FOUND'}`);
  info(`Quotation with publicShareId: ${quotation ? quotation.publicShareId : 'NONE FOUND'}`);
  
  const token = await adminLogin();

  // ─── TEST 1: Public URL Generation ────────────────────────────────
  console.log('\n[TEST 1] Public URL Generation');
  
  if (invoice?.publicShareId) {
    const invoiceToken = invoice.publicShareId;
    // Ensure no colons in the token itself
    if (invoiceToken.includes(':')) {
      fail('1-invoice-url', `publicShareId contains colon: ${invoiceToken}`);
    } else {
      const url = `${BASE}/api/public/invoices/${invoiceToken}`;
      const r = await get(url);
      if (r.status === 200) {
        const returnedId = r.data?.data?.publicShareId;
        if (returnedId === invoiceToken) {
          pass('1-invoice-url', `publicShareId matches exactly: ${invoiceToken}`);
        } else {
          fail('1-invoice-url', `Response publicShareId mismatch: expected ${invoiceToken}, got ${returnedId}`);
        }
      } else {
        fail('1-invoice-url', `HTTP ${r.status} for /api/public/invoices/${invoiceToken}`);
      }
    }
  } else {
    fail('1-invoice-url', 'No invoice with publicShareId found in DB');
  }

  // For quotation: if no publicShareId yet, generate one via admin API
  let quotationPublicShareId = quotation?.publicShareId;
  if (!quotationPublicShareId && quotation && token) {
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const gen = await axios.post(`${BASE}/api/admin/quotations/${quotation._id}/public-link`, {}, 
        { headers: authHeaders, validateStatus: () => true });
      if (gen.status === 200 && gen.data.publicShareId) {
        quotationPublicShareId = gen.data.publicShareId;
        info(`Generated quotation publicShareId on-demand: ${quotationPublicShareId}`);
      }
    } catch(e) { info(`Failed to generate quotation link: ${e.message}`); }
  }

  if (quotationPublicShareId) {
    const qToken = quotationPublicShareId;
    if (qToken.includes(':')) {
      fail('1-quotation-url', `publicShareId contains colon: ${qToken}`);
    } else {
      const url = `${BASE}/api/public/quotations/${qToken}`;
      const r = await get(url);
      if (r.status === 200) {
        const returnedId = r.data?.data?.publicShareId;
        if (returnedId === qToken) {
          pass('1-quotation-url', `quotation publicShareId matches exactly: ${qToken}`);
        } else {
          fail('1-quotation-url', `Response publicShareId mismatch: expected ${qToken}, got ${returnedId}`);
        }
      } else {
        fail('1-quotation-url', `HTTP ${r.status} for /api/public/quotations/${qToken}`);
      }
    }
  } else {
    fail('1-quotation-url', 'No quotation with publicShareId found and could not generate one');
  }

  if (exchange?.publicShareId) {
    const eToken = exchange.publicShareId;
    if (eToken.includes(':')) {
      fail('1-exchange-url', `publicShareId contains colon: ${eToken}`);
    } else {
      const url = `${BASE}/api/public/exchanges/${eToken}`;
      const r = await get(url);
      if (r.status === 200) {
        pass('1-exchange-url', `exchange publicShareId correct: ${eToken}`);
      } else {
        fail('1-exchange-url', `HTTP ${r.status} for /api/public/exchanges/${eToken}`);
      }
    }
  } else {
    fail('1-exchange-url', 'No exchange with publicShareId found in DB');
  }

  // ─── TEST 2: Invoice Route Isolation ──────────────────────────────
  console.log('\n[TEST 2] Invoice Route Isolation');
  if (invoice?.publicShareId) {
    const tok = invoice.publicShareId;
    const r1 = await get(`${BASE}/api/public/invoices/${tok}`);
    r1.status === 200 ? pass('2-invoice-correct-route', `200 on /invoices/${tok}`) : fail('2-invoice-correct-route', `Expected 200, got ${r1.status}`);
    
    const r2 = await get(`${BASE}/api/public/exchanges/${tok}`);
    r2.status === 404 ? pass('2-invoice-rejected-at-exchange', `404 on /exchanges/${tok}`) : fail('2-invoice-rejected-at-exchange', `Expected 404, got ${r2.status}`);
  } else {
    fail('2-invoice-route-isolation', 'No invoice publicShareId to test');
  }

  // ─── TEST 3: Exchange Route Isolation ─────────────────────────────
  console.log('\n[TEST 3] Exchange Route Isolation');
  if (exchange?.publicShareId) {
    const tok = exchange.publicShareId;
    const r1 = await get(`${BASE}/api/public/exchanges/${tok}`);
    r1.status === 200 ? pass('3-exchange-correct-route', `200 on /exchanges/${tok}`) : fail('3-exchange-correct-route', `Expected 200, got ${r1.status}`);
    
    const r2 = await get(`${BASE}/api/public/invoices/${tok}`);
    r2.status === 404 ? pass('3-exchange-rejected-at-invoice', `404 on /invoices/${tok}`) : fail('3-exchange-rejected-at-invoice', `Expected 404, got ${r2.status}`);
  } else {
    fail('3-exchange-route-isolation', 'No exchange publicShareId to test');
  }

  // ─── TEST 4: Quotation Security ───────────────────────────────────
  console.log('\n[TEST 4] Quotation Security');
  if (quotationPublicShareId) {
    const tok = quotationPublicShareId;
    
    // Correct token
    const r1 = await get(`${BASE}/api/public/quotations/${tok}`);
    r1.status === 200 ? pass('4-quotation-correct-token', '200 with correct token') : fail('4-quotation-correct-token', `Expected 200, got ${r1.status}`);
    
    // By quotation number (if quotation record exists)
    if (quotation?.quotationNumber) {
      const r2 = await get(`${BASE}/api/public/quotations/${quotation.quotationNumber}`);
      r2.status === 404 ? pass('4-quotation-number-rejected', `404 on quotationNumber`) : fail('4-quotation-number-rejected', `Expected 404, got ${r2.status} for number ${quotation.quotationNumber}`);
    }
    
    // By Mongo _id (if quotation record exists)
    if (quotation?._id) {
      const r3 = await get(`${BASE}/api/public/quotations/${quotation._id}`);
      r3.status === 404 ? pass('4-quotation-mongoid-rejected', '404 on Mongo _id') : fail('4-quotation-mongoid-rejected', `Expected 404, got ${r3.status}`);
    }
    
    // Modified token (flip last char)
    const chars = tok.split('');
    chars[chars.length - 1] = chars[chars.length - 1] === 'a' ? 'b' : 'a';
    const modTok = chars.join('');
    const r4 = await get(`${BASE}/api/public/quotations/${modTok}`);
    r4.status === 404 ? pass('4-quotation-modified-token-rejected', '404 on modified token') : fail('4-quotation-modified-token-rejected', `Expected 404, got ${r4.status}`);
  } else {
    fail('4-quotation-security', 'No quotation publicShareId to test');
  }

  // ─── TEST 15: DTO Security ────────────────────────────────────────
  console.log('\n[TEST 15] Public DTO Security');
  const SENSITIVE_FIELDS = ['userId', 'costPrice', 'purchasePrice', 'profit', 'margin', 'internalNotes', 'adminData'];
  
  if (invoice?.publicShareId) {
    const r = await get(`${BASE}/api/public/invoices/${invoice.publicShareId}`);
    if (r.status === 200) {
      const body = JSON.stringify(r.data?.data || {});
      const leaked = SENSITIVE_FIELDS.filter(f => body.includes(`"${f}"`));
      leaked.length === 0 ? pass('15-invoice-dto', 'No sensitive fields exposed') : fail('15-invoice-dto', `Sensitive fields leaked: ${leaked.join(', ')}`);
    }
  }
  
  if (quotation?.publicShareId) {
    const r = await get(`${BASE}/api/public/quotations/${quotation.publicShareId}`);
    if (r.status === 200) {
      const body = JSON.stringify(r.data?.data || {});
      const leaked = SENSITIVE_FIELDS.filter(f => body.includes(`"${f}"`));
      leaked.length === 0 ? pass('15-quotation-dto', 'No sensitive fields exposed') : fail('15-quotation-dto', `Sensitive fields leaked: ${leaked.join(', ')}`);
      
      // Also check __v and raw _id exposure (not on the returned DTO)
      const data = r.data?.data || {};
      if (data.__v !== undefined) fail('15-quotation-dto-version', '__v exposed in quotation DTO');
      else pass('15-quotation-dto-version', '__v not exposed');
    }
  }
  
  if (exchange?.publicShareId) {
    const r = await get(`${BASE}/api/public/exchanges/${exchange.publicShareId}`);
    if (r.status === 200) {
      const body = JSON.stringify(r.data?.data || {});
      const leaked = SENSITIVE_FIELDS.filter(f => body.includes(`"${f}"`));
      leaked.length === 0 ? pass('15-exchange-dto', 'No sensitive fields exposed') : fail('15-exchange-dto', `Sensitive fields leaked: ${leaked.join(', ')}`);
    }
  }

  // ─── TEST: Admin Link Generate/Regenerate/Disable ─────────────────
  console.log('\n[TEST 5] Public Link Controls (Quotation)');
  if (token) {
    // First find or create a test quotation
    const testQuotation = await Quotation.findOne({});
    if (testQuotation) {
      const qId = testQuotation._id;
      const authHeaders = { Authorization: `Bearer ${token}` };
      
      // Generate
      try {
        const gen = await axios.post(`${BASE}/api/admin/quotations/${qId}/public-link`, {}, { headers: authHeaders, validateStatus: () => true });
        if (gen.status === 200 && gen.data.publicShareId) {
          const genToken = gen.data.publicShareId;
          const genUrl = gen.data.publicUrl;
          info(`Generated public link token: ${genToken}`);
          
          // Verify no colon in URL
          if (genUrl && genUrl.includes('/:')) {
            fail('5-generate-no-colon', `publicUrl contains route colon: ${genUrl}`);
          } else {
            pass('5-generate-no-colon', `publicUrl is clean: ${genUrl}`);
          }
          
          // Verify link works
          const testR = await get(`${BASE}/api/public/quotations/${genToken}`);
          testR.status === 200 ? pass('5-generated-link-works', 'Generated link returns 200') : fail('5-generated-link-works', `Generated link returned ${testR.status}`);
          
          // Regenerate
          const regen = await axios.post(`${BASE}/api/admin/quotations/${qId}/public-link/regenerate`, {}, { headers: authHeaders, validateStatus: () => true });
          if (regen.status === 200 && regen.data.publicShareId) {
            const newToken = regen.data.publicShareId;
            info(`Regenerated token: ${newToken}`);
            
            // Old token must 404
            const oldR = await get(`${BASE}/api/public/quotations/${genToken}`);
            oldR.status === 404 ? pass('5-regen-old-token-404', 'Old token correctly 404') : fail('5-regen-old-token-404', `Old token returned ${oldR.status}, expected 404`);
            
            // New token must 200
            const newR = await get(`${BASE}/api/public/quotations/${newToken}`);
            newR.status === 200 ? pass('5-regen-new-token-works', 'New token returns 200') : fail('5-regen-new-token-works', `New token returned ${newR.status}`);
            
            // Disable
            const dis = await axios.delete(`${BASE}/api/admin/quotations/${qId}/public-link`, { headers: authHeaders, validateStatus: () => true });
            if (dis.status === 200) {
              const disR = await get(`${BASE}/api/public/quotations/${newToken}`);
              disR.status === 404 ? pass('5-disable-link-404', 'Disabled link returns 404') : fail('5-disable-link-404', `Disabled link returned ${disR.status}`);
            } else {
              fail('5-disable-link', `Disable returned ${dis.status}`);
            }
          } else {
            fail('5-regenerate', `Regenerate returned ${regen.status}: ${JSON.stringify(regen.data)}`);
          }
        } else {
          fail('5-generate', `Generate returned ${gen.status}: ${JSON.stringify(gen.data)}`);
        }
      } catch(e) {
        fail('5-link-controls', e.message);
      }
    } else {
      fail('5-link-controls', 'No quotation found to test');
    }
  } else {
    fail('5-link-controls', 'No admin token available');
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n=== VERIFICATION SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nTotal: ${results.length} | ✅ PASS: ${passed.length} | ❌ FAIL: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(r => console.log(`  ❌ [${r.id}] ${r.detail}`));
  }
  
  mongoose.connection.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
