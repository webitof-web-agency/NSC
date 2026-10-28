const fs = require('fs');
const mongoose = require('mongoose');
const { getWhatsAppConfigStatus } = require('../config/whatsapp');
const { getUploadsRoot } = require('../utils/storagePaths');
const { version } = require('../package.json');

const CHECK_TIMEOUT_MS = 3000;
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

const withTimeout = (promise, ms = CHECK_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);

const formatDuration = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ');
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Each check returns { name, status: 'ok' | 'warn' | 'down', summary, details: [[label, value]] }

async function checkDatabase() {
  const state = DB_STATES[mongoose.connection.readyState] || 'unknown';
  const details = [['State', state], ['Database', mongoose.connection.name || '—']];
  if (mongoose.connection.readyState !== 1) {
    return { name: 'MongoDB', status: 'down', summary: `Not connected (${state})`, details };
  }
  try {
    const started = Date.now();
    await withTimeout(mongoose.connection.db.admin().ping());
    const latency = Date.now() - started;
    details.push(['Ping', `${latency} ms`]);
    return { name: 'MongoDB', status: latency > 1000 ? 'warn' : 'ok', summary: 'Connected', details };
  } catch (err) {
    details.push(['Error', err.message]);
    return { name: 'MongoDB', status: 'down', summary: 'Ping failed', details };
  }
}

