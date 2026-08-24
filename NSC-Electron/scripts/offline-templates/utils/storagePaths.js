'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getUploadsRoot() {
  return path.resolve(
    process.env.NSC_UPLOADS_DIR || path.join(os.homedir(), '.nsc-desktop', 'uploads'),
  );
}

function ensureUploadDir(...segments) {
  const directory = path.join(getUploadsRoot(), ...segments);
  fs.mkdirSync(directory, { recursive: true });
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
