import { useEffect, useMemo, useState, type CSSProperties, type UIEvent } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import {
  CircleAlert,
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
import CustomerInvoiceAccordion from "@components/customer/CustomerInvoiceAccordion";
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
} from "./publicDocumentPortalUtils";
import PublicInvoiceDetails from "./PublicInvoiceDetails";

export interface PublicAddress {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface PublicDocumentItem {
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
  totalPaid: number;
  balanceAmount: number;
  payment_method?: string;
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

export interface PublicDocumentData {
  invoiceNumber?: string;
  quotationNumber?: string;
  exchangeNumber?: string;
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
  items: PublicDocumentItem[];
  exchangeOriginalItems?: PublicDocumentItem[];
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

interface PublicDocumentPortalProps {
  documentType: "INVOICE" | "QUOTATION" | "EXCHANGE";
  documentData: PublicDocumentData;
  onDownload: () => void;
}

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

const PublicDocumentPortal = ({ documentType, documentData: document, onDownload }: PublicDocumentPortalProps) => {
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
  const branding = document.portalBranding;
  const accentColor = branding.portalAccentColor || "#A43275";
  const accentTextColor = getAccentTextColor(accentColor);
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
          historyInvoice.invoiceNumber !== (document.invoiceNumber || document.exchangeNumber)
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
    document.invoiceNumber,
    document.exchangeNumber,
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
        {document.business.logo ? (
          <img
            src={document.business.logo}
            alt={`${document.business.name} logo`}
            className="h-10 w-10 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: accentColor, color: accentTextColor }}
          >
            {document.business.name.trim().charAt(0) || "N"}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-bold leading-tight text-stone-950">
            {document.business.name}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {documentType === 'INVOICE' ? 'Customer invoice' : documentType === 'QUOTATION' ? 'Customer quotation' : 'Customer exchange'}
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
            <PublicInvoiceDetails
              documentType={documentType}
              document={document}
              accentColor={accentColor}
              onDownload={onDownload}
            />

            {branding.showPromotionalBanner && hasActiveBanner && (
              <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Promotional banner">
                {branding.activeBannerType === "image" && branding.bannerImage && (
                  <img
                    src={branding.bannerImage}
                    alt={branding.heroTitle || `${document.business.name} promotion`}
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
                            alt={item.caption || `${document.business.name} promotional image`}
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
                <CustomerInvoiceAccordion
                  invoices={historyInvoices.map((historyInvoice) => ({
                    id: historyInvoice.id,
                    invoiceNumber: historyInvoice.invoiceNumber,
                    invoiceDate: historyInvoice.invoiceDate,
                    status: historyInvoice.status,
                    totalAmount: historyInvoice.TotalAmount,
                    totalPaid: historyInvoice.totalPaid,
                    balanceAmount: historyInvoice.balanceAmount,
                    paymentMethod: historyInvoice.payment_method,
                  }))}
                />
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
              alt={`${document.business.name} footer logo`}
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
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto grid w-full max-w-[520px] ${documentType === 'QUOTATION' ? 'grid-cols-2' : 'grid-cols-3'} border-t border-stone-200 bg-white/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur`}
      >
        <button type="button" onClick={showInvoice} aria-current={activeView === "invoice" ? "page" : undefined} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold" style={{ color: activeView === "invoice" ? accentColor : "#78716c" }}>
          <ReceiptText className="h-5 w-5" aria-hidden="true" />
          <span>{documentType === 'INVOICE' ? 'Invoice' : documentType === 'QUOTATION' ? 'Quotation' : 'Exchange'}</span>
        </button>
        {documentType !== 'QUOTATION' && (
          <button type="button" onClick={() => setActiveView("history")} aria-current={activeView === "history" ? "page" : undefined} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold" style={{ color: activeView === "history" ? accentColor : "#78716c" }}>
            <History className="h-5 w-5" aria-hidden="true" />
            <span>History</span>
          </button>
        )}
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

export default PublicDocumentPortal;
