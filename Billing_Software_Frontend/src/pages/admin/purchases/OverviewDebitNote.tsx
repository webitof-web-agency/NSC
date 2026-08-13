import { numberToWords } from '@utils/converters';
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
import { ArrowLeftRight, Printer, RotateCcw } from 'lucide-react';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

/* ───────────────────────── types ───────────────────────── */
interface DebitNoteItem {
  // denormalized name fields (stored directly on item in DB)
  name: string | null;
  hsn_code: string | null;
  variantName: string | null;
  variantDesignNo: string | null;
  variantColor: string | null;
  variantSize: string | null;
  unit: string | null;
  // amounts
  qty: number;
  quantity: number;
  rate: number;
  discount: number;
  tax: number;
  amount: number;
  reason: string | null;
  taxGroup: { id: string; name: string | null; rate: number } | null;
}

interface DebitNoteDetail {
  id: string;
  debitNoteId: string;
  referenceNo: string | null;
  vendor: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  purchase: {
    id: string;
    purchaseId: string | null;
    supplierBillNumber: string | null;
    purchaseDate: string | null;
    totalAmount: number;
  } | null;
  debitNoteDate: string | null;
  status: string | null;
  taxableAmount: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  replacementAmount: number;
  netAdjustment: number;
  adjustmentType: string;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: { id: string; name: string; slug: string } | null;
  notes: string | null;
  termsAndCondition: string | null;
  items: DebitNoteItem[];
  replacementItems: DebitNoteItem[];
  createdBy: { id: string; name: string } | null;
}

/* ───────────────────── helpers ──────────────────────────── */
const statusColorMap: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  partially_paid: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-emerald-100 text-emerald-700',
  return: 'bg-orange-100 text-orange-700',
  replaced: 'bg-purple-100 text-purple-700',
};

/** qty stored as `qty` (create path) OR `quantity` (older docs) */
const getQty = (item: DebitNoteItem) => Number(item.qty || item.quantity || 0);

/** Build a readable item display name from denormalized fields */
const getItemName = (item: DebitNoteItem): string => {
  const base = item.name || '';
  const parts: string[] = [];
  if (item.variantName) parts.push(item.variantName);
  if (item.variantDesignNo) parts.push(`Design: ${item.variantDesignNo}`);
  if (item.variantColor) parts.push(item.variantColor);
  if (item.variantSize) parts.push(item.variantSize);
  if (item.hsn_code) parts.push(`HSN: ${item.hsn_code}`);
  return base || parts.join(' | ') || '—';
};

const getItemSubtitle = (item: DebitNoteItem): string => {
  if (!item.name) return '';
  const parts: string[] = [];
  if (item.variantName) parts.push(item.variantName);
  if (item.variantDesignNo) parts.push(`Design: ${item.variantDesignNo}`);
  if (item.variantColor) parts.push(item.variantColor);
  if (item.variantSize) parts.push(item.variantSize);
  return parts.join(' · ');
};

