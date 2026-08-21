import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FileX2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import Constants from "@constants/api";
import type { QuotationData, QuotationItem } from "@models/quotation";
import QuotationTemplate from "@pages/admin/quotations/QuotationTemplate";
import PublicDocumentPortal, {
  type PublicAddress,
  type PublicDocumentData,
  type PublicDocumentItem,
  type PublicPortalBranding,
} from "./PublicDocumentPortal";

const defaultPortalBranding: PublicPortalBranding = {
  activeBannerType: "none",
  bannerImage: "",
  bannerVideo: "",
  footerLogo: "",
  heroTitle: "",
  heroSubtitle: "",
  footerText: "",
  footerAddress: "",
  footerPhone: "",
  footerPhoneAlt: "",
  footerEmail: "",
  footerWebsite: "",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  whatsappNumber: "",
  shopOnlineUrl: "",
  portalAccentColor: "#A43275",
  showPromotionalBanner: true,
  showPromotionalGallery: true,
  showShopOnline: true,
  showSocialLinks: true,
  enableCustomerHistory: false,
  promoGallery: [],
};

const normalizePortalInvoice = (invoice: PublicDocumentData): PublicDocumentData => ({
  ...invoice,
  payment: invoice.payment || {
    method: invoice.paymentMethod || "",
    totalPaid: ["PAID", "EXCHANGE"].includes(invoice.status) ? invoice.totalAmount : 0,
    balanceAmount: ["PAID", "EXCHANGE"].includes(invoice.status) ? 0 : invoice.totalAmount,
  },
  portalBranding: {
    ...defaultPortalBranding,
    ...(invoice.portalBranding || {}),
    promoGallery: invoice.portalBranding?.promoGallery || [],
  },
  history: invoice.history || {
    requested: false,
    enabled: false,
    code: "OTP_DELIVERY_NOT_CONFIGURED",
    message: "Invoice history is not enabled by this business.",
  },
});

const emptyAddress = (): NonNullable<QuotationData["shippingAddress"]> => ({
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
});

const toTemplateAddress = (
  address?: PublicAddress | null,
): NonNullable<QuotationData["shippingAddress"]> => ({
  ...emptyAddress(),
  ...address,
});

const toTemplateItem = (item: PublicDocumentItem, index: number, prefix: string): QuotationItem => ({
  id: item.id || `${prefix}-${index}`,
  name: item.name || "N/A",
  variantName: item.variantName || "-",
  unit: item.unit || "",
  qty: Number(item.quantity || 0),
  rate: Number(item.rate || 0),
  discount: Number(item.discount || 0),
  tax: Number(item.taxAmount || 0),
  tax_group_id: item.taxGroupId || "",
  discount_type: item.discountType === "Percentage" ? "Percentage" : "Fixed",
  discount_value: item.discountValue ?? null,
  amount: Number(item.amount || 0),
});

const toQuotationTemplateData = (quotation: PublicDocumentData): QuotationData => {
  const billingAddress = toTemplateAddress(quotation.customer.billingAddress);

  return {
    id: quotation.quotationNumber,
    quotationNumber: quotation.quotationNumber,
    quotationDate: quotation.date,
    validUntil: quotation.dueDate,
    referenceNo: "",
    status: quotation.status,
    taxableAmount: Number(quotation.subtotal || 0),
    totalDiscount: Number(quotation.discountAmount || 0),
    vat: Number(quotation.taxAmount || 0),
    TotalAmount: Number(quotation.totalAmount || 0),
    items: quotation.items.map((item, index) => toTemplateItem(item, index, "item")),
    billFrom: {
      id: "",
      name: quotation.business.name,
      email: quotation.business.email,
      phone: quotation.business.phone,
      address: quotation.business.address,
      image: quotation.business.logo || null,
    },
    billTo: {
      id: "",
      name: quotation.customer.name || "N/A",
      email: "",
      phone: quotation.customer.phone || "N/A",
      billingAddress,
      image: null,
    },
    customerGstin: quotation.customerGstin || quotation.customer.gstNumber,
    shippingAddress: quotation.shippingAddress
      ? toTemplateAddress(quotation.shippingAddress)
      : null,
    notes: quotation.notes || "",
    termsAndCondition: quotation.termsAndCondition || "",
    sign_type: "digitalSignature",
    signature: {
      id: "",
      name: "",
      image: null,
    },
    createdAt: quotation.date,
    updatedAt: quotation.date,
  };
};

const PublicQuotation = () => {
  const { publicShareId } = useParams<{ publicShareId: string }>();
  const [quotation, setQuotation] = useState<PublicDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPublicQuotation = async () => {
      try {
        const response = await axios.get(
          `${Constants.BASE_URL}/api/public/quotations/${publicShareId}`,
        );
        if (response.data.success) {
          setQuotation(normalizePortalInvoice(response.data.data));
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (publicShareId) {
      fetchPublicQuotation();
    }
  }, [publicShareId]);

  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.querySelector('meta[name="robots"]');
    const createdMeta = !meta;
    const previousRobotsContent = meta?.getAttribute("content");
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex,nofollow");

    return () => {
      document.title = previousTitle;
      if (createdMeta) {
        meta?.remove();
      } else if (previousRobotsContent === null) {
        meta?.removeAttribute("content");
      } else {
        meta?.setAttribute("content", previousRobotsContent);
      }
    };
  }, []);

  useEffect(() => {
    if (quotation) document.title = `Quotation ${quotation.quotationNumber} - ${quotation.business.name}`;
  }, [quotation]);

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: quotation?.quotationNumber || "Quotation",
    pageStyle: `
      @page {
        size: auto;
        margin: 5mm 5mm 2mm 2mm;
      }
      @page:first {
        margin: 2mm;
      }
    `,
  });

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f6f3]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
          aria-label="Loading quotation"
          role="status"
        />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f6f3] px-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-stone-200 bg-white p-7 text-center shadow-sm">
          <FileX2 className="mx-auto mb-4 text-stone-400" size={40} />
          <h1 className="mb-2 font-serif text-xl font-bold text-stone-950">Quotation Not Found</h1>
          <p className="text-sm leading-6 text-stone-600">
            This quotation link is invalid, expired, or no longer active.
          </p>
        </div>
      </div>
    );
  }

  const quotationTemplateData = toQuotationTemplateData(quotation);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#eeeae5]">
      <PublicDocumentPortal documentType="QUOTATION" documentData={quotation} onDownload={() => handlePrint()} />

      <div
        ref={invoiceRef}
        aria-hidden="true"
        className="portal-print-document pointer-events-none fixed left-[-10000px] top-0 w-[210mm] bg-white print:static print:w-auto"
      >
        <QuotationTemplate
          quotationData={quotationTemplateData}
          companyDetails={{
            name: quotation.business.name,
            address: quotation.business.address,
            phone: quotation.business.phone,
            logo: quotation.business.logo,
            dateFormat: "DD MMMM YYYY",
          }}
        />
      </div>
    </div>
  );
};

export default PublicQuotation;
