import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { toast } from "react-toastify";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";

const SCREEN_DPI = 96;
const MM_PER_INCH = 25.4;

const mmToPx = (mm: number, dpi: number) => (mm * dpi) / MM_PER_INCH;

interface QrSettings {
    labelWidthMm: number;
    labelHeightMm: number;
    safeMarginMm?: number;
    qrSizeMm: number;
    showProductName: boolean;
    showBrand: boolean;
    showVariantSize: boolean;
    showVariantColor: boolean;
    fontProductMm?: number;
    fontBrandMm?: number;
    fontSizeMm?: number;
    fontColorMm?: number;
    weightProduct?: number;
    weightBrand?: number;
    weightSize?: number;
    weightColor?: number;
}

const DEFAULT_SETTINGS: QrSettings = {
    labelWidthMm: 50,
    labelHeightMm: 25,
    safeMarginMm: 2,
    qrSizeMm: 15,
    showProductName: true,
    showBrand: true,
    showVariantSize: true,
    showVariantColor: true,
    fontProductMm: undefined,
    fontBrandMm: undefined,
    fontSizeMm: undefined,
    fontColorMm: undefined,
    weightProduct: 800,
    weightBrand: 800,
    weightSize: 800,
    weightColor: 800,
};

const labelPresets = [
    { label: "30 × 20 mm", labelWidthMm: 30, labelHeightMm: 20, qrSizeMm: 12 },
    { label: "48 × 23 mm", labelWidthMm: 48, labelHeightMm: 23, qrSizeMm: 15 },
    { label: "50 × 25 mm", labelWidthMm: 50, labelHeightMm: 25, qrSizeMm: 15 },
    { label: "50 × 30 mm", labelWidthMm: 50, labelHeightMm: 30, qrSizeMm: 18 },
    { label: "58 × 40 mm", labelWidthMm: 58, labelHeightMm: 40, qrSizeMm: 24 },
];

const weightOptions = [400, 500, 600, 700, 800, 900];

