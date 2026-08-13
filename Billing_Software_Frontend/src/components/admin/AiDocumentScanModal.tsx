import { useMemo, useState, useRef } from "react";
import axios from "axios";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Sparkles, UploadCloud, ScanLine, FileText, CheckCircle, Info, ChevronRight, FileSearch } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import Modal from "@components/admin/Modal";
import Constants from "@constants/api";
import type { RootState } from "@store/index";

type DocumentType = "purchase" | "invoice" | "quotation";

type AiDocumentScanModalProps = {
    isOpen: boolean;
    onClose: () => void;
    type: DocumentType;
    onApply: (payload: any) => void;
};

const endpointMap: Record<DocumentType, string> = {
    purchase: Constants.AI_EXTRACT_PURCHASE_BILL_URL,
    invoice: Constants.AI_EXTRACT_INVOICE_URL,
    quotation: Constants.AI_EXTRACT_QUOTATION_URL,
};

const titleMap: Record<DocumentType, string> = {
    purchase: "AI Purchase Bill Scanner",
    invoice: "AI Invoice Scanner",
    quotation: "AI Quotation Scanner",
};

const AiDocumentScanModal: React.FC<AiDocumentScanModalProps> = ({
    isOpen,
    onClose,
    type,
    onApply,
}) => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const acceptedTypes = useMemo(() => ".jpg,.jpeg,.png,.webp,.pdf", []);

    const resetState = () => {
        setFile(null);
        setLoading(false);
        setResult(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleExtract = async () => {
        if (!file) {
            toast.error("Please choose an image or PDF file first.");
            return;
        }

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append("file", file);

            const response = await axios.post(endpointMap[type], formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            setResult(response.data?.data || null);
            toast.success("Document scanned successfully! 🎉");
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.response?.data?.errors?.[0] ||
                "Failed to scan document";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const warnings = result?.warnings || [];
    const reviewSummary = result?.reviewSummary || {};
    const extractedItemsCount = reviewSummary?.extractedItems || result?.extracted?.items?.length || 0;
    const matchedItemsCount = reviewSummary?.matchedItems || result?.matches?.items?.filter((item: any) => item?.matched)?.length || 0;
    const unmatchedItemsCount = reviewSummary?.unmatchedItems || Math.max(extractedItemsCount - matchedItemsCount, 0);

    const canApply = !!result && matchedItemsCount > 0;
    const applyBlockReason = !canApply
        ? "No scanned items could be matched to existing products."
        : "";

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={titleMap[type]} size="3xl">
            <div className="p-1 max-h-[80vh] overflow-y-auto custom-scrollbar">

                {/* AI Header / Upload Section */}
                {!result && (
                    <div className="p-6">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Upload {type === 'purchase' ? 'Purchase Bill' : type === 'invoice' ? 'Invoice' : 'Quotation'}</h3>
                            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                                Let our AI instantly extract details and items from your document.
                            </p>
                        </div>

                        <div
                            className={`relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl transition-all duration-300 ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={acceptedTypes}
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />

                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 ${file ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                {file ? <FileText className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
                            </div>

                            {file ? (
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">{file.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:text-red-700 font-medium mt-3">Remove File</button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-700">
                                        Drag & drop your file here, or{" "}
                                        <button onClick={() => fileInputRef.current?.click()} className="text-primary font-semibold hover:underline">browse</button>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG, WEBP, PDF up to 10MB</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                type="button"
                                onClick={handleExtract}
                                disabled={!file || loading}
                                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Analyzing Document...
                                    </>
                                ) : (
                                    <>
                                        <ScanLine className="h-4 w-4" />
                                        Extract Data
                                    </>
                                )}
                            </button>
                        </div>
                        {!canApply && applyBlockReason && (
                            <p className="mt-3 text-xs font-medium text-amber-600 text-right">
                                {applyBlockReason}
                            </p>
                        )}
                    </div>
                )}

                {/* AI Result Section */}
                {result && (
                    <div className="p-6 space-y-6 bg-gray-50/50">
                        {/* Status Banner */}
                        {warnings.length === 0 ? (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Perfect Match!</h4>
                                        <p className="text-emerald-100 text-xs">All items and details were successfully verified.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        onApply(result);
                                        handleClose();
                                    }}
                                    className="px-4 py-2 bg-white text-teal-600 text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-shadow"
                                >
                                    Apply Data
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">Attention Required</h4>
                                    <p className="text-amber-100 text-xs mt-0.5 mb-3">Some items could not be perfectly matched. You can still apply the matched items and skip the unmatched ones.</p>
                                    <div className="bg-black/10 rounded-xl p-3 backdrop-blur-sm">
                                        <ul className="space-y-1.5 list-none">
                                            {warnings.map((warning: string, index: number) => (
                                                <li key={index} className="flex items-start gap-2 text-[11px] font-medium leading-relaxed">
                                                    <span className="mt-1 w-1 h-1 rounded-full bg-white/70 flex-shrink-0" />
                                                    {warning}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                    <FileSearch className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Document</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900 capitalize">{result.documentType}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                    <ScanLine className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Extracted</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-gray-900">{extractedItemsCount}</p>
                                    <p className="text-xs text-gray-500 font-medium">items</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Matched</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-emerald-600">{matchedItemsCount}</p>
                                    <p className="text-xs text-emerald-500/70 font-medium">items</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-amber-500 mb-2">
                                    <Info className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Review</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-amber-600">{unmatchedItemsCount}</p>
                                    <p className="text-xs text-amber-500/70 font-medium">items</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* General Info Preview */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-fit">
                                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                                    <h4 className="text-sm font-bold text-gray-800">General Information</h4>
                                </div>
                                <div className="p-5">
                                    <dl className="space-y-4">
                                        {"supplierName" in (result.extracted || {}) && (
                                            <div>
                                                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Supplier</dt>
                                                <dd className="mt-1 text-sm font-semibold text-gray-900">
                                                    {result.extracted?.supplierName || result.matches?.supplier?.name || "N/A"}
                                                </dd>
                                                <dd className="mt-1 text-xs text-gray-500">
                                                    {result.extracted?.supplierPhone || result.matches?.supplier?.phone || "N/A"}
                                                </dd>
                                            </div>
                                        )}
                                        {"customerName" in (result.extracted || {}) && (
                                            <div>
                                                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer</dt>
                                                <dd className="mt-1 text-sm font-semibold text-gray-900">
                                                    {result.extracted?.customerPhone || result.matches?.customer?.phone || "N/A"}
                                                </dd>
                                                <dd className="mt-1 text-xs text-gray-500">
                                                    {result.extracted?.customerName || result.matches?.customer?.name || "N/A"}
                                                </dd>
                                            </div>
                                        )}
                                        {("purchaseDate" in (result.extracted || {}) || "invoiceDate" in (result.extracted || {}) || "quotationDate" in (result.extracted || {})) && (
                                            <div>
                                                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Document Date</dt>
                                                <dd className="mt-1 text-sm font-semibold text-gray-900">
                                                    {result.extracted?.purchaseDate || result.extracted?.invoiceDate || result.extracted?.quotationDate || "—"}
                                                </dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Grand Total</dt>
                                            <dd className="mt-1 text-lg font-black text-gray-900">₹{result.extracted?.totals?.grandTotal || "0.00"}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            {/* Line Items Review */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                                    <h4 className="text-sm font-bold text-gray-800">Item Match Review</h4>
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                                        {result.matches?.items?.length || 0} Items
                                    </span>
                                </div>
                                <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2 bg-gray-50/30">
                                    {(result.matches?.items || []).map((item: any, index: number) => (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-xl border transition-all ${item?.matched ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-gray-400">ITEM {index + 1}</span>
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${item?.matched ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {item?.matched ? 'Matched' : 'Unmatched'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-900 truncate" title={item?.source?.description || item?.source?.designNumber || "Unnamed item"}>
                                                        {item?.source?.description || item?.source?.designNumber || "Unnamed item"}
                                                    </p>
                                                    <div className="mt-2 flex items-start gap-1.5">
                                                        <ChevronRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${item?.matched ? 'text-green-500' : 'text-gray-300'}`} />
                                                        <p className={`text-[11px] ${item?.matched ? 'text-green-800 font-medium' : 'text-gray-400 italic'}`}>
                                                            {item?.matched
                                                                ? `${item?.product?.brand?.brand_name || ""} ${item?.variant?.designNo || ""} ${item?.variant?.size || ""}`.trim()
                                                                : "No matching product variant found in database"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {item?.matchMeta?.matchedBy?.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap gap-1">
                                                    <span className="text-[9px] font-medium text-gray-400 uppercase mr-1">Matched By:</span>
                                                    {item.matchMeta.matchedBy.map((criteria: string, idx: number) => (
                                                        <span key={idx} className="px-1.5 py-0.5 rounded bg-black/5 text-[9px] font-semibold text-gray-600">
                                                            {criteria}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!result.matches?.items || result.matches?.items?.length === 0) && (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                                            <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                            <p className="text-sm font-medium text-gray-600">No items extracted</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={resetState}
                                className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors px-4 py-2"
                            >
                                Scan Another File
                            </button>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="rounded-xl bg-white border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onApply(result);
                                        handleClose();
                                    }}
                                    disabled={!canApply}
                                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-md disabled:pointer-events-none disabled:opacity-50 flex items-center gap-2"
                                >
                                    {canApply ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    {canApply ? (unmatchedItemsCount > 0 ? "Apply Matched Items" : "Apply Data to Form") : "No Matched Items to Apply"}
                                </button>
                            </div>
                        </div>
                        {!canApply && applyBlockReason && (
                            <p className="mt-3 text-xs font-medium text-amber-600 text-right">
                                {applyBlockReason}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AiDocumentScanModal;
