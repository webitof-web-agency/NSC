const bcrypt = require('bcryptjs');
const Customer = require('@models/Customer');
const Invoice = require('@models/Invoice');
const InvoicePayment = require('@models/InvoicePayment');
const CompanySettings = require('@models/CompanySettings');
const CustomerPortalBranding = require('@models/CustomerPortalBranding');
const Localization = require('@models/Localization');
const DateFormat = require('@models/DateFormat');
const TimeFormat = require('@models/TimeFormat');
const Timezone = require('@models/Timezone');
const generateToken = require('@utils/generateToken');
const {
  DEFAULT_PORTAL_ACCENT_COLOR,
  sanitizeHttpUrl,
} = require('@utils/publicInvoicePortal');
const fs = require('fs');
const path = require('path');

const PORTAL_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const PORTAL_VIDEO_MAX_SIZE = 50 * 1024 * 1024;

const parseFormBoolean = (value, fallback) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
};

const validateOptionalHttpUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return sanitizeHttpUrl(trimmed) || null;
};

const buildAbsoluteFileUrl = (req, filePath) => {
  if (!filePath) return '';
  const cleanedPath = String(filePath).replace(/^[\\/]+/, '');
  return req.protocol + '://' + req.get('host') + '/' + cleanedPath.replace(/\\/g, '/');
};

const extractCustomerPortalBranding = (branding, req) => ({
  activeBannerType: branding?.activeBannerType || 'none',
  bannerImage: buildAbsoluteFileUrl(req, branding?.bannerImage),
  bannerVideo: buildAbsoluteFileUrl(req, branding?.bannerVideo),
  footerLogo: buildAbsoluteFileUrl(req, branding?.footerLogo),
  heroTitle: branding?.heroTitle || '',
  heroSubtitle: branding?.heroSubtitle || '',
  footerText: branding?.footerText || '',
  footerAddress: branding?.footerAddress || '',
  footerPhone: branding?.footerPhone || '',
  footerPhoneAlt: branding?.footerPhoneAlt || '',
  footerEmail: branding?.footerEmail || '',
  footerWebsite: branding?.footerWebsite || '',
  facebookUrl: branding?.facebookUrl || '',
  instagramUrl: branding?.instagramUrl || '',
  youtubeUrl: branding?.youtubeUrl || '',
  whatsappNumber: branding?.whatsappNumber || '',
  shopOnlineUrl: branding?.shopOnlineUrl || '',
  portalAccentColor: branding?.portalAccentColor || DEFAULT_PORTAL_ACCENT_COLOR,
  showPromotionalBanner: branding?.showPromotionalBanner !== false,
  showPromotionalGallery: branding?.showPromotionalGallery !== false,
  showShopOnline: branding?.showShopOnline !== false,
  showSocialLinks: branding?.showSocialLinks !== false,
  enableCustomerHistory: branding?.enableCustomerHistory === true,
  promoGallery: (branding?.promoGallery || [])
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .map((item) => ({
      id: item?._id,
      type: item?.type || 'image',
      url: buildAbsoluteFileUrl(req, item?.url),
      relativeUrl: item?.url || '',
      caption: item?.caption || '',
      order: Number(item?.order || 0),
      createdAt: item?.createdAt || null,
      updatedAt: item?.updatedAt || null,
    })),
});

