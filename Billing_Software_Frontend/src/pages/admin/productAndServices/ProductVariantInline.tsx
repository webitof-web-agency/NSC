
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Constants from "../../../constants/api";
import { PencilLine, Printer, Trash2 } from "lucide-react";
import PrintBarcode from "@components/admin/PrintBarcode";
import SmartDropdown from "@components/admin/SmartDropdown";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import Modal from "@components/admin/Modal";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";

interface VariantInlineProps {
    productId: string | null;
    localVariants: any[];
    setLocalVariants: React.Dispatch<React.SetStateAction<any[]>>;
    multiplierEventKey?: string;
}

interface VariantFormData {
    designNo: string;
    color: string;
    size: string;
    purchase_price: string;
    sale_price: string;
    mrp: string;
    min_sale_price: string;
    reorder_limit: string;
    discount_value: string;
    barcode: string;
}

export default function ProductVariantInline({ productId, localVariants, setLocalVariants, multiplierEventKey = "product-variant-inline" }: VariantInlineProps) {
    const initialVariant: VariantFormData = {
        designNo: "",
        color: "",
        size: "",
        purchase_price: "",
        sale_price: "",
        mrp: "",
        min_sale_price: "",
        reorder_limit: "",
        discount_value: "",
        barcode: "",
    };

    const { token } = useSelector((state: RootState) => state.auth);

    // Bulk generation states
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [sizeSearchInput, setSizeSearchInput] = useState("");
    const [colorSearchInput, setColorSearchInput] = useState("");
    const [bulkSizeInput, setBulkSizeInput] = useState("");
    const [bulkColorInput, setBulkColorInput] = useState("");
    const [sizes, setSizes] = useState<{ id: string; name: string }[]>([]);
    const [colors, setColors] = useState<{ id: string; name: string }[]>([]);
    const [isSavingSize, setIsSavingSize] = useState(false);
    const [isSavingColor, setIsSavingColor] = useState(false);
    const [mrpMultiplier, setMrpMultiplier] = useState<number>(0);
    const [saleMultiplier, setSaleMultiplier] = useState<number>(0);
    const [allowManualOverride, setAllowManualOverride] = useState(true);
    const [allowSaleManualOverride, setAllowSaleManualOverride] = useState(true);
    const [showMultiplierModal, setShowMultiplierModal] = useState(false);
    const [isSavingMultiplierSettings, setIsSavingMultiplierSettings] = useState(false);
    const [mrpMultiplierInput, setMrpMultiplierInput] = useState("0");
    const [saleMultiplierInput, setSaleMultiplierInput] = useState("0");
    const [bulkDesignNo, setBulkDesignNo] = useState("");
    const [bulkPurchasePrice, setBulkPurchasePrice] = useState("");
    const [bulkPurchasePriceBySize, setBulkPurchasePriceBySize] = useState<Record<string, string>>({});
    const [showBulkPurchasePriceDropdown, setShowBulkPurchasePriceDropdown] = useState(false);
    const [bulkSalePrice, setBulkSalePrice] = useState("");
    const [bulkSalePriceBySize, setBulkSalePriceBySize] = useState<Record<string, string>>({});
    const [showBulkSalePriceDropdown, setShowBulkSalePriceDropdown] = useState(false);
    const [bulkMrp, setBulkMrp] = useState("");
    const [bulkMrpBySize, setBulkMrpBySize] = useState<Record<string, string>>({});
    const [showBulkMrpDropdown, setShowBulkMrpDropdown] = useState(false);
    const [bulkMinSalePrice, setBulkMinSalePrice] = useState("");
    const [bulkReorderLimit, setBulkReorderLimit] = useState("");
    const [bulkDiscountValue, setBulkDiscountValue] = useState("");
    const [bulkBarcode, setBulkBarcode] = useState("");

    // Individual variant states
    const [variant, setVariant] = useState<VariantFormData>(initialVariant);
    const [variantsList, setVariantsList] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showPrintBarcode, setShowPrintBarcode] = useState(false);
    const [showBulkPrintBarcode, setShowBulkPrintBarcode] = useState(false);
    const bulkPurchasePriceDropdownRef = useRef<HTMLDivElement | null>(null);
    const bulkSalePriceDropdownRef = useRef<HTMLDivElement | null>(null);
    const bulkMrpDropdownRef = useRef<HTMLDivElement | null>(null);
    const skipVariantAutoFillRef = useRef(false);

    const fetchSizes = async (search = "") => {
        try {
            const res = await axios.get(Constants.FETCH_SIZES_URL, {
                params: { search },
                headers: { Authorization: `Bearer ${token}` },
            });
            setSizes(res.data?.data || []);
        } catch {
            setSizes([]);
        }
    };

    const fetchColors = async (search = "") => {
        try {
            const res = await axios.get(Constants.FETCH_COLORS_URL, {
                params: { search },
                headers: { Authorization: `Bearer ${token}` },
            });
            setColors(res.data?.data || []);
        } catch {
            setColors([]);
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchSizes();
        fetchColors();
    }, [token]);
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (bulkPurchasePriceDropdownRef.current && !bulkPurchasePriceDropdownRef.current.contains(event.target as Node)) {
                setShowBulkPurchasePriceDropdown(false);
            }
            if (bulkSalePriceDropdownRef.current && !bulkSalePriceDropdownRef.current.contains(event.target as Node)) {
                setShowBulkSalePriceDropdown(false);
            }
            if (bulkMrpDropdownRef.current && !bulkMrpDropdownRef.current.contains(event.target as Node)) {
                setShowBulkMrpDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);


    useEffect(() => {
        if (!token) return;
        const fetchMrpSettings = async () => {
            try {
                const res = await axios.get(Constants.GET_MRP_SETTINGS_URL, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = res.data?.data;
                if (typeof data?.multiplier === "number") {
                    setMrpMultiplier(data.multiplier);
                } else if (data?.mode === "2x") {
                    setMrpMultiplier(2);
                } else if (data?.mode === "3x") {
                    setMrpMultiplier(3);
                } else {
                    setMrpMultiplier(0);
                }
                if (typeof data?.saleMultiplier === "number") {
                    setSaleMultiplier(data.saleMultiplier);
                } else {
                    setSaleMultiplier(0);
                }
                if (typeof data?.allowManualOverride === "boolean") {
                    setAllowManualOverride(data.allowManualOverride);
                }
                if (typeof data?.allowSaleManualOverride === "boolean") {
                    setAllowSaleManualOverride(data.allowSaleManualOverride);
                }
            } catch {
                setMrpMultiplier(0);
                setSaleMultiplier(0);
                setAllowManualOverride(true);
                setAllowSaleManualOverride(true);
            }
        };
        fetchMrpSettings();
    }, [token]);

    const calcMrpFromPurchase = (purchase: string, multiplierOverride?: string | number) => {
        const p = Number(purchase);
        if (!Number.isFinite(p)) return "";
        const multiplier = Number(multiplierOverride);
        if (Number.isFinite(multiplier) && multiplier > 0) return (p * multiplier).toFixed(2);
        if (mrpMultiplier > 0) return (p * mrpMultiplier).toFixed(2);
        return "";
    };

    const calcSaleFromPurchase = (purchase: string, multiplierOverride?: string | number) => {
        const p = Number(purchase);
        if (!Number.isFinite(p)) return "";
        const multiplier = Number(multiplierOverride);
        if (Number.isFinite(multiplier) && multiplier > 0) return (p * multiplier).toFixed(2);
        if (saleMultiplier > 0) return (p * saleMultiplier).toFixed(2);
        return "";
    };

    const hasOwnSizeValue = (map: Record<string, string>, size: string) =>
        Object.prototype.hasOwnProperty.call(map, size);

    const getResolvedBulkPurchasePrice = (size: string) => {
        const useSizeScopedValue = selectedSizes.length > 1;
        const hasScopedValue = useSizeScopedValue && size ? hasOwnSizeValue(bulkPurchasePriceBySize, size) : false;
        if (hasScopedValue) {
            return bulkPurchasePriceBySize[size] ?? "";
        }
        return bulkPurchasePrice;
    };

    const getResolvedBulkSalePrice = (size: string) => {
        const useSizeScopedValue = selectedSizes.length > 1;
        const hasScopedValue = useSizeScopedValue && size ? hasOwnSizeValue(bulkSalePriceBySize, size) : false;
        if (hasScopedValue) {
            return bulkSalePriceBySize[size] ?? "";
        }
        return bulkSalePrice;
    };

    const getResolvedBulkMrpPrice = (size: string) => {
        const useSizeScopedValue = selectedSizes.length > 1;
        const hasScopedValue = useSizeScopedValue && size ? hasOwnSizeValue(bulkMrpBySize, size) : false;
        if (hasScopedValue) {
            return bulkMrpBySize[size] ?? "";
        }
        return bulkMrp;
    };

    const syncBulkSizePurchasePrices = (sizesToSync: string[], fallbackPurchasePrice: string) => {
        setBulkPurchasePriceBySize((prev) => {
            const nextEntries = sizesToSync.map((size) => {
                const resolvedValue = hasOwnSizeValue(prev, size)
                    ? (prev[size] ?? "")
                    : (fallbackPurchasePrice ?? "");
                return [size, resolvedValue] as const;
            });
            const next = Object.fromEntries(nextEntries);
            const unchanged = sizesToSync.length === Object.keys(prev).length
                && sizesToSync.every((size) => (prev[size] ?? "") === (next[size] ?? ""));
            return unchanged ? prev : next;
        });
    };

    const syncBulkSizeSalePrices = (sizesToSync: string[], purchasePricesBySize: Record<string, string>, fallbackSalePrice: string) => {
        setBulkSalePriceBySize((prev) => {
            const nextEntries = sizesToSync.map((size) => {
                const purchaseValue = purchasePricesBySize[size] ?? bulkPurchasePrice;
                const computedSalePrice = saleMultiplier > 0 && purchaseValue
                    ? calcSaleFromPurchase(purchaseValue)
                    : "";
                const resolvedValue = hasOwnSizeValue(prev, size)
                    ? (prev[size] ?? "")
                    : (computedSalePrice || fallbackSalePrice || "");
                return [size, resolvedValue] as const;
            });
            const next = Object.fromEntries(nextEntries);
            const unchanged = sizesToSync.length === Object.keys(prev).length
                && sizesToSync.every((size) => (prev[size] ?? "") === (next[size] ?? ""));
            return unchanged ? prev : next;
        });
    };

    const syncBulkSizeMrpPrices = (sizesToSync: string[], purchasePricesBySize: Record<string, string>, fallbackMrpPrice: string) => {
        setBulkMrpBySize((prev) => {
            const nextEntries = sizesToSync.map((size) => {
                const purchaseValue = purchasePricesBySize[size] ?? bulkPurchasePrice;
                const computedMrpPrice = mrpMultiplier > 0 && purchaseValue
                    ? calcMrpFromPurchase(purchaseValue)
                    : "";
                const resolvedValue = hasOwnSizeValue(prev, size)
                    ? (prev[size] ?? "")
                    : (computedMrpPrice || fallbackMrpPrice || "");
                return [size, resolvedValue] as const;
            });
            const next = Object.fromEntries(nextEntries);
            const unchanged = sizesToSync.length === Object.keys(prev).length
                && sizesToSync.every((size) => (prev[size] ?? "") === (next[size] ?? ""));
            return unchanged ? prev : next;
        });
    };

    useEffect(() => {
        if (skipVariantAutoFillRef.current) {
            skipVariantAutoFillRef.current = false;
            return;
        }
        if (!variant.purchase_price) return;

        const hasMrpAutoFill = mrpMultiplier > 0;
        const hasSaleAutoFill = saleMultiplier > 0;

        if (!hasMrpAutoFill && !hasSaleAutoFill) return;

        setVariant((prev) => ({
            ...prev,
            ...(hasMrpAutoFill ? { mrp: calcMrpFromPurchase(prev.purchase_price) } : {}),
            ...(hasSaleAutoFill ? { sale_price: calcSaleFromPurchase(prev.purchase_price) } : {}),
        }));
    }, [mrpMultiplier, saleMultiplier, variant.purchase_price]);

    useEffect(() => {
        if (!bulkPurchasePrice) return;

        const hasMrpAutoFill = mrpMultiplier > 0;
        const hasSaleAutoFill = saleMultiplier > 0;

        if (hasMrpAutoFill) {
            setBulkMrp(calcMrpFromPurchase(bulkPurchasePrice));
        }
        if (hasSaleAutoFill) {
            setBulkSalePrice(calcSaleFromPurchase(bulkPurchasePrice));
        }
    }, [mrpMultiplier, saleMultiplier, bulkPurchasePrice]);

    useEffect(() => {
        if (selectedSizes.length === 0) {
            setBulkPurchasePriceBySize({});
            setBulkSalePriceBySize({});
            setBulkMrpBySize({});
            setShowBulkPurchasePriceDropdown(false);
            setShowBulkSalePriceDropdown(false);
            setShowBulkMrpDropdown(false);
            return;
        }

        syncBulkSizePurchasePrices(selectedSizes, bulkPurchasePrice);
        const nextPurchasePrices = Object.fromEntries(selectedSizes.map((size) => [size, getResolvedBulkPurchasePrice(size)]));
        syncBulkSizeSalePrices(selectedSizes, nextPurchasePrices, bulkSalePrice);
        syncBulkSizeMrpPrices(selectedSizes, nextPurchasePrices, bulkMrp);
    }, [selectedSizes, bulkPurchasePrice, bulkSalePrice, bulkMrp, mrpMultiplier, saleMultiplier]);

    const openMultiplierSettingsModal = () => {
        setMrpMultiplierInput(String(mrpMultiplier || 0));
        setSaleMultiplierInput(String(saleMultiplier || 0));
        setShowMultiplierModal(true);
    };

    useEffect(() => {
        const eventName = `open-price-multiplier-modal:${multiplierEventKey}`;
        const handleOpen = () => openMultiplierSettingsModal();
        window.addEventListener(eventName, handleOpen);
        return () => window.removeEventListener(eventName, handleOpen);
    }, [multiplierEventKey, mrpMultiplier, saleMultiplier]);

    const handleSaveMultiplierSettings = async () => {
        try {
            setIsSavingMultiplierSettings(true);
            const payload = {
                multiplier: Number(mrpMultiplierInput) || 0,
                saleMultiplier: Number(saleMultiplierInput) || 0,
                allowManualOverride,
                allowSaleManualOverride,
            };
            await axios.put(Constants.UPDATE_MRP_SETTINGS_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMrpMultiplier(payload.multiplier);
            setSaleMultiplier(payload.saleMultiplier);
            toast.success("Price multiplier settings updated");
            setShowMultiplierModal(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to update price multiplier settings");
        } finally {
            setIsSavingMultiplierSettings(false);
        }
    };

    const addSize = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("Size name is required");
            return;
        }

        try {
            setIsSavingSize(true);
            const res = await axios.post(Constants.CREATE_SIZE_URL, { name: trimmed }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const created = res.data?.data;
            if (Array.isArray(created)) {
                setSizes(prev => [...created.map(c => ({ id: c.id, name: c.name })), ...prev]);
                const newNames = created.map(c => c.name);
                setSelectedSizes(prev => {
                    const toAdd = newNames.filter(n => !prev.includes(n));
                    return [...prev, ...toAdd];
                });
                setBulkSizeInput("");
            } else if (created?.id) {
                setSizes(prev => [{ id: created.id, name: created.name }, ...prev]);
                if (!selectedSizes.includes(created.name)) {
                    setSelectedSizes(prev => [...prev, created.name]);
                }
                setBulkSizeInput("");
            }
            setSizeSearchInput("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add size");
        } finally {
            setIsSavingSize(false);
        }
    };

    const deleteSize = async (sizeId: string, sizeName: string) => {
        if (!sizeId) return;
        try {
            await axios.delete(`${Constants.DELETE_SIZE_URL}/${sizeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSizes(prev => prev.filter(size => size.id !== sizeId));
            setSelectedSizes(prev => prev.filter(size => size !== sizeName));
            if (variant.size === sizeName) {
                setVariant(prev => ({ ...prev, size: "" }));
            }
            toast.success("Size deleted");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete size");
        }
    };

    const deleteColor = async (colorId: string, colorName: string) => {
        if (!colorId) return;
        try {
            await axios.delete(`${Constants.DELETE_COLOR_URL}/${colorId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setColors(prev => prev.filter(color => color.id !== colorId));
            setSelectedColors(prev => prev.filter(color => color !== colorName));
            if (variant.color === colorName) {
                setVariant(prev => ({ ...prev, color: "" }));
            }
            toast.success("Color deleted");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete color");
        }
    };
    const addColor = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("Color name is required");
            return;
        }

        try {
            setIsSavingColor(true);
            const res = await axios.post(Constants.CREATE_COLOR_URL, { name: trimmed }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const created = res.data?.data;
            if (Array.isArray(created)) {
                setColors(prev => [...created.map(c => ({ id: c.id, name: c.name })), ...prev]);
                const newNames = created.map(c => c.name);
                setSelectedColors(prev => {
                    const toAdd = newNames.filter(n => !prev.includes(n));
                    return [...prev, ...toAdd];
                });
                setBulkColorInput("");
            } else if (created?.id) {
                setColors(prev => [{ id: created.id, name: created.name }, ...prev]);
                if (!selectedColors.includes(created.name)) {
                    setSelectedColors(prev => [...prev, created.name]);
                }
                setBulkColorInput("");
            }
            setColorSearchInput("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add color");
        } finally {
            setIsSavingColor(false);
        }
    };

    // Load saved variants when component mounts (for edit mode)
    useEffect(() => {
        if (!productId) return;

        axios
            .get(Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", productId), {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then((res) => setVariantsList(res.data.data || []))
            .catch(() => toast.error("Failed to load variants"));
    }, [productId, token]);

    const normalizeNum = (v: string | number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const normalizePersistedVariant = (savedVariant: any) => ({
        ...savedVariant,
        _id: savedVariant?._id || savedVariant?.id,
        id: savedVariant?.id || savedVariant?._id,
    });

    const makeBarcodeKey = (designNo: string, color: string, size: string, purchase: string, sale: string, mrp: string) => {
        return [
            String(designNo || "").trim(),
            String(size || "").trim().toLowerCase(),
            normalizeNum(purchase),
            normalizeNum(sale),
            normalizeNum(mrp),
        ].join("|");
    };

    const hash32 = (str: string, seed = 0) => {
        let h = seed >>> 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i);
            h >>>= 0;
        }
        return h >>> 0;
    };

    const generateDeterministicBarcode = (key: string) => {
        const h1 = hash32(key, 0).toString().padStart(10, "0");
        const h2 = (hash32(key, 7) % 100).toString().padStart(2, "0");
        return `${h1}${h2}`.slice(0, 12);
    };

    const resolveBarcodeForConfig = (designNo: string, color: string, size: string, purchase: string, sale: string, mrp: string) => {
        const key = makeBarcodeKey(designNo, color, size, purchase, sale, mrp);
        const existing = [...variantsList, ...localVariants].find((v) => {
            const k = makeBarcodeKey(
                v.designNo || "",
                v.color || "",
                v.size || "",
                String(v.purchase_price || 0),
                String(v.sale_price || 0),
                String(v.mrp || 0)
            );
            return k === key && v.barcode;
        });
        return existing?.barcode || generateDeterministicBarcode(key);
    };

    const handleBarcodeGenerate = () => {
        setVariant((prev) => ({
            ...prev,
            barcode: resolveBarcodeForConfig(prev.designNo, prev.color, prev.size, prev.purchase_price, prev.sale_price, prev.mrp),
        }));
    };

    // Handle individual variant input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const hasMrpAutoFill = mrpMultiplier > 0;
        const hasSaleAutoFill = saleMultiplier > 0;
        if (name === "purchase_price" && (hasMrpAutoFill || hasSaleAutoFill)) {
            const nextMrp = hasMrpAutoFill ? calcMrpFromPurchase(value) : undefined;
            const nextSale = hasSaleAutoFill ? calcSaleFromPurchase(value) : undefined;
            setVariant((prev) => ({
                ...prev,
                purchase_price: value,
                ...(hasMrpAutoFill ? { mrp: nextMrp } : {}),
                ...(hasSaleAutoFill ? { sale_price: nextSale } : {}),
            }));
            return;
        }
        setVariant((prev) => ({ ...prev, [name]: value }));
    };

    const toggleSize = (size: string) => {
        setSelectedSizes(prev =>
            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
        );
    };

    const toggleColor = (color: string) => {
        setSelectedColors(prev =>
            prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
        );
    };

    // Generate all size x color combinations
    const handleBulkGenerate = () => {
        if (selectedSizes.length === 0 && selectedColors.length === 0) {
            toast.error("Please select at least one size OR one color");
            return;
        }

        if (!bulkMrp || Number(bulkMrp) <= 0) {
            toast.error("Please enter valid MRP for bulk generation");
            return;
        }

        // Price validation
        const minSalePrice = Number(bulkMinSalePrice) || 0;
        const scopedSizes = selectedSizes.length > 0 ? selectedSizes : [""];
        const sizeScopedPrices = scopedSizes.map((size) => ({
            size,
            purchasePrice: Number(getResolvedBulkPurchasePrice(size)) || 0,
            salePrice: Number(getResolvedBulkSalePrice(size)) || 0,
            mrp: Number(getResolvedBulkMrpPrice(size)) || 0,
        }));

        // MRP should be greater than both Sale and Purchase prices
        for (const scopedPrice of sizeScopedPrices) {
            if (scopedPrice.salePrice > 0 && scopedPrice.mrp <= scopedPrice.salePrice) {
                toast.error(scopedPrice.size ? `MRP must be greater than Sale Price for size ${scopedPrice.size}` : "MRP must be greater than Sale Price");
                return;
            }
            if (scopedPrice.purchasePrice > 0 && scopedPrice.mrp <= scopedPrice.purchasePrice) {
                toast.error(scopedPrice.size ? `MRP must be greater than Purchase Price for size ${scopedPrice.size}` : "MRP must be greater than Purchase Price");
                return;
            }
        }

        // Sale Price should be greater than Purchase Price
        for (const scopedPrice of sizeScopedPrices) {
            if (scopedPrice.salePrice > 0 && scopedPrice.purchasePrice > 0 && scopedPrice.salePrice <= scopedPrice.purchasePrice) {
                toast.error(scopedPrice.size ? `Sale Price must be greater than Purchase Price for size ${scopedPrice.size}` : "Sale Price must be greater than Purchase Price");
                return;
            }
        }

        // Min Sale Price should be between Purchase Price and Sale Price
        if (minSalePrice > 0) {
            for (const scopedPrice of sizeScopedPrices) {
                if (scopedPrice.purchasePrice > 0 && minSalePrice < scopedPrice.purchasePrice) {
                    toast.error(scopedPrice.size ? `Min Sale Price cannot be less than Purchase Price for size ${scopedPrice.size}` : "Min Sale Price cannot be less than Purchase Price");
                    return;
                }
                if (scopedPrice.salePrice > 0 && minSalePrice > scopedPrice.salePrice) {
                    toast.error(scopedPrice.size ? `Min Sale Price cannot be greater than Sale Price for size ${scopedPrice.size}` : "Min Sale Price cannot be greater than Sale Price");
                    return;
                }
            }
        }

        const newVariants: any[] = [];

        const createVariant = (size: string, color: string) => {
            const resolvedPurchasePrice = getResolvedBulkPurchasePrice(size);
            const resolvedSalePrice = getResolvedBulkSalePrice(size);
            const resolvedMrpPrice = getResolvedBulkMrpPrice(size);
            return {
                _id: crypto.randomUUID(),
                designNo: bulkDesignNo || "",
                color,
                size,
                purchase_price: Number(resolvedPurchasePrice) || 0,
                sale_price: Number(resolvedSalePrice) || 0,
                mrp: Number(resolvedMrpPrice),
                min_sale_price: Number(bulkMinSalePrice) || 0,
                reorder_limit: Number(bulkReorderLimit) || 0,
                discount_value: Number(bulkDiscountValue) || 0,
                barcode: bulkBarcode.trim()
                    ? bulkBarcode.trim()
                    : resolveBarcodeForConfig(bulkDesignNo, color, size, resolvedPurchasePrice, resolvedSalePrice, resolvedMrpPrice),
            };
        };

        // Handle different scenarios
        if (selectedSizes.length === 0) {
            // Color-only variants (for sarees, etc.)
            selectedColors.forEach(color => {
                newVariants.push(createVariant("", color));
            });
        } else if (selectedColors.length === 0) {
            // Size-only variants
            selectedSizes.forEach(size => {
                newVariants.push(createVariant(size, ""));
            });
        } else {
            // Both: Create size × color matrix
            selectedSizes.forEach(size => {
                selectedColors.forEach(color => {
                    newVariants.push(createVariant(size, color));
                });
            });
        }

        if (productId) {
            // Save to backend immediately
            Promise.all(
                newVariants.map(v =>
                    axios.post(Constants.CREATE_PRODUCTS_VARIANT_URL, { ...v, productId }, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                )
            )
                .then((responses) => {
                    const savedVariants = responses.map(r => normalizePersistedVariant(r.data.data));
                    setVariantsList(prev => [...prev, ...savedVariants]);
                    toast.success(`${newVariants.length} variants created successfully!`);
                    window.dispatchEvent(new CustomEvent("variantCreated", { detail: { productId } }));
                })
                .catch(() => toast.error("Failed to create some variants"));
        } else {
            // Add to local state
            setLocalVariants(prev => [...prev, ...newVariants]);
            toast.success(`${newVariants.length} variants added (not saved yet)`);
        }

        // Reset bulk form
        setSelectedSizes([]);
        setSelectedColors([]);
        setBulkDesignNo("");
        setBulkPurchasePrice("");
        setBulkPurchasePriceBySize({});
        setBulkSalePrice("");
        setBulkSalePriceBySize({});
        setBulkMrp("");
        setBulkMrpBySize({});
        setBulkMinSalePrice("");
        setBulkReorderLimit("");
        setBulkDiscountValue("");
        setBulkBarcode("");
    };

    // Prepare payload for API
    const preparePayload = (variantData: VariantFormData) => {
        const numeric = (v: string) => (v === "" ? null : Number(v));

        return {
            productId,
            designNo: variantData.designNo?.trim() || "",
            color: variantData.color?.trim() || "",
            size: variantData.size?.trim() || "",
            purchase_price: numeric(variantData.purchase_price),
            sale_price: numeric(variantData.sale_price),
            mrp: numeric(variantData.mrp),
            min_sale_price: numeric(variantData.min_sale_price),
            reorder_limit: numeric(variantData.reorder_limit),
            discount_value: numeric(variantData.discount_value),
            barcode: variantData.barcode && variantData.barcode.length >= 6
                ? variantData.barcode
                : resolveBarcodeForConfig(variantData.designNo, variantData.color, variantData.size, variantData.purchase_price, variantData.sale_price, variantData.mrp),
        };
    };

    // Validate individual variant form
    const isValid = () => {
        if (!variant.designNo?.trim()) return false;
        // Size is now optional (for sarees, fabrics, etc.)
        if (!variant.mrp || Number(variant.mrp) <= 0) return false;
        if (variant.min_sale_price && Number(variant.min_sale_price) < 0) return false;
        return true;
    };

    // Get table data based on mode
    const tableData = productId ? variantsList : localVariants;

    // CREATE / UPDATE individual variant
    const handleSave = async () => {
        if (!isValid()) {
            toast.error("Please fill all required fields");
            return;
        }

        // Price validation
        const mrp = Number(variant.mrp) || 0;
        const salePrice = Number(variant.sale_price) || 0;
        const purchasePrice = Number(variant.purchase_price) || 0;
        const minSalePrice = Number(variant.min_sale_price) || 0;

        // MRP should be greater than both Sale and Purchase prices
        if (salePrice > 0 && mrp <= salePrice) {
            toast.error("MRP must be greater than Sale Price");
            return;
        }
        if (purchasePrice > 0 && mrp <= purchasePrice) {
            toast.error("MRP must be greater than Purchase Price");
            return;
        }

        // Sale Price should be greater than Purchase Price
        if (salePrice > 0 && purchasePrice > 0 && salePrice <= purchasePrice) {
            toast.error("Sale Price must be greater than Purchase Price");
            return;
        }

        // Min Sale Price should be between Purchase Price and Sale Price
        if (minSalePrice > 0) {
            if (purchasePrice > 0 && minSalePrice < purchasePrice) {
                toast.error("Min Sale Price cannot be less than Purchase Price");
                return;
            }
            if (salePrice > 0 && minSalePrice > salePrice) {
                toast.error("Min Sale Price cannot be greater than Sale Price");
                return;
            }
        }

        const payload = preparePayload(variant);

        if (!productId) {
            if (editingId) {
                const updatedVariant = {
                    ...payload,
                    _id: editingId,
                    id: editingId,
                };

                setLocalVariants((prev) =>
                    prev.map((v) => {
                        const variantId = v._id || v.id;
                        return variantId === editingId ? { ...v, ...updatedVariant } : v;
                    })
                );
                toast.success("Variant updated (not saved yet)");
            } else {
                const generatedId = crypto.randomUUID();
                const newVariant = {
                    ...payload,
                    _id: generatedId,
                    id: generatedId,
                };

                setLocalVariants((prev) => [...prev, newVariant]);
                toast.success("Variant added (not saved yet)");
            }

            setVariant(initialVariant);
            setEditingId(null);
            return;
        }

        // EDIT MODE → productId exists
        try {
            if (editingId) {
                const res = await axios.put(
                    Constants.UPDATE_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", editingId),
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const savedVariant = normalizePersistedVariant(res.data.data);

                setVariantsList((prev) =>
                    prev.map((v) => (v._id === editingId ? savedVariant : v))
                );

                toast.success("Variant updated");
            } else {
                const res = await axios.post(Constants.CREATE_PRODUCTS_VARIANT_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const savedVariant = normalizePersistedVariant(res.data.data);
                setVariantsList((prev) => [...prev, savedVariant]);
                toast.success("Variant added");
                window.dispatchEvent(new CustomEvent("variantCreated", { detail: { productId } }));
            }

            setVariant(initialVariant);
            setEditingId(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to save variant");
        }
    };

    // Edit existing variant
    const handleEdit = (row: any) => {
        skipVariantAutoFillRef.current = true;
        setEditingId(row._id);
        setVariant({
            designNo: row.designNo,
            color: row.color,
            size: row.size,
            purchase_price: row.purchase_price,
            sale_price: row.sale_price,
            mrp: row.mrp,
            min_sale_price: row.min_sale_price,
            reorder_limit: row.reorder_limit,
            discount_value: row.discount_value,
            barcode: row.barcode,
        });
    };

    // Delete variant
    const handleDelete = async (row: any) => {
        const variantId = row?._id || row?.id;

        if (!productId) {
            // Delete from local state
            setLocalVariants(prev => prev.filter(v => (v._id || v.id) !== variantId));
            toast.success("Variant removed");
            return;
        }

        if (!variantId) {
            setVariantsList((prev) => prev.filter((v) => (v._id || v.id) !== variantId));
            toast.success("Variant removed");
            return;
        }

        try {
            await axios.delete(
                Constants.DELETE_PRODUCTS_VARIANT_URL.replace(":id", variantId),
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setVariantsList((prev) => prev.filter((v) => (v._id || v.id) !== variantId));
            toast.success("Variant deleted");
            window.dispatchEvent(new CustomEvent("variantDeleted", { detail: { productId, variantId } }));
        } catch {
            toast.error("Delete failed");
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3">Product Variants</h2>

            {/* BULK GENERATION SECTION */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-xl border border-purple-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-2xl">⚡</span> Bulk Generate Variants
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                    {/* Size Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Select Sizes (Optional for sarees)</label>

                        <div className="mb-2 p-2 rounded">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Add custom sizes: 32, 34, 36..."
                                    value={bulkSizeInput}
                                    onChange={(e) => setBulkSizeInput(e.target.value)}
                                    className="flex-1 sm:w-64 px-2 py-1 text-xs border border-gray-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => addSize(bulkSizeInput)}
                                    disabled={isSavingSize}
                                    className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-gray-900 transition-colors whitespace-nowrap w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSavingSize ? "Saving..." : "+ Add"}
                                </button>
                            </div>
                        </div>

                        {selectedSizes.some(s => !sizes.some(db => db.name === s)) && (
                            <div className="mb-2 flex flex-wrap gap-1 items-center">
                                <span className="text-xs font-medium text-gray-600">Custom:</span>
                                {selectedSizes.filter(s => !sizes.some(db => db.name === s)).map((size) => (
                                    <span key={size} className="inline-flex items-center gap-1 px-2 py-1 bg-pink-500 text-white text-xs rounded-md shadow-sm">
                                        {size}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSizes(prev => prev.filter(s => s !== size))}
                                            className="ml-1 hover:text-red-200 font-bold text-sm"
                                            title="Remove"
                                        >
                                            ?
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {sizes.map(size => (
                                <div
                                    key={size.id}
                                    className={`inline-flex items-center rounded-lg border transition-all ${selectedSizes.includes(size.name)
                                        ? "bg-primary text-white shadow-md border-primary"
                                        : "bg-white text-gray-700 border-gray-300 hover:border-primary hover:shadow-sm"
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleSize(size.name)}
                                        className="px-4 py-2 text-sm font-medium"
                                    >
                                        {size.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void deleteSize(size.id, size.name);
                                        }}
                                        className={`px-2 py-2 border-l ${selectedSizes.includes(size.name) ? "border-white/20 text-white hover:bg-white/10" : "border-gray-200 text-red-500 hover:bg-red-50"}`}
                                        title="Delete size from database"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Select Colors (Optional)</label>

                        <div className="mb-2 p-2 rounded">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Add custom colors: Magenta, Gold..."
                                    value={bulkColorInput}
                                    onChange={(e) => setBulkColorInput(e.target.value)}
                                    className="flex-1 sm:w-64 px-2 py-1 text-xs border border-gray-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => addColor(bulkColorInput)}
                                    disabled={isSavingColor}
                                    className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-gray-900 transition-colors whitespace-nowrap w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSavingColor ? "Saving..." : "+ Add"}
                                </button>
                            </div>
                        </div>

                        {selectedColors.some(c => !colors.some(db => db.name === c)) && (
                            <div className="mb-2 flex flex-wrap gap-1 items-center">
                                <span className="text-xs font-medium text-gray-600">Custom:</span>
                                {selectedColors.filter(c => !colors.some(db => db.name === c)).map((color) => (
                                    <span key={color} className="inline-flex items-center gap-1 px-2 py-1 bg-pink-500 text-white text-xs rounded-md shadow-sm">
                                        {color}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedColors(prev => prev.filter(cl => cl !== color))}
                                            className="ml-1 hover:text-red-200 font-bold text-sm"
                                            title="Remove"
                                        >
                                            ?
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {colors.map(color => (
                                <div
                                    key={color.id}
                                    className={`inline-flex items-center rounded-lg border transition-all ${selectedColors.includes(color.name)
                                        ? "bg-primary text-white shadow-md border-primary"
                                        : "bg-white text-gray-700 border-gray-300 hover:border-primary hover:shadow-sm"
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleColor(color.name)}
                                        className="px-4 py-2 text-sm font-medium"
                                    >
                                        {color.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void deleteColor(color.id, color.name);
                                        }}
                                        className={`px-2 py-2 border-l ${selectedColors.includes(color.name) ? "border-white/20 text-white hover:bg-white/10" : "border-gray-200 text-red-500 hover:bg-red-50"}`}
                                        title="Delete color from database"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Common Fields for Bulk Generation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                    <SmallInput label="Design No" value={bulkDesignNo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkDesignNo(e.target.value)} />
                    <div className="relative" ref={bulkPurchasePriceDropdownRef}>
                        <SmallInput
                            label="Purchase Price"
                            type="number"
                            value={bulkPurchasePrice}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const next = e.target.value;
                                const nextSale = saleMultiplier > 0 && next.trim() !== "" ? calcSaleFromPurchase(next) : "";
                                const nextMrp = mrpMultiplier > 0 && next.trim() !== "" ? calcMrpFromPurchase(next) : "";
                                setBulkPurchasePrice(next);
                                if (selectedSizes.length > 1) {
                                    setBulkPurchasePriceBySize(Object.fromEntries(selectedSizes.map((size) => [size, next])));
                                }
                                if (saleMultiplier > 0) {
                                    setBulkSalePrice(nextSale);
                                    if (selectedSizes.length > 1) {
                                        setBulkSalePriceBySize(Object.fromEntries(selectedSizes.map((size) => [size, nextSale])));
                                    }
                                }
                                if (mrpMultiplier > 0) {
                                    setBulkMrp(nextMrp);
                                    if (selectedSizes.length > 1) {
                                        setBulkMrpBySize(Object.fromEntries(selectedSizes.map((size) => [size, nextMrp])));
                                    }
                                }
                            }}
                        />
                        {selectedSizes.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkPurchasePriceDropdown((prev) => !prev)}
                                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm hover:border-primary"
                                >
                                    <span className="flex items-center justify-between">
                                        <span>Size-wise Purchase Prices</span>
                                        <span className="text-gray-400">{selectedSizes.length} size(s)</span>
                                    </span>
                                </button>
                                {showBulkPurchasePriceDropdown && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
                                        <div className="max-h-48 overflow-auto p-3 space-y-2">
                                            {selectedSizes.map((size) => (
                                                <div key={size} className="flex items-center gap-3">
                                                    <div className="min-w-[96px] text-sm font-medium text-gray-700">{size}</div>
                                                    <input
                                                        type="number"
                                                        value={hasOwnSizeValue(bulkPurchasePriceBySize, size) ? (bulkPurchasePriceBySize[size] ?? "") : bulkPurchasePrice}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            setBulkPurchasePriceBySize((prev) => ({
                                                                ...prev,
                                                                [size]: next,
                                                            }));
                                                            if (saleMultiplier > 0) {
                                                                setBulkSalePriceBySize((prev) => ({
                                                                    ...prev,
                                                                    [size]: next.trim() === "" ? "" : calcSaleFromPurchase(next),
                                                                }));
                                                            }
                                                            if (mrpMultiplier > 0) {
                                                                setBulkMrpBySize((prev) => ({
                                                                    ...prev,
                                                                    [size]: next.trim() === "" ? "" : calcMrpFromPurchase(next),
                                                                }));
                                                            }
                                                        }}
                                                        className="w-full p-2 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="relative" ref={bulkSalePriceDropdownRef}>
                        <SmallInput
                            label="Sale Price"
                            type="number"
                            value={bulkSalePrice}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const next = e.target.value;
                                setBulkSalePrice(next);
                                if (selectedSizes.length > 1) {
                                    setBulkSalePriceBySize(Object.fromEntries(selectedSizes.map((size) => [size, next])));
                                }
                            }}
                            disabled={saleMultiplier > 0 && !allowSaleManualOverride}
                        />
                        {selectedSizes.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkSalePriceDropdown((prev) => !prev)}
                                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm hover:border-primary"
                                >
                                    <span className="flex items-center justify-between">
                                        <span>Size-wise Sale Prices</span>
                                        <span className="text-gray-400">{selectedSizes.length} size(s)</span>
                                    </span>
                                </button>
                                {showBulkSalePriceDropdown && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
                                        <div className="max-h-48 overflow-auto p-3 space-y-2">
                                            {selectedSizes.map((size) => (
                                                <div key={size} className="flex items-center gap-3">
                                                    <div className="min-w-[96px] text-sm font-medium text-gray-700">{size}</div>
                                                    <input
                                                        type="number"
                                                        value={bulkSalePriceBySize[size] ?? getResolvedBulkSalePrice(size)}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            setBulkSalePriceBySize((prev) => ({
                                                                ...prev,
                                                                [size]: next,
                                                            }));
                                                        }}
                                                        disabled={saleMultiplier > 0 && !allowSaleManualOverride}
                                                        className="w-full p-2 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="relative" ref={bulkMrpDropdownRef}>
                        <SmallInput
                            label="MRP *"
                            type="number"
                            value={bulkMrp}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const next = e.target.value;
                                setBulkMrp(next);
                                if (selectedSizes.length > 1) {
                                    setBulkMrpBySize(Object.fromEntries(selectedSizes.map((size) => [size, next])));
                                }
                            }}
                            required
                            disabled={mrpMultiplier > 0 && !allowManualOverride}
                        />
                        {selectedSizes.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkMrpDropdown((prev) => !prev)}
                                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm hover:border-primary"
                                >
                                    <span className="flex items-center justify-between">
                                        <span>Size-wise MRP Prices</span>
                                        <span className="text-gray-400">{selectedSizes.length} size(s)</span>
                                    </span>
                                </button>
                                {showBulkMrpDropdown && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
                                        <div className="max-h-48 overflow-auto p-3 space-y-2">
                                            {selectedSizes.map((size) => (
                                                <div key={size} className="flex items-center gap-3">
                                                    <div className="min-w-[96px] text-sm font-medium text-gray-700">{size}</div>
                                                    <input
                                                        type="number"
                                                        value={bulkMrpBySize[size] ?? getResolvedBulkMrpPrice(size)}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            setBulkMrpBySize((prev) => ({
                                                                ...prev,
                                                                [size]: next,
                                                            }));
                                                        }}
                                                        disabled={mrpMultiplier > 0 && !allowManualOverride}
                                                        className="w-full p-2 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <SmallInput label="Min Sale Price (Optional)" type="number" value={bulkMinSalePrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkMinSalePrice(e.target.value)} />
                    <SmallInput label="Reorder Limit" type="number" value={bulkReorderLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkReorderLimit(e.target.value)} />
                    <SmallInput label="Discount % (Optional)" type="number" value={bulkDiscountValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkDiscountValue(e.target.value)} />
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Barcode</label>
                        <div className="flex mt-1">
                            <input
                                type="text"
                                value={bulkBarcode}
                                onChange={(e) => setBulkBarcode(e.target.value)}
                                className="p-2 border w-full rounded-l-md text-sm text-gray-700 border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                                placeholder="Enter barcode (optional)"
                            />
                            <button
                                className="px-3 bg-gray-200 hover:bg-gray-300 text-sm font-medium whitespace-nowrap"
                                type="button"
                                onClick={() => setBulkBarcode(resolveBarcodeForConfig(
                                    bulkDesignNo,
                                    selectedColors[0] || "",
                                    selectedSizes[0] || "",
                                    bulkPurchasePrice,
                                    bulkSalePrice,
                                    bulkMrp
                                ))}
                            >
                                Generate
                            </button>
                            <button
                                className="px-3 bg-primary text-white rounded-r-md hover:bg-gray-900"
                                type="button"
                                onClick={() => {
                                    if (!bulkBarcode.trim()) {
                                        toast.error("Please enter or generate a barcode first.");
                                        return;
                                    }
                                    setShowBulkPrintBarcode(true);
                                }}
                            >
                                <Printer size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleBulkGenerate}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-400 to-pink-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-pink-800 transition-all shadow-lg hover:shadow-xl"
                >
                    Generate Variants (
                    {selectedSizes.length === 0 && selectedColors.length > 0
                        ? `${selectedColors.length} colors`
                        : selectedColors.length === 0 && selectedSizes.length > 0
                            ? `${selectedSizes.length} sizes`
                            : `${selectedSizes.length} × ${selectedColors.length} = ${selectedSizes.length * selectedColors.length}`}
                    )
                </button>

                {showBulkPrintBarcode && bulkBarcode && (
                    <PrintBarcode
                        barcode={bulkBarcode}
                        price={Number(bulkMrp)}
                        salePrice={Number(selectedSizes.length === 1 ? getResolvedBulkSalePrice(selectedSizes[0]) : bulkSalePrice)}
                        productName={bulkDesignNo}
                        variantSize={selectedSizes.length === 1 ? selectedSizes[0] : ""}
                        onClose={() => setShowBulkPrintBarcode(false)}
                    />
                )}
            </div>

            {/* INDIVIDUAL VARIANT FORM */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {editingId ? "✏️ Edit Variant" : "➕ Add Single Variant"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <SmallInput label="Design No *" name="designNo" value={variant.designNo} onChange={handleChange} required />
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Color (Optional)</label>
                        <SmartDropdown
                            items={colors}
                            value={variant.color}
                            onChange={(val) => setColorSearchInput(val)}
                            onSelect={(selected) => {
                                const name = selected?.name?.trim() || "";
                                setVariant(prev => ({ ...prev, color: name }));
                            }}
                            onAddNew={() => addColor(colorSearchInput)}
                            placeholder="Type to search color..."
                            addNewLabel={isSavingColor ? "Saving..." : "Add Color"}
                            loading={isSavingColor}
                            selectedItem={variant.color ? { id: variant.color, name: variant.color } : null}
                            serverside={false}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Size (Optional)</label>
                        <SmartDropdown
                            items={sizes}
                            value={variant.size}
                            onChange={(val) => setSizeSearchInput(val)}
                            onSelect={(selected) => {
                                const name = selected?.name?.trim() || "";
                                setVariant(prev => ({ ...prev, size: name }));
                            }}
                            onAddNew={() => addSize(sizeSearchInput)}
                            placeholder="Type to search size..."
                            addNewLabel={isSavingSize ? "Saving..." : "Add Size"}
                            loading={isSavingSize}
                            selectedItem={variant.size ? { id: variant.size, name: variant.size } : null}
                            serverside={false}
                        />
                    </div>

                    <SmallInput label="Purchase Price" type="number" name="purchase_price" value={variant.purchase_price} onChange={handleChange} />

                    <SmallInput
                        label="Sale Price"
                        type="number"
                        name="sale_price"
                        value={variant.sale_price}
                        onChange={handleChange}
                        disabled={saleMultiplier > 0 && !allowSaleManualOverride}
                    />

                    <SmallInput
                        label="MRP *"
                        type="number"
                        name="mrp"
                        value={variant.mrp}
                        onChange={handleChange}
                        required
                        disabled={mrpMultiplier > 0 && !allowManualOverride}
                    />

                    <SmallInput label="Min Sale Price (Optional)" type="number" name="min_sale_price" value={variant.min_sale_price} onChange={handleChange} />
                    <SmallInput label="Reorder Limit" type="number" name="reorder_limit" value={variant.reorder_limit} onChange={handleChange} />
                    <SmallInput label="Discount % (Optional)" type="number" name="discount_value" value={variant.discount_value} onChange={handleChange} />

                    {/* Barcode */}
                    <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
                        <label className="block text-xs font-medium text-gray-600">Barcode</label>
                        <div className="flex mt-1">
                            <input
                                type="text"
                                name="barcode"
                                value={variant.barcode}
                                onChange={handleChange}
                                className="p-2 border w-full rounded-l-md text-sm text-gray-700 border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                            />

                            <button className="px-3 bg-gray-200 hover:bg-gray-300 text-sm font-medium whitespace-nowrap" type="button" onClick={handleBarcodeGenerate}>
                                Generate
                            </button>

                            <button className="px-3 bg-primary text-white rounded-r-md hover:bg-gray-900" type="button" onClick={() => setShowPrintBarcode(true)}>
                                <Printer size={16} />
                            </button>
                        </div>

                        {showPrintBarcode && (
                            <PrintBarcode
                                barcode={variant.barcode}
                                price={Number(variant.mrp)}
                                salePrice={Number(variant.sale_price)}
                                productName={variant.designNo}
                                variantSize={variant.size}
                                onClose={() => setShowPrintBarcode(false)}
                            />
                        )}
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3 xl:col-span-1 flex items-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!isValid()}
                            className={`w-full px-4 py-2 rounded-lg text-white font-medium transition-all ${isValid() ? "bg-primary hover:bg-gray-900 shadow-md hover:shadow-lg" : "bg-gray-400 cursor-not-allowed"
                                }`}
                        >
                            {editingId ? "Update" : "+ Add"}
                        </button>
                    </div>
                </div>
            </div>

            {/* VARIANTS TABLE */}
            {tableData.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span>📋</span> {productId ? "Saved Variants" : "Unsaved Variants"} ({tableData.length})
                    </h3>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <div className="min-w-[800px]">
                            <Table
                                headers={[
                                    "#",
                                    "Design",
                                    "Color",
                                    "Size",
                                    "Purchase",
                                    "Sale",
                                    "MRP",
                                    "Barcode",
                                    "Actions",
                                ]}
                            >
                                {tableData.map((v, index) => (
                                    <TableRow
                                        key={v._id}
                                        index={index + 1}
                                        row={v}
                                        columns={[
                                            v.designNo,
                                            v.color,
                                            v.size,
                                            v.purchase_price,
                                            v.sale_price,
                                            v.mrp,
                                            v.barcode,
                                        ]}
                                        actions={[
                                            { label: "Edit", onClick: () => handleEdit(v) },
                                            { label: "Delete", onClick: () => handleDelete(v) },
                                        ]}
                                    />
                                ))}
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={showMultiplierModal} onClose={() => setShowMultiplierModal(false)} title="Edit Price Multipliers" size="lg">
                <div className="space-y-5">
                    <p className="text-sm text-gray-600">
                        Update the saved MRP and Sale Price multiplier values used by the MRP Settings page.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">MRP Multiplier</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={mrpMultiplierInput}
                                onChange={(e) => setMrpMultiplierInput(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Purchase 100 × {Number(mrpMultiplierInput || 0)} = {Number(mrpMultiplierInput || 0) * 100}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price Multiplier</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={saleMultiplierInput}
                                onChange={(e) => setSaleMultiplierInput(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Purchase 100 × {Number(saleMultiplierInput || 0)} = {Number(saleMultiplierInput || 0) * 100}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Allow Manual Override (MRP)</label>
                            <p className="text-xs text-gray-500">If enabled, MRP can still be edited manually.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={allowManualOverride}
                                onChange={(e) => setAllowManualOverride(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Allow Manual Override (Sale Price)</label>
                            <p className="text-xs text-gray-500">If enabled, Sale Price can still be edited manually.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={allowSaleManualOverride}
                                onChange={(e) => setAllowSaleManualOverride(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowMultiplierModal(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveMultiplierSettings}
                            disabled={isSavingMultiplierSettings}
                            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary hover:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSavingMultiplierSettings ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function SmallInput({ label, required, placeholder, ...props }: { label: string; required?: boolean; placeholder?: string;[key: string]: any }) {
    return (
        <div>
            <label className={`block text-xs font-medium mb-1 ${required ? 'text-red-500' : 'text-gray-600'}`}>
                {label}
            </label>
            <input
                {...props}
                placeholder={placeholder}
                className="p-2 border text-sm rounded-md w-full text-gray-700 border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
            />
        </div>
    );
}
