import { useEffect, useMemo, useState, type CSSProperties, type UIEvent } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  Facebook,
  Globe2,
  History,
  Instagram,
  LoaderCircle,
  LogIn,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShoppingBag,
  Youtube,
} from "lucide-react";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import { logoutCustomer } from "@store/customerAuthSlice";
import { isTokenExpired } from "@utils/auth";
import {
  getCustomerInitials,
  getFooterAddressLines,
  getSafeHttpUrl,
  getUniquePhoneNumbers,
  getValidEmail,
  getWhatsAppNumber,
} from "./publicInvoicePortalUtils";

export interface PublicAddress {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface PublicInvoiceItem {
  id?: string;
  name: string;
  variantName?: string;
  designNumber?: string;
  color?: string;
  size?: string;
  unit?: string;
  quantity: number;
  rate: number;
  amount: number;
  discount: number;
  taxAmount: number;
  taxGroupId?: string;
  discountType?: string;
  discountValue?: number | null;
  hsnCode: string;
}

interface PromotionalMedia {
  id: string;
  type: "image" | "video";
  url: string;
  caption: string;
  order: number;
}

interface CustomerHistoryInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  TotalAmount: number;
}

type HistoryLoadStatus = "idle" | "loading" | "success" | "error";

export interface PublicPortalBranding {
  activeBannerType: "none" | "image" | "video";
  bannerImage: string;
  bannerVideo: string;
  footerLogo: string;
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
  shopOnlineUrl: string;
  portalAccentColor: string;
  showPromotionalBanner: boolean;
  showPromotionalGallery: boolean;
  showShopOnline: boolean;
  showSocialLinks: boolean;
  enableCustomerHistory: boolean;
  promoGallery: PromotionalMedia[];
}

export interface PublicInvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  paymentMethod?: string;
  taxType?: string;
  gstType?: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  roundOff?: boolean;
  roundOffAmount?: number;
  customerGstin?: string;
  ewayBillNumber?: string;
  shippingAddress?: PublicAddress | null;
  termsAndCondition?: string;
  notes?: string;
  exchangeOldTotal?: number | null;
  exchangeNewTotal?: number | null;
  customer: {
    name: string;
    phone: string;
    address: string;
    state: string;
    gstNumber: string;
    billingAddress?: PublicAddress | null;
  };
  items: PublicInvoiceItem[];
  exchangeOriginalItems?: PublicInvoiceItem[];
  business: {
    name: string;
    logo?: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    gstNumber: string;
  };
  payment: {
    method: string;
    totalPaid: number;
    balanceAmount: number;
  };
  portalBranding: PublicPortalBranding;
  history: {
    requested: boolean;
    enabled: boolean;
    code: string;
    message: string;
  };
}

interface PublicInvoicePortalProps {
  invoice: PublicInvoiceData;
  onDownload: () => void;
}

const formatMoney = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatPaymentMethod = (value?: string) => (
  String(value || "Not recorded").replaceAll("_", " ").toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const getAccentTextColor = (hex: string) => {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "A43275";
  const red = Number.parseInt(color.slice(0, 2), 16) / 255;
  const green = Number.parseInt(color.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(color.slice(4, 6), 16) / 255;
  const linearize = (channel: number) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  return luminance > 0.45 ? "#111827" : "#FFFFFF";
};

const getStatusPresentation = (status: string) => {
  const normalized = String(status || "PENDING").toUpperCase();
  if (["PAID", "EXCHANGE"].includes(normalized)) {
    return { label: normalized === "EXCHANGE" ? "Exchange" : "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" };
  }
  if (normalized === "PARTIALLY_PAID") {
    return { label: "Partially paid", className: "bg-amber-50 text-amber-800 ring-amber-600/20" };
  }
  if (["OVERDUE", "CANCELLED"].includes(normalized)) {
    return { label: normalized === "OVERDUE" ? "Overdue" : "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-600/15" };
  }
  return { label: normalized.charAt(0) + normalized.slice(1).toLowerCase(), className: "bg-slate-100 text-slate-700 ring-slate-500/15" };
};

const DetailChip = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] leading-none text-stone-600">
      <span className="font-semibold text-stone-500">{label}</span>
      {value}
    </span>
  );
};

