import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Printer, FileText, X, Copy, RotateCw, Minus, Plus,
    AlignCenter, AlignLeft, Monitor, CheckCircle2, Loader2,
    Settings2, Eye, MessageCircle
} from 'lucide-react';

export type ProfessionalPrintPaperSize = 'A4' | 'A5' | 'Thermal-80mm' | 'Thermal-58mm' | 'Custom';
export type ProfessionalPrintOrientation = 'portrait' | 'landscape';

export interface ProfessionalPrintDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: () => void;
    onWhatsApp?: () => void;
    onPrintAndWhatsApp?: () => void;
    isWhatsAppLoading?: boolean;
    title?: string;
    documentName?: string;
    documentType?: string;
    description?: string;
    isPrinting?: boolean;
    copies?: number;
    onCopiesChange?: (value: number) => void;
    paperSize?: ProfessionalPrintPaperSize;
    onPaperSizeChange?: (value: ProfessionalPrintPaperSize) => void;
    orientation?: ProfessionalPrintOrientation;
    onOrientationChange?: (value: ProfessionalPrintOrientation) => void;
    showCopies?: boolean;
    showPaperSize?: boolean;
    showOrientation?: boolean;
    preview?: React.ReactNode;
    previewWrapperClassName?: string;
    footerNote?: string;
    printButtonLabel?: string;
}

/* ── Paper Size Config with visual shapes ── */
const paperSizeConfig: Record<ProfessionalPrintPaperSize, { label: string; sub: string; w: number; h: number }> = {
    'A4':          { label: 'A4',          sub: '210 × 297 mm',  w: 21, h: 29 },
    'A5':          { label: 'A5',          sub: '148 × 210 mm',  w: 17, h: 24 },
    'Thermal-80mm':{ label: 'Thermal 80',  sub: '80 × 297 mm',   w: 10, h: 29 },
    'Thermal-58mm':{ label: 'Thermal 58',  sub: '58 × 297 mm',   w: 8,  h: 29 },
    'Custom':      { label: 'Custom',      sub: 'User-defined',  w: 20, h: 22 },
};

/* ── Paper Shape Preview ── */
const PaperShape: React.FC<{ size: ProfessionalPrintPaperSize; orientation: ProfessionalPrintOrientation; active: boolean }> = ({
    size, orientation, active
}) => {
    const cfg = paperSizeConfig[size];
    const isLandscape = orientation === 'landscape';
    const w = isLandscape ? cfg.h : cfg.w;
    const h = isLandscape ? cfg.w : cfg.h;
    const scale = 22 / Math.max(w, h);

    return (
        <div
            className="flex items-center justify-center"
            style={{ width: 28, height: 28 }}
        >
            <div
                className={`rounded-[2px] border-2 transition-all duration-200 ${active ? 'border-primary bg-primary/10' : 'border-gray-300 bg-gray-100'}`}
                style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
            />
        </div>
    );
};

/* ── Section Label ── */
const SectionLabel: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 mb-3">
        <span className="text-primary/80">{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500">{label}</p>
    </div>
);

/* ── Divider ── */
const Divider = () => <div className="h-px w-full bg-gray-100 my-4" />;

