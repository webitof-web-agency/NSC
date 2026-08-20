import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FileX2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import Constants from "@constants/api";
import type { InvoiceData, Item } from "@models/invoice";
import InvoiceTemplateB from "@pages/admin/invoices/InvoiceTemplateB";

interface PublicAddress {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

interface PublicInvoiceItem {
  id?: string;
  name: string;
  variantName?: string;
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

interface PublicInvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  paymentMethod?: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
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
}

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

const toTemplateItem = (item: PublicInvoiceItem, index: number, prefix: string): Item => ({
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

const toInvoiceTemplateData = (invoice: PublicInvoiceData): InvoiceData => {
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
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
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
          setInvoice(response.data.data);
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
    if (invoice) {
      document.title = `Invoice ${invoice.invoiceNumber} - ${invoice.business.name}`;
      let meta = document.querySelector('meta[name="robots"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "robots");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", "noindex,nofollow");
    }
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FileX2 className="mx-auto mb-4 text-slate-400" size={40} />
          <h1 className="mb-2 text-xl font-bold text-slate-950">Invoice Not Found</h1>
          <p className="text-sm text-slate-600">
            The invoice does not exist or this public link is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const invoiceTemplateData = toInvoiceTemplateData(invoice);

  return (
    <div className="min-h-screen bg-slate-100 px-2 py-3 text-slate-950 sm:px-6 sm:py-8">
      <main className="mx-auto max-w-5xl">
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div ref={invoiceRef}>
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

        <div className="mt-4 print:hidden">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex min-h-12 min-w-48 w-full cursor-pointer items-center justify-center gap-2 rounded bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
          >
            <Printer size={17} />
            Print / Save as PDF
          </button>
        </div>
      </main>
    </div>
  );
};

export default PublicInvoice;