const QrCustomization = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [settings, setSettings] = useState<QrSettings>(DEFAULT_SETTINGS);
    const [activePreset, setActivePreset] = useState<string | null>("50 × 25 mm");
    const [qrImg, setQrImg] = useState<string>("");

    const defaultFontProductMm = Math.min(2.8, settings.labelHeightMm * 0.12);
    const defaultFontBrandMm = Math.min(2.3, settings.labelHeightMm * 0.1);
    const defaultFontSizeMm = Math.min(2.3, settings.labelHeightMm * 0.1);
    const defaultFontColorMm = Math.min(2.3, settings.labelHeightMm * 0.1);

    const baseProductMm = settings.fontProductMm ?? defaultFontProductMm;
    const baseBrandMm = settings.fontBrandMm ?? defaultFontBrandMm;
    const baseSizeMm = settings.fontSizeMm ?? defaultFontSizeMm;
    const baseColorMm = settings.fontColorMm ?? defaultFontColorMm;

    const labelWidthPx = mmToPx(settings.labelWidthMm, SCREEN_DPI);
    const labelHeightPx = mmToPx(settings.labelHeightMm, SCREEN_DPI);
    const safeMarginPx = mmToPx(settings.safeMarginMm ?? 2, SCREEN_DPI);
    const qrSizePx = mmToPx(settings.qrSizeMm, SCREEN_DPI);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(Constants.GET_QR_SETTINGS_URL, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.data?.data) {
                    const raw = response.data.data;
                    setSettings((prev) => ({ ...prev, ...raw }));

                    const matched = labelPresets.find(
                        (p) => p.labelWidthMm === raw.labelWidthMm && p.labelHeightMm === raw.labelHeightMm
                    );
                    setActivePreset(matched?.label ?? null);
                }
            } catch (error) {
                console.error("Failed to load QR settings", error);
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [token]);

    const generateQrCode = async () => {
        try {
            const payload = JSON.stringify({
                itemName: "Design/Article No.",
                brand: "Brand Name",
                size: "XL",
                color: "Red",
            }, null, 0);

            const qrDataUrl = await QRCode.toDataURL(payload, {
                errorCorrectionLevel: "M",
                margin: 0,
                width: 256,
            });
            setQrImg(qrDataUrl);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        generateQrCode();
    }, [settings]);

    const handleChange = (field: keyof QrSettings, value: any) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
        if (["labelWidthMm", "labelHeightMm", "qrSizeMm"].includes(field as string)) {
            setActivePreset(null);
        }
    };

    const applyPreset = (preset: typeof labelPresets[0]) => {
        setActivePreset(preset.label);
        setSettings((prev) => ({
            ...prev,
            labelWidthMm: preset.labelWidthMm,
            labelHeightMm: preset.labelHeightMm,
            qrSizeMm: preset.qrSizeMm,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(Constants.UPDATE_QR_SETTINGS_URL, settings, {
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
            <div className="flex h-48 items-center justify-center">
                <LoaderSpinner />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
                    QR Configuration
                </h2>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-0.5">
                            Sticker Label Size
                        </label>
                        <p className="text-xs text-gray-400 mb-1">
                            Selecting a preset sets the print page to exactly this sticker size.
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                QR Size
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="5"
                                    max="50"
                                    step="0.5"
                                    value={settings.qrSizeMm}
                                    onChange={(e) => handleChange("qrSizeMm", parseFloat(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-medium">mm</span>
                            </div>
                        </div>
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
                        </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900 mb-2 uppercase tracking-wider text-xs">Label Visibility</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.showProductName}
                                    onChange={(e) => handleChange("showProductName", e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Design no.</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.showBrand}
                                    onChange={(e) => handleChange("showBrand", e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Brand Name</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.showVariantSize}
                                    onChange={(e) => handleChange("showVariantSize", e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Variant Size</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.showVariantColor}
                                    onChange={(e) => handleChange("showVariantColor", e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Variant Color</span>
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
                    </p>

                    <div className="h-[220px] bg-slate-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-4 relative overflow-hidden group">
                        <div
                            className="bg-white shadow-xl rounded border border-gray-200 flex items-center justify-start relative z-10 transform transition-transform group-hover:scale-105 duration-300"
                            style={{
                                padding: `${safeMarginPx}px`,
                                gap: `${mmToPx(3, SCREEN_DPI)}px`,
                                width: `${labelWidthPx}px`,
                                minHeight: `${labelHeightPx}px`
                            }}
                        >
                            <div style={{ width: `${qrSizePx}px`, height: `${qrSizePx}px`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {qrImg && <img src={qrImg} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />}
                            </div>

                            <div className="flex-1 flex flex-col justify-center items-start overflow-hidden text-left" style={{ gap: `${mmToPx(1, SCREEN_DPI)}px` }}>
                                {settings.showProductName && (
                                    <p className="m-0 leading-tight w-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${mmToPx(baseProductMm, SCREEN_DPI)}px`, fontWeight: settings.weightProduct ?? 800 }}>
                                        Design/Article No.
                                    </p>
                                )}
                                {settings.showBrand && (
                                    <p className="m-0 leading-tight w-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${mmToPx(baseBrandMm, SCREEN_DPI)}px`, fontWeight: settings.weightBrand ?? 800 }}>
                                        Brand Name
                                    </p>
                                )}
                                {settings.showVariantSize && (
                                    <p className="m-0 leading-tight w-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${mmToPx(baseSizeMm, SCREEN_DPI)}px`, fontWeight: settings.weightSize ?? 800 }}>
                                        Size: XL
                                    </p>
                                )}
                                {settings.showVariantColor && (
                                    <p className="m-0 leading-tight w-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${mmToPx(baseColorMm, SCREEN_DPI)}px`, fontWeight: settings.weightColor ?? 800 }}>
                                        Color: Red
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-0.5 uppercase tracking-wider text-xs">Typography</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Design No. Size</label>
                            <input
                                type="number" min="0.8" max="6" step="0.1" value={settings.fontProductMm ?? ""}
                                onChange={(e) => handleChange("fontProductMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder={defaultFontProductMm.toFixed(2)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Brand Size</label>
                            <input
                                type="number" min="0.8" max="6" step="0.1" value={settings.fontBrandMm ?? ""}
                                onChange={(e) => handleChange("fontBrandMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder={defaultFontBrandMm.toFixed(2)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Size Label</label>
                            <input
                                type="number" min="0.8" max="6" step="0.1" value={settings.fontSizeMm ?? ""}
                                onChange={(e) => handleChange("fontSizeMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder={defaultFontSizeMm.toFixed(2)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Color Label</label>
                            <input
                                type="number" min="0.8" max="6" step="0.1" value={settings.fontColorMm ?? ""}
                                onChange={(e) => handleChange("fontColorMm", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder={defaultFontColorMm.toFixed(2)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QrCustomization;