const PublicInvoicePortal = ({ invoice, onDownload }: PublicInvoicePortalProps) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isAuthenticated, token, customer } = useSelector(
    (state: RootState) => state.customerAuth,
  );
  const [activeView, setActiveView] = useState<"invoice" | "history">("invoice");
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [historyInvoices, setHistoryInvoices] = useState<CustomerHistoryInvoice[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryLoadStatus>("idle");
  const [historyRequestKey, setHistoryRequestKey] = useState(0);
  const branding = invoice.portalBranding;
  const accentColor = branding.portalAccentColor || "#A43275";
  const accentTextColor = getAccentTextColor(accentColor);
  const status = getStatusPresentation(invoice.status);
  const shopUrl = branding.showShopOnline ? getSafeHttpUrl(branding.shopOnlineUrl) : "";
  const footerLogo = branding.footerLogo.trim();
  const footerText = branding.footerText.trim();
  const footerAddressLines = getFooterAddressLines(branding.footerAddress);
  const footerPhoneNumbers = getUniquePhoneNumbers([
    branding.footerPhone,
    branding.footerPhoneAlt,
  ]);
  const footerEmail = getValidEmail(branding.footerEmail);
  const footerWebsite = getSafeHttpUrl(branding.footerWebsite);
  const facebookUrl = getSafeHttpUrl(branding.facebookUrl);
  const instagramUrl = getSafeHttpUrl(branding.instagramUrl);
  const youtubeUrl = getSafeHttpUrl(branding.youtubeUrl);
  const whatsappNumber = getWhatsAppNumber(branding.whatsappNumber);
  const hasCustomerSession = Boolean(
    isAuthenticated
    && token
    && !isTokenExpired(token),
  );
  const customerInitials = getCustomerInitials(customer?.name);
  const hasHero = Boolean(branding.heroTitle || branding.heroSubtitle);
  const hasActiveBanner = Boolean(
    (branding.activeBannerType === "image" && branding.bannerImage)
    || (branding.activeBannerType === "video" && branding.bannerVideo),
  );
  const gallery = useMemo(
    () => [...(branding.promoGallery || [])].sort((a, b) => a.order - b.order),
    [branding.promoGallery],
  );
  const hasConfiguredSocialLink = branding.showSocialLinks && Boolean(
    facebookUrl
    || instagramUrl
    || youtubeUrl
    || whatsappNumber,
  );
  const hasContactLink = Boolean(
    footerPhoneNumbers.length
    || footerEmail
    || footerWebsite,
  );
  const hasFooter = Boolean(
    footerLogo
    || footerText
    || footerAddressLines.length
    || hasContactLink
    || hasConfiguredSocialLink,
  );
  const style = {
    "--portal-accent": accentColor,
    "--portal-accent-text": accentTextColor,
  } as CSSProperties;

  useEffect(() => {
    if (isAuthenticated && isTokenExpired(token)) {
      dispatch(logoutCustomer());
    }
  }, [dispatch, isAuthenticated, token]);

  useEffect(() => {
    if (activeView !== "history" || !hasCustomerSession || !token) return undefined;

    const requestController = new AbortController();
    setHistoryStatus("loading");

    axios.get(Constants.CUSTOMER_PORTAL_INVOICES_URL, {
      params: { limit: 100 },
      headers: { Authorization: `Bearer ${token}` },
      signal: requestController.signal,
    }).then((response) => {
      const invoices = Array.isArray(response.data?.data?.invoices)
        ? response.data.data.invoices
        : [];
      setHistoryInvoices(
        invoices.filter((historyInvoice: CustomerHistoryInvoice) => (
          historyInvoice.invoiceNumber !== invoice.invoiceNumber
        )),
      );
      setHistoryStatus("success");
    }).catch((error) => {
      if (axios.isCancel(error)) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        dispatch(logoutCustomer());
      }
      setHistoryStatus("error");
    });

    return () => requestController.abort();
  }, [
    activeView,
    dispatch,
    hasCustomerSession,
    historyRequestKey,
    invoice.invoiceNumber,
    token,
  ]);

  const handleGalleryScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (!element.clientWidth) return;
    setActiveMediaIndex(Math.round(element.scrollLeft / element.clientWidth));
  };

  const showInvoice = () => {
    setActiveView("invoice");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      style={style}
      className="mx-auto min-h-[100dvh] w-full max-w-[520px] overflow-x-hidden border-x border-stone-200 bg-[#f8f6f3] pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-stone-900 shadow-[0_0_50px_rgba(28,25,23,0.08)]"
    >
      <style>{`
        .portal-gallery { scrollbar-width: none; scroll-snap-type: x mandatory; }
        .portal-gallery::-webkit-scrollbar { display: none; }
        .portal-gallery-slide { scroll-snap-align: center; }
      `}</style>

      <header className="flex min-h-16 items-center gap-3 border-b border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur">
        {invoice.business.logo ? (
          <img
            src={invoice.business.logo}
            alt={`${invoice.business.name} logo`}
            className="h-10 w-10 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: accentColor, color: accentTextColor }}
          >
            {invoice.business.name.trim().charAt(0) || "N"}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-bold leading-tight text-stone-950">
            {invoice.business.name}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Customer invoice
          </p>
        </div>
      </header>

      {activeView === "invoice" ? (
        <>
          {hasHero && (
            <section className="border-b border-stone-200 bg-white px-4 py-4" aria-labelledby="portal-hero-title">
              {branding.heroTitle && (
                <h1 id="portal-hero-title" className="font-serif text-xl font-bold leading-tight text-stone-950">
                  {branding.heroTitle}
                </h1>
              )}
              {branding.heroSubtitle && (
                <p className="mt-1 text-sm leading-5 text-stone-600">{branding.heroSubtitle}</p>
              )}
            </section>
          )}

          <main id="current-invoice" className="space-y-3 p-3 sm:p-4">
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="invoice-heading">
              <div className="border-b border-stone-100 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Tax invoice</p>
                    <h1 id="invoice-heading" className="mt-1 break-words font-serif text-xl font-bold text-stone-950">
                      {invoice.invoiceNumber}
                    </h1>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-stone-500">Invoice date</p>
                    <p className="mt-0.5 font-semibold text-stone-800">{formatDate(invoice.date)}</p>
                  </div>
                  {invoice.dueDate && (
                    <div className="text-right">
                      <p className="text-stone-500">Due date</p>
                      <p className="mt-0.5 font-semibold text-stone-800">{formatDate(invoice.dueDate)}</p>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-dashed border-stone-200 pt-2">
                    <p className="text-stone-500">Billed to</p>
                    <p className="mt-0.5 font-semibold text-stone-900">{invoice.customer.name || "Customer"}</p>
                    {invoice.customer.phone && <p className="mt-0.5 text-stone-600">{invoice.customer.phone}</p>}
                  </div>
                </div>
              </div>

              <div className="px-3 py-3 sm:px-4" aria-label="Item details">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">Items</h2>
                  <span className="text-xs text-stone-500">{invoice.items.length} {invoice.items.length === 1 ? "item" : "items"}</span>
                </div>
                <div className="space-y-2">
                  {invoice.items.map((item, index) => (
                    <article key={item.id || `${item.name}-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                          style={{ backgroundColor: `${accentColor}16`, color: accentColor }}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-[13px] font-bold leading-5 text-stone-900">{item.name || "Item"}</h3>
                          {item.variantName && <p className="mt-0.5 text-xs text-stone-500">{item.variantName}</p>}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <DetailChip label="Design" value={item.designNumber} />
                            <DetailChip label="Size" value={item.size} />
                            <DetailChip label="HSN" value={item.hsnCode} />
                          </div>
                          <div className="mt-2 flex items-end justify-between gap-3 border-t border-dashed border-stone-200 pt-2">
                            <p className="text-xs text-stone-600">
                              <span className="font-semibold text-stone-800">{item.quantity}</span>
                              {item.unit ? ` ${item.unit}` : ""} × {formatMoney(item.rate)}
                            </p>
                            <p className="shrink-0 text-sm font-bold text-stone-950">{formatMoney(item.amount)}</p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 text-sm">
                <dl className="space-y-2">
                  <div className="flex justify-between gap-4 text-stone-600">
                    <dt>Subtotal</dt>
                    <dd className="font-medium text-stone-800">{formatMoney(invoice.subtotal)}</dd>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between gap-4 text-stone-600">
                      <dt>Discount</dt>
                      <dd className="font-medium text-stone-800">− {formatMoney(invoice.discountAmount)}</dd>
                    </div>
                  )}
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between gap-4 text-stone-600">
                      <dt>Tax</dt>
                      <dd className="font-medium text-stone-800">{formatMoney(invoice.taxAmount)}</dd>
                    </div>
                  )}
                  {Boolean(invoice.roundOffAmount) && (
                    <div className="flex justify-between gap-4 text-stone-600">
                      <dt>Round off</dt>
                      <dd className="font-medium text-stone-800">{formatMoney(invoice.roundOffAmount || 0)}</dd>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-4 border-t border-stone-200 pt-3">
                    <dt className="font-serif text-base font-bold text-stone-950">Invoice total</dt>
                    <dd className="font-serif text-xl font-bold text-stone-950">{formatMoney(invoice.totalAmount)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" aria-labelledby="payment-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p id="payment-heading" className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Payment</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{formatPaymentMethod(invoice.payment.method || invoice.paymentMethod)}</p>
                </div>
                {invoice.payment.balanceAmount <= 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-label="Paid in full" />
                ) : (
                  <CircleAlert className="h-6 w-6 text-amber-600" aria-label="Payment due" />
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Amount paid</dt>
                  <dd className="mt-1 text-base font-bold text-emerald-900">{formatMoney(invoice.payment.totalPaid)}</dd>
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-right">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Amount due</dt>
                  <dd className="mt-1 text-base font-bold text-amber-950">{formatMoney(invoice.payment.balanceAmount)}</dd>
                </div>
              </dl>
            </section>

            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: accentColor, color: accentTextColor }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Invoice
            </button>

            {branding.showPromotionalBanner && hasActiveBanner && (
              <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Promotional banner">
                {branding.activeBannerType === "image" && branding.bannerImage && (
                  <img
                    src={branding.bannerImage}
                    alt={branding.heroTitle || `${invoice.business.name} promotion`}
                    loading="lazy"
                    className="aspect-[16/8] w-full object-cover"
                  />
                )}
                {branding.activeBannerType === "video" && branding.bannerVideo && (
                  <video
                    src={branding.bannerVideo}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-cover"
                  >
                    Your browser does not support this promotional video.
                  </video>
                )}
              </section>
            )}

            {branding.showPromotionalGallery && gallery.length > 0 && (
              <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-labelledby="gallery-heading">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 id="gallery-heading" className="font-serif text-base font-bold text-stone-950">From our store</h2>
                  <span className="text-[11px] text-stone-500">Swipe to explore</span>
                </div>
                <div
                  className="portal-gallery flex overflow-x-auto rounded-xl"
                  onScroll={handleGalleryScroll}
                  aria-label="Promotional media gallery"
                >
                  {gallery.map((item) => (
                    <figure key={item.id} className="portal-gallery-slide min-w-full overflow-hidden bg-stone-100">
                      <div className="aspect-square w-full overflow-hidden bg-white">
                        {item.type === "video" ? (
                          <video
                            src={item.url}
                            controls
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full bg-black object-contain"
                          >
                            Your browser does not support this promotional video.
                          </video>
                        ) : (
                          <img
                            src={item.url}
                            alt={item.caption || `${invoice.business.name} promotional image`}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        )}
                      </div>
                      {item.caption && <figcaption className="bg-white px-3 py-2 text-xs leading-5 text-stone-600">{item.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
                {gallery.length > 1 && (
                  <div className="mt-2 flex justify-center gap-1.5" aria-label={`Gallery item ${activeMediaIndex + 1} of ${gallery.length}`}>
                    {gallery.map((item, index) => (
                      <span
                        key={item.id}
                        aria-hidden="true"
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: index === activeMediaIndex ? 18 : 6,
                          backgroundColor: index === activeMediaIndex ? accentColor : "#d6d3d1",
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {shopUrl && (
              <a
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              >
                <span>
                  <span className="block font-serif text-base font-bold text-stone-950">Continue shopping</span>
                  <span className="mt-0.5 block text-xs text-stone-500">Visit the official online store</span>
                </span>
                <ShoppingBag className="h-5 w-5" style={{ color: accentColor }} aria-hidden="true" />
              </a>
            )}
          </main>
        </>
      ) : (
        <main className="p-3 sm:p-4">
          {hasCustomerSession ? (
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="history-heading">
              <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: accentColor, color: accentTextColor }}
                  aria-hidden="true"
                >
                  {customerInitials}
                </span>
                <div className="min-w-0">
                  <h1 id="history-heading" className="font-serif text-lg font-bold text-stone-950">Invoice history</h1>
                  <p className="truncate text-xs text-stone-500">{customer?.name || "Customer account"}</p>
                </div>
              </div>

              {historyStatus === "loading" && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-8 text-sm text-stone-500" role="status">
                  <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
                  Loading previous invoices…
                </div>
              )}

              {historyStatus === "error" && (
                <div className="px-5 py-8 text-center">
                  <CircleAlert className="mx-auto h-7 w-7 text-amber-600" aria-hidden="true" />
                  <p className="mt-2 text-sm text-stone-600">Previous invoices could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => setHistoryRequestKey((key) => key + 1)}
                    className="mt-3 min-h-10 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                  >
                    Try again
                  </button>
                </div>
              )}

              {historyStatus === "success" && historyInvoices.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <History className="mx-auto h-7 w-7 text-stone-300" aria-hidden="true" />
                  <p className="mt-2 text-sm text-stone-500">No previous invoices found.</p>
                </div>
              )}

              {historyStatus === "success" && historyInvoices.length > 0 && (
                <div className="divide-y divide-stone-100" aria-label="Previous invoices">
                  {historyInvoices.map((historyInvoice) => {
                    const historyInvoiceStatus = getStatusPresentation(historyInvoice.status);
                    return (
                      <Link
                        key={historyInvoice.id}
                        to={`/customer/invoices/${historyInvoice.id}`}
                        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-stone-900">{historyInvoice.invoiceNumber}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${historyInvoiceStatus.className}`}>
                              {historyInvoiceStatus.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500">{formatDate(historyInvoice.invoiceDate)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-stone-900">{formatMoney(historyInvoice.TotalAmount)}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm" aria-labelledby="history-heading">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 id="history-heading" className="mt-3 font-serif text-xl font-bold text-stone-950">Invoice history</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">
                Sign in once to securely view your previous invoices here.
              </p>
              <Link
                to="/customer/login"
                state={{ from: location.pathname }}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-sm font-bold"
                style={{ backgroundColor: accentColor, color: accentTextColor }}
              >
                Customer Login
              </Link>
            </section>
          )}
        </main>
      )}

      {hasFooter && (
        <footer className="mx-3 mb-3 mt-1 rounded-2xl border border-stone-200 bg-white px-4 py-4 text-center sm:mx-4">
          {footerLogo && (
            <img
              src={footerLogo}
              alt={`${invoice.business.name} footer logo`}
              loading="lazy"
              className="mx-auto mb-2 h-10 max-w-[150px] object-contain"
            />
          )}
          {footerText && <p className="font-serif text-sm font-bold text-stone-900">{footerText}</p>}
          {footerAddressLines.length > 0 && (
            <div className="mt-2 inline-flex items-start justify-center gap-1.5 text-xs leading-5 text-stone-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {footerAddressLines.map((line, index) => (
                  <span key={`${line}-${index}`} className="block">{line}</span>
                ))}
              </span>
            </div>
          )}
          {hasContactLink && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {footerPhoneNumbers.map((phoneNumber) => (
                <a key={phoneNumber.dial} aria-label={`Call ${phoneNumber.display}`} href={`tel:${phoneNumber.dial}`} className="rounded-full bg-stone-100 p-2 text-stone-600"><Phone className="h-4 w-4" /></a>
              ))}
              {footerEmail && <a aria-label={`Email ${footerEmail}`} href={`mailto:${footerEmail}`} className="rounded-full bg-stone-100 p-2 text-stone-600"><Mail className="h-4 w-4" /></a>}
              {footerWebsite && <a aria-label="Open website" href={footerWebsite} target="_blank" rel="noopener noreferrer" className="rounded-full bg-stone-100 p-2 text-stone-600"><Globe2 className="h-4 w-4" /></a>}
            </div>
          )}
          {hasConfiguredSocialLink && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {instagramUrl && <a aria-label="Instagram" href={instagramUrl} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><Instagram className="h-4 w-4" /></a>}
              {facebookUrl && <a aria-label="Facebook" href={facebookUrl} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><Facebook className="h-4 w-4" /></a>}
              {youtubeUrl && <a aria-label="YouTube" href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><Youtube className="h-4 w-4" /></a>}
              {whatsappNumber && <a aria-label="WhatsApp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><MessageCircle className="h-4 w-4" /></a>}
            </div>
          )}
        </footer>
      )}

      <nav
        aria-label="Customer invoice navigation"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto grid w-full max-w-[520px] grid-cols-3 border-t border-stone-200 bg-white/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur"
      >
        <button type="button" onClick={showInvoice} aria-current={activeView === "invoice" ? "page" : undefined} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold" style={{ color: activeView === "invoice" ? accentColor : "#78716c" }}>
          <ReceiptText className="h-5 w-5" aria-hidden="true" />
          <span>Invoice</span>
        </button>
        <button type="button" onClick={() => setActiveView("history")} aria-current={activeView === "history" ? "page" : undefined} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold" style={{ color: activeView === "history" ? accentColor : "#78716c" }}>
          <History className="h-5 w-5" aria-hidden="true" />
          <span>History</span>
        </button>
        {hasCustomerSession ? (
          <Link to="/customer/profile" aria-label="Open customer profile" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-stone-500">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: accentColor, color: accentTextColor }}
              aria-hidden="true"
            >
              {getCustomerInitials(customer?.name)}
            </span>
            <span>Profile</span>
          </Link>
        ) : (
          <Link to="/customer/login" state={{ from: location.pathname }} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-stone-500">
            <LogIn className="h-5 w-5" aria-hidden="true" />
            <span>Login</span>
          </Link>
        )}
      </nav>
    </div>
  );
};

export default PublicInvoicePortal;
