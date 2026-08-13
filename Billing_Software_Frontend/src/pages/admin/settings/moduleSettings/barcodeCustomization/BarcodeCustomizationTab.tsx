import React, { useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { toast } from "react-toastify";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";

const SCREEN_DPI = 96;
const MM_PER_INCH = 25.4;
const PRINTER_DPI = 203; // TVS LP 46 NEO / TSC TTP-244 Pro
const BARCODE_SCALE = 2;

/** Convert millimetres → pixels at a given DPI */
const mmToPx = (mm: number, dpi: number) => (mm * dpi) / MM_PER_INCH;

interface BarcodeSettings {
    widthMm: number;        // barcode bar-module width in mm
    heightMm: number;       // barcode bar height in mm
    labelWidthMm: number;   // physical sticker width in mm
    labelHeightMm: number;  // physical sticker height in mm
    safeMarginMm?: number;
    format: string;
    showBarcodeNumber: boolean;
    showPrice: boolean;      // MRP
    showSalePrice: boolean;  // Sale price
    showBrand: boolean;
    showVariantSize: boolean;
    showProductName: boolean;
    fontProductMm?: number;
    fontBrandMm?: number;
    fontSizeMm?: number;
    fontBarcodeMm?: number;
    fontPriceMm?: number;
    fontSalePriceMm?: number;
    weightProduct?: number;
    weightBrand?: number;
    weightSize?: number;
    weightBarcode?: number;
    weightPrice?: number;
    weightSalePrice?: number;
}

const formatOptions = [
    { value: "CODE128", label: "CODE128 (Standard)" },
    { value: "EAN13", label: "EAN13" },
    { value: "UPC", label: "UPC" },
    { value: "CODE39", label: "CODE39" },
];

/**
 * Label presets — each entry defines:
 *   labelWidthMm / labelHeightMm : physical sticker roll dimensions
 *   widthMm  : recommended barcode bar-module width for that label
 *   heightMm : recommended barcode bar height that fits inside the label
 */
const labelPresets = [
    { label: "30 × 20 mm", labelWidthMm: 30, labelHeightMm: 20, heightMm: 9, widthMm: 0.30 },
    { label: "48 × 23 mm", labelWidthMm: 48, labelHeightMm: 23, heightMm: 11, widthMm: 0.35 }, // ← client size
    { label: "50 × 25 mm", labelWidthMm: 50, labelHeightMm: 25, heightMm: 12, widthMm: 0.35 },
    { label: "50 × 30 mm", labelWidthMm: 50, labelHeightMm: 30, heightMm: 15, widthMm: 0.40 },
    { label: "58 × 40 mm", labelWidthMm: 58, labelHeightMm: 40, heightMm: 20, widthMm: 0.50 },
];

const DEFAULT_SETTINGS: BarcodeSettings = {
    widthMm: 0.35,
    heightMm: 11,
    labelWidthMm: 48,
    labelHeightMm: 23,
    safeMarginMm: 2,
    format: "CODE128",
    showBarcodeNumber: true,
    showPrice: true,
    showSalePrice: false,
    showBrand: true,
    showVariantSize: false,
    showProductName: true,
    fontProductMm: undefined,
    fontBrandMm: undefined,
    fontSizeMm: undefined,
    fontBarcodeMm: undefined,
    fontPriceMm: undefined,
    fontSalePriceMm: undefined,
    weightProduct: 800,
    weightBrand: 800,
    weightSize: 800,
    weightBarcode: 700,
    weightPrice: 800,
    weightSalePrice: 800,
};

const BarcodeCustomization = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [settings, setSettings] = useState<BarcodeSettings>(DEFAULT_SETTINGS);
    const [activePreset, setActivePreset] = useState<string | null>("48 × 23 mm");

    const [barcodeImg, setBarcodeImg] = useState<string>("");
    const weightOptions = [400, 500, 600, 700, 800, 900];

    const defaultFontProductMm = Math.min(2.8, settings.labelHeightMm * 0.12);
    const defaultFontBrandMm = Math.min(2.3, settings.labelHeightMm * 0.1);
    const defaultFontSizeMm = Math.min(2.3, settings.labelHeightMm * 0.1);
    const defaultFontBarcodeMm = Math.min(1.3, settings.labelHeightMm * 0.055);
    const defaultFontPriceMm = Math.min(2.4, settings.labelHeightMm * 0.11);

    const baseProductMm = settings.fontProductMm ?? defaultFontProductMm;
    const baseBrandMm = settings.fontBrandMm ?? defaultFontBrandMm;
    const baseSizeMm = settings.fontSizeMm ?? defaultFontSizeMm;
    const baseBarcodeMm = settings.fontBarcodeMm ?? defaultFontBarcodeMm;
    const basePriceMm = settings.fontPriceMm ?? defaultFontPriceMm;
    const baseSaleMm = settings.fontSalePriceMm ?? basePriceMm;

    const lineIdentityMm = (settings.showProductName || settings.showBrand)
        ? Math.max(baseProductMm, baseBrandMm) * 1.15
        : 0;
    const lineBarcodeMm = settings.showBarcodeNumber ? baseBarcodeMm * 1.0 : 0;
    const lineMrpMm = settings.showPrice ? basePriceMm * 1.1 : 0;
    const lineSaleMm = settings.showSalePrice ? baseSaleMm * 1.1 : 0;
    const textTotalMm = lineIdentityMm + lineBarcodeMm + lineMrpMm + lineSaleMm;
    const availableBarcodeMm = Math.max(1, (settings.labelHeightMm - (settings.safeMarginMm ?? 2) * 2) - textTotalMm);
    const barcodeMaxHeightMm = Math.min(settings.heightMm, availableBarcodeMm);

    const previewProductStyle = {
        fontSize: `${mmToPx(baseProductMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightProduct ?? 800,
    };
    const previewBrandStyle = {
        fontSize: `${mmToPx(baseBrandMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightBrand ?? 800,
        letterSpacing: "0.08em",
    };
    const previewBarcodeStyle = {
        fontSize: `${mmToPx(baseBarcodeMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightBarcode ?? 700,
    };
    const previewSizeStyle = {
        fontSize: `${mmToPx(baseSizeMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightSize ?? 800,
    };
    const previewPriceStyle = {
        fontSize: `${mmToPx(basePriceMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightPrice ?? 800,
    };
    const previewSaleStyle = {
        fontSize: `${mmToPx(baseSaleMm, SCREEN_DPI)}px`,
        fontWeight: settings.weightSalePrice ?? 800,
    };
    const labelWidthPx = mmToPx(settings.labelWidthMm, SCREEN_DPI);
    const labelHeightPx = mmToPx(settings.labelHeightMm, SCREEN_DPI);
    const safeMarginPx = mmToPx(settings.safeMarginMm ?? 2, SCREEN_DPI);
    const hasPreviewSideLabel = settings.showVariantSize || settings.showBrand;
    const sizeGutterPx = hasPreviewSideLabel ? Math.max(mmToPx(Math.max(baseSizeMm, baseBrandMm) * 2.1, SCREEN_DPI), mmToPx(7, SCREEN_DPI)) : 0;
    const barcodeAreaWidthPx = labelWidthPx - safeMarginPx * 2 - sizeGutterPx;
    const barcodeMaxHeightPx = mmToPx(barcodeMaxHeightMm, SCREEN_DPI);

    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(Constants.GET_BARCODE_SETTINGS_URL, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.data?.data) {
                    const raw = response.data.data;
                    // Backward-compat: migrate old px-based keys
                    const widthMm =
                        raw.widthMm ??
                        (raw.width ? parseFloat((raw.width * MM_PER_INCH / PRINTER_DPI).toFixed(2)) : DEFAULT_SETTINGS.widthMm);
                    const heightMm =
                        raw.heightMm ??
                        (raw.height ? parseFloat((raw.height * MM_PER_INCH / PRINTER_DPI).toFixed(2)) : DEFAULT_SETTINGS.heightMm);
                    const labelWidthMm = raw.labelWidthMm ?? DEFAULT_SETTINGS.labelWidthMm;
                    const labelHeightMm = raw.labelHeightMm ?? DEFAULT_SETTINGS.labelHeightMm;

                    setSettings((prev) => ({ ...prev, ...raw, widthMm, heightMm, labelWidthMm, labelHeightMm }));

                    // Restore active preset badge
                    const matched = labelPresets.find(
                        (p) => p.labelWidthMm === labelWidthMm && p.labelHeightMm === labelHeightMm
                    );
                    setActivePreset(matched?.label ?? null);
                }
            } catch (error) {
                console.error("Failed to load barcode settings", error);
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [token]);

    const generateBarcodeDataUrl = (value: string): string => {
        try {
            const barWidthPx = Math.max(2, Math.round(mmToPx(settings.widthMm, PRINTER_DPI) * BARCODE_SCALE));
            const barHeightPx = Math.round(mmToPx(settings.heightMm, PRINTER_DPI) * BARCODE_SCALE);
            const marginPx = barWidthPx * 4;

            const canvas = document.createElement("canvas");
            canvas.height = barHeightPx + marginPx * 2;

            JsBarcode(canvas, value, {
                format: settings.format,
                displayValue: false,
                width: barWidthPx,
                height: barHeightPx,
                margin: marginPx,
                background: "#ffffff",
                lineColor: "#000000",
            });

            return canvas.toDataURL("image/png");
        } catch (e) {
            console.error("Barcode preview generation error", e);
            return "";
        }
    };

    useEffect(() => {
        setBarcodeImg(generateBarcodeDataUrl("123456789012"));
    }, [settings]);

    const handleChange = (field: keyof BarcodeSettings, value: any) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
        if (["widthMm", "heightMm", "labelWidthMm", "labelHeightMm"].includes(field as string)) {
            setActivePreset(null);
        }
    };

    const applyPreset = (preset: typeof labelPresets[0]) => {
        setActivePreset(preset.label);
        setSettings((prev) => ({
            ...prev,
            labelWidthMm: preset.labelWidthMm,
            labelHeightMm: preset.labelHeightMm,
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(Constants.UPDATE_BARCODE_SETTINGS_URL, settings, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Settings saved successfully!");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoaderSpinner />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                        <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
                        Configuration
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-3">

                        {/* Format Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Barcode Format
                            </label>
                            <CustomSelectDropdown
                                options={formatOptions}
                                value={settings.format}
                                onChange={(value) => handleChange("format", value)}
                                placeholder="Select Format"
                            />
                        </div>

                        {/* Sticker Label Size Presets */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-0.5">
                                Sticker Label Size
                            </label>
                            <p className="text-xs text-gray-400 mb-1">
                                Selecting a preset sets the print page to exactly this sticker size so nothing gets cut off.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {labelPresets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${activePreset === preset.label
                                            ? "bg-primary text-white border-primary shadow-sm"
                                            : "bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary"
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Barcode Bar Dimensions */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bar Width
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0.1"
                                        max="1.5"
                                        step="0.05"
                                        value={settings.widthMm}
                                        onChange={(e) => handleChange("widthMm", parseFloat(e.target.value))}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-medium">mm</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Recommended: 0.3 – 0.5 mm</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Barcode Height
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="5"
                                        max="50"
                                        step="0.5"
                                        value={settings.heightMm}
                                        onChange={(e) => handleChange("heightMm", parseFloat(e.target.value))}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-medium">mm</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Recommended: 8 – 15 mm</p>
                            </div>
                        </div>

                        {/* Safe Print Margin */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Print Safe Margin
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.5"
                                    value={settings.safeMarginMm ?? ""}
                                    onChange={(e) => handleChange("safeMarginMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-medium">mm</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Increase if labels are getting cut at the edges.</p>
                        </div>

                        {/* Visibility Options */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <h3 className="text-sm font-medium text-gray-900 mb-2 uppercase tracking-wider text-xs">Label Visibility</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showBarcodeNumber}
                                        onChange={(e) => handleChange("showBarcodeNumber", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Barcode Number</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showProductName}
                                        onChange={(e) => handleChange("showProductName", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Design no.</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showPrice}
                                        onChange={(e) => handleChange("showPrice", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">MRP Price</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showSalePrice}
                                        onChange={(e) => handleChange("showSalePrice", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Sale Price</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showBrand}
                                        onChange={(e) => handleChange("showBrand", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Brand Name</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={settings.showVariantSize}
                                        onChange={(e) => handleChange("showVariantSize", e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        style={{ accentColor: "var(--color-primary)" }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Variant Size</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <SubmitButton isLoading={submitting} mode="edit" />
                        </div>
                    </form>
                </div>

                <div className="flex flex-col">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex-grow">
                        <h2 className="text-lg font-semibold mb-0.5 text-gray-800 flex items-center gap-2">
                            <span className="w-1 h-5 bg-green-500 rounded-full inline-block"></span>
                            Live Preview
                        </h2>
                        <p className="text-xs text-gray-400 mb-2">
                            Label: <span className="font-medium text-gray-600">{settings.labelWidthMm} × {settings.labelHeightMm} mm</span>
                            &nbsp;·&nbsp; Barcode: <span className="font-medium text-gray-600">{settings.heightMm} mm tall · {settings.widthMm} mm bar</span>
                        </p>

                        <div className="h-[220px] bg-slate-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-4 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-0">
                                <p className="text-slate-400 font-medium tracking-widest text-sm uppercase">Print Preview</p>
                            </div>

                            <div
                                className="bg-white shadow-xl rounded border border-gray-200 inline-flex flex-col items-start relative z-10 transform transition-transform group-hover:scale-105 duration-300"
                                style={{ padding: `${safeMarginPx}px`, gap: "2px", width: `${labelWidthPx}px`, minHeight: `${labelHeightPx}px` }}
                            >
                                {hasPreviewSideLabel && (
                                    <div
                                        className="absolute top-0 bottom-0 right-0 flex items-center justify-center text-gray-900"
                                        style={{
                                            width: `${sizeGutterPx}px`,
                                            writingMode: "vertical-rl",
                                            textOrientation: "mixed",
                                            lineHeight: 1,
                                        }}
                                    >
                                        <div
                                            className="flex flex-col items-center justify-center"
                                            style={{ gap: `${mmToPx(0.8, SCREEN_DPI)}px` }}
                                        >
                                            {settings.showVariantSize && <span style={previewSizeStyle}>XL</span>}
                                            {settings.showBrand && <span className="uppercase" style={previewBrandStyle}>LEVIS</span>}
                                        </div>
                                    </div>
                                )}
                                {settings.showSalePrice && (
                                    <p className="text-gray-900 m-0 leading-tight text-left w-full" style={previewSaleStyle}>NSC PRICE : 999</p>
                                )}
                                <div className="py-0.5 flex justify-start w-full">
                                    {barcodeImg ? (
                                        <img
                                            src={barcodeImg}
                                            alt="barcode"
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: `${barcodeMaxHeightPx}px`,
                                                width: "auto",
                                                height: "auto",
                                                display: "block",
                                            }}
                                        />
                                    ) : null}
                                </div>
                                {settings.showBarcodeNumber && (
                                    <p className="text-gray-700 m-0 leading-tight text-left w-full" style={previewBarcodeStyle}>123456789012</p>
                                )}
                                {settings.showProductName && (
                                    <p className="text-gray-900 m-0 leading-tight text-left w-full whitespace-nowrap overflow-hidden text-ellipsis">
                                        <span style={previewProductStyle}>Design/Article No.</span>
                                    </p>
                                )}
                                {settings.showPrice && (
                                    <p className="text-gray-900 m-0 leading-tight text-left w-full" style={previewPriceStyle}>
                                        MRP : 1,299
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Info Banners */}
                        <div className="mt-2 space-y-2">
                            <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-2h8v2H6zm7-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-semibold">TVS LP 46 NEO · 203 DPI · {settings.format} · High-Res PNG Output</p>
                                    <p className="text-amber-700 mt-0.5">
                                        Barcodes render at 406 DPI (2× printer resolution) for crisp scanning. Label: <strong>{settings.labelWidthMm} × {settings.labelHeightMm} mm</strong> · Bar width: <strong>{settings.widthMm} mm</strong> · Height: <strong>{settings.heightMm} mm</strong>. In your browser print dialog, set paper size to <strong>{settings.labelWidthMm} × {settings.labelHeightMm} mm</strong> and margins to <strong>None</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Typography Controls */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mt-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-0.5 uppercase tracking-wider text-xs">Label Typography</h3>
                        <p className="text-xs text-gray-500 mb-3">Font sizes are in mm and affect actual print size.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Design No. Size</label>
                                <input
                                    type="number"
                                    min="0.8"
                                    max="6"
                                    step="0.1"
                                    value={settings.fontProductMm ?? ""}
                                    onChange={(e) => handleChange("fontProductMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={defaultFontProductMm.toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Design No. Weight</label>
                                <select
                                    value={settings.weightProduct ?? 800}
                                    onChange={(e) => handleChange("weightProduct", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Brand Size</label>
                                <input
                                    type="number"
                                    min="0.8"
                                    max="6"
                                    step="0.1"
                                    value={settings.fontBrandMm ?? ""}
                                    onChange={(e) => handleChange("fontBrandMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={defaultFontBrandMm.toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Brand Weight</label>
                                <select
                                    value={settings.weightBrand ?? 800}
                                    onChange={(e) => handleChange("weightBrand", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Variant Size Label Size</label>
                                <input
                                    type="number"
                                    min="0.8"
                                    max="6"
                                    step="0.1"
                                    value={settings.fontSizeMm ?? ""}
                                    onChange={(e) => handleChange("fontSizeMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={defaultFontSizeMm.toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Variant Size Label Weight</label>
                                <select
                                    value={settings.weightSize ?? 800}
                                    onChange={(e) => handleChange("weightSize", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Barcode No. Size</label>
                                <input
                                    type="number"
                                    min="0.6"
                                    max="4"
                                    step="0.1"
                                    value={settings.fontBarcodeMm ?? ""}
                                    onChange={(e) => handleChange("fontBarcodeMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={defaultFontBarcodeMm.toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Barcode No. Weight</label>
                                <select
                                    value={settings.weightBarcode ?? 700}
                                    onChange={(e) => handleChange("weightBarcode", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">MRP Size</label>
                                <input
                                    type="number"
                                    min="0.8"
                                    max="6"
                                    step="0.1"
                                    value={settings.fontPriceMm ?? ""}
                                    onChange={(e) => handleChange("fontPriceMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={defaultFontPriceMm.toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Only sizes ≤ 4 will print “.00” decimals.
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">MRP Weight</label>
                                <select
                                    value={settings.weightPrice ?? 800}
                                    onChange={(e) => handleChange("weightPrice", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Sale Size</label>
                                <input
                                    type="number"
                                    min="0.8"
                                    max="6"
                                    step="0.1"
                                    value={settings.fontSalePriceMm ?? ""}
                                    onChange={(e) => handleChange("fontSalePriceMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    placeholder={(settings.fontPriceMm ?? defaultFontPriceMm).toFixed(2)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Only sizes ≤ 4 will print “.00” decimals.
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Sale Weight</label>
                                <select
                                    value={settings.weightSalePrice ?? 800}
                                    onChange={(e) => handleChange("weightSalePrice", parseInt(e.target.value, 10))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                >
                                    {weightOptions.map((w) => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
};

export default BarcodeCustomization;
