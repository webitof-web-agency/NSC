function normalizePhoneNumber(phone, defaultCountryCode = '91') {
  const raw = String(phone || '').trim();
  if (!raw) {
    throw new Error('Customer phone number is missing');
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Customer phone number is invalid');
  }

  if (raw.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length > 10) {
    return `+${digits}`;
  }

  throw new Error('Customer phone number must contain at least 10 digits');
}

module.exports = {
  normalizePhoneNumber,
};
