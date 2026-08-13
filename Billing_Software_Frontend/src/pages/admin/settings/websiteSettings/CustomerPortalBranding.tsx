import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Constants from '@constants/api';
import SubmitButton from '@components/admin/SubmitButton';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { hasPermission } from '@utils/hasPermission';
import {
    Image as ImageIcon, Video, UploadCloud, X, Monitor, Plus, Trash2, ArrowUp, ArrowDown, LoaderCircle, RefreshCw,
    MapPin, Phone, Mail, Globe, Facebook, Instagram, Youtube,
    MessageCircle, Layout, Eye, EyeOff, Sparkles, PlayCircle, Images
} from 'lucide-react';


interface PromoGalleryItem {
    id: string;
    type: 'image' | 'video';
    url: string;
    relativeUrl?: string;
    caption: string;
    order: number;
}
interface BrandingFormData {
    activeBannerType: 'none' | 'image' | 'video';
    heroTitle: string;
    heroSubtitle: string;
    footerText: string;
    footerAddress: string;
    footerPhone: string;
    footerPhoneAlt: string;
    footerEmail: string;
    footerWebsite: string;
    facebookUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    whatsappNumber: string;
    bannerImage: File | null;
    bannerImagePreview: string;
    bannerVideo: File | null;
    bannerVideoPreview: string;
    footerLogo: File | null;
    footerLogoPreview: string;
}

