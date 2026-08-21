import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FileX2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import Constants from "@constants/api";
import type { InvoiceData, Item } from "@models/invoice";
import InvoiceTemplateB from "@pages/admin/invoices/InvoiceTemplateB";
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

const emptyAddress = (): NonNullable<InvoiceData["shippingAddress"]> => ({
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
): NonNullable<InvoiceData["shippingAddress"]> => ({
  ...emptyAddress(),
  ...address,
});

const toTemplateItem = (item: PublicDocumentItem, index: number, prefix: string): Item => ({
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

const toInvoiceTemplateData = (invoice: PublicDocumentData): InvoiceData => {
  const billingAddress = toTemplateAddress(invoice.customer.billingAddress);

  return {
    id: invoice.invoiceNumber,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.date,
    dueDate: invoice.dueDate,
    referenceNo: "",
    status: invoice.status,
    payment_method: invoice.paymentMethod || "",
    taxableAmount: Number(invoice.subtotal || 0),
    totalDiscount: Number(invoice.discountAmount || 0),
    vat: Number(invoice.taxAmount || 0),
    TotalAmount: Number(invoice.totalAmount || 0),
    exchangeOldTotal: invoice.exchangeOldTotal ?? undefined,
    exchangeNewTotal: invoice.exchangeNewTotal ?? undefined,
    items: invoice.items.map((item, index) => toTemplateItem(item, index, "item")),
    exchangeOriginalItems: (invoice.exchangeOriginalItems || []).map((item, index) =>
      toTemplateItem(item, index, "exchange-item"),
    ),
    billFrom: {
      id: "",
      name: invoice.business.name,
      email: invoice.business.email,
      phone: invoice.business.phone,
      address: invoice.business.address,
      image: invoice.business.logo || null,
    },
    billTo: {
      id: "",
      name: invoice.customer.name || "N/A",
      email: "",
      phone: invoice.customer.phone || "N/A",
      billingAddress,
      image: null,
    },
    customerGstin: invoice.customerGstin || invoice.customer.gstNumber,
    ewayBillNumber: invoice.ewayBillNumber,
    shippingAddress: invoice.shippingAddress
      ? toTemplateAddress(invoice.shippingAddress)
      : null,
    notes: invoice.notes || "",
    termsAndCondition: invoice.termsAndCondition || "",
    isRecurring: false,
    recurring: null,
    recurringDuration: null,
    sign_type: "digitalSignature",
    signature: {
      id: "",
      name: "",
      image: null,
    },
    createdAt: invoice.date,
    updatedAt: invoice.date,
  };
};

const PublicInvoice = () => {
  const { publicShareId } = useParams<{ publicShareId: string }>();
  const [invoice, setInvoice] = useState<PublicDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPublicInvoice = async () => {
      try {
        const response = await axios.get(
          `${Constants.BASE_URL}/api/public/invoices/${publicShareId}`,
        );
        if (response.data.success) {
          setInvoice(normalizePortalInvoice(response.data.data));
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
      fetchPublicInvoice();
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
    if (invoice) document.title = `Invoice ${invoice.invoiceNumber} - ${invoice.business.name}`;
  }, [invoice]);

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: invoice?.invoiceNumber || "Invoice",
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
          aria-label="Loading invoice"
          role="status"
        />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f6f3] px-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-stone-200 bg-white p-7 text-center shadow-sm">
          <FileX2 className="mx-auto mb-4 text-stone-400" size={40} />
          <h1 className="mb-2 font-serif text-xl font-bold text-stone-950">Invoice Not Found</h1>
          <p className="text-sm leading-6 text-stone-600">
            This invoice link is invalid, expired, or no longer active.
          </p>
        </div>
      </div>
    );
  }

  const invoiceTemplateData = toInvoiceTemplateData(invoice);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#eeeae5]">
      <PublicDocumentPortal documentType="INVOICE" documentData={invoice} onDownload={() => handlePrint()} />

      <div
        ref={invoiceRef}
        aria-hidden="true"
        className="portal-print-document pointer-events-none fixed left-[-10000px] top-0 w-[210mm] bg-white print:static print:w-auto"
      >
        <InvoiceTemplateB
          invoiceData={invoiceTemplateData}
          companyDetails={{
            name: invoice.business.name,
            address: invoice.business.address,
            phone: invoice.business.phone,
            logo: invoice.business.logo,
            dateFormat: "DD MMMM YYYY",
          }}
        />
      </div>
    </div>
  );
};

export default PublicInvoice;
