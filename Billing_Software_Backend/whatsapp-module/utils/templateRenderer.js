const DEFAULT_TEMPLATE_BODIES = {
  invoice:
    'Hello {{customerName}}, your invoice {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached your bill here.',
  exchange:
    'Hello {{customerName}}, your exchange invoice {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached your bill here.',
  quotation:
    'Hello {{customerName}}, your quotation {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached it here.',
};

function formatAmount(amount) {
  const value = Number(amount || 0);
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function normalizeLine(value) {
  return String(value || '').trim();
}

function renderTemplateString(template, variables) {
  return String(template || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function buildDefaultVariables(context = {}) {
  return {
    customerName: context.customerName || 'Customer',
    customerPhone: context.customerPhone || '',
    documentNumber: context.documentNumber || '',
    amount: formatAmount(context.amount),
    date: context.date || '',
    companyName: context.companyName || 'Your Company',
    documentType: context.documentType || '',
  };
}

function renderWhatsAppMessage({ template, context }) {
  const variables = buildDefaultVariables(context);
  const safeTemplate = template || {};
  const headerText = renderTemplateString(normalizeLine(safeTemplate.headerText), variables);
  const bodyText = renderTemplateString(
    normalizeLine(safeTemplate.bodyText) || DEFAULT_TEMPLATE_BODIES[context.documentType] || DEFAULT_TEMPLATE_BODIES.invoice,
    variables
  );
  const footerText = renderTemplateString(normalizeLine(safeTemplate.footerText), variables);

  const text = [headerText, bodyText, footerText].filter(Boolean).join('\n\n').trim();

  return {
    headerText,
    bodyText,
    footerText,
    text,
    variables,
  };
}

module.exports = {
  DEFAULT_TEMPLATE_BODIES,
  renderWhatsAppMessage,
};
