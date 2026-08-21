import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import type { InvoiceData, Item } from "@models/invoice";
import InvoiceTemplateB from "@pages/admin/invoices/InvoiceTemplateB";
import PublicInvoiceDetails, {
  type PublicInvoiceDetailsDocument,
} from "@pages/public/PublicInvoiceDetails";

export interface CustomerInvoiceSummary {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  totalAmount: number;
  totalPaid: number;
  balanceAmount: number;
  paymentMethod?: string;
}

interface CustomerInvoiceLine {
  id?: string;
  rowId?: string;
  name?: string;
  variantName?: string;
  variantDesignNo?: string;
  designNumber?: string;
  variantSize?: string;
  size?: string;
  hsn_code?: string;
  hsnCode?: string;
  unit?: string;
  qty?: number;
  rate?: number;
  discount?: number;
  tax?: number;
  tax_group_id?: string;
  discount_type?: string;
  discount_value?: number | null;
  amount?: number;
}

interface CustomerInvoiceAddress {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

interface CustomerInvoiceParty {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
  billingAddress?: CustomerInvoiceAddress | null;
}

interface CustomerInvoiceData {
  id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  referenceNo?: string;
  status: string;
  payment_method?: string;
  taxableAmount?: number;
  totalDiscount?: number;
  vat?: number;
  TotalAmount: number;
  roundOffAmount?: number;
  totalPaid?: number;
  balanceAmount?: number;
  billFrom?: CustomerInvoiceParty | null;
  billTo?: CustomerInvoiceParty | null;
  customerGstin?: string;
  ewayBillNumber?: string;
  shippingAddress?: CustomerInvoiceAddress | null;
  notes?: string;
  termsAndCondition?: string;
  exchangeOldTotal?: number | null;
  exchangeNewTotal?: number | null;
  items?: CustomerInvoiceLine[];
  exchangeOriginalItems?: CustomerInvoiceLine[];
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerInvoiceAccordionProps {
  invoices: CustomerInvoiceSummary[];
  className?: string;
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

const getStatusStyle = (status: string) => {
  const normalized = String(status || "PENDING").toUpperCase();
  if (["PAID", "EXCHANGE"].includes(normalized)) {
    return {
      label: normalized === "EXCHANGE" ? "Exchange" : "Paid",
      chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
      dot: "bg-emerald-500",
    };
  }
  if (["PARTIAL", "PARTIALLY PAID", "PARTIALLY_PAID"].includes(normalized)) {
    return {
      label: "Partial",
      chip: "bg-amber-50 text-amber-800 ring-amber-600/20",
      dot: "bg-amber-500",
    };
  }
  return {
    label: normalized === "OVERDUE" ? "Overdue" : "Unpaid",
    chip: "bg-rose-50 text-rose-700 ring-rose-600/15",
    dot: "bg-rose-500",
  };
};

const toPublicInvoiceDetails = (
  invoice: CustomerInvoiceData,
  summary: CustomerInvoiceSummary,
): PublicInvoiceDetailsDocument => {
  const totalAmount = Number(invoice.TotalAmount ?? summary.totalAmount ?? 0);
  const totalPaid = Number(invoice.totalPaid ?? summary.totalPaid ?? 0);
  const balanceAmount = Number(
    invoice.balanceAmount ?? summary.balanceAmount ?? Math.max(totalAmount - totalPaid, 0),
  );

  return {
    invoiceNumber: invoice.invoiceNumber || summary.invoiceNumber,
    date: invoice.invoiceDate || summary.invoiceDate,
    dueDate: invoice.dueDate || summary.dueDate,
    status: invoice.status || summary.status,
    paymentMethod: invoice.payment_method || summary.paymentMethod,
    totalAmount,
    subtotal: Number(invoice.taxableAmount ?? totalAmount),
    taxAmount: Number(invoice.vat || 0),
    discountAmount: Number(invoice.totalDiscount || 0),
    roundOffAmount: Number(invoice.roundOffAmount || 0),
    customer: {
      name: invoice.billTo?.name || "Customer",
      phone: invoice.billTo?.phone || "",
    },
    items: (invoice.items || []).map((item, index) => ({
      id: item.id || item.rowId || `${summary.id}-${index}`,
      name: item.name || "Item",
      variantName: item.variantName,
      designNumber: item.variantDesignNo || item.designNumber,
      size: item.variantSize || item.size,
      hsnCode: item.hsn_code || item.hsnCode,
      unit: item.unit,
      quantity: Number(item.qty || 0),
      rate: Number(item.rate || 0),
      amount: Number(item.amount || 0),
    })),
    payment: {
      method: invoice.payment_method || summary.paymentMethod || "",
      totalPaid,
      balanceAmount,
    },
  };
};

const emptyTemplateAddress = (): NonNullable<InvoiceData["shippingAddress"]> => ({
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
});

const toTemplateAddress = (
  address?: CustomerInvoiceAddress | null,
): NonNullable<InvoiceData["shippingAddress"]> => ({
  ...emptyTemplateAddress(),
  ...(address || {}),
});

const toTemplateItem = (item: CustomerInvoiceLine, index: number, prefix: string): Item => ({
  id: item.id || item.rowId || `${prefix}-${index}`,
  name: item.name || "N/A",
  variantName: item.variantName || "-",
  unit: item.unit || "",
  qty: Number(item.qty || 0),
  rate: Number(item.rate || 0),
  discount: Number(item.discount || 0),
  tax: Number(item.tax || 0),
  tax_group_id: item.tax_group_id || "",
  discount_type: item.discount_type === "Percentage" ? "Percentage" : "Fixed",
  discount_value: item.discount_value ?? null,
  amount: Number(item.amount || 0),
});

const toFormalInvoiceTemplateData = (invoice: CustomerInvoiceData): InvoiceData => ({
  id: invoice.id || invoice.invoiceNumber,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate,
  dueDate: invoice.dueDate || "",
  referenceNo: invoice.referenceNo || "",
  status: invoice.status,
  payment_method: invoice.payment_method || "",
  taxableAmount: Number(invoice.taxableAmount || 0),
  totalDiscount: Number(invoice.totalDiscount || 0),
  vat: Number(invoice.vat || 0),
  TotalAmount: Number(invoice.TotalAmount || 0),
  exchangeOldTotal: invoice.exchangeOldTotal ?? undefined,
  exchangeNewTotal: invoice.exchangeNewTotal ?? undefined,
  items: (invoice.items || []).map((item, index) => toTemplateItem(item, index, "item")),
  exchangeOriginalItems: (invoice.exchangeOriginalItems || []).map((item, index) => (
    toTemplateItem(item, index, "exchange-item")
  )),
  billFrom: {
    id: invoice.billFrom?.id || "",
    name: invoice.billFrom?.name || "",
    email: invoice.billFrom?.email || "",
    phone: invoice.billFrom?.phone || "",
    address: invoice.billFrom?.address || "",
    image: invoice.billFrom?.image || null,
  },
  billTo: {
    id: invoice.billTo?.id || "",
    name: invoice.billTo?.name || "N/A",
    email: invoice.billTo?.email || "",
    phone: invoice.billTo?.phone || "N/A",
    billingAddress: toTemplateAddress(invoice.billTo?.billingAddress),
    image: invoice.billTo?.image || null,
  },
  customerGstin: invoice.customerGstin || "",
  ewayBillNumber: invoice.ewayBillNumber || "",
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
  createdAt: invoice.createdAt || invoice.invoiceDate,
  updatedAt: invoice.updatedAt || invoice.invoiceDate,
});

interface InvoiceAccordionItemProps {
  invoice: CustomerInvoiceSummary;
  expanded: boolean;
  onToggle: () => void;
  token: string | null;
  accentColor: string;
}

const InvoiceAccordionItem = ({
  invoice,
  expanded,
  onToggle,
  token,
  accentColor,
}: InvoiceAccordionItemProps) => {
  const [details, setDetails] = useState<CustomerInvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const formalPrintRef = useRef<HTMLDivElement>(null);
  const panelId = `customer-invoice-panel-${invoice.id}`;
  const status = getStatusStyle(invoice.status);

  useEffect(() => {
    if (!expanded || details || !token) return undefined;

    const requestController = new AbortController();
    setLoading(true);
    setError(false);

    axios.get(`${Constants.CUSTOMER_PORTAL_INVOICES_URL}/${invoice.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: requestController.signal,
    }).then((response) => {
      setDetails(response.data?.data || null);
      setError(!response.data?.data);
    }).catch((requestError) => {
      if (!axios.isCancel(requestError)) setError(true);
    }).finally(() => {
      if (!requestController.signal.aborted) setLoading(false);
    });

    return () => requestController.abort();
  }, [details, expanded, invoice.id, requestKey, token]);

  const handlePrint = useReactToPrint({
    contentRef: formalPrintRef,
    documentTitle: invoice.invoiceNumber || "Invoice",
    pageStyle: `
      @page { size: auto; margin: 5mm 5mm 2mm 2mm; }
      @page:first { margin: 2mm; }
    `,
  });

  const publicInvoice = details ? toPublicInvoiceDetails(details, invoice) : null;
  const formalInvoice = details ? toFormalInvoiceTemplateData(details) : null;

  return (
    <article className="bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A43275]"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-serif text-sm font-bold text-stone-900">{invoice.invoiceNumber}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${status.chip}`}>
              {status.label}
            </span>
          </span>
          <span className="mt-1 block text-xs text-stone-500">{formatDate(invoice.invoiceDate)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold text-stone-900">{formatMoney(invoice.totalAmount)}</span>
          <ChevronDown
            className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-stone-200 bg-[#f8f6f3] p-3 sm:p-4">
          {loading && (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-stone-500" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading invoice…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-amber-200 bg-white px-4 py-6 text-center">
              <CircleAlert className="mx-auto h-6 w-6 text-amber-600" aria-hidden="true" />
              <p className="mt-2 text-sm text-stone-600">This invoice could not be loaded.</p>
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setRequestKey((key) => key + 1);
                }}
                className="mt-3 min-h-10 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
              >
                Try again
              </button>
            </div>
          )}

          {publicInvoice && !loading && (
            <>
              <PublicInvoiceDetails
                documentType="INVOICE"
                document={publicInvoice}
                accentColor={accentColor}
                onDownload={() => handlePrint()}
              />

              {formalInvoice && (
                <div
                  ref={formalPrintRef}
                  aria-hidden="true"
                  className="portal-print-document pointer-events-none fixed left-[-10000px] top-0 w-[210mm] bg-white print:static print:w-auto"
                >
                  <InvoiceTemplateB invoiceData={formalInvoice} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
};

const CustomerInvoiceAccordion = ({ invoices, className = "" }: CustomerInvoiceAccordionProps) => {
  const { token } = useSelector((state: RootState) => state.customerAuth);
  const systemSettings = useSelector((state: RootState) => state.systemSettings.data);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const branding = (systemSettings?.company as { customerPortalBranding?: { portalAccentColor?: string } } | undefined)
    ?.customerPortalBranding;
  const accentColor = branding?.portalAccentColor || "#A43275";

  return (
    <div className={`divide-y divide-stone-100 ${className}`} aria-label="Invoice history">
      {invoices.map((invoice) => (
        <InvoiceAccordionItem
          key={invoice.id}
          invoice={invoice}
          expanded={expandedId === invoice.id}
          onToggle={() => setExpandedId((current) => current === invoice.id ? null : invoice.id)}
          token={token}
          accentColor={accentColor}
        />
      ))}
    </div>
  );
};

export default CustomerInvoiceAccordion;
