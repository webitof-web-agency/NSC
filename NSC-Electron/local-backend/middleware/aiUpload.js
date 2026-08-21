const fs = require("fs");
const multer = require("multer");
const { ensureUploadDir } = require('../utils/storagePaths');

const tempDir = ensureUploadDir('_temp', 'ai-imports');

fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed"));
  }
  cb(null, true);
};

const maxFileSizeMb = Number(process.env.AI_SCAN_MAX_FILE_SIZE_MB || 10);

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
});
