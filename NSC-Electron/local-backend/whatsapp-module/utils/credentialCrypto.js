const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'enc:';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = String(process.env.WHATSAPP_SETTINGS_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('WHATSAPP_SETTINGS_SECRET or JWT_SECRET is required to encrypt WhatsApp credentials');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith(ENCRYPTION_PREFIX)) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!raw.startsWith(ENCRYPTION_PREFIX)) return raw;

  const parts = raw.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted WhatsApp credential format is invalid');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function maskSecret(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 8) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

module.exports = {
  encryptValue,
  decryptValue,
  maskSecret,
};
