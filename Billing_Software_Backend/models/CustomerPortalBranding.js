const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const customerPortalPromoGalleryItemSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['image', 'video'],
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    caption: {
        type: String,
        default: '',
        trim: true,
    },
    order: {
        type: Number,
        default: 0,
    },
}, {
    _id: true,
    timestamps: true,
});

const customerPortalBrandingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    activeBannerType: {
        type: String,
        enum: ['none', 'image', 'video'],
        default: 'none',
    },
    bannerImage: {
        type: String,
        default: '',
        trim: true,
    },
    bannerVideo: {
        type: String,
        default: '',
        trim: true,
    },
    footerLogo: {
        type: String,
        default: '',
        trim: true,
    },
    heroTitle: {
        type: String,
        default: '',
        trim: true,
    },
    heroSubtitle: {
        type: String,
        default: '',
        trim: true,
    },
    footerText: {
        type: String,
        default: '',
        trim: true,
    },
    footerAddress: {
        type: String,
        default: '',
        trim: true,
    },
    footerPhone: {
        type: String,
        default: '',
        trim: true,
    },
    footerPhoneAlt: {
        type: String,
        default: '',
        trim: true,
    },
    footerEmail: {
        type: String,
        default: '',
        trim: true,
    },
    footerWebsite: {
        type: String,
        default: '',
        trim: true,
    },
    facebookUrl: {
        type: String,
        default: '',
        trim: true,
    },
    instagramUrl: {
        type: String,
        default: '',
        trim: true,
    },
    youtubeUrl: {
        type: String,
        default: '',
        trim: true,
    },
    whatsappNumber: {
        type: String,
        default: '',
        trim: true,
    },
    shopOnlineUrl: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2048,
    },
    portalAccentColor: {
        type: String,
        default: '#A43275',
        trim: true,
        match: /^#[0-9A-Fa-f]{6}$/,
    },
    showPromotionalBanner: {
        type: Boolean,
        default: true,
    },
    showPromotionalGallery: {
        type: Boolean,
        default: true,
    },
    showShopOnline: {
        type: Boolean,
        default: true,
    },
    showSocialLinks: {
        type: Boolean,
        default: true,
    },
    enableCustomerHistory: {
        type: Boolean,
        default: false,
    },
    promoGallery: {
        type: [customerPortalPromoGalleryItemSchema],
        default: [],
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

customerPortalBrandingSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('CustomerPortalBranding', customerPortalBrandingSchema);
