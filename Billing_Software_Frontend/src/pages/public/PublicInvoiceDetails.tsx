import { CheckCircle2, CircleAlert, Download } from "lucide-react";

export interface PublicInvoiceDetailsItem {
  id?: string;
  name: string;
  variantName?: string;
  designNumber?: string;
  size?: string;
  unit?: string;
  quantity: number;
  rate: number;
  amount: number;
  hsnCode?: string;
}

export interface PublicInvoiceDetailsDocument {
  invoiceNumber?: string;
  quotationNumber?: string;
  exchangeNumber?: string;
  date: string;
  dueDate?: string;
  status: string;
  paymentMethod?: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  roundOffAmount?: number;
  customer: {
    name: string;
    phone: string;
  };
  items: PublicInvoiceDetailsItem[];
  payment: {
    method: string;
    totalPaid: number;
    balanceAmount: number;
  };
}

interface PublicInvoiceDetailsProps {
  documentType: "INVOICE" | "QUOTATION" | "EXCHANGE";
  document: PublicInvoiceDetailsDocument;
  accentColor?: string;
  onDownload?: () => void;
  className?: string;
}

const formatPublicInvoiceMoney = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatPublicInvoiceDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getPublicInvoiceStatus = (status: string) => {
  const normalized = String(status || "PENDING").toUpperCase();
  if (["PAID", "EXCHANGE"].includes(normalized)) {
    return {
      label: normalized === "EXCHANGE" ? "Exchange" : "Paid",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    };
  }
  if (["PARTIAL", "PARTIALLY PAID", "PARTIALLY_PAID"].includes(normalized)) {
    return {
      label: "Partially paid",
      className: "bg-amber-50 text-amber-800 ring-amber-600/20",
    };
  }
  if (["OVERDUE", "CANCELLED"].includes(normalized)) {
    return {
      label: normalized === "OVERDUE" ? "Overdue" : "Cancelled",
      className: "bg-rose-50 text-rose-700 ring-rose-600/15",
    };
  }
  return {
    label: normalized.charAt(0) + normalized.slice(1).toLowerCase(),
    className: "bg-slate-100 text-slate-700 ring-slate-500/15",
  };
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

const DetailChip = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] leading-none text-stone-600">
      <span className="font-semibold text-stone-500">{label}</span>
      {value}
    </span>
  );
};

const getDocumentLabel = (documentType: PublicInvoiceDetailsProps["documentType"]) => {
  if (documentType === "QUOTATION") return "Quotation";
  if (documentType === "EXCHANGE") return "Exchange";
  return "Invoice";
};

const PublicInvoiceDetails = ({
  documentType,
  document,
  accentColor = "#A43275",
  onDownload,
  className = "space-y-3",
}: PublicInvoiceDetailsProps) => {
  const status = getPublicInvoiceStatus(document.status);
  const documentLabel = getDocumentLabel(documentType);
  const documentNumber = documentType === "QUOTATION"
    ? document.quotationNumber
    : documentType === "EXCHANGE"
      ? document.exchangeNumber
      : document.invoiceNumber;

  return (
    <div className={className}>
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby={`invoice-heading-${documentNumber}`}>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">
                {documentType === "INVOICE" ? "Tax invoice" : documentLabel}
              </p>
              <h2 id={`invoice-heading-${documentNumber}`} className="mt-1 break-words font-serif text-xl font-bold text-stone-950">
                {documentNumber}
              </h2>
            </div>
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${status.className}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <p className="text-stone-500">{documentType === "QUOTATION" ? "Date" : "Invoice date"}</p>
              <p className="mt-0.5 font-semibold text-stone-800">{formatPublicInvoiceDate(document.date)}</p>
            </div>
            {document.dueDate && (
              <div className="text-right">
                <p className="text-stone-500">Due date</p>
                <p className="mt-0.5 font-semibold text-stone-800">{formatPublicInvoiceDate(document.dueDate)}</p>
              </div>
            )}
            <div className="col-span-2 border-t border-dashed border-stone-200 pt-2">
              <p className="text-stone-500">Billed to</p>
              <p className="mt-0.5 font-semibold text-stone-900">{document.customer.name || "Customer"}</p>
              {document.customer.phone && <p className="mt-0.5 text-stone-600">{document.customer.phone}</p>}
            </div>
          </div>
        </div>

        <div className="px-3 py-3 sm:px-4" aria-label="Item details">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">Items</h3>
            <span className="text-xs text-stone-500">{document.items.length} {document.items.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="space-y-2">
            {document.items.map((item, index) => (
              <article key={item.id || `${item.name}-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                    style={{ backgroundColor: `${accentColor}16`, color: accentColor }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words text-[13px] font-bold leading-5 text-stone-900">{item.name || "Item"}</h4>
                    {item.variantName && <p className="mt-0.5 text-xs text-stone-500">{item.variantName}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <DetailChip label="Design" value={item.designNumber} />
                      <DetailChip label="Size" value={item.size} />
                      <DetailChip label="HSN" value={item.hsnCode} />
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3 border-t border-dashed border-stone-200 pt-2">
                      <p className="text-xs text-stone-600">
                        <span className="font-semibold text-stone-800">{item.quantity}</span>
                        {item.unit ? ` ${item.unit}` : ""} × {formatPublicInvoiceMoney(item.rate)}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-stone-950">{formatPublicInvoiceMoney(item.amount)}</p>
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
              <dd className="font-medium text-stone-800">{formatPublicInvoiceMoney(document.subtotal)}</dd>
            </div>
            {document.discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-stone-600">
                <dt>Discount</dt>
                <dd className="font-medium text-stone-800">− {formatPublicInvoiceMoney(document.discountAmount)}</dd>
              </div>
            )}
            {document.taxAmount > 0 && (
              <div className="flex justify-between gap-4 text-stone-600">
                <dt>Tax</dt>
                <dd className="font-medium text-stone-800">{formatPublicInvoiceMoney(document.taxAmount)}</dd>
              </div>
            )}
            {Boolean(document.roundOffAmount) && (
              <div className="flex justify-between gap-4 text-stone-600">
                <dt>Round off</dt>
                <dd className="font-medium text-stone-800">{formatPublicInvoiceMoney(document.roundOffAmount || 0)}</dd>
              </div>
            )}
            <div className="flex items-end justify-between gap-4 border-t border-stone-200 pt-3">
              <dt className="font-serif text-base font-bold text-stone-950">{documentLabel} total</dt>
              <dd className="font-serif text-xl font-bold text-stone-950">{formatPublicInvoiceMoney(document.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" aria-label="Payment summary">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Payment</p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{formatPaymentMethod(document.payment?.method || document.paymentMethod)}</p>
          </div>
          {document.payment?.balanceAmount <= 0 ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-label="Paid in full" />
          ) : (
            <CircleAlert className="h-6 w-6 text-amber-600" aria-label="Payment due" />
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Amount paid</dt>
            <dd className="mt-1 text-base font-bold text-emerald-900">{formatPublicInvoiceMoney(document.payment?.totalPaid ?? 0)}</dd>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-right">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Amount due</dt>
            <dd className="mt-1 text-base font-bold text-amber-950">{formatPublicInvoiceMoney(document.payment?.balanceAmount ?? document.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ backgroundColor: accentColor, color: getAccentTextColor(accentColor) }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {`Print / Save ${documentLabel}`}
        </button>
      )}
    </div>
  );
};

export default PublicInvoiceDetails;