const deleteUploadedFile = (filePath) => {
  if (!filePath) return;
  try {
    const normalizedPath = String(filePath).replace(/^\/+/, '');
    const fullPath = path.join(__dirname, '..', normalizedPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error('Customer portal branding file delete error:', error);
  }
};

const cleanupUploadedFiles = (files = {}) => {
  Object.values(files).flat().forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

const normalizePromoGalleryItems = (items = []) => {
  return items
    .map((item) => item.toObject ? item.toObject() : item)
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .map((item, index) => ({
      ...item,
      order: index,
    }));
};

const getPromoGalleryItemById = (branding, itemId) => {
  return branding?.promoGallery?.id(itemId) || null;
};

const buildLegacyBrandingPayload = (settings) => ({
  activeBannerType: settings?.customerPortalActiveBannerType || 'none',
  bannerImage: settings?.customerPortalBannerImage || '',
  bannerVideo: settings?.customerPortalBannerVideo || '',
  footerLogo: settings?.customerPortalFooterLogo || '',
  heroTitle: settings?.customerPortalHeroTitle || '',
  heroSubtitle: settings?.customerPortalHeroSubtitle || '',
  footerText: settings?.customerPortalFooterText || '',
  footerAddress: settings?.customerPortalFooterAddress || '',
  footerPhone: settings?.customerPortalFooterPhone || '',
  footerPhoneAlt: settings?.customerPortalFooterPhoneAlt || '',
  footerEmail: settings?.customerPortalFooterEmail || '',
  footerWebsite: settings?.customerPortalFooterWebsite || '',
  facebookUrl: settings?.customerPortalFacebookUrl || '',
  instagramUrl: settings?.customerPortalInstagramUrl || '',
  youtubeUrl: settings?.customerPortalYoutubeUrl || '',
  whatsappNumber: settings?.customerPortalWhatsappNumber || '',
  shopOnlineUrl: settings?.customerPortalShopOnlineUrl || '',
  portalAccentColor: settings?.customerPortalAccentColor || DEFAULT_PORTAL_ACCENT_COLOR,
  showPromotionalBanner: settings?.customerPortalShowPromotionalBanner !== false,
  showPromotionalGallery: settings?.customerPortalShowPromotionalGallery !== false,
  showShopOnline: settings?.customerPortalShowShopOnline !== false,
  showSocialLinks: settings?.customerPortalShowSocialLinks !== false,
  enableCustomerHistory: settings?.customerPortalEnableCustomerHistory === true,
  promoGallery: normalizePromoGalleryItems(settings?.customerPortalPromoGallery || []),
});

const findOrCreateCustomerPortalBrandingForUser = async (userId, options = {}) => {
  if (!userId) return null;

  let branding = await CustomerPortalBranding.findOne({ userId });
  if (branding) {
    return options.lean ? branding.toObject() : branding;
  }

  const companySettings = await findCompanySettingsForUser(userId, { lean: true });
  const initialPayload = companySettings
    ? { userId, ...buildLegacyBrandingPayload(companySettings) }
    : { userId };

  branding = await CustomerPortalBranding.create(initialPayload);
  return options.lean ? branding.toObject() : branding;
};


const findCompanySettingsForUser = async (userId, options = {}) => {
  const query = userId ? { userId } : {};
  let settings = await CompanySettings.findOne(query).sort({ createdAt: -1, _id: -1 });

  if (!settings && userId) {
    settings = await CompanySettings.findOne({}).sort({ createdAt: -1, _id: -1 });
  }

  if (!settings) {
    return null;
  }

  if (options.lean) {
    return settings.toObject();
  }

  return settings;
};

const buildCustomerPortalSettingsResponse = async (req) => {
  const ownerUserId = req.ownerUserId || req.user || req.query.userId;
  const [companySettings, customerPortalBranding, userLocalization, defaultDateFormat, defaultTimeFormat, defaultTimezone] = await Promise.all([
    findCompanySettingsForUser(ownerUserId, { lean: true }),
    findOrCreateCustomerPortalBrandingForUser(ownerUserId, { lean: true }),
    Localization.findOne({ isActive: true }).populate('dateFormat timeFormat timezone').sort({ createdAt: -1 }).lean(),
    DateFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
    TimeFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
    Timezone.findOne().sort({ createdAt: 1 }).lean(),
  ]);

  return {
    company: {
      _id: companySettings?._id || null,
      companyName: companySettings?.companyName || 'Customer Portal',
      email: companySettings?.email || '',
      phone: companySettings?.phone || '',
      address: companySettings?.address || '',
      city: companySettings?.city || '',
      state: companySettings?.state || '',
      country: companySettings?.country || '',
      pincode: companySettings?.pincode || '',
      gstin: companySettings?.gstin || '',
      udyam: companySettings?.udyam || '',
      siteLogo: buildAbsoluteFileUrl(req, companySettings?.siteLogo),
      favicon: buildAbsoluteFileUrl(req, companySettings?.favicon),
      companyLogo: buildAbsoluteFileUrl(req, companySettings?.companyLogo),
      companyBanner: buildAbsoluteFileUrl(req, companySettings?.companyBanner),
      customerPortalBranding: extractCustomerPortalBranding(customerPortalBranding, req),
    },
    dateFormat: userLocalization?.dateFormat || defaultDateFormat || { title: 'DD-MM-YYYY', format: 'd-m-Y', isActive: true },
    timeFormat: userLocalization?.timeFormat || defaultTimeFormat || { name: 'H:i:s', format: 'H:i:s', isActive: true },
    timezone: userLocalization?.timezone || defaultTimezone || { name: 'UTC', utc_offset: '+00:00' },
    startWeek: userLocalization?.startWeek || 'Monday',
    ownerUserId,
  };
};
const normalizeShippingAddress = (shippingAddress) => {
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return null;
  }

  return {
    name: shippingAddress.name || '',
    addressLine1: shippingAddress.addressLine1 || '',
    addressLine2: shippingAddress.addressLine2 || '',
    city: shippingAddress.city || '',
    state: shippingAddress.state || '',
    country: shippingAddress.country || '',
    pincode: shippingAddress.pincode || '',
  };
};

const buildInvoiceResponse = async (invoice, req) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/`;

  const billFromDetails = invoice.billFrom
    ? {
        id: invoice.billFrom._id,
        name: `${invoice.billFrom.firstName || ''} ${invoice.billFrom.lastName || ''}`.trim(),
        email: invoice.billFrom.email || null,
        phone: invoice.billFrom.phone || null,
        address: invoice.billFrom.address || null,
        image: invoice.billFrom.profileImage
          ? `${baseUrl}${invoice.billFrom.profileImage.replace(/\\/g, '/')}`
          : '',
      }
    : null;

  const billToDetails = invoice.billTo
    ? {
        id: invoice.billTo._id,
        name: invoice.billTo.name || '',
        email: invoice.billTo.email || null,
        phone: invoice.billTo.phone || null,
        billingAddress: invoice.billTo.billingAddress || null,
        image: invoice.billTo.image
          ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, '/')}`
          : '',
      }
    : null;

  const bankDetails = invoice.bank
    ? {
        id: invoice.bank.id || '',
        accountHoldername: invoice.bank.accountHoldername || '',
        bankName: invoice.bank.bankName || '',
        branchName: invoice.bank.branchName || '',
        accountNumber: invoice.bank.accountNumber || '',
        IFSCCode: invoice.bank.IFSCCode || '',
      }
    : null;

  const payments = await InvoicePayment.find({
    invoiceId: invoice._id,
    isDeleted: { $ne: true },
  }).lean();

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balanceAmount = Math.max(Number(invoice.TotalAmount || 0) - totalPaid, 0);

  return {
    id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    referenceNo: invoice.referenceNo,
    status: invoice.status,
    payment_method: invoice.payment_method,
    taxableAmount: invoice.taxableAmount,
    totalDiscount: invoice.totalDiscount,
    overall_discount: invoice.overall_discount,
    vat: invoice.vat,
    TotalAmount: invoice.TotalAmount,
    roundOff: invoice.roundOff,
    items: invoice.items || [],
    exchangeOriginalItems: invoice.exchangeOriginalItems || [],
    itemsCount: invoice.items?.length || 0,
    billFrom: billFromDetails,
    billTo: billToDetails,
    bank: bankDetails,
    notes: invoice.notes,
    termsAndCondition: invoice.termsAndCondition,
    customerGstin: invoice.customerGstin || '',
    ewayBillNumber: invoice.ewayBillNumber || '',
    shippingAddress: normalizeShippingAddress(invoice.shippingAddress),
    taxType: invoice.taxType || 'GST',
    gstType: invoice.gstType || 'Exclusive',
    cashAmount: invoice.cashAmount || 0,
    cardAmount: invoice.cardAmount || 0,
    upiAmount: invoice.upiAmount || 0,
    creditAmount: invoice.creditAmount || 0,
    totalPaid,
    balanceAmount,
    exchangeOldTotal: invoice.exchangeOldTotal ?? null,
    exchangeNewTotal: invoice.exchangeNewTotal ?? null,
    amountDifference: invoice.amountDifference ?? null,
    isExchange: invoice.isExchange ?? false,
    exchangePending: invoice.exchangePending ?? false,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
};

