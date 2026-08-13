import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import { useNavigate } from "react-router-dom";
import {
    FileText, IndianRupee, CheckCircle2, Clock, XCircle,
    ChevronRight, ReceiptText, ArrowRight, PlayCircle,
    TrendingUp, AlertCircle, Image as ImageIcon, Sparkles,
    Volume2, VolumeX, ChevronLeft, X
} from "lucide-react";

/* ─── Types ─── */
interface DashboardSummary {
    totalInvoices: number;
    paidInvoices: number;
    partialInvoices: number;
    openInvoices: number;
    totalAmount: number;
    totalPaid: number;
    totalDue: number;
}
interface RecentInvoice {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: string;
    totalAmount: number;
    totalPaid: number;
    balanceAmount: number;
}
interface PromoGalleryItem {
    id: string;
    type: "image" | "video";
    url: string;
    caption: string;
    order: number;
}

/* ─── Status helpers ─── */
const statusConfig = (status: string) => {
    switch (status?.toUpperCase()) {
        case "PAID":
            return { label: "Paid", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
        case "PARTIAL":
        case "PARTIALLY PAID":
            return { label: "Partial", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", icon: <Clock className="w-3.5 h-3.5" /> };
        default:
            return { label: "Unpaid", chip: "bg-red-100 text-red-700", dot: "bg-red-400", icon: <XCircle className="w-3.5 h-3.5" /> };
    }
};

/* ═══════════════════════════════════════
   PromoBanner  (unchanged logic)
═══════════════════════════════════════ */
const PromoBanner: React.FC<{ branding: any; firstName: string }> = ({ branding, firstName }) => {
    const hasMedia = branding?.activeBannerType === "image" || branding?.activeBannerType === "video";
    const hasTitle = branding?.heroTitle || branding?.heroSubtitle;
    if (!hasMedia && !hasTitle) return null;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 shadow-sm group" style={{ aspectRatio: hasMedia ? undefined : undefined }}>
            <div className="absolute inset-0 bg-gray-950" />
            {branding?.activeBannerType === "image" && branding?.bannerImage && (
                <img src={branding.bannerImage} alt="Promotional banner"
                    className="absolute inset-0 h-full w-full object-cover opacity-85 transition-transform duration-1000 ease-out group-hover:scale-105" />
            )}
            {branding?.activeBannerType === "video" && branding?.bannerVideo && (
                <video src={branding.bannerVideo} className="absolute inset-0 h-full w-full object-cover opacity-85"
                    autoPlay muted loop playsInline />
            )}
            <div className="absolute inset-0" style={{
                background: hasMedia
                    ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.80) 100%)"
                    : "linear-gradient(135deg, #A43275 0%, #c0428e 100%)"
            }} />
            <div className={`relative z-10 flex flex-col justify-end ${hasMedia ? "min-h-[200px] lg:min-h-[280px]" : "min-h-[130px]"} px-6 py-5 lg:px-8 lg:py-8`}>
                <div className="max-w-3xl">
                    {!hasMedia && (
                        <span className="mb-2 inline-block rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
                            Customer Portal
                        </span>
                    )}
                    {(branding?.heroSubtitle || !hasMedia) && (
                        <p className="text-sm font-medium leading-relaxed text-white/90 drop-shadow-md lg:text-base">
                            {branding?.heroSubtitle || `Welcome back, ${firstName}`}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════
   Reel Card — vertical 9:16 video card
═══════════════════════════════════════ */
const ReelCard: React.FC<{ item: PromoGalleryItem; onOpen: (item: PromoGalleryItem) => void }> = ({ item, onOpen }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [muted, setMuted] = useState(true);
    const [playing, setPlaying] = useState(true);

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !muted;
            setMuted(!muted);
        }
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        if (playing) {
            videoRef.current.pause();
        } else {
            void videoRef.current.play();
        }
        setPlaying(!playing);
    };

    return (
        <div
            className="relative flex-shrink-0 overflow-hidden rounded-2xl bg-gray-950 shadow-md cursor-pointer group/reel"
            style={{ width: "clamp(140px, 22vw, 200px)", aspectRatio: "9/16" }}
            onDoubleClick={() => onOpen(item)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(item);
                }
            }}
            tabIndex={0}
            role="button"
            aria-label={item.caption || 'Open promotional reel preview'}
        >
            <video
                ref={videoRef}
                src={item.url}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay muted loop playsInline
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

            {!playing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <PlayCircle className="w-7 h-7 text-white" />
                    </div>
                </div>
            )}

            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-white opacity-0 transition-opacity group-hover/reel:opacity-100 z-10">
                <button
                    onClick={toggleMute}
                    className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
                >
                    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                    onClick={togglePlay}
                    className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
                >
                    <PlayCircle className="w-3.5 h-3.5" />
                </button>
            </div>

            {item.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 drop-shadow">{item.caption}</p>
                </div>
            )}

            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
                <PlayCircle className="w-3 h-3 text-white" />
                <span className="text-[9px] font-bold text-white uppercase tracking-wide">Reel</span>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════
   Image Promo Card — landscape
