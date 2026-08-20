const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/portal');
const promoUploadDir = path.join(__dirname, '../uploads/portal/promo');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(promoUploadDir)) {
  fs.mkdirSync(promoUploadDir, { recursive: true });
}

const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
};

const secureFileName = (file) => {
  const ext = mimeExtensions[file.mimetype] || '';
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, secureFileName(file));
  }
});

const promoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, promoUploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, secureFileName(file));
  }
});

const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const BRANDING_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const BRANDING_VIDEO_MAX_SIZE = 50 * 1024 * 1024;

const validateFileByKind = (kind, mimetype, cb) => {
  if (kind === 'video') {
    if (allowedVideoTypes.includes(mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid file type for video. Only MP4, WEBM, OGG, and MOV are allowed.'));
  }

  if (allowedImageTypes.includes(mimetype)) {
    return cb(null, true);
  }

  return cb(new Error('Invalid image type. Only JPG, PNG, and WEBP files are allowed.'));
};

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'bannerVideo') {
    return validateFileByKind('video', file.mimetype, cb);
  }

  if (file.fieldname === 'promoMedia') {
    const requestedType = String(req.body?.type || '').trim().toLowerCase();
    if (requestedType === 'video') {
      return validateFileByKind('video', file.mimetype, cb);
    }
    if (requestedType === 'image') {
      return validateFileByKind('image', file.mimetype, cb);
    }

    if (allowedImageTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    if (allowedVideoTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error('Invalid promotional media file. Only JPG, PNG, WEBP, MP4, WEBM, OGG, and MOV are allowed.'));
  }

  return validateFileByKind('image', file.mimetype, cb);
};

const uploadCustomerPortalBranding = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: BRANDING_VIDEO_MAX_SIZE,
  }
}).fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'bannerVideo', maxCount: 1 },
  { name: 'footerLogo', maxCount: 1 },
]);

const uploadCustomerPortalPromoMedia = multer({
  storage: promoStorage,
  fileFilter,
  limits: {
    fileSize: BRANDING_VIDEO_MAX_SIZE,
  }
}).single('promoMedia');

const handleCustomerPortalUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const requestedType = String(req.body?.type || '').trim().toLowerCase();
      const isImageRequest = String(req.body?.type || '').trim().toLowerCase() === 'image' || req.file?.fieldname === 'bannerImage' || req.file?.fieldname === 'footerLogo';
      const maxSizeLabel = isImageRequest ? '10MB' : '50MB';
      return res.status(400).json({ success: false, message: `File too large. Maximum size is ${maxSizeLabel}.` });
    }
    return res.status(400).json({ success: false, message: `File upload error: ${err.message}` });
  }

  if (err?.message) {
    return res.status(400).json({ success: false, message: err.message });
  }

  next(err);
};

module.exports = { uploadCustomerPortalBranding, uploadCustomerPortalPromoMedia, handleCustomerPortalUploadError };
