import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from '@constants/api';
import axios from 'axios';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import ProfessionalPrintDialog from '@components/admin/ProfessionalPrintDialog';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

/* ─────────────────────── types ─────────────────────────── */
interface SupplierPaymentDetail {
  id: string;
  paymentId: string;
  referenceNumber: string | null;
  chequeNumber: string | null;
  paymentDate: string | null;
  sourceType: string | null;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  notes: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    profileImage: string | null;
  } | null;
  purchase: {
    id: string;
    purchaseId: string | null;
    supplierBillNumber: string | null;
    totalAmount: number;
    purchaseDate: string | null;
  } | null;
  bank: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  } | null;
  paymentMode: { name: string; slug: string } | null;
  createdAt: string | null;
}

/* ─────────────── source type badge colours ─────────────── */
const sourceColorMap: Record<string, string> = {
  BANK: 'bg-blue-100 text-blue-700',
  PETTY_CASH: 'bg-amber-100 text-amber-700',
  ON_ACCOUNT: 'bg-gray-100 text-gray-600',
};

/* ─────────────────────── component ─────────────────────── */
const OverviewSupplierPayment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
  const navigate = useNavigate();

  const [payment, setPayment] = useState<SupplierPaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const { format } = useCurrencyFormatter();
  const componentRef = useRef<HTMLDivElement>(null);

  const fetchPayment = useCallback(async (paymentId: string) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${Constants.GET_SUPPLIER_PAYMENTS_URL}/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPayment(res.data.data);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (id) fetchPayment(id);
  }, [fetchPayment, id]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `SupplierPayment-${payment?.paymentId ?? id}`,
    pageStyle: `
      @page { size: A4; margin: 12mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: sans-serif; font-size: 12px; color: #111; margin: 0; }
      .sp-container { padding: 16px !important; }
      .sp-footer { page-break-before: avoid; break-before: avoid; break-inside: avoid; }
      .summary-dark { background-color: #111827 !important; color: #fff !important; }
    `,
  });

  useEffect(() => {
    if (!payment) return;
    if (searchParams.get('print') !== 'true') return;

    const timer = window.setTimeout(() => {
      setShowPrintDialog(true);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [payment, searchParams, handlePrint]);

  /* ────────── loading ────────── */
  if (isLoading || !payment) {
    return (
      <div className="flex justify-center mt-20">
        <LoaderSpinner />
      </div>
    );
  }

  const sourceKey = (payment.sourceType ?? '').toUpperCase();
  const sourceClass = sourceColorMap[sourceKey] ?? 'bg-gray-100 text-gray-600';
  const sourceLabel = sourceKey === 'PETTY_CASH' ? 'Petty Cash'
    : sourceKey === 'ON_ACCOUNT' ? 'On Account'
      : sourceKey;
  const previewHtml = componentRef.current
    ? componentRef.current.innerHTML
        .replace(/max-w-3xl\s+mx-auto/g, 'w-full')
        .replace(/max-w-4xl\s+mx-auto/g, 'w-full')
        .replace(/max-w-5xl\s+mx-auto/g, 'w-full')
        .replace(/\smx-auto/g, '')
    : '';
  const printPreview = previewHtml ? (
    <div className="bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
  ) : null;

  /* ─────────────────────── render ────────────────────────── */
  return (
    <>
      {/* Action bar — hidden on print */}
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => setShowPrintDialog(true)}
          className="bg-primary text-white px-4 py-2 rounded-md text-sm flex items-center gap-2"
        >
          <Printer size={14} />
          Print / PDF
        </button>
        <button
          onClick={() => navigate('/admin/supplier-payments')}
          className="px-4 py-2 rounded-md text-sm bg-gray-300 hover:bg-gray-400 text-gray-950 border border-gray-200"
        >
          Back
        </button>
      </div>

      <ProfessionalPrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        onPrint={() => {
          setShowPrintDialog(false);
          window.setTimeout(() => handlePrint(), 80);
        }}
        title="Print Supplier Payment"
        documentName={payment.paymentId || 'Supplier Payment'}
        documentType="Supplier Payment"
        description="Review the supplier payment receipt before sending it to print."
        preview={printPreview}
        previewWrapperClassName="min-w-full overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm"
        footerNote="The final print layout will use the supplier payment print template."
        printButtonLabel="Print Payment"
        showCopies={false}
        showPaperSize={false}
        showOrientation={false}
      />

      {/* ═══════════ Printable area ═══════════ */}
      <div
        ref={componentRef}
        className="sp-container bg-white border border-gray-200 rounded-xl shadow-sm max-w-3xl mx-auto p-10 text-gray-900 font-sans"
      >
        {/* ── Header ── */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <img
              src={
                resolveAssetUrl(systemSettings?.company?.siteLogo) ||
                resolveAssetUrl(systemSettings?.company?.favicon) ||
                logoImage
              }
              alt="Company Logo"
              className="w-28 h-auto mb-3"
            />
            <p className="font-semibold text-base text-gray-950">
              {systemSettings?.company?.companyName}
            </p>
            <p className="text-sm text-gray-500">{systemSettings?.company?.address}</p>
            <p className="text-sm text-gray-500">{systemSettings?.company?.phone}</p>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-950 tracking-tight">Payment Receipt</h1>
            <p className="text-sm text-gray-400 mt-1">#{payment.paymentId}</p>
            {payment.referenceNumber && (
              <p className="text-xs text-gray-400 mt-0.5">Ref: {payment.referenceNumber}</p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${sourceClass}`}>
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* ── Meta grid (4-col, no responsive prefix so print works) ── */}
        <div className="grid grid-cols-4 gap-4 text-sm mb-5">
          <div>
            <p className="text-gray-500 mb-0.5">Payment Date</p>
            <p className="font-medium text-gray-950">{payment.paymentDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Payment Mode</p>
            <p className="font-medium text-gray-950">{payment.paymentMode?.name ?? '—'}</p>
          </div>
          {payment.paymentMode?.name?.toLowerCase() === 'cheque' && (
            <div>
              <p className="text-gray-500 mb-0.5">Cheque Number</p>
              <p className="font-medium text-gray-950">{payment.chequeNumber ?? '—'}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 mb-0.5">Created On</p>
            <p className="font-medium text-gray-950">{payment.createdAt ?? '—'}</p>
          </div>

          <div>
            <p className="text-gray-500 mb-0.5">Purchase ID</p>
            <p className="font-medium text-gray-950">{payment.purchase?.purchaseId ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Supplier Bill No</p>
            <p className="font-medium text-gray-950">{payment.purchase?.supplierBillNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Purchase Date</p>
            <p className="font-medium text-gray-950">{payment.purchase?.purchaseDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Purchase Total</p>
            <p className="font-medium text-gray-950">{format(payment.purchase?.totalAmount ?? 0)}</p>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* ── Supplier ── */}
        {payment.supplier && (
          <div className="text-sm mb-6">
            <p className="uppercase text-xs font-semibold text-gray-400 mb-1.5 tracking-wider">
              Supplier / Vendor
            </p>
            <p className="font-semibold text-gray-950 uppercase">{payment.supplier.name}</p>
            {payment.supplier.phone && <p className="text-gray-500">{payment.supplier.phone}</p>}
          </div>
        )}

        {/* ── Bank details ── */}
        {payment.bank && (
          <>
            <div className="h-px bg-gray-200 mb-5" />
            <div className="text-sm mb-6">
              <p className="uppercase text-xs font-semibold text-gray-400 mb-1.5 tracking-wider">
                Bank Details
              </p>
              <p className="font-semibold text-gray-950">{payment.bank.bankName}</p>
              <p className="text-gray-500">A/C: {payment.bank.accountNumber}</p>
              <p className="text-gray-500">Holder: {payment.bank.accountHolder}</p>
            </div>
          </>
        )}

        <div className="h-px bg-gray-200 mb-5" />

        {/* ── Amount summary ── */}
        <div className="flex justify-end mb-6">
          <div className="w-72 border border-gray-200 rounded-lg overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Invoice Total</span>
              <span className="font-medium text-gray-950">{format(payment.amount)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Paid Amount</span>
              <span className="font-semibold text-emerald-600">{format(payment.paidAmount)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-gray-950 text-white summary-dark">
              <span className="font-semibold">Balance Due</span>
              <span className="font-bold text-base">{format(payment.dueAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        {payment.notes && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-semibold text-gray-950 mb-1">Notes</p>
            <p className="text-gray-500 leading-relaxed">{payment.notes}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="sp-footer mt-8 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Generated electronically • No signature required</span>
          <span>{systemSettings?.company?.companyName}</span>
        </div>
      </div>
    </>
  );
};

export default OverviewSupplierPayment;