/* ─────────────────────────── component ─────────────────── */
const OverviewDebitNote: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
  const navigate = useNavigate();

  const [debitNote, setDebitNote] = useState<DebitNoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const { format } = useCurrencyFormatter();
  const componentRef = useRef<HTMLDivElement>(null);

  const fetchDebitNote = useCallback(async (noteId: string) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${Constants.FETCH_FOR_DEBIT_NOTE_LIST_URL}/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDebitNote(res.data.data);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (id) fetchDebitNote(id);
  }, [fetchDebitNote, id]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `DebitNote-${debitNote?.debitNoteId ?? id}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 12mm;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: sans-serif; font-size: 12px; color: #111; margin: 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: 6px 10px; font-size: 11px; }
      thead tr { background-color: #f9fafb !important; }
      tfoot tr { background-color: #f9fafb !important; }
      .print-accent-orange { background-color: #fff7ed !important; color: #c2410c !important; border: 1px solid #fed7aa !important; }
      .print-accent-purple { background-color: #faf5ff !important; color: #7e22ce !important; border: 1px solid #e9d5ff !important; }
      .summary-dark { background-color: #111827 !important; color: #fff !important; }
      .dn-container { padding: 16px !important; }
      .dn-footer { page-break-before: avoid; break-before: avoid; page-break-inside: avoid; break-inside: avoid; }
    `,
  });

  useEffect(() => {
    if (!debitNote) return;
    if (searchParams.get('print') !== 'true') return;

    const timer = window.setTimeout(() => {
      const html = componentRef.current?.innerHTML
        ?.replace(/max-w-4xl\s+mx-auto/g, 'w-full')
        .replace(/max-w-5xl\s+mx-auto/g, 'w-full')
        .replace(/\smx-auto/g, '') || '';
      setPreviewHtml(html);
      if (html) {
        setShowPrintDialog(true);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [debitNote, searchParams]);

  /* ────────── loading ────────── */
  if (isLoading || !debitNote) {
    return (
      <div className="flex justify-center mt-20">
        <LoaderSpinner />
      </div>
    );
  }

  const isReplaced = debitNote.status === 'replaced' || debitNote.replacementItems.length > 0;
  const hasReturn = debitNote.items.length > 0;
  const statusKey = (debitNote.status ?? '').toLowerCase();
  const statusClass = statusColorMap[statusKey] ?? 'bg-gray-100 text-gray-600';
  const currentPreviewHtml = componentRef.current
    ? componentRef.current.innerHTML
        .replace(/max-w-4xl\s+mx-auto/g, 'w-full')
        .replace(/max-w-5xl\s+mx-auto/g, 'w-full')
        .replace(/\smx-auto/g, '')
    : '';

  const resolvedPreviewHtml = previewHtml || currentPreviewHtml;

  const printPreview = resolvedPreviewHtml ? (
    <div
      className="bg-white"
      dangerouslySetInnerHTML={{ __html: resolvedPreviewHtml }}
    />
  ) : (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Debit Note ID</p>
          <p className="mt-2 text-lg font-bold text-slate-800">{debitNote.debitNoteId || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Supplier</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{debitNote.vendor?.name || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{debitNote.status || '-'}</p>
        </div>
      </div>
    </div>
  );

  /* ─────────── inner item-table component ───────── */
  const ItemTable = ({
    items,
    label,
    icon,
    headClass,
    printClass,
  }: {
    items: DebitNoteItem[];
    label: string;
    icon: React.ReactNode;
    headClass: string;   // Tailwind classes for heading bar
    printClass: string;  // for print override
  }) => {
    const totalQty = items.reduce((s, i) => s + getQty(i), 0);
    const totalDisc = items.reduce((s, i) => s + (Number(i.discount) || 0), 0);
    const totalTax = items.reduce((s, i) => s + (Number(i.tax) || 0), 0);
    const totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return (
      <div className="mb-7">
        {/* heading */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold border ${headClass} ${printClass}`}>
          {icon}
          <span>{label}</span>
          <span className="ml-auto text-xs font-normal opacity-70">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* table */}
        <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="text-left px-4 py-3 font-medium w-7">#</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Rate</th>
                <th className="text-right px-4 py-3 font-medium">Discount</th>
                <th className="text-right px-4 py-3 font-medium">Tax</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const displayName = getItemName(item);
                const displaySubtitle = getItemSubtitle(item);
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950">{displayName}</p>
                      {displaySubtitle && (
                        <p className="text-xs text-gray-400 mt-0.5">{displaySubtitle}</p>
                      )}
                      {item.unit && (
                        <p className="text-xs text-gray-400">Unit: {item.unit}</p>
                      )}
                      {item.taxGroup?.name && (
                        <p className="text-xs text-gray-400">
                          Tax: {item.taxGroup.name} ({item.taxGroup.rate}%)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-950">{getQty(item)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{format(item.rate)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{format(item.discount || 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{format(item.tax || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-950">{format(item.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 text-sm font-semibold">
                <td className="px-4 py-2.5 text-gray-500 text-xs" colSpan={2}>Totals</td>
                <td className="px-4 py-2.5 text-right text-gray-950">{totalQty}</td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right text-gray-700">{format(totalDisc)}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{format(totalTax)}</td>
                <td className="px-4 py-2.5 text-right text-gray-950">{format(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  /* ─────────────────────── render ────────────────────────── */
  return (
    <>
      {/* Top action bar — hidden on print */}
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => setShowPrintDialog(true)}
          className="bg-primary text-white px-4 py-2 rounded-md text-sm flex items-center gap-2"
        >
          <Printer size={14} />
          Print / PDF
        </button>
        <button
          onClick={() => navigate('/admin/debit-notes')}
          className="px-4 py-2 rounded-md text-sm bg-gray-300 hover:bg-gray-400 text-gray-950 border border-gray-200"
        >
          Back
        </button>
      </div>

      <ProfessionalPrintDialog
        isOpen={showPrintDialog}
        onClose={() => {
          setShowPrintDialog(false);
          setPreviewHtml('');
        }}
        onPrint={() => {
          setShowPrintDialog(false);
          setPreviewHtml('');
          window.setTimeout(() => {
            handlePrint();
          }, 80);
        }}
        title="Print Debit Note"
        documentName={debitNote.debitNoteId || 'Debit Note'}
        documentType="Debit Note"
        description="Review the debit note summary before sending it to print."
        preview={printPreview}
        previewWrapperClassName="min-w-full overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm"
        footerNote="The final print layout will use the current debit note print template."
        printButtonLabel="Print Debit Note"
        showCopies={false}
        showPaperSize={false}
        showOrientation={false}
      />

      {/* ═══════════════ Printable area ══════════════════ */}
      <div
        ref={componentRef}
        className="dn-container bg-white border border-gray-200 rounded-xl shadow-sm max-w-5xl mx-auto p-10 text-gray-900 font-sans"
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
            <h1 className="text-2xl font-bold text-gray-950 tracking-tight">Debit Note</h1>
            <p className="text-sm text-gray-400 mt-1">#{debitNote.debitNoteId}</p>
            {debitNote.referenceNo && (
              <p className="text-xs text-gray-400 mt-0.5">Ref: {debitNote.referenceNo}</p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              {hasReturn && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  <RotateCcw size={10} /> Return
                </span>
              )}
              {isReplaced && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  <ArrowLeftRight size={10} /> Replaced
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* ── Meta grid ── */}
        <div className="grid grid-cols-4 gap-4 text-sm mb-5">
          <div>
            <p className="text-gray-500 mb-0.5">Debit Note Date</p>
            <p className="font-medium text-gray-950">{debitNote.debitNoteDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Purchase ID</p>
            <p className="font-medium text-gray-950">{debitNote.purchase?.purchaseId ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Supplier Bill No</p>
            <p className="font-medium text-gray-950">{debitNote.purchase?.supplierBillNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Status</p>
            <span className={`inline-block capitalize text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusClass}`}>
              {debitNote.status ?? '—'}
            </span>
          </div>

          {debitNote.paymentMode && (
            <div>
              <p className="text-gray-500 mb-0.5">Payment Mode</p>
              <p className="font-medium text-gray-950">{debitNote.paymentMode.name}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 mb-0.5">Paid Amount</p>
            <p className="font-medium text-gray-950">{format(debitNote.paidAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Balance</p>
            <p className="font-medium text-gray-950">{format(debitNote.balanceAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Created By</p>
            <p className="font-medium text-gray-950">{debitNote.createdBy?.name ?? '—'}</p>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* ── Vendor ── */}
        {debitNote.vendor && (
          <div className="text-sm mb-6">
            <p className="uppercase text-xs font-semibold text-gray-400 mb-1.5 tracking-wider">
              Supplier / Vendor
            </p>
            <p className="font-semibold text-gray-950 uppercase">{debitNote.vendor.name}</p>
            {debitNote.vendor.address && <p className="text-gray-500">{debitNote.vendor.address}</p>}
            {debitNote.vendor.phone && <p className="text-gray-500">{debitNote.vendor.phone}</p>}
          </div>
        )}

        {/* ── Returned Items ── */}
        {hasReturn && (
          <ItemTable
            items={debitNote.items}
            label="Returned Items"
            icon={<RotateCcw size={14} />}
            headClass="bg-orange-50 text-orange-700 border-orange-200"
            printClass="print-accent-orange"
          />
        )}

        {/* ── Replacement Items ── */}
        {isReplaced && debitNote.replacementItems.length > 0 && (
          <ItemTable
            items={debitNote.replacementItems}
            label="Replacement Items (Received from Supplier)"
            icon={<ArrowLeftRight size={14} />}
            headClass="bg-purple-50 text-purple-700 border-purple-200"
            printClass="print-accent-purple"
          />
        )}

        {/* ── Summary box ── */}
        <div className="flex justify-end mb-6">
          <div className="w-80 border border-gray-200 rounded-lg overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Return Amount</span>
              <span className="font-medium text-gray-950">{format(debitNote.totalAmount)}</span>
            </div>
            {isReplaced && (
              <>
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-gray-500">Replacement Amount</span>
                  <span className="font-medium text-gray-950">{format(debitNote.replacementAmount)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-gray-500">Net Adjustment</span>
                  <span className={`font-semibold ${debitNote.netAdjustment >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {debitNote.netAdjustment >= 0 ? '+' : ''}{format(debitNote.netAdjustment)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-100 text-xs text-gray-400">
                  <span>Adjustment Type</span>
                  <span className="capitalize">{debitNote.adjustmentType.replace(/_/g, ' ')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Paid</span>
              <span className="font-medium text-gray-950">{format(debitNote.paidAmount)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-gray-950 text-white summary-dark">
              <span className="font-semibold">Balance</span>
              <span className="font-bold text-base">{format(debitNote.balanceAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Amount in Words ── */}

        {/* ── Notes ── */}
        {debitNote.notes && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-semibold text-gray-950 mb-1">Notes</p>
            <p className="text-gray-500 leading-relaxed">{debitNote.notes}</p>
          </div>
        )}

        {/* ── Terms & Conditions ── */}
        {debitNote.termsAndCondition && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-semibold text-gray-950 mb-1">Terms &amp; Conditions</p>
            <p className="text-gray-500 leading-relaxed">{debitNote.termsAndCondition}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="dn-footer border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Generated electronically • No signature required</span>
          <span>{systemSettings?.company?.companyName}</span>
        </div>
      </div>
    </>
  );
};

export default OverviewDebitNote;
