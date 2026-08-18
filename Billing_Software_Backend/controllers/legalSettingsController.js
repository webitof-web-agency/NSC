const User = require('@models/User');
const LegalSettings = require('@models/LegalSettings');
const CompanySettings = require('@models/CompanySettings');
const xss = require('xss');

// Advanced XSS filter allowing rich text formatting but no scripts/iframes
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
    strong: [],
    b: [],
    i: [],
    em: [],
    u: [],
    strike: [],
    ul: ['style', 'class'],
    ol: ['style', 'class'],
    li: ['style', 'class'],
    br: [],
    hr: [],
    a: ['href', 'title', 'target'],
    span: ['style', 'class'],
    blockquote: ['style', 'class']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

const sanitizeHtml = (html) => {
  if (!html) return '';
  return xss(html, xssOptions);
};

// Professional Default Contents
const getDefaultContent = (type) => {
  switch (type) {
    case 'privacyPolicy':
      return `<h2>Privacy Policy</h2>
<p>This Privacy Policy explains how {{businessName}} ("we", "us", or "our") collects, uses, and protects your information.</p>
<h3>1. Information We Collect</h3>
<p>We collect information that you provide directly to us, including:</p>
<ul>
  <li>Customer name and contact information</li>
  <li>Billing and invoice details</li>
  <li>WhatsApp communication data when you interact with our business via WhatsApp</li>
</ul>
<h3>2. Purpose and Data Usage</h3>
<p>We use the information we collect to provide, maintain, and improve our services, process transactions, send invoices, and communicate with you effectively.</p>
<h3>3. Third-Party Services</h3>
<p>We utilize third-party services, such as Meta/WhatsApp for business communication. Your interactions through these platforms may also be subject to their respective privacy policies.</p>
<h3>4. Data Protection and Retention</h3>
<p>We implement appropriate technical measures to protect your personal data against unauthorized access. We retain your information as long as necessary to fulfill the purposes outlined in this policy or as required by law.</p>
<h3>5. Your Rights</h3>
<p>You have the right to request access to, correction, or deletion of your personal data. Please refer to our Data Deletion policy for more details.</p>
<h3>6. Contact Information</h3>
<p>If you have any questions about this Privacy Policy, please contact us at:</p>
<p>Email: {{businessEmail}}<br>Phone: {{businessPhone}}<br>Address: {{businessAddress}}</p>`;
    
    case 'termsAndConditions':
      return `<h2>Terms & Conditions</h2>
<p>Welcome to {{businessName}}. By accessing or using our services, you agree to be bound by these Terms & Conditions.</p>
<h3>1. Acceptance of Terms</h3>
<p>By using our platform and services, you confirm that you accept these terms and that you agree to comply with them.</p>
<h3>2. Use of Services</h3>
<p>You agree to use our services only for lawful purposes and in a way that does not infringe the rights of others.</p>
<h3>3. Billing and Invoice Information</h3>
<p>You are responsible for providing accurate billing and invoice information. We are not liable for issues arising from incorrect details provided by the customer.</p>
<h3>4. Business Communication</h3>
<p>By providing your phone number, you consent to receive business communication, including invoices and updates, via WhatsApp or SMS.</p>
<h3>5. Limitation of Liability</h3>
<p>{{businessName}} shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our services.</p>
<h3>6. Changes to Terms</h3>
<p>We reserve the right to modify these terms at any time. Continued use of our services constitutes acceptance of the updated terms.</p>
<h3>7. Contact Information</h3>
<p>For any inquiries regarding these terms, contact us at {{businessEmail}}.</p>`;

    case 'dataDeletion':
      return `<h2>Data Deletion Instructions</h2>
<p>If you wish to have your personal data deleted from {{businessName}} systems, please follow the instructions below.</p>
<h3>1. Requesting Data Deletion</h3>
<p>You can request the deletion of your personal data by contacting us directly.</p>
<h3>2. Verification Process</h3>
<p>To protect your privacy, we will require you to verify your identity before processing your request. Please provide identifying information such as your registered email or phone number.</p>
<h3>3. What Data Will Be Deleted?</h3>
<p>We will delete your contact details and communication history where applicable. However, data that must be retained for legal, accounting, or regulatory purposes (such as invoices and transaction records) will not be deleted until the mandatory retention period expires.</p>
<h3>4. Processing Timeline</h3>
<p>We will respond to your request and process eligible deletions within 30 days of verifying your identity.</p>
<h3>5. Contact Method</h3>
<p>To submit a deletion request, please contact us at:</p>
<p>Email: {{businessEmail}}<br>Phone: {{businessPhone}}</p>`;
    
    default:
      return '';
  }
};

/**
 * Replace placeholders like {{businessName}} with actual data safely.
 */
const replacePlaceholders = (html, company) => {
  if (!html) return '';
  
  // Basic HTML escape for variables to prevent injection from business settings
  const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
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

// ----------------------------------------------------
// Admin Endpoints
// ----------------------------------------------------

exports.getLegalSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user || Number(user.user_type) !== 1) {
      return res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }

    let settings = await LegalSettings.findOne({});
    if (!settings) {
      settings = new LegalSettings({
        privacyPolicy: getDefaultContent('privacyPolicy'),
        termsAndConditions: getDefaultContent('termsAndConditions'),
        dataDeletion: getDefaultContent('dataDeletion')
      });
      await settings.save();
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching legal settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateLegalSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user || Number(user.user_type) !== 1) {
      return res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }

    const { privacyPolicy, termsAndConditions, dataDeletion } = req.body;
    
    // Sanitize before saving
    const updateData = {};
    if (privacyPolicy !== undefined) updateData.privacyPolicy = sanitizeHtml(privacyPolicy);
    if (termsAndConditions !== undefined) updateData.termsAndConditions = sanitizeHtml(termsAndConditions);
    if (dataDeletion !== undefined) updateData.dataDeletion = sanitizeHtml(dataDeletion);

    let settings = await LegalSettings.findOne({});
    if (settings) {
      Object.assign(settings, updateData);
      await settings.save();
    } else {
      settings = new LegalSettings(updateData);
      await settings.save();
    }
    
    res.status(200).json({ success: true, message: 'Legal pages updated successfully', data: settings });
  } catch (error) {
    console.error('Error updating legal settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// Public Endpoint
// ----------------------------------------------------

exports.getPublicLegalSettings = async (req, res) => {
  try {
    const [settings, company] = await Promise.all([
      LegalSettings.findOne({}),
      CompanySettings.findOne({})
    ]);

    // Use DB content or fallback to defaults
    const privacyPolicy = replacePlaceholders(settings?.privacyPolicy || getDefaultContent('privacyPolicy'), company);
    const termsAndConditions = replacePlaceholders(settings?.termsAndConditions || getDefaultContent('termsAndConditions'), company);
    const dataDeletion = replacePlaceholders(settings?.dataDeletion || getDefaultContent('dataDeletion'), company);

    res.status(200).json({
      success: true,
      data: {
        privacyPolicy,
        termsAndConditions,
        dataDeletion
      }
    });
  } catch (error) {
    console.error('Error fetching public legal settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
