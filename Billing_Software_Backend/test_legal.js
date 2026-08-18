const xss = require('xss');

const xssOptions = {
  whiteList: {
    ...xss.whiteList,
    p: ['style', 'class'],
    h1: ['style', 'class'],
    h2: ['style', 'class'],
    h3: ['style', 'class'],
    h4: ['style', 'class'],
    h5: ['style', 'class'],
    h6: ['style', 'class'],
    strong: [], b: [], i: [], em: [], u: [], strike: [],
    ul: ['style', 'class'], ol: ['style', 'class'], li: ['style', 'class'],
    br: [], hr: [], a: ['href', 'title', 'target'], span: ['style', 'class'],
    blockquote: ['style', 'class']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

const sanitizeHtml = (html) => {
  if (!html) return '';
  return xss(html, xssOptions);
};

const replacePlaceholders = (html, company) => {
  if (!html) return '';
  const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const businessName = escapeHtml(company?.companyName) || 'Our Business';
  const businessEmail = escapeHtml(company?.email) || 'support@example.com';
  const businessPhone = escapeHtml(company?.phone) || 'Contact Support';
  const businessAddress = escapeHtml(company?.address) || 'Business Address';

  return html
    .replace(/\{\{businessName\}\}/g, businessName)
    .replace(/\{\{businessEmail\}\}/g, businessEmail)
    .replace(/\{\{businessPhone\}\}/g, businessPhone)
    .replace(/\{\{businessAddress\}\}/g, businessAddress);
};

// Tests
console.log('--- Testing Sanitization ---');
const maliciousHtml = '<p>Safe Text <script>alert(1)</script> <iframe src="bad"></iframe> <a href="javascript:alert(1)">Click</a></p>';
console.log(sanitizeHtml(maliciousHtml));

console.log('--- Testing Placeholders ---');
const template = '<p>Contact {{businessName}} at {{businessEmail}}. Phone: {{businessPhone}}</p>';
const maliciousCompany = { companyName: '<script>alert("hack")</script>', email: 'admin@a.com', phone: '123' };
console.log(replacePlaceholders(template, maliciousCompany));