/* ══════════════════════════════════════════
   Main Component
══════════════════════════════════════════ */
const ProfessionalPrintDialog: React.FC<ProfessionalPrintDialogProps> = ({
    isOpen,
    onClose,
    onPrint,
    onWhatsApp,
    onPrintAndWhatsApp,
    isWhatsAppLoading = false,
    title = 'Print Document',
    documentName = 'Ready to print',
    documentType = 'Document',
    description = 'Review settings before printing.',
    isPrinting = false,
    copies = 1,
    onCopiesChange,
    paperSize = 'A4',
    onPaperSizeChange,
    orientation = 'portrait',
    onOrientationChange,
    showCopies = true,
    showPaperSize = true,
    showOrientation = true,
    preview,
    previewWrapperClassName,
    footerNote = 'Final output depends on your selected printer and paper tray settings.',
    printButtonLabel = 'Print Now',
}) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('preview');

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handleEscape); };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const safeCopies = Number.isFinite(copies) && copies > 0 ? Math.floor(copies) : 1;

    const paperSizeList = Object.keys(paperSizeConfig) as ProfessionalPrintPaperSize[];

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[11000] bg-gray-950/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog shell */}
            <div className="fixed inset-0 z-[11010] flex items-center justify-center p-3 sm:p-6">
                <div
                    className="flex h-[94vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* ── Header Bar ── */}
                    <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-gray-950 px-5 py-3.5">
                        <div className="flex items-center gap-3">
                            {/* Traffic-light dots */}
                            <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors flex-shrink-0" aria-label="Close" />
                            <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />

                            <div className="w-px h-4 bg-gray-700 mx-1" />

                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                                    <Printer className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white leading-none">{title}</h2>
                                    <p className="text-[11px] text-gray-400 mt-0.5 leading-none">{description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Mobile tabs */}
                        <div className="flex items-center gap-1 lg:hidden">
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Settings2 className="w-3.5 h-3.5" /> Settings
                            </button>
                            <button
                                onClick={() => setActiveTab('preview')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'preview' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Eye className="w-3.5 h-3.5" /> Preview
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
                            aria-label="Close print dialog"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex min-h-0 flex-1 overflow-hidden">

                        {/* ── Left Panel: Settings ── */}
                        <div className={`${activeTab === 'settings' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[300px] flex-shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50`}>

                            {/* Document card */}
                            <div className="p-4 border-b border-gray-200 bg-white">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 leading-none mb-1">{documentType}</p>
                                        <p className="text-sm font-semibold text-gray-800 truncate">{documentName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Settings body */}
                            <div className="flex-1 p-4 space-y-1">

                                {/* Copies */}
                                {showCopies && (
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <SectionLabel icon={<Copy className="w-3.5 h-3.5" />} label="Number of Copies" />
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => onCopiesChange?.(Math.max(1, safeCopies - 1))}
                                                className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition font-bold disabled:opacity-40"
                                                disabled={safeCopies <= 1}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                value={safeCopies}
                                                onChange={(e) => onCopiesChange?.(Math.max(1, Number(e.target.value) || 1))}
                                                className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-center text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => onCopiesChange?.(safeCopies + 1)}
                                                className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition font-bold"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {safeCopies > 1 && (
                                            <p className="mt-2 text-[11px] text-gray-400 text-center">{safeCopies} copies will be printed</p>
                                        )}
                                    </div>
                                )}

                                {/* Paper Size */}
                                {showPaperSize && (
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <SectionLabel icon={<Monitor className="w-3.5 h-3.5" />} label="Paper Size" />
                                        <div className="space-y-2">
                                            {paperSizeList.map((option) => {
                                                const cfg = paperSizeConfig[option];
                                                const isActive = paperSize === option;
                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => onPaperSizeChange?.(option)}
                                                        className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${isActive
                                                            ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <PaperShape size={option} orientation={orientation} active={isActive} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-semibold leading-none ${isActive ? 'text-primary' : 'text-gray-800'}`}>
                                                                {cfg.label}
                                                            </p>
                                                            <p className="text-[11px] text-gray-400 mt-0.5">{cfg.sub}</p>
                                                        </div>
                                                        {isActive && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Orientation */}
                                {showOrientation && (
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <SectionLabel icon={<RotateCw className="w-3.5 h-3.5" />} label="Orientation" />
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['portrait', 'landscape'] as ProfessionalPrintOrientation[]).map((option) => {
                                                const isActive = orientation === option;
                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => onOrientationChange?.(option)}
                                                        className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-3 transition-all ${isActive
                                                            ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {option === 'portrait' ? (
                                                            <AlignCenter className={`w-8 h-8 ${isActive ? 'text-primary' : 'text-gray-300'}`} />
                                                        ) : (
                                                            <AlignLeft className={`w-8 h-8 rotate-90 ${isActive ? 'text-primary' : 'text-gray-300'}`} />
                                                        )}
                                                        <span className={`text-xs font-semibold capitalize ${isActive ? 'text-primary' : 'text-gray-600'}`}>
                                                            {option}
                                                        </span>
                                                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Settings footer summary */}
                            <div className="p-4 border-t border-gray-200 bg-white">
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                                        <FileText className="w-3 h-3" /> {paperSizeConfig[paperSize].label}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 capitalize">
                                        <RotateCw className="w-3 h-3" /> {orientation}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                                        <Copy className="w-3 h-3" /> {safeCopies} cop{safeCopies === 1 ? 'y' : 'ies'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Right Panel: Preview ── */}
                        <div className={`${activeTab === 'preview' ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 flex-col bg-gray-100`}>

                            {/* Preview header */}
                            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-3">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-gray-400" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Print Preview</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[11px] font-medium text-gray-400">Ready to print</span>
                                </div>
                            </div>

                            {/* Preview body */}
                            <div className="flex-1 min-h-0 overflow-auto p-6">
                                {preview ? (
                                    <div className="flex min-h-full items-start justify-center">
                                        <div className={previewWrapperClassName ?? 'w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden'}>
                                            {preview}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white/60 text-center p-8">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                                            <Printer className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-500">No preview available</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-xs">Connect a preview component to see the document before printing.</p>
                                    </div>
                                )}
                            </div>

                            {/* ── Footer / Action Bar ── */}
                            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-3.5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-[11px] text-gray-400 max-w-md leading-relaxed">
                                        <span className="font-medium text-gray-600">Note: </span>{footerNote}
                                    </p>
                                    <div className="flex items-center gap-2.5 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition"
                                        >
                                            Cancel
                                        </button>
                                        
                                        {onWhatsApp && (
                                            <button
                                                type="button"
                                                onClick={onWhatsApp}
                                                disabled={isWhatsAppLoading || isPrinting}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#25D366] bg-white text-sm font-semibold text-[#25D366] hover:bg-[#25D366]/10 disabled:cursor-not-allowed disabled:opacity-60 transition"
                                            >
                                                {isWhatsAppLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                                                WhatsApp Only
                                            </button>
                                        )}

                                        {onPrintAndWhatsApp && (
                                            <button
                                                type="button"
                                                onClick={onPrintAndWhatsApp}
                                                disabled={isWhatsAppLoading || isPrinting}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-sm font-bold text-white shadow-sm shadow-[#25D366]/25 hover:bg-[#25D366]/90 disabled:cursor-not-allowed disabled:opacity-60 transition"
                                            >
                                                {isWhatsAppLoading || isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                                Print + WhatsApp
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={onPrint}
                                            disabled={isPrinting || isWhatsAppLoading}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-sm font-bold text-white shadow-sm shadow-primary/25 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition"
                                        >
                                            {isPrinting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Preparing…
                                                </>
                                            ) : (
                                                <>
                                                    <Printer className="w-4 h-4" />
                                                    {printButtonLabel}
                                                    {safeCopies > 1 && (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                                                            ×{safeCopies}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default ProfessionalPrintDialog;