const loginCustomer = async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const customer = await Customer.findOne({
      phone,
      isDeleted: false,
      portalEnabled: { $ne: false },
      status: 'Active',
    });

    if (!customer) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let isMatch = false;

    if (customer.portalPassword) {
      isMatch = await customer.matchPortalPassword(password);
    } else if (password === phone) {
      customer.portalPassword = await bcrypt.hash(phone, 12);
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    customer.portalLastLoginAt = new Date();
    await customer.save();

    return res.status(200).json({
      message: 'Customer login successful',
      token: generateToken(customer._id, { type: 'customer' }),
      customer: {
        id: customer._id,
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
      },
    });
  } catch (error) {
    console.error('Customer portal login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerPortalSettings = async (req, res) => {
  try {
    const data = await buildCustomerPortalSettingsResponse(req);
    return res.status(200).json({
      success: true,
      message: 'Customer portal settings fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Customer portal settings error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getAdminCustomerPortalBranding = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user, { lean: true });
    return res.status(200).json({
      success: true,
      data: extractCustomerPortalBranding(branding, req),
    });
  } catch (error) {
    console.error('Get admin customer portal branding error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateAdminCustomerPortalBranding = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    const activeBannerType = String(req.body.activeBannerType || branding.activeBannerType || 'none');
    if (!['none', 'image', 'video'].includes(activeBannerType)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'Invalid banner type.' });
    }

    const accentColor = String(req.body.portalAccentColor || branding.portalAccentColor || DEFAULT_PORTAL_ACCENT_COLOR).trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'Accent color must be a six-digit hex color.' });
    }

    const urlFields = ['footerWebsite', 'facebookUrl', 'instagramUrl', 'youtubeUrl', 'shopOnlineUrl'];
    const normalizedUrls = {};
    for (const field of urlFields) {
      const normalizedUrl = validateOptionalHttpUrl(req.body[field]);
      if (normalizedUrl === null) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: `${field} must use a valid http or https URL.` });
      }
      normalizedUrls[field] = normalizedUrl;
    }

    const bannerImageFile = req.files?.bannerImage?.[0];
    const bannerVideoFile = req.files?.bannerVideo?.[0];
    const footerLogoFile = req.files?.footerLogo?.[0];
    const oversizedImage = [bannerImageFile, footerLogoFile].find((file) => file && file.size > PORTAL_IMAGE_MAX_SIZE);
    if (oversizedImage || (bannerVideoFile && bannerVideoFile.size > PORTAL_VIDEO_MAX_SIZE)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        message: oversizedImage ? 'Images must be 10MB or smaller.' : 'Videos must be 50MB or smaller.',
      });
    }

    const updates = {
      activeBannerType,
      heroTitle: req.body.heroTitle || '',
      heroSubtitle: req.body.heroSubtitle || '',
      footerText: req.body.footerText || '',
      footerAddress: req.body.footerAddress || '',
      footerPhone: req.body.footerPhone || '',
      footerPhoneAlt: req.body.footerPhoneAlt || '',
      footerEmail: req.body.footerEmail || '',
      ...normalizedUrls,
      whatsappNumber: req.body.whatsappNumber || '',
      portalAccentColor: accentColor.toUpperCase(),
      showPromotionalBanner: parseFormBoolean(req.body.showPromotionalBanner, branding.showPromotionalBanner !== false),
      showPromotionalGallery: parseFormBoolean(req.body.showPromotionalGallery, branding.showPromotionalGallery !== false),
      showShopOnline: parseFormBoolean(req.body.showShopOnline, branding.showShopOnline !== false),
      showSocialLinks: parseFormBoolean(req.body.showSocialLinks, branding.showSocialLinks !== false),
      enableCustomerHistory: parseFormBoolean(req.body.enableCustomerHistory, branding.enableCustomerHistory === true),
    };
    const oldFilesToDelete = [];

    if (bannerImageFile) {
      if (branding.bannerImage) oldFilesToDelete.push(branding.bannerImage);
      updates.bannerImage = `/uploads/portal/${bannerImageFile.filename}`;
    } else if (parseFormBoolean(req.body.removeBannerImage, false)) {
      if (branding.bannerImage) oldFilesToDelete.push(branding.bannerImage);
      updates.bannerImage = '';
    }

    if (bannerVideoFile) {
      if (branding.bannerVideo) oldFilesToDelete.push(branding.bannerVideo);
      updates.bannerVideo = `/uploads/portal/${bannerVideoFile.filename}`;
    } else if (parseFormBoolean(req.body.removeBannerVideo, false)) {
      if (branding.bannerVideo) oldFilesToDelete.push(branding.bannerVideo);
      updates.bannerVideo = '';
    }

    if (footerLogoFile) {
      if (branding.footerLogo) oldFilesToDelete.push(branding.footerLogo);
      updates.footerLogo = `/uploads/portal/${footerLogoFile.filename}`;
    } else if (parseFormBoolean(req.body.removeFooterLogo, false)) {
      if (branding.footerLogo) oldFilesToDelete.push(branding.footerLogo);
      updates.footerLogo = '';
    }

    Object.assign(branding, updates);
    await branding.save();
    oldFilesToDelete.forEach(deleteUploadedFile);

    return res.status(200).json({
      success: true,
      message: 'Customer portal branding updated successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req),
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error('Update admin customer portal branding error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


const addPromoGalleryItem = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    if (!req.file) {
      return res.status(400).json({ message: 'Promo media file is required.' });
    }

    const existingItems = branding.promoGallery || [];

    const type = String(req.body.type || '').trim().toLowerCase();
    if (!['image', 'video'].includes(type)) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Invalid promo media type.' });
    }

    const maximumSize = type === 'video' ? PORTAL_VIDEO_MAX_SIZE : PORTAL_IMAGE_MAX_SIZE;
    if (req.file.size > maximumSize) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: type === 'video' ? 'Videos must be 50MB or smaller.' : 'Images must be 10MB or smaller.',
      });
    }

    const item = {
      type,
      url: `/uploads/portal/promo/${req.file.filename}`,
      caption: String(req.body.caption || '').trim(),
      order: existingItems.length,
    };

    branding.promoGallery.push(item);
    branding.promoGallery = normalizePromoGalleryItems(branding.promoGallery);
    await branding.save();

    return res.status(201).json({
      success: true,
      message: 'Promotional media added successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req).promoGallery,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Add promo gallery item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updatePromoGalleryItem = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    const item = getPromoGalleryItemById(branding, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Promotional media item not found.' });
    }

    if (req.body.caption !== undefined) {
      item.caption = String(req.body.caption || '').trim();
    }

    await branding.save();

    return res.status(200).json({
      success: true,
      message: 'Promotional media updated successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req).promoGallery,
    });
  } catch (error) {
    console.error('Update promo gallery item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const replacePromoGalleryItemMedia = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    const item = getPromoGalleryItemById(branding, req.params.itemId);
    if (!item) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Promotional media item not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Replacement promo media file is required.' });
    }

    const type = String(req.body.type || item.type || '').trim().toLowerCase();
    if (!['image', 'video'].includes(type)) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Invalid promo media type.' });
    }

    const maximumSize = type === 'video' ? PORTAL_VIDEO_MAX_SIZE : PORTAL_IMAGE_MAX_SIZE;
    if (req.file.size > maximumSize) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: type === 'video' ? 'Videos must be 50MB or smaller.' : 'Images must be 10MB or smaller.',
      });
    }

    const oldUrl = item.url;
    item.type = type;
    item.url = `/uploads/portal/promo/${req.file.filename}`;
    if (req.body.caption !== undefined) {
      item.caption = String(req.body.caption || '').trim();
    }

    await branding.save();
    if (oldUrl) deleteUploadedFile(oldUrl);

    return res.status(200).json({
      success: true,
      message: 'Promotional media replaced successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req).promoGallery,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Replace promo gallery item media error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deletePromoGalleryItem = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    const item = getPromoGalleryItemById(branding, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Promotional media item not found.' });
    }

    const oldUrl = item.url;
    item.deleteOne();
    branding.promoGallery = normalizePromoGalleryItems(branding.promoGallery);
    await branding.save();
    if (oldUrl) deleteUploadedFile(oldUrl);

    return res.status(200).json({
      success: true,
      message: 'Promotional media deleted successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req).promoGallery,
    });
  } catch (error) {
    console.error('Delete promo gallery item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const reorderPromoGalleryItems = async (req, res) => {
  try {
    const branding = await findOrCreateCustomerPortalBrandingForUser(req.user);

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'Reorder items are required.' });
    }

    const orderMap = new Map(items.map((item) => [String(item.id), Number(item.order)]));
    branding.promoGallery.forEach((galleryItem) => {
      const nextOrder = orderMap.get(String(galleryItem._id));
      if (Number.isFinite(nextOrder)) {
        galleryItem.order = nextOrder;
      }
    });

    branding.promoGallery = normalizePromoGalleryItems(branding.promoGallery);
    await branding.save();

    return res.status(200).json({
      success: true,
      message: 'Promotional media reordered successfully',
      data: extractCustomerPortalBranding(branding.toObject(), req).promoGallery,
    });
  } catch (error) {
    console.error('Reorder promo gallery items error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
const getCustomerMe = async (req, res) => {
  const customer = req.customer;

  return res.status(200).json({
    success: true,
    data: {
      id: customer._id,
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      website: customer.website || '',
      notes: customer.notes || '',
      status: customer.status || 'Active',
      billingAddress: customer.billingAddress || {},
      shippingAddress: customer.shippingAddress || {},
      bankDetails: customer.bankDetails || {},
      portalEnabled: customer.portalEnabled,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
  });
};

const updateCustomerProfile = async (req, res) => {
  try {
    const customer = req.customer;
    const {
      name,
      email,
      website,
      notes,
      billingAddress,
      shippingAddress,
      bankDetails,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    const parsedBillingAddress =
      typeof billingAddress === 'string' ? JSON.parse(billingAddress) : billingAddress;
    const parsedShippingAddress =
      typeof shippingAddress === 'string' ? JSON.parse(shippingAddress) : shippingAddress;
    const parsedBankDetails =
      typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;

    customer.name = name !== undefined ? name : customer.name;
    customer.email = email !== undefined ? String(email || '').trim().toLowerCase() : customer.email;
    customer.website = website !== undefined ? website : customer.website;
    customer.notes = notes !== undefined ? notes : customer.notes;
    customer.billingAddress = parsedBillingAddress || customer.billingAddress;
    customer.shippingAddress = parsedShippingAddress || customer.shippingAddress;
    customer.bankDetails = parsedBankDetails || customer.bankDetails;

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Current password, new password, and confirm password are required' });
      }

      const isCurrentMatch = await customer.matchPortalPassword(currentPassword);
      if (!isCurrentMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      customer.portalPassword = await bcrypt.hash(String(newPassword), 12);
      customer.portalPasswordChanged = true;
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Customer portal profile update error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const listCustomerInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      startDate,
      endDate,
    } = req.query;

    const query = {
      billTo: req.customerId,
      isDeleted: false,
      parentInvoice: null,
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [total, invoices] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.find(query)
        .populate('billTo', 'name email phone billingAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const paymentRows = invoiceIds.length
      ? await InvoicePayment.aggregate([
          { $match: { invoiceId: { $in: invoiceIds }, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: '$invoiceId',
              totalPaid: { $sum: { $ifNull: ['$amount', 0] } },
            },
          },
        ])
      : [];

    const paymentMap = new Map(paymentRows.map((row) => [String(row._id), Number(row.totalPaid || 0)]));

    const rows = invoices.map((invoice) => {
      const totalPaid = paymentMap.get(String(invoice._id)) || 0;
      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        payment_method: invoice.payment_method || 'N/A',
        TotalAmount: Number(invoice.TotalAmount || 0),
        totalPaid,
        balanceAmount: Math.max(Number(invoice.TotalAmount || 0) - totalPaid, 0),
        createdAt: invoice.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        invoices: rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    console.error('Customer portal list invoices error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      billTo: req.customerId,
      isDeleted: false,
    })
      .populate({
        path: 'billFrom',
        model: 'User',
        select: 'firstName lastName email phone profileImage address',
      })
      .populate('billTo', 'name email phone billingAddress image')
      .populate(
        'bank',
        'accountHoldername bankName branchName accountNumber IFSCCode'
      );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    const responseData = await buildInvoiceResponse(invoice, req);

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Customer portal get invoice error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerDashboard = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      billTo: req.customerId,
      isDeleted: false,
      parentInvoice: null,
    })
      .select('_id invoiceNumber TotalAmount status invoiceDate dueDate')
      .lean();

    const payments = invoices.length
      ? await InvoicePayment.aggregate([
          {
            $match: {
              invoiceId: { $in: invoices.map((invoice) => invoice._id) },
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: '$invoiceId',
              totalPaid: { $sum: { $ifNull: ['$amount', 0] } },
            },
          },
        ])
      : [];

    const paymentMap = new Map(payments.map((row) => [String(row._id), Number(row.totalPaid || 0)]));

    const summary = invoices.reduce(
      (acc, invoice) => {
        const total = Number(invoice.TotalAmount || 0);
        const paid = paymentMap.get(String(invoice._id)) || 0;
        acc.totalInvoices += 1;
        acc.totalAmount += total;
        acc.totalPaid += paid;
        acc.totalDue += Math.max(total - paid, 0);
        if (invoice.status === 'PAID') acc.paidInvoices += 1;
        if (invoice.status === 'PARTIALLY_PAID') acc.partialInvoices += 1;
        if (['UNPAID', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING', 'DRAFT'].includes(invoice.status)) {
          acc.openInvoices += 1;
        }
        return acc;
      },
      {
        totalInvoices: 0,
        paidInvoices: 0,
        partialInvoices: 0,
        openInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
      }
    );

    const recentInvoices = invoices
      .sort((a, b) => new Date(b.createdAt || b.invoiceDate).getTime() - new Date(a.createdAt || a.invoiceDate).getTime())
      .slice(0, 5)
      .map((invoice) => {
        const paid = paymentMap.get(String(invoice._id)) || 0;
        return {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          status: invoice.status,
          totalAmount: Number(invoice.TotalAmount || 0),
          totalPaid: paid,
          balanceAmount: Math.max(Number(invoice.TotalAmount || 0) - paid, 0),
        };
      });

    return res.status(200).json({
      success: true,
      data: {
        summary,
        recentInvoices,
      },
    });
  } catch (error) {
    console.error('Customer portal dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const generateAdminCustomerPortalAccess = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.status(200).json({
      success: true,
      token: generateToken(customer._id, { type: 'customer', adminPreview: true }),
      customer: {
        id: customer._id,
        name: customer.name || '',
        phone: customer.phone || '',
      },
    });
  } catch (error) {
    console.error('Admin customer portal access error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  loginCustomer,
  getCustomerPortalSettings,
  getCustomerMe,
  updateCustomerProfile,
  listCustomerInvoices,
  getCustomerInvoiceById,
  getCustomerDashboard,
  getAdminCustomerPortalBranding,
  updateAdminCustomerPortalBranding,
  addPromoGalleryItem,
  updatePromoGalleryItem,
  replacePromoGalleryItemMedia,
  deletePromoGalleryItem,
  reorderPromoGalleryItems,
  generateAdminCustomerPortalAccess,
};
