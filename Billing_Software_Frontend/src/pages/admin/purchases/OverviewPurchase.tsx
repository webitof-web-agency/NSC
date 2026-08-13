import { numberToWords } from '@utils/converters';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from '@constants/api';
import axios from 'axios';
import type { PurchaseShape } from '@models/purchase';
import useDateFormatter from '@hooks/useDateFormatter';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import ProfessionalPrintDialog from '@components/admin/ProfessionalPrintDialog';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

type StateLike =
  | string
  | {
    name?: string | null;
    state?: string | null;
    state_name?: string | null;
    id?: string | number | null;
    _id?: string | number | null;
  }
  | null
  | undefined;

type SystemSettingsLike = {
  company?: {
    stateDetails?: StateLike;
    stateName?: StateLike;
    locationDetails?: {
      state?: StateLike;
    };
    state?: StateLike;
  };
  locationDetails?: {
    state?: StateLike;
  };
};

const getStateValue = (state: StateLike): string => {
  if (!state) return '';
  if (typeof state === 'string') return state;
  return String(state.name || state.state || state.state_name || state.id || state._id || '');
};

const normalizeStateName = (state: StateLike): string => {
  return getStateValue(state)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const getCompanyStateName = (systemSettings: SystemSettingsLike | null | undefined): string => {
  return (
    normalizeStateName(systemSettings?.company?.stateDetails) ||
    normalizeStateName(systemSettings?.company?.stateName) ||
    normalizeStateName(systemSettings?.locationDetails?.state) ||
    normalizeStateName(systemSettings?.company?.locationDetails?.state) ||
    normalizeStateName(systemSettings?.company?.state)
  );
};

const OverviewPurchase: React.FC = () => {
  const { id: purchaseId } = useParams();
  const [searchParams] = useSearchParams();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);

  const [purchaseData, setPurchaseData] = useState<PurchaseShape>();
  const [companyStateName, setCompanyStateName] = useState('');
  const [supplierStateName, setSupplierStateName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const { formatDate } = useDateFormatter();
  const { format } = useCurrencyFormatter();
  const navigate = useNavigate();
  const componentRef = useRef<HTMLDivElement>(null);

  const fetchPurchase = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${Constants.GET_PURCHASE_DETAILS_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchaseData(res.data.data);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (purchaseId) fetchPurchase(purchaseId);
  }, [fetchPurchase, purchaseId]);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      const userId = user?.id;
      if (!userId) {
        setCompanyStateName('');
        return;
      }

      try {
        const resolveState = async (state: StateLike) => {
          const rawState = getStateValue(state).trim();
          const normalized = normalizeStateName(rawState);
          if (!normalized) return '';

          if (/^\d+$/.test(rawState)) {
            try {
              const stateRes = await axios.get(`${Constants.FETCH_STATE_URL}/${rawState}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              return normalizeStateName(stateRes.data?.name || stateRes.data?.state || stateRes.data);
            } catch {
              return normalized;
            }
          }

          return normalized;
        };

        const res = await axios.get(`${Constants.FETCH_COMPANY_SETTINGS_URL}/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const company = res.data?.data?.company || res.data?.data || {};
        const resolvedState =
          company?.stateDetails?.name ||
          company?.stateName ||
          company?.locationDetails?.state?.name ||
          company?.locationDetails?.state?.state ||
          company?.state?.name ||
          company?.state ||
          '';
        setCompanyStateName(await resolveState(resolvedState));
      } catch {
        setCompanyStateName('');
      }
    };

    if (token) {
      fetchCompanySettings();
    }
  }, [token, user?.id]);

  useEffect(() => {
    const fetchSupplierState = async () => {
      const purchaseSupplierState = normalizeStateName(purchaseData?.billTo?.state);
      if (purchaseSupplierState) {
        setSupplierStateName(purchaseSupplierState);
        return;
      }

      if (!token || !purchaseData?.billTo?.id) {
        setSupplierStateName('');
        return;
      }

      try {
        const res = await axios.get(`${Constants.GET_SUPPLIER_BY_ID_URL}/${purchaseData.billTo.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSupplierStateName(normalizeStateName(res.data?.data?.state));
      } catch {
        setSupplierStateName('');
      }
    };

    fetchSupplierState();
  }, [token, purchaseData?.billTo?.id, purchaseData?.billTo?.state]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Purchase-${purchaseData?.purchaseId}`,
    pageStyle: `
      @page { margin: 10mm; }
      body { font-family: sans-serif; }
    `
  });

  useEffect(() => {
    if (!purchaseData) return;
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
  }, [purchaseData, searchParams]);

  if (isLoading || !purchaseData) {
    return (
      <div className="flex justify-center mt-20">
        <LoaderSpinner />
      </div>
    );
  }

  const totalQty = purchaseData.items.reduce((sum, i) => sum + i.qty, 0);
  const itemDiscountTotal = purchaseData.items.reduce(
    (sum, i) => sum + (Number(i.discount) || 0),
    0
  );

  const statusClasses: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    partial: 'bg-blue-100 text-blue-700',
  };
  const statusClass = statusClasses[purchaseData.status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  const effectiveCompanyStateName = companyStateName || getCompanyStateName(systemSettings);
  const shouldShowIgst = Boolean(
    purchaseData.taxSummaryMode === 'IGST' ||
    (
      effectiveCompanyStateName &&
      supplierStateName &&
      effectiveCompanyStateName !== supplierStateName
    )
  );
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Purchase ID</p>
          <p className="mt-2 text-lg font-bold text-slate-800">{purchaseData.purchaseId || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Supplier</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{purchaseData.billTo?.supplier_name || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{purchaseData.status || '-'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Top Actions */}
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => setShowPrintDialog(true)}
          className="bg-primary text-white px-4 py-2 rounded-md text-sm flex items-center gap-2"
        >
          <Printer size={14} />
          Print / PDF
        </button>
        <button
          onClick={() => navigate('/admin/purchases')}
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
        title="Print Purchase"
        documentName={purchaseData.purchaseId || 'Purchase'}
        documentType="Purchase Bill"
        description="Review the purchase summary before sending it to print."
        preview={printPreview}
        previewWrapperClassName="min-w-full overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm"
        footerNote="The final print layout will use the current purchase print template."
        printButtonLabel="Print Purchase"
        showCopies={false}
        showPaperSize={false}
        showOrientation={false}
      />

      {/* Invoice Container */}
      <div
        ref={componentRef}
        className="bg-white border border-gray-200 rounded-xl shadow-sm max-w-4xl mx-auto p-10 text-gray-900 font-sans"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <img
              src={
                resolveAssetUrl(systemSettings?.company?.siteLogo) ||
                resolveAssetUrl(systemSettings?.company?.favicon) ||
                logoImage
              }
              alt="Company Logo"
              className="w-32 h-auto mb-3"
            />
            <p className="font-semibold text-base text-gray-950">
              {systemSettings?.company.companyName}
            </p>
            <p className="text-sm text-gray-500">{systemSettings?.company.address}</p>
            <p className="text-sm text-gray-500">{systemSettings?.company.phone}</p>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-950 tracking-tight">
              Purchase Invoice
            </h1>
            <p className="text-sm text-gray-400 mt-1">#{purchaseData.purchaseId}</p>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* Meta */}
        <div className="grid grid-cols-4 gap-4 text-sm mb-5">
          <div>
            <p className="text-gray-500 mb-0.5">Invoice Date</p>
            <p className="font-medium text-gray-950">
              {formatDate(
                purchaseData.purchaseDate,
                systemSettings?.dateFormat?.format ?? 'dd-MM-yyyy'
              )}
            </p>
          </div>

          <div>
            <p className="text-gray-500 mb-0.5">Supplier Bill No</p>
            <p className="font-medium text-gray-950">
              {purchaseData.supplier_bill_number || '-'}
            </p>
          </div>

          <div>
            <p className="text-gray-500 mb-0.5">Status</p>
            <span className={`inline-block text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full ${statusClass}`}>
              {purchaseData.status}
            </span>
          </div>

          <div>
            <p className="text-gray-500 mb-0.5">Total Amount</p>
            <p className="font-bold text-lg text-gray-950">
              {format(purchaseData.totalAmount)}
            </p>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-5" />

        {/* Supplier */}
        <div className="text-sm mb-6">
          <p className="uppercase text-xs font-semibold text-gray-400 mb-1.5 tracking-wider">
            Supplier
          </p>
          <p className="font-semibold text-gray-950 uppercase">
            {purchaseData.billTo?.name || purchaseData.supplierName || 'Unknown Supplier'}
          </p>
          {(purchaseData.billTo?.companyAddress || purchaseData.billTo?.pinCode) && (
            <p className="text-gray-500">
              {purchaseData.billTo?.companyAddress || '-'}
              {purchaseData.billTo?.pinCode ? ` | ${purchaseData.billTo.pinCode}` : ''}
            </p>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Unit</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Rate</th>
                <th className="text-right px-4 py-3 font-medium">Discount</th>
                <th className="text-right px-4 py-3 font-medium">
                  {purchaseData.taxType === "GST" && purchaseData.gstType === "Inclusive" ? "Inc. Tax" : "Tax"}
                </th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchaseData.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-950">
                      {item.name}{item.hsn_code ? ` (${item.hsn_code})` : ''}
                    </p>
                    {item.variantName && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.variantName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.unit || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-950 font-medium">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{format(item.rate)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{format(item.discount || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{format(item.tax || 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-950">
                    {format(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 border border-gray-200 rounded-lg overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Total Quantity</span>
              <span className="font-medium text-gray-950">{totalQty}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Item Discount</span>
              <span className="font-medium text-gray-950">{format(itemDiscountTotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-gray-500">Overall Discount</span>
              <span className="font-medium text-gray-950">{format(purchaseData.overall_discount || 0)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-gray-950 text-white">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-base">{format(purchaseData.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">HSN/SAC Tax Summary</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left px-4 py-2.5 font-medium">HSN/SAC</th>
                <th className="text-center px-4 py-2.5 font-medium">GST%</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                {shouldShowIgst ? (
                  <th className="text-right px-4 py-2.5 font-medium">IGST</th>
                ) : (
                  <>
                    <th className="text-right px-4 py-2.5 font-medium">CGST</th>
                    <th className="text-right px-4 py-2.5 font-medium">SGST</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const isInclusive =
                  purchaseData.taxType === "GST" && purchaseData.gstType === "Inclusive";
                const taxGroups = new Map<string, { hsn: string; taxRate: number; taxableAmount: number; taxAmount: number }>();

                purchaseData.items
                  .filter((item) => !!item?.name && item.name.trim() !== "")
                  .forEach((item) => {
                    const hsnCode = item.hsn_code || "N/A";
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const discount = Number(item.discount) || 0;
                    const taxAmount = Number(item.tax) || 0;

                    const saleAmount = Math.max(qty * rate, 0);
                    const baseBeforeTax = Math.max(saleAmount - discount, 0);
                    const taxableValue = isInclusive
                      ? Math.max(baseBeforeTax - taxAmount, 0)
                      : baseBeforeTax;

                    let taxRate = 0;
                    if (taxableValue > 0 && taxAmount > 0) {
                      taxRate = Number(((taxAmount / taxableValue) * 100).toFixed(2));
                    }

                    const key = `${hsnCode}-${taxRate}`;
                    if (!taxGroups.has(key)) {
                      taxGroups.set(key, { hsn: hsnCode, taxRate, taxableAmount: 0, taxAmount: 0 });
                    }

                    const group = taxGroups.get(key)!;
                    group.taxableAmount += saleAmount;
                    group.taxAmount += taxAmount;
                  });

                const rows = Array.from(taxGroups.values());
                if (rows.length === 0) {
                  return (
                    <tr>
                      <td className="px-4 py-4 text-center text-gray-400 text-sm" colSpan={shouldShowIgst ? 4 : 5}>
                        No tax data
                      </td>
                    </tr>
                  );
                }

                return rows.map((group, index) => {
                  const cgstAmount = (group.taxAmount / 2).toFixed(2);
                  const sgstAmount = (group.taxAmount / 2).toFixed(2);
                  return (
                    <tr key={index}>
                      <td className="px-4 py-2.5 text-gray-950 font-medium">{group.hsn}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{group.taxRate}%</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{group.taxableAmount.toFixed(2)}</td>
                      {shouldShowIgst ? (
                        <td className="px-4 py-2.5 text-right text-gray-600">{group.taxAmount.toFixed(2)}</td>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 text-right text-gray-600">{cgstAmount}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{sgstAmount}</td>
                        </>
                      )}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <p className="text-sm text-gray-600 mb-4">
          <span className="font-semibold text-gray-950">Amount in Words: </span>
          {numberToWords(purchaseData.totalAmount)}
        </p>

        {/* Terms & Conditions */}
        {purchaseData.termsAndCondition && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-semibold text-gray-950 mb-1">Terms &amp; Conditions</p>
            <p className="text-gray-500 leading-relaxed">{purchaseData.termsAndCondition}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Generated electronically • No signature required</span>
          <span>{systemSettings?.company.companyName}</span>
        </div>
      </div>
    </>
  );
};

export default OverviewPurchase;