const initialState: BrandingFormData = {
    activeBannerType: 'none',
    heroTitle: '',
    heroSubtitle: '',
    footerText: '',
    footerAddress: '',
    footerPhone: '',
    footerPhoneAlt: '',
    footerEmail: '',
    footerWebsite: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    whatsappNumber: '',
    bannerImage: null,
    bannerImagePreview: '',
    bannerVideo: null,
    bannerVideoPreview: '',
    footerLogo: null,
    footerLogoPreview: '',
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#A43275] focus:ring-1 focus:ring-[#A43275]/20 transition placeholder-gray-400';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

/* ─── Upload Zone ─── */
const UploadZone: React.FC<{
    label: string;
    accept: string;
    icon: React.ReactNode;
    preview?: string;
    isVideo?: boolean;
    onFile: (f: File) => void;
    onClear: () => void;
}> = ({ label, accept, icon, preview, isVideo, onFile, onClear }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
    };

    return (
        <div className="space-y-2">
            <p className={labelCls}>{label}</p>
            {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {isVideo ? (
                        <video src={preview} className="w-full h-44 object-cover" controls muted />
                    ) : (
                        <img src={preview} alt={label} className="w-full h-44 object-cover" />
                    )}
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition"
                    >
                        <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/60 hover:bg-black/80 text-white px-2.5 py-1 rounded-md transition"
                    >
                        Replace
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center gap-2 h-44 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${dragOver
                        ? 'border-[#A43275] bg-[#fce6f4]/40'
                        : 'border-gray-200 bg-gray-50 hover:border-[#A43275] hover:bg-[#fce6f4]/20'
                        }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                        {icon}
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Click or drag to upload</p>
                        <p className="text-xs text-gray-400 mt-0.5">{isVideo ? 'MP4, WebM up to 100MB' : 'JPG, PNG, WebP up to 10MB'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#A43275] text-xs font-semibold">
                        <UploadCloud className="w-3.5 h-3.5" />
                        Browse file
                    </div>
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
        </div>
    );
};

/* ─── Section Card ─── */
const SectionCard: React.FC<{ icon: React.ReactNode; title: string; description: string; children: React.ReactNode }> = ({ icon, title, description, children }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="w-8 h-8 rounded-lg bg-[#fce6f4] flex items-center justify-center text-[#A43275] flex-shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

/* ─── Social Field ─── */
const SocialField: React.FC<{ icon: React.ReactNode; label: string; name: string; value: string; placeholder: string; onChange: (e: any) => void }> = ({ icon, label, name, value, placeholder, onChange }) => (
    <div>
        <label className={labelCls}>{label}</label>
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
            <input name={name} value={value} onChange={onChange} placeholder={placeholder} className={`${inputCls} pl-9`} />
        </div>
    </div>
);

/* ─── Banner Type Toggle ─── */
const BannerTypeToggle: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
    const options = [
        { v: 'none', icon: <EyeOff className="w-4 h-4" />, label: 'None' },
        { v: 'image', icon: <ImageIcon className="w-4 h-4" />, label: 'Image' },
        { v: 'video', icon: <Video className="w-4 h-4" />, label: 'Video' },
    ];
    return (
        <div className="flex gap-2">
            {options.map(o => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onChange(o.v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${value === o.v
                        ? 'bg-[#A43275] text-white border-[#A43275] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#A43275] hover:text-[#A43275]'
                        }`}
                >
                    {o.icon}
                    {o.label}
                </button>
            ))}
        </div>
    );
};

/* ─── Main Component ─── */
const CustomerPortalBranding: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [formData, setFormData] = useState<BrandingFormData>(initialState);
    const [isSaving, setIsSaving] = useState(false);
    const [promoGallery, setPromoGallery] = useState<PromoGalleryItem[]>([]);
    const [isPromoUploading, setIsPromoUploading] = useState<'image' | 'video' | null>(null);
    const [isPromoRefreshing, setIsPromoRefreshing] = useState(false);
    const [replacingPromoId, setReplacingPromoId] = useState<string | null>(null);
    const [pendingReplaceType, setPendingReplaceType] = useState<'image' | 'video' | null>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const videoUploadRef = useRef<HTMLInputElement>(null);
    const replaceUploadRef = useRef<HTMLInputElement>(null);

    const canEdit = useMemo(() => hasPermission(permissions, 'website-settings', 'edit'), [permissions]);
    const sortedPromoGallery = useMemo(() => [...promoGallery].sort((a, b) => a.order - b.order), [promoGallery]);
    const promoGalleryStats = useMemo(() => ({
        total: promoGallery.length,
        images: promoGallery.filter((item) => item.type === 'image').length,
        videos: promoGallery.filter((item) => item.type === 'video').length,
    }), [promoGallery]);

    const fetchBranding = async (showLoader = false) => {
        try {
            if (showLoader) setIsPromoRefreshing(true);
            const response = await axios.get(Constants.ADMIN_CUSTOMER_PORTAL_BRANDING_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = response.data?.data || {};
            setFormData(prev => ({
                ...prev,
                activeBannerType: data.activeBannerType || 'none',
                heroTitle: data.heroTitle || '',
                heroSubtitle: data.heroSubtitle || '',
                footerText: data.footerText || '',
                footerAddress: data.footerAddress || '',
                footerPhone: data.footerPhone || '',
                footerPhoneAlt: data.footerPhoneAlt || '',
                footerEmail: data.footerEmail || '',
                footerWebsite: data.footerWebsite || '',
                facebookUrl: data.facebookUrl || '',
                instagramUrl: data.instagramUrl || '',
                youtubeUrl: data.youtubeUrl || '',
                whatsappNumber: data.whatsappNumber || '',
                bannerImagePreview: data.bannerImage || '',
                bannerVideoPreview: data.bannerVideo || '',
                footerLogoPreview: data.footerLogo || '',
            }));
            setPromoGallery(Array.isArray(data.promoGallery) ? data.promoGallery : []);
        } catch (error) {
            toast.error('Failed to load customer portal branding');
        } finally {
            if (showLoader) setIsPromoRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) void fetchBranding();
    }, [token]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFile = (field: 'bannerImage' | 'bannerVideo' | 'footerLogo', previewField: 'bannerImagePreview' | 'bannerVideoPreview' | 'footerLogoPreview') => (file: File) => {
        setFormData(prev => ({ ...prev, [field]: file, [previewField]: URL.createObjectURL(file) }));
    };

    const clearFile = (field: 'bannerImage' | 'bannerVideo' | 'footerLogo', previewField: 'bannerImagePreview' | 'bannerVideoPreview' | 'footerLogoPreview') => () => {
        setFormData(prev => ({ ...prev, [field]: null, [previewField]: '' }));
    };

    const validatePromoMediaFile = (file: File, type: 'image' | 'video') => {
        const isExpectedType = type === 'video' ? file.type.startsWith('video/') : file.type.startsWith('image/');
        if (!isExpectedType) {
            toast.error(type === 'video' ? 'Please select a valid video file.' : 'Please select a valid image file.');
            return false;
        }

        const maxSizeMb = type === 'video' ? 50 : 10;
        if (file.size > maxSizeMb * 1024 * 1024) {
            toast.error(`${type === 'video' ? 'Video' : 'Image'} must be smaller than ${maxSizeMb}MB.`);
            return false;
        }

        return true;
    };

    const uploadPromoGalleryItem = async (file: File, type: 'image' | 'video') => {
        if (!validatePromoMediaFile(file, type)) return;
        try {
            setIsPromoUploading(type);
            const payload = new FormData();
            payload.append('promoMedia', file);
            payload.append('type', type);
            await axios.post(Constants.PORTAL_PROMO_GALLERY_URL, payload, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });
            await fetchBranding(true);
            toast.success('Promotional media uploaded successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to upload promotional media');
        } finally {
            setIsPromoUploading(null);
            if (imageUploadRef.current) imageUploadRef.current.value = '';
            if (videoUploadRef.current) videoUploadRef.current.value = '';
        }
    };

    const deletePromoGalleryItem = async (itemId: string) => {
        try {
            await axios.delete(`${Constants.PORTAL_PROMO_GALLERY_URL}/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchBranding(true);
            toast.success('Promotional media deleted successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to delete promotional media');
        }
    };

    const updatePromoGalleryCaption = async (itemId: string, caption: string) => {
        try {
            await axios.patch(`${Constants.PORTAL_PROMO_GALLERY_URL}/${itemId}`, { caption }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPromoGallery(prev => prev.map(item => item.id === itemId ? { ...item, caption } : item));
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update caption');
        }
    };

    const reorderPromoGallery = async (items: PromoGalleryItem[]) => {
        try {
            await axios.patch(Constants.PORTAL_PROMO_GALLERY_REORDER_URL, {
                items: items.map((item, index) => ({ id: item.id, order: index })),
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPromoGallery(items.map((item, index) => ({ ...item, order: index })));
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to reorder promotional media');
            await fetchBranding(true);
        }
    };

    const movePromoGalleryItem = async (itemId: string, direction: 'up' | 'down') => {
        const currentIndex = promoGallery.findIndex((item) => item.id === itemId);
        if (currentIndex === -1) return;
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= promoGallery.length) return;
        const next = [...promoGallery];
        const [moved] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, moved);
        setPromoGallery(next.map((item, index) => ({ ...item, order: index })));
        await reorderPromoGallery(next);
    };

    const triggerPromoReplace = (itemId: string, type: 'image' | 'video') => {
        setReplacingPromoId(itemId);
        setPendingReplaceType(type);
        replaceUploadRef.current?.click();
    };

    const handlePromoReplaceFile = async (file: File | null) => {
        if (!file || !replacingPromoId || !pendingReplaceType) return;
        if (!validatePromoMediaFile(file, pendingReplaceType)) return;
        try {
            const payload = new FormData();
            payload.append('promoMedia', file);
            payload.append('type', pendingReplaceType);
            await axios.patch(`${Constants.PORTAL_PROMO_GALLERY_URL}/${replacingPromoId}/media`, payload, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });
            await fetchBranding(true);
            toast.success('Promotional media replaced successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to replace promotional media');
        } finally {
            setReplacingPromoId(null);
            setPendingReplaceType(null);
            if (replaceUploadRef.current) replaceUploadRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const footerPhones = [formData.footerPhone, formData.footerPhoneAlt].filter(Boolean);
            const hasInvalidFooterPhone = footerPhones.some((phone) => phone.length !== 10);
            if (hasInvalidFooterPhone) {
                toast.error('Both footer phone numbers must be exactly 10 digits.');
                return;
            }

            setIsSaving(true);
            const payload = new FormData();
            payload.append('activeBannerType', formData.activeBannerType);
            payload.append('heroTitle', formData.heroTitle);
            payload.append('heroSubtitle', formData.heroSubtitle);
            payload.append('footerText', formData.footerText);
            payload.append('footerAddress', formData.footerAddress);
            payload.append('footerPhone', formData.footerPhone);
            payload.append('footerPhoneAlt', formData.footerPhoneAlt);
            payload.append('footerEmail', formData.footerEmail);
            payload.append('footerWebsite', formData.footerWebsite);
            payload.append('facebookUrl', formData.facebookUrl);
            payload.append('instagramUrl', formData.instagramUrl);
            payload.append('youtubeUrl', formData.youtubeUrl);
            payload.append('whatsappNumber', formData.whatsappNumber);
            if (formData.bannerImage) payload.append('bannerImage', formData.bannerImage);
            if (formData.bannerVideo) payload.append('bannerVideo', formData.bannerVideo);
            if (formData.footerLogo) payload.append('footerLogo', formData.footerLogo);

            const response = await axios.put(Constants.ADMIN_CUSTOMER_PORTAL_BRANDING_URL, payload, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });

            const data = response.data?.data || {};
            setFormData(prev => ({
                ...prev,
                bannerImage: null, bannerVideo: null, footerLogo: null,
                bannerImagePreview: data.bannerImage || prev.bannerImagePreview,
                bannerVideoPreview: data.bannerVideo || prev.bannerVideoPreview,
                footerLogoPreview: data.footerLogo || prev.footerLogoPreview,
            }));
            toast.success('Customer portal branding updated successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update branding');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">Customer Portal Branding</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Control the banner and footer displayed on your customer-facing portal.
                </p>
            </div>

            {/* ── Section 1: Banner ── */}
            <SectionCard
                icon={<Monitor className="w-4 h-4" />}
                title="Promotional Banner"
                description="Upload an image or video shown at the top of the customer dashboard"
            >
                <div className="space-y-5">
                    {/* Banner type toggle */}
                    <div>
                        <p className={labelCls}>Active Banner Type</p>
                        <BannerTypeToggle
                            value={formData.activeBannerType}
                            onChange={(v) => setFormData(prev => ({ ...prev, activeBannerType: v as any }))}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            Select which type of banner will be displayed. Upload both if needed, then choose which one is active.
                        </p>
                    </div>

                    {/* Upload zones */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className={formData.activeBannerType === 'image' ? 'ring-2 ring-[#A43275]/30 rounded-xl' : ''}>
                            <UploadZone
                                label={`Banner Image${formData.activeBannerType === 'image' ? ' — Active ✓' : ''}`}
                                accept="image/*"
                                icon={<ImageIcon className="w-5 h-5" />}
                                preview={formData.bannerImagePreview}
                                onFile={handleFile('bannerImage', 'bannerImagePreview')}
                                onClear={clearFile('bannerImage', 'bannerImagePreview')}
                            />
                        </div>
                        <div className={formData.activeBannerType === 'video' ? 'ring-2 ring-[#A43275]/30 rounded-xl' : ''}>
                            <UploadZone
                                label={`Banner Video${formData.activeBannerType === 'video' ? ' — Active ✓' : ''}`}
                                accept="video/*"
                                icon={<Video className="w-5 h-5" />}
                                preview={formData.bannerVideoPreview}
                                isVideo
                                onFile={handleFile('bannerVideo', 'bannerVideoPreview')}
                                onClear={clearFile('bannerVideo', 'bannerVideoPreview')}
                            />
                        </div>
                    </div>

                    {/* Hero text */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                        <div>
                            <label className={labelCls}>Hero Title</label>
                            <input name="heroTitle" value={formData.heroTitle} onChange={handleChange}
                                placeholder="e.g. Welcome to Naresh Sarees" className={inputCls} />
                            <p className="text-[11px] text-gray-400 mt-1">Displayed on banner overlay (optional)</p>
                        </div>
                        <div>
                            <label className={labelCls}>Hero Subtitle</label>
                            <input name="heroSubtitle" value={formData.heroSubtitle} onChange={handleChange}
                                placeholder="e.g. Explore our latest collection" className={inputCls} />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* ── Section 2: Footer ── */}
            <SectionCard
                icon={<Layout className="w-4 h-4" />}
                title="Portal Footer"
                description="Shown at the bottom of all customer portal pages"
            >
                <div className="space-y-5">
                    {/* Logo + text */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                        {/* Logo upload */}
                        <div>
                            <p className={labelCls}>Footer Logo</p>
                            {formData.footerLogoPreview ? (
                                <div className="relative inline-block">
                                    <img src={formData.footerLogoPreview} alt="Footer Logo"
                                        className="h-20 w-auto max-w-[180px] object-contain rounded-xl border border-gray-200 bg-gray-50 p-2" />
                                    <button type="button" onClick={clearFile('footerLogo', 'footerLogoPreview')}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                        <X className="w-3 h-3 text-white" />
                                    </button>
                                    <button type="button"
                                        onClick={() => document.getElementById('logoInput')?.click()}
                                        className="mt-2 block text-xs text-[#A43275] font-medium hover:underline">
                                        Change logo
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => document.getElementById('logoInput')?.click()}
                                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#A43275] hover:bg-[#fce6f4]/10 cursor-pointer transition-colors"
                                >
                                    <ImageIcon className="w-6 h-6 text-gray-300" />
                                    <p className="text-xs text-gray-500 font-medium">Upload logo</p>
                                </div>
                            )}
                            <input id="logoInput" type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile('footerLogo', 'footerLogoPreview')(f); }} />
                        </div>

                        <div>
                            <label className={labelCls}>Footer Tagline</label>
                            <input name="footerText" value={formData.footerText} onChange={handleChange}
                                placeholder="e.g. Quality you can trust since 1995" className={inputCls} />
                            <label className={`${labelCls} mt-4`}>Shop Address</label>
                            <textarea name="footerAddress" value={formData.footerAddress} onChange={handleChange}
                                placeholder="123 Main Street, City, State — 000000"
                                className={`${inputCls} min-h-[70px] resize-none`} />
                        </div>
                    </div>

                    {/* Contact fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                        <div>
                            <label className={labelCls}>Phone 1</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input name="footerPhone" value={formData.footerPhone} onChange={handleChange}
                                    placeholder="Enter 10 digit phone" maxLength={10} inputMode="numeric" className={`${inputCls} pl-8`} />
                            </div>
                            <p className="mt-1 text-[11px] text-gray-400">Exactly 10 digits</p>
                        </div>
                        <div>
                            <label className={labelCls}>Phone 2</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input name="footerPhoneAlt" value={formData.footerPhoneAlt} onChange={handleChange}
                                    placeholder="Enter 10 digit phone" maxLength={10} inputMode="numeric" className={`${inputCls} pl-8`} />
                            </div>
                            <p className="mt-1 text-[11px] text-gray-400">Exactly 10 digits</p>
                        </div>
                        <div>
                            <label className={labelCls}>Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input name="footerEmail" value={formData.footerEmail} onChange={handleChange}
                                    placeholder="hello@yourshop.com" className={`${inputCls} pl-8`} />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Website</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input name="footerWebsite" value={formData.footerWebsite} onChange={handleChange}
                                    placeholder="https://yourshop.com" className={`${inputCls} pl-8`} />
                            </div>
                        </div>
                    </div>

                    {/* Social media */}
                    <div className="border-t border-gray-100 pt-4">
                        <p className={labelCls}>Social Media Handles</p>
                        <p className="text-xs text-gray-400 mb-3">Only fill handles you want shown. Empty fields will be hidden.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SocialField icon={<Instagram className="w-3.5 h-3.5" />} label="Instagram"
                                name="instagramUrl" value={formData.instagramUrl} onChange={handleChange}
                                placeholder="https://instagram.com/yourshop" />
                            <SocialField icon={<Facebook className="w-3.5 h-3.5" />} label="Facebook"
                                name="facebookUrl" value={formData.facebookUrl} onChange={handleChange}
                                placeholder="https://facebook.com/yourshop" />
                            <SocialField icon={<MessageCircle className="w-3.5 h-3.5" />} label="WhatsApp"
                                name="whatsappNumber" value={formData.whatsappNumber} onChange={handleChange}
                                placeholder="+91 99999 99999" />
                            <SocialField icon={<Youtube className="w-3.5 h-3.5" />} label="YouTube"
                                name="youtubeUrl" value={formData.youtubeUrl} onChange={handleChange}
                                placeholder="https://youtube.com/@yourshop" />
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                icon={<Video className="w-4 h-4" />}
                title="Promotional Media Gallery"
                description="Upload separate promotional reels and images for the customer dashboard"
            >
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Gallery Items</p>
                            <p className="text-xs text-gray-400 mt-0.5">Upload multiple promotional images and videos. Banner image and banner video stay completely separate.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => imageUploadRef.current?.click()}
                                disabled={!canEdit || isPromoUploading !== null}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-[#A43275] hover:text-[#A43275] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPromoUploading === 'image' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add Image
                            </button>
                            <button
                                type="button"
                                onClick={() => videoUploadRef.current?.click()}
                                disabled={!canEdit || isPromoUploading !== null}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-[#A43275] hover:text-[#A43275] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPromoUploading === 'video' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add Video
                            </button>
                            <button
                                type="button"
                                onClick={() => fetchBranding(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-[#A43275] hover:text-[#A43275]"
                            >
                                <RefreshCw className={`w-4 h-4 ${isPromoRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    <input
                        ref={imageUploadRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPromoGalleryItem(file, 'image');
                        }}
                    />
                    <input
                        ref={videoUploadRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPromoGalleryItem(file, 'video');
                        }}
                    />
                    <input
                        ref={replaceUploadRef}
                        type="file"
                        accept={pendingReplaceType === 'video' ? 'video/*' : 'image/*'}
                        className="hidden"
                        onChange={(e) => void handlePromoReplaceFile(e.target.files?.[0] || null)}
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="rounded-xl border border-[#A43275]/15 bg-[#fcf3f8] px-4 py-3">
                            <div className="flex items-center gap-2 text-[#A43275]"><Sparkles className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Total</span></div>
                            <p className="mt-2 text-2xl font-bold text-gray-900">{promoGalleryStats.total}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-600"><Images className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Images</span></div>
                            <p className="mt-2 text-2xl font-bold text-gray-900">{promoGalleryStats.images}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-600"><PlayCircle className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Videos</span></div>
                            <p className="mt-2 text-2xl font-bold text-gray-900">{promoGalleryStats.videos}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gradient-to-r from-[#fcf4f9] via-white to-[#fff7fb] px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Customer Portal Preview Notes</p>
                                <p className="mt-1 text-xs text-gray-500">The first reordered item becomes the spotlight media on the customer dashboard. Videos and images both appear in the same polished promo section.</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#A43275] ring-1 ring-[#A43275]/15">
                                <Sparkles className="w-4 h-4" />
                                Dashboard spotlight follows gallery order
                            </div>
                        </div>
                    </div>

                    {sortedPromoGallery.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-12 text-center">
                            <p className="text-sm font-medium text-gray-600">No promotional media uploaded yet</p>
                            <p className="text-xs text-gray-400 mt-1">Add image or video items to show them below the customer portal banner.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {sortedPromoGallery.map((item, index) => (
                                <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <div className="relative bg-gray-100">
                                        {item.type === 'video' ? (
                                            <video src={item.url} className="h-64 w-full object-cover" muted playsInline controls />
                                        ) : (
                                            <img src={item.url} alt={item.caption || 'Promotional media'} className="h-64 w-full object-cover" />
                                        )}
                                        <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                            {item.type}
                                        </span>
                                    </div>
                                    <div className="space-y-3 p-4">
                                        <textarea
                                            defaultValue={item.caption}
                                            rows={3}
                                            placeholder="Add caption"
                                            className={`${inputCls} min-h-[84px] resize-none`}
                                            onBlur={(e) => {
                                                const nextCaption = e.target.value.trim();
                                                if (nextCaption !== item.caption) {
                                                    void updatePromoGalleryCaption(item.id, nextCaption);
                                                }
                                            }}
                                        />
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-2 text-gray-600 hover:border-[#A43275] hover:text-[#A43275] disabled:opacity-40" disabled={index === 0} onClick={() => void movePromoGalleryItem(item.id, 'up')}><ArrowUp className="w-4 h-4" /></button>
                                                <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-2 text-gray-600 hover:border-[#A43275] hover:text-[#A43275] disabled:opacity-40" disabled={index === promoGallery.length - 1} onClick={() => void movePromoGalleryItem(item.id, 'down')}><ArrowDown className="w-4 h-4" /></button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-[#A43275] hover:text-[#A43275]" onClick={() => triggerPromoReplace(item.id, item.type)}>Replace</button>
                                                <button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => void deletePromoGalleryItem(item.id)}><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Save */}
            <div className="flex justify-end pb-2">
                {canEdit && <SubmitButton isDisabled={isSaving} isLoading={isSaving} mode="edit" />}
            </div>
        </form>
    );
};

export default CustomerPortalBranding;