async function checkSyncJournal() {
  const name = 'Sync journal';
  const retention = `${Number(process.env.SYNC_JOURNAL_RETENTION_DAYS) || 60} days`;
  if (mongoose.connection.readyState !== 1) {
    return { name, status: 'down', summary: 'Database unavailable', details: [['Retention', retention]] };
  }
  try {
    const SyncJournal = mongoose.models.SyncJournal || require('../models/SyncJournal');
    const [count, oldest] = await withTimeout(Promise.all([
      SyncJournal.estimatedDocumentCount(),
      SyncJournal.findOne().sort({ _id: 1 }).select('createdAt').lean(),
    ]));
    return {
      name,
      status: 'ok',
      summary: `${count.toLocaleString('en-IN')} entries`,
      details: [
        ['Oldest entry', oldest ? new Date(oldest.createdAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'],
        ['Retention', retention],
      ],
    };
  } catch (err) {
    return { name, status: 'warn', summary: 'Could not read', details: [['Error', err.message]] };
  }
}

function checkUploads() {
  const root = getUploadsRoot();
  try {
    fs.accessSync(root, fs.constants.W_OK);
    return { name: 'Uploads storage', status: 'ok', summary: 'Writable', details: [] };
  } catch (err) {
    return { name: 'Uploads storage', status: 'down', summary: 'Not writable', details: [['Error', err.code || err.message]] };
  }
}

const isSet = (value) => (value ? 'Set' : 'Not set');

function checkWhatsApp() {
  const s = getWhatsAppConfigStatus();
  return {
    name: 'WhatsApp Cloud API',
    status: s.isConfigured ? 'ok' : 'warn',
    summary: s.isConfigured ? 'Configured' : 'Incomplete config',
    details: [
      ['Access token', isSet(s.accessToken)],
      ['Phone number ID', isSet(s.phoneNumberId)],
      ['Business account ID', isSet(s.businessAccountId)],
      ['Webhook verify token', isSet(s.webhookVerifyToken)],
      ['API version', s.apiVersion],
    ],
  };
}

function checkEmail() {
  const configured = Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);
  return {
    name: 'Email (SMTP)',
    status: configured ? 'ok' : 'warn',
    summary: configured ? 'Configured' : 'Not configured',
    details: [['Credentials', isSet(configured)], ['Port', process.env.SMTP_PORT || 465]],
  };
}

function checkRazorpay() {
  const configured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return {
    name: 'Razorpay',
    status: configured ? 'ok' : 'warn',
    summary: configured ? 'Configured' : 'Not configured',
    details: [['API keys', isSet(configured)]],
  };
}

async function collectStatus() {
  const checks = [
    await checkDatabase(),
    await checkSyncJournal(),
    checkUploads(),
    checkWhatsApp(),
    checkEmail(),
    checkRazorpay(),
  ];
  const overall = checks.some((c) => c.status === 'down') ? 'down'
    : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
  const memory = process.memoryUsage();
  return {
    overall,
    checks,
    server: {
      version,
      environment: process.env.NODE_ENV || 'development',
      node: process.version,
      uptime: formatDuration(process.uptime()),
      memory: `${Math.round(memory.rss / 1048576)} MB`,
    },
    timestamp: new Date().toISOString(),
  };
}

const OVERALL_TEXT = { ok: 'All systems operational', warn: 'Running with warnings', down: 'Service disruption' };
const STATUS_TEXT = { ok: 'Operational', warn: 'Attention', down: 'Down' };

function renderStatusPage({ overall, checks, server, timestamp }) {
  const cards = checks.map((c) => `
      <section class="card">
        <header>
          <span class="dot ${c.status}"></span>
          <h2>${escapeHtml(c.name)}</h2>
          <span class="pill ${c.status}">${STATUS_TEXT[c.status]}</span>
        </header>
        <p class="summary">${escapeHtml(c.summary)}</p>
        ${c.details.length ? `<dl>${c.details.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>` : ''}
      </section>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<meta name="robots" content="noindex">
<title>NSC Backend Status</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #fff; --text: #16181d; --muted: #667085; --border: #e4e7ec;
    --ok: #12b76a; --ok-bg: #ecfdf3; --warn: #f79009; --warn-bg: #fffaeb; --down: #f04438; --down-bg: #fef3f2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --card: #171a21; --text: #e6e8eb; --muted: #98a2b3; --border: #262b35;
      --ok-bg: #0b2b1d; --warn-bg: #2e2208; --down-bg: #2f1210;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  .banner { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 12px;
    border: 1px solid var(--border); margin-bottom: 24px; font-weight: 600; font-size: 17px; }
  .banner.ok { background: var(--ok-bg); } .banner.warn { background: var(--warn-bg); } .banner.down { background: var(--down-bg); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
  .card header { display: flex; align-items: center; gap: 10px; }
  .card h2 { font-size: 15px; margin: 0; flex: 1; }
  .summary { margin: 8px 0 0; color: var(--muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .banner .dot { width: 12px; height: 12px; }
  .dot.ok { background: var(--ok); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 20%, transparent); }
  .dot.warn { background: var(--warn); box-shadow: 0 0 0 4px color-mix(in srgb, var(--warn) 20%, transparent); }
  .dot.down { background: var(--down); box-shadow: 0 0 0 4px color-mix(in srgb, var(--down) 20%, transparent); }
  .pill { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; }
  .pill.ok { color: var(--ok); background: var(--ok-bg); }
  .pill.warn { color: var(--warn); background: var(--warn-bg); }
  .pill.down { color: var(--down); background: var(--down-bg); }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 12px 0 0; padding-top: 12px;
    border-top: 1px solid var(--border); font-size: 13px; }
  dt { color: var(--muted); } dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
  .server { margin-top: 24px; }
  footer { margin-top: 24px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>NSC Backend</h1>
  <p class="sub">v${escapeHtml(server.version)} · ${escapeHtml(server.environment)}</p>
  <div class="banner ${overall}"><span class="dot ${overall}"></span>${OVERALL_TEXT[overall]}</div>
  <div class="grid">${cards}
  </div>
  <section class="card server">
    <header><h2>Server</h2></header>
    <dl>
      <dt>Uptime</dt><dd>${escapeHtml(server.uptime)}</dd>
      <dt>Node.js</dt><dd>${escapeHtml(server.node)}</dd>
      <dt>Memory (RSS)</dt><dd>${escapeHtml(server.memory)}</dd>
    </dl>
  </section>
  <footer>Checked ${escapeHtml(timestamp.replace('T', ' ').slice(0, 19))} UTC · refreshes every 30 s · JSON: <code>/?format=json</code></footer>
</main>
</body>
</html>`;
}

exports.getStatus = async (req, res) => {
  const status = await collectStatus();
  res.status(status.overall === 'down' ? 503 : 200).set('Cache-Control', 'no-store');
  if (req.query.format === 'json' || req.accepts(['html', 'json']) === 'json') {
    return res.json(status);
  }
  res.type('html').send(renderStatusPage(status));
};
