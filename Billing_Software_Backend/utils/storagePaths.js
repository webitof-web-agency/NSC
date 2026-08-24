'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getUploadsRoot() {
  if (process.env.NSC_UPLOADS_DIR) {
    return path.resolve(process.env.NSC_UPLOADS_DIR);
  }
  if (process.env.OFFLINE_MODE === 'true' || process.env.ELECTRON_APP === 'true') {
    return path.resolve(path.join(os.homedir(), '.nsc-desktop', 'uploads'));
  }
  return path.resolve(process.cwd(), 'uploads');
}

function ensureUploadDir(...segments) {
  const directory = path.join(getUploadsRoot(), ...segments);
  try {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  } catch (err) {
    console.warn(`[StoragePaths] Warning: could not mkdir ${directory}:`, err.message);
  }
  return directory;
}

function resolveStoredFilePath(storedPath) {
  const normalized = String(storedPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\/+/, '');
  const root = getUploadsRoot();
  const resolved = path.resolve(root, normalized);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('File path is outside local upload storage');
  }
  return resolved;
}

module.exports = {
  ensureUploadDir,
  getUploadsRoot,
  resolveStoredFilePath,
};
