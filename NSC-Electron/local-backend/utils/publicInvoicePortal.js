const DEFAULT_PORTAL_ACCENT_COLOR = '#A43275';

const PUBLIC_BRANDING_BOOLEAN_DEFAULTS = Object.freeze({
  showPromotionalBanner: true,
  showPromotionalGallery: true,
  showShopOnline: true,
  showSocialLinks: true,
  enableCustomerHistory: false,
});

const sanitizeHttpUrl = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.length > 2048) return '';

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
};

const toAbsoluteAssetUrl = (value, assetBaseUrl = '') => {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return sanitizeHttpUrl(candidate);

  const base = String(assetBaseUrl || '').replace(/\/$/, '');
  if (!base) return candidate;
  return `${base}/${candidate.replace(/^\/+/, '')}`;
};

const normalizeBoolean = (value, fallback) => (
  typeof value === 'boolean' ? value : fallback
);

const normalizePublicPortalBranding = (branding = {}, assetBaseUrl = '') => ({
  activeBannerType: ['none', 'image', 'video'].includes(branding.activeBannerType)
    ? branding.activeBannerType
    : 'none',
  bannerImage: toAbsoluteAssetUrl(branding.bannerImage, assetBaseUrl),
  bannerVideo: toAbsoluteAssetUrl(branding.bannerVideo, assetBaseUrl),
  footerLogo: toAbsoluteAssetUrl(branding.footerLogo, assetBaseUrl),
  heroTitle: String(branding.heroTitle || ''),
  heroSubtitle: String(branding.heroSubtitle || ''),
  footerText: String(branding.footerText || ''),
  footerAddress: String(branding.footerAddress || ''),
  footerPhone: String(branding.footerPhone || ''),
  footerPhoneAlt: String(branding.footerPhoneAlt || ''),
  footerEmail: String(branding.footerEmail || ''),
  footerWebsite: sanitizeHttpUrl(branding.footerWebsite),
  facebookUrl: sanitizeHttpUrl(branding.facebookUrl),
  instagramUrl: sanitizeHttpUrl(branding.instagramUrl),
  youtubeUrl: sanitizeHttpUrl(branding.youtubeUrl),
  whatsappNumber: String(branding.whatsappNumber || '').replace(/[^\d+]/g, ''),
  shopOnlineUrl: sanitizeHttpUrl(branding.shopOnlineUrl),
  portalAccentColor: /^#[0-9a-f]{6}$/i.test(String(branding.portalAccentColor || ''))
    ? String(branding.portalAccentColor).toUpperCase()
    : DEFAULT_PORTAL_ACCENT_COLOR,
  showPromotionalBanner: normalizeBoolean(
    branding.showPromotionalBanner,
    PUBLIC_BRANDING_BOOLEAN_DEFAULTS.showPromotionalBanner,
  ),
  showPromotionalGallery: normalizeBoolean(
    branding.showPromotionalGallery,
    PUBLIC_BRANDING_BOOLEAN_DEFAULTS.showPromotionalGallery,
  ),
  showShopOnline: normalizeBoolean(
    branding.showShopOnline,
    PUBLIC_BRANDING_BOOLEAN_DEFAULTS.showShopOnline,
  ),
  showSocialLinks: normalizeBoolean(
    branding.showSocialLinks,
    PUBLIC_BRANDING_BOOLEAN_DEFAULTS.showSocialLinks,
  ),
  enableCustomerHistory: normalizeBoolean(
    branding.enableCustomerHistory,
    PUBLIC_BRANDING_BOOLEAN_DEFAULTS.enableCustomerHistory,
  ),
  promoGallery: (Array.isArray(branding.promoGallery) ? branding.promoGallery : [])
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .map((item) => ({
      id: String(item?._id || item?.id || ''),
      type: item?.type === 'video' ? 'video' : 'image',
      url: toAbsoluteAssetUrl(item?.url, assetBaseUrl),
      caption: String(item?.caption || ''),
      order: Number(item?.order || 0),
    }))
    .filter((item) => Boolean(item.url)),
});

const getCustomerHistoryAvailability = (branding = {}) => ({
  requested: branding.enableCustomerHistory === true,
  enabled: false,
  code: 'OTP_DELIVERY_NOT_CONFIGURED',
  message: branding.enableCustomerHistory === true
    ? 'Invoice history is unavailable until secure OTP delivery is configured.'
    : 'Invoice history is not enabled by this business.',
});

module.exports = {
  DEFAULT_PORTAL_ACCENT_COLOR,
  PUBLIC_BRANDING_BOOLEAN_DEFAULTS,
  sanitizeHttpUrl,
  toAbsoluteAssetUrl,
  normalizePublicPortalBranding,
  getCustomerHistoryAvailability,
};