═══════════════════════════════════════ */
const ImagePromoCard: React.FC<{ item: PromoGalleryItem; onOpen: (item: PromoGalleryItem) => void }> = ({ item, onOpen }) => (
    <div
        className="relative flex-shrink-0 overflow-hidden rounded-2xl bg-gray-100 shadow-sm group/img cursor-pointer"
        style={{ width: "clamp(200px, 30vw, 280px)", aspectRatio: "4/3" }}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(item);
            }
        }}
        tabIndex={0}
        role="button"
        aria-label={item.caption || 'Open promotional image preview'}
    >
        <img src={item.url} alt={item.caption || "Promotion"}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        {item.caption && (
            <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 drop-shadow">{item.caption}</p>
            </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <ImageIcon className="w-3 h-3 text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wide">Photo</span>
        </div>
    </div>
);

const PromoMediaPreviewModal: React.FC<{
    item: PromoGalleryItem | null;
    canGoPrev: boolean;
    canGoNext: boolean;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}> = ({ item, canGoPrev, canGoNext, onClose, onPrev, onNext }) => {
    useEffect(() => {
        if (!item) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft' && canGoPrev) onPrev();
            if (event.key === 'ArrowRight' && canGoNext) onNext();
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [item, canGoPrev, canGoNext, onClose, onPrev, onNext]);

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-gray-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="relative flex min-h-[320px] items-center justify-center bg-black sm:min-h-[420px]">
                    {canGoPrev && (
                        <button
                            type="button"
                            onClick={onPrev}
                            className="absolute left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}

                    {item.type === 'video' ? (
                        <video src={item.url} className="max-h-[75vh] w-full object-contain" controls autoPlay playsInline />
                    ) : (
                        <img src={item.url} alt={item.caption || 'Promotion preview'} className="max-h-[75vh] w-full object-contain" />
                    )}

                    {canGoNext && (
                        <button
                            type="button"
                            onClick={onNext}
                            className="absolute right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <div className="border-t border-white/10 bg-gray-950/95 px-5 py-4 text-white">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                        {item.type === 'video' ? <PlayCircle className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        {item.type}
                    </div>
                    <p className="mt-2 text-base font-semibold text-white sm:text-lg">
                        {item.caption || 'Promotional media preview'}
                    </p>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════
   Promotions Section — Reels + Images
═══════════════════════════════════════ */
const PromotionsSection: React.FC<{ branding: any }> = ({ branding }) => {
    const reelsRef = useRef<HTMLDivElement>(null);
    const imagesRef = useRef<HTMLDivElement>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const allItems = useMemo<PromoGalleryItem[]>(() => {
        return Array.isArray(branding?.promoGallery)
            ? [...branding.promoGallery].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
            : [];
    }, [branding]);

    const videos = allItems.filter(i => i.type === "video");
    const images = allItems.filter(i => i.type === "image");
    const previewItem = previewIndex !== null ? allItems[previewIndex] ?? null : null;

    if (!allItems.length) return null;

    const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") => {
        if (!ref.current) return;
        ref.current.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
    };

    const openPreview = (item: PromoGalleryItem) => {
        const index = allItems.findIndex((galleryItem) => galleryItem.id === item.id);
        if (index !== -1) setPreviewIndex(index);
    };

    const closePreview = () => setPreviewIndex(null);
    const showPrevious = () => setPreviewIndex((current) => current === null ? current : Math.max(current - 1, 0));
    const showNext = () => setPreviewIndex((current) => current === null ? current : Math.min(current + 1, allItems.length - 1));

    return (
        <>
            <section className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A43275] to-[#c0428e] flex items-center justify-center shadow-sm shadow-[#A43275]/30">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Promotions & Reels</h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">Latest offers, videos & store highlights</p>
                        </div>
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fce6f4] text-[#A43275] text-[11px] font-bold">
                        {allItems.length} items
                    </span>
                </div>

                {videos.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <PlayCircle className="w-3.5 h-3.5 text-[#A43275]" /> Reels
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => scroll(reelsRef, "left")}
                                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                                <button onClick={() => scroll(reelsRef, "right")}
                                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                            </div>
                        </div>
                        <div
                            ref={reelsRef}
                            className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
                            style={{ scrollSnapType: "x mandatory" }}
                        >
                            {videos.map(item => (
                                <div key={item.id} style={{ scrollSnapAlign: "start" }}>
                                    <ReelCard item={item} onOpen={openPreview} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {images.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-[#A43275]" /> Featured Images
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => scroll(imagesRef, "left")}
                                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                                <button onClick={() => scroll(imagesRef, "right")}
                                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                            </div>
                        </div>
                        <div
                            ref={imagesRef}
                            className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
                            style={{ scrollSnapType: "x mandatory" }}
                        >
                            {images.map(item => (
                                <div key={item.id} style={{ scrollSnapAlign: "start" }}>
                                    <ImagePromoCard item={item} onOpen={openPreview} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <PromoMediaPreviewModal
                item={previewItem}
                canGoPrev={previewIndex !== null && previewIndex > 0}
                canGoNext={previewIndex !== null && previewIndex < allItems.length - 1}
                onClose={closePreview}
                onPrev={showPrevious}
                onNext={showNext}
            />
        </>
    );
};
/* ═══════════════════════════════════════
   Main Dashboard
═══════════════════════════════════════ */
const CustomerDashboard: React.FC = () => {
    const { token, customer } = useSelector((state: RootState) => state.customerAuth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);

    const displayName = (customer as any)?.name || (customer as any)?.phone || "Customer";
    const firstName = displayName.split(" ")[0];
    const branding = (systemSettings as any)?.company?.customerPortalBranding;

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const response = await axios.get(Constants.CUSTOMER_PORTAL_DASHBOARD_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSummary(response.data.data.summary || null);
                setRecentInvoices(response.data.data.recentInvoices || []);
            } catch (error) {
                console.error("Error fetching customer dashboard:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchDashboard();
    }, [token]);

    if (loading) {
        return <div className="flex min-h-[300px] items-center justify-center"><LoaderSpinner /></div>;
    }

    const statCards = [
        { label: "Total Invoices", value: summary?.totalInvoices ?? 0, icon: <FileText className="w-5 h-5" />, gradient: "from-[#A43275] to-[#c0428e]", textColor: "text-[#A43275]", bgLight: "bg-[#fce6f4]" },
        { label: "Total Amount", value: format(summary?.totalAmount ?? 0), icon: <IndianRupee className="w-5 h-5" />, gradient: "from-violet-500 to-purple-600", textColor: "text-violet-600", bgLight: "bg-violet-50" },
        { label: "Paid Amount", value: format(summary?.totalPaid ?? 0), icon: <TrendingUp className="w-5 h-5" />, gradient: "from-emerald-500 to-teal-600", textColor: "text-emerald-600", bgLight: "bg-emerald-50" },
        { label: "Due Amount", value: format(summary?.totalDue ?? 0), icon: <AlertCircle className="w-5 h-5" />, gradient: "from-rose-500 to-red-600", textColor: "text-rose-600", bgLight: "bg-rose-50" },
    ];

    const statusBreakdown = [
        { label: "Paid", count: summary?.paidInvoices ?? 0, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, barColor: "bg-emerald-400", chip: "bg-emerald-100 text-emerald-700", lightBg: "bg-emerald-50" },
        { label: "Partial", count: summary?.partialInvoices ?? 0, icon: <Clock className="w-5 h-5 text-amber-500" />, barColor: "bg-amber-400", chip: "bg-amber-100 text-amber-700", lightBg: "bg-amber-50" },
        { label: "Unpaid", count: summary?.openInvoices ?? 0, icon: <XCircle className="w-5 h-5 text-rose-500" />, barColor: "bg-rose-400", chip: "bg-rose-100 text-rose-700", lightBg: "bg-rose-50" },
    ];

    const total = (summary?.totalInvoices ?? 0) || 1;

    return (
        <div className="space-y-5 lg:space-y-6">

            {/* ── 1. Hero Banner ── */}
            <PromoBanner branding={branding} firstName={firstName} />

            {/* ── 1b. Mobile greeting fallback ── */}
            {!branding?.heroTitle && branding?.activeBannerType === "none" && (
                <div className="rounded-2xl px-5 py-4 text-white lg:hidden"
                    style={{ background: "linear-gradient(135deg, #A43275 0%, #c0428e 100%)" }}>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">Welcome back</p>
                    <h2 className="mt-0.5 text-xl font-bold">{firstName} 👋</h2>
                    <p className="mt-1 text-xs text-white/70">Here's your billing overview</p>
                </div>
            )}

            {/* ── 2. Promotions & Reels — only if data exists ── */}
            <PromotionsSection branding={branding} />

            {/* ── 3. Divider + Billing Section heading ── */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#A43275] to-[#c0428e]" />
                    <h2 className="text-base font-bold text-gray-900">Billing Overview</h2>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="hidden lg:block text-xs text-gray-400">Your invoices & balances</span>
            </div>

            {/* ── 4. Stat Cards ── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
                {statCards.map((card) => (
                    <div key={card.label} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:p-5">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500 lg:text-xs">{card.label}</p>
                                <p className={`mt-1.5 truncate text-lg font-bold lg:text-2xl ${card.textColor}`}>{card.value}</p>
                            </div>
                            <div className={`ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl lg:h-10 lg:w-10 ${card.bgLight} ${card.textColor}`}>
                                {card.icon}
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient}`} />
                    </div>
                ))}
            </div>

            {/* ── 5. Status Breakdown ── */}
            <div className="grid grid-cols-3 gap-3 lg:gap-4">
                {statusBreakdown.map((item) => {
                    const pct = Math.round((item.count / total) * 100);
                    return (
                        <div key={item.label} className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm lg:space-y-4 lg:p-5">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-2.5">
                                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${item.lightBg}`}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium text-gray-500 lg:text-xs">{item.label}</p>
                                        <p className="text-lg font-bold text-gray-900 lg:text-xl">{item.count}</p>
                                    </div>
                                </div>
                                <span className={`hidden rounded-full px-2 py-1 text-xs font-semibold lg:inline ${item.chip}`}>{pct}%</span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 lg:h-1.5">
                                <div className={`h-full rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── 6. Recent Invoices ── */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-4 lg:px-6"
                    style={{ background: "linear-gradient(to right, #A43275, #c0428e)" }}>
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                            <ReceiptText className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Recent Invoices</h3>
                            <p className="text-[10px] text-white/70">Latest invoices linked to your account</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/customer/invoices")}
                        className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/30"
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </button>
                </div>

                {recentInvoices.length > 0 ? (
                    <>
                        {/* Mobile list */}
                        <div className="divide-y divide-gray-50 lg:hidden">
                            {recentInvoices.map((invoice) => {
                                const cfg = statusConfig(invoice.status);
                                return (
                                    <div key={invoice.id}
                                        onClick={() => navigate(`/customer/invoices/${invoice.id}`)}
                                        className="flex cursor-pointer items-center gap-3 px-4 py-3.5 active:bg-[#fce6f4]/30">
                                        <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-bold text-[#A43275]">{invoice.invoiceNumber}</span>
                                                <span className="flex-shrink-0 text-sm font-bold text-gray-800">{format(invoice.totalAmount)}</span>
                                            </div>
                                            <div className="mt-0.5 flex items-center justify-between gap-2">
                                                <span className="text-[11px] text-gray-400">
                                                    {formatDate(invoice.invoiceDate, (systemSettings as any)?.dateFormat?.format || "d-m-Y")}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.chip}`}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                            </div>
                                            {invoice.balanceAmount > 0 && (
                                                <p className="mt-0.5 text-[10px] font-medium text-rose-500">Balance: {format(invoice.balanceAmount)}</p>
                                            )}
                                        </div>
                                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/60">
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Paid</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Balance</th>
                                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentInvoices.map((invoice) => {
                                        const cfg = statusConfig(invoice.status);
                                        return (
                                            <tr key={invoice.id}
                                                onClick={() => navigate(`/customer/invoices/${invoice.id}`)}
                                                className="group cursor-pointer transition-colors duration-150 hover:bg-[#fce6f4]/30">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
                                                        <span className="font-semibold text-[#A43275] group-hover:underline">{invoice.invoiceNumber}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-500">
                                                    {formatDate(invoice.invoiceDate, (systemSettings as any)?.dateFormat?.format || "d-m-Y")}
                                                </td>
                                                <td className="px-5 py-4 text-right font-semibold text-gray-800">{format(invoice.totalAmount)}</td>
                                                <td className="px-5 py-4 text-right font-medium text-emerald-600">{format(invoice.totalPaid)}</td>
                                                <td className="px-5 py-4 text-right font-medium text-rose-600">{format(invoice.balanceAmount)}</td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.chip}`}>
                                                            {cfg.icon}{cfg.label}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3 lg:px-5">
                            <p className="text-[11px] text-gray-400">Showing last {recentInvoices.length} invoices</p>
                            <button onClick={() => navigate("/customer/invoices")}
                                className="flex items-center gap-1 text-xs font-semibold text-[#A43275] hover:underline">
                                View all <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fce6f4]">
                            <ReceiptText className="h-7 w-7 text-[#A43275]" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700">No invoices yet</p>
                        <p className="mt-1 text-xs text-gray-400">Your recent invoices will appear here</p>
                    </div>
                )}
            </div>

        </div>
    );
};

export default CustomerDashboard;
