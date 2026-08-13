import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import { Trash2, Printer, PencilLine, Edit2 } from "lucide-react";
import { useDebounce } from "@hooks/useDebounce";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import type { ProductItem } from "@models/product";
import PrintBarcode from "./PrintBarcode";
import { formatVariantDisplay, getBrandName } from "@utils/formatVariantDisplay";

interface Product {
    id: string;
    _id?: string;
    name?: string;
    code: string;
    hsn_code: string;
    unit: { id: string; name: string } | null;
    prices?: { purchase?: number };
    tax?: { group_id: string; group_name: string; total_rate: number } | null;
    category?: { _id: string; category_name: string } | null;
    brand?: { _id: string; brand_name: string } | null;
}

interface Variant {
    _id: string;
    productId?: any;
    designNo?: string;
    color?: string;
    size?: string;
    purchase_price?: number;
    sale_price?: number;
    barcode?: string;
    mrp?: number;
}

interface Props {
    item: ProductItem & any;
    currencySymbol: string;
    onEditItem: (item: ProductItem) => void;
    onDeleteItem: (item: ProductItem) => void;
    availableItems: ProductItem[];
    onInLineItemChange: (updatedItem: ProductItem) => void;
    addNewProduct: () => void;
    onAddVariants?: (variants: Variant[], product: Product) => void; // New Prop
    onOpenProductEditor?: (item: ProductItem & any) => void;
    index?: number;
}

const PurchaseInvoiceTableRow = React.forwardRef<HTMLTableRowElement, Props>(
    (
        {
            item,
            currencySymbol,
            onEditItem,
            onDeleteItem,
            availableItems,
            onInLineItemChange,
            addNewProduct,
            onAddVariants,
            onOpenProductEditor,
            index,
        },
        ref
    ) => {
        const { token } = useSelector((state: RootState) => state.auth);

        /* ---------------- PRODUCT SEARCH ---------------- */
        const [searchInput, setSearchInput] = useState(item.name || "");
        const [searchTerm, setSearchTerm] = useState(item.name || "");
        const debouncedSearch = useDebounce(searchTerm, 350);
        const [products, setProducts] = useState<Product[]>([]);
        const [searchVariants, setSearchVariants] = useState<Variant[]>([]);
        const [showDropdown, setShowDropdown] = useState(false);
        const [activeIndex, setActiveIndex] = useState(-1);
        const searchRef = useRef<HTMLDivElement>(null);
        const dropdownRef = useRef<HTMLUListElement>(null);
        const [isLoadingProducts, setIsLoadingProducts] = useState(false);
        const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
        const [variantMap, setVariantMap] = useState<Record<string, Variant[]>>({});
        const variantCacheRef = useRef<Record<string, Variant[]>>({});
        const productCacheRef = useRef<Record<string, Product>>({});

        /* ---------------- VARIANTS ---------------- */
        const [variants, setVariants] = useState<Variant[]>([]);
        const [variantInput, setVariantInput] = useState("");
        const [showVariantDropdown, setShowVariantDropdown] = useState(false);
        const [variantActiveIndex, setVariantActiveIndex] = useState(-1);
        const variantDropdownRef = useRef<HTMLUListElement>(null);
        const variantInputRef = useRef<HTMLInputElement>(null);
        const [showPrintBarcode, setShowPrintBarcode] = useState(false);
        const [resolvedBarcodeOverride, setResolvedBarcodeOverride] = useState<string | null>(null);
        const [resolvedBrandNameOverride, setResolvedBrandNameOverride] = useState<string | null>(null);
        const [resolvedPriceOverride, setResolvedPriceOverride] = useState<number | null>(null);
        const [resolvedSalePriceOverride, setResolvedSalePriceOverride] = useState<number | null>(null);
        const [isResolvingBarcode, setIsResolvingBarcode] = useState(false);
        const barcodeCacheRef = useRef<Record<string, string>>({});

        const openPrintBarcodeModal = () => {
            setShowPrintBarcode(true);
        };

        const resolveBrandNameInBackground = async () => {
            if (resolvedBrandName) return;

            if (item.product_id) {
                const loaded = await ensureProductLoaded(String(item.product_id));
                if (loaded?.brand?.brand_name) {
                    setResolvedBrandNameOverride(loaded.brand.brand_name);
                }
                return;
            }

            if (item.variantId) {
                const variantMatch = variants.find((v) => String(v._id || (v as any).id) === String(item.variantId));
                const productId = variantMatch ? getVariantProductId(variantMatch) : undefined;
                if (productId) {
                    const loaded = await ensureProductLoaded(String(productId));
                    if (loaded?.brand?.brand_name) {
                        setResolvedBrandNameOverride(loaded.brand.brand_name);
                    }
                }
            }
        };

        const getProductLabel = (product?: Product | null) =>
            product?.name || product?.code || product?.id || product?._id || "";

        const getVariantProductId = (v: Variant) =>
            typeof v.productId === "object" && v.productId !== null
                ? (v.productId.id || v.productId._id)
                : v.productId;

        const buildProductFromVariant = (v: Variant): Product | null => {
            if (typeof v.productId !== "object" || v.productId === null) return null;
            const source = v.productId;
            const productId = source.id || source._id;
            if (!productId) return null;
            const taxRates = Array.isArray(source.tax?.tax_rate_ids)
                ? source.tax.tax_rate_ids.reduce((sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0), 0)
                : 0;
            return {
                id: productId,
                _id: productId,
                name: source.name || "",
                code: source.code || "",
                hsn_code: source.hsn_code || "",
                unit: source.unit
                    ? {
                        id: source.unit.id || source.unit._id || "",
                        name: source.unit.short_name || source.unit.unit_name || source.unit.name || "",
                    }
                    : null,
                prices: {
                    purchase: Number(v.purchase_price ?? source.purchase_price ?? 0),
                },
                tax: source.tax
                    ? {
                        group_id: source.tax.group_id || source.tax._id || "",
                        group_name: source.tax.group_name || source.tax.tax_name || "",
                        total_rate: Number(source.tax.total_rate ?? source.tax.total_tax_rate ?? taxRates),
                    }
                    : null,
                category: source.category || null,
                brand: source.brand || null,
            };
        };

        const isValidObjectId = (value: unknown) =>
            typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

        const resolvedBarcode =
            resolvedBarcodeOverride ||
            item.variantBarcode ||
            (item as any).variant?.barcode ||
            variants.find((v) => String(v._id) === String(item.variantId))?.barcode;
        const resolvedBrandName =
            resolvedBrandNameOverride ||
            item.productBrandName ||
            selectedProduct?.brand?.brand_name ||
            (item as any).product?.brand?.brand_name ||
            (() => {
                const match = variants.find((v) => String(v._id) === String(item.variantId));
                const productId = match ? getVariantProductId(match) : undefined;
                const cachedProduct = productId ? productCacheRef.current[String(productId)] : undefined;
                if (cachedProduct?.brand?.brand_name) return cachedProduct.brand.brand_name;
                const productMatch = products.find(
                    (p) => String(p.id || p._id) === String(productId)
                );
                return productMatch?.brand?.brand_name || "";
            })();
        const resolvedPrice =
            resolvedPriceOverride ??
            item.variantMrp ??
            (item as any).variant?.mrp ??
            variants.find((v) => String(v._id) === String(item.variantId))?.mrp;
        const resolvedSalePrice =
            resolvedSalePriceOverride ??
            item.variantSalePrice ??
            (item as any).variant?.sale_price ??
            variants.find((v) => String(v._id) === String(item.variantId))?.sale_price;
        const resolvedPrintProductName =
            item.variantDesignNo ||
            (item as any).variant?.designNo ||
            (() => {
                const currentName = String(item.name || "").trim();
                const currentBrand = String(resolvedBrandName || "").trim();
                if (!currentName) return "";
                if (!currentBrand) return currentName;

                const prefixedName = `${currentBrand} - `;
                if (currentName.startsWith(prefixedName)) {
                    return currentName.slice(prefixedName.length).trim();
                }
                if (currentName === currentBrand) {
                    return "";
                }
                return currentName;
            })();

        // HYDRATE VARIANT ON EDIT
        useEffect(() => {
            if (item.variantName) {
                setVariantInput(item.variantName);
            } else {
                setVariantInput("");
            }
        }, [
            item.variantId,
            item.variantName,
            item.variantDesignNo,
            item.variantColor,
            item.variantSize,
        ]);

        useEffect(() => {
            if (!showDropdown) {
                setSearchInput(item.name || "");
            }
        }, [item.name, showDropdown]);

        useEffect(() => {
            if (item.product_id && isValidObjectId(String(item.product_id))) {
                fetchVariants(item.product_id);
            }
        }, [item.product_id]);

        /* ---------------- OUTSIDE CLICK ---------------- */
        useEffect(() => {
            const handler = (e: MouseEvent) => {
                if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                    setShowDropdown(false);
                }
                if (!(e.target as HTMLElement)?.closest(".variant-select")) {
                    setShowVariantDropdown(false);
                }
            };
            document.addEventListener("mousedown", handler);
            return () => document.removeEventListener("mousedown", handler);
        }, []);

        useEffect(() => {
            if (activeIndex > -1 && dropdownRef.current) {
                const items = dropdownRef.current.querySelectorAll('[data-dropdown-row="true"]');
                const activeItem = items[activeIndex] as HTMLLIElement | undefined;
                if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }, [activeIndex]);

        useEffect(() => {
            if (variantActiveIndex > -1 && variantDropdownRef.current) {
                const items = variantDropdownRef.current.querySelectorAll('[data-variant-row="true"]');
                const activeItem = items[variantActiveIndex] as HTMLLIElement | undefined;
                if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }, [variantActiveIndex]);

        /* ---------------- FETCH PRODUCTS ---------------- */
        useEffect(() => {
            const fetchProducts = async () => {
                try {
                    setIsLoadingProducts(true);
                    const term = debouncedSearch.trim();
                    if (!term) {
                        const res = await axios.get(
                            `${Constants.FETCH_PRODUCTS_FOR_INVOICE_URL}?search=`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );

                        const list: Product[] = res.data?.data?.products ?? res.data?.data ?? [];
                        setProducts(list);
                        setSearchVariants([]);
                        list.forEach((p) => {
                            const key = (p as any).id || (p as any)._id;
                            if (key) productCacheRef.current[key] = p;
                        });
                    } else {
                        const res = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                            params: { search: term, all: true, limit: 0 },
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const variantsArray: Variant[] =
                            res.data?.data?.variants ?? res.data?.data ?? [];
                        setSearchVariants(Array.isArray(variantsArray) ? variantsArray : []);
                        setProducts([]);
                    }
                } catch {
                    setProducts([]);
                    setSearchVariants([]);
                } finally {
                    setIsLoadingProducts(false);
                }
            };

            fetchProducts();
        }, [debouncedSearch, token, availableItems]);

        /* ---------------- FETCH VARIANTS ---------------- */
        const fetchVariants = async (productId: string) => {
            try {
                if (!isValidObjectId(String(productId))) {
                    setVariants([]);
                    return [];
                }
                const url = Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", productId);
                const res = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const fetchedVariants = res.data.data || [];
                setVariants(fetchedVariants);
                variantCacheRef.current[productId] = fetchedVariants;
                setVariantMap(prev => ({ ...prev, [productId]: fetchedVariants }));
                return fetchedVariants;
            } catch {
                setVariants([]);
                return [];
            }
        };

        const ensureProductLoaded = async (productId?: string | null) => {
            if (!productId || !isValidObjectId(String(productId))) return null;
            const existing = productCacheRef.current[productId];
            if (existing) return existing;
            try {
                const res = await axios.get(`${Constants.GET_PRODUCT_URL}/${productId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = res.data?.data ?? res.data?.product ?? res.data ?? {};
                const product: Product = {
                    id: data._id || data.id || productId,
                    _id: data._id || data.id || productId,
                    name: data.name || "",
                    code: data.code || "",
                    hsn_code: data.hsn_code || "",
                    unit: data.unit
                        ? {
                            id: data.unit._id || data.unit.id,
                            name: data.unit.short_name || data.unit.unit_name || data.unit.name || "",
                        }
                        : null,
                    prices: data.prices || undefined,
                    tax: data.tax
                        ? {
                            group_id: data.tax._id || data.tax.group_id,
                            group_name: data.tax.tax_name || data.tax.group_name,
                            total_rate: data.tax.total_tax_rate ?? data.tax.total_rate ?? 0,
                        }
                        : null,
                    category: data.category || null,
                    brand: data.brand || null,
                };
                productCacheRef.current[productId] = product;
                return product;
            } catch {
                return null;
            }
        };

        useEffect(() => {
            const fetchVariantsForDropdown = async () => {
                const missing = products.filter(p => {
                    const key = (p as any).id || (p as any)._id;
                    return key && isValidObjectId(String(key)) && !variantCacheRef.current[key];
                });
                if (missing.length === 0) return;

                await Promise.all(missing.map(async (p) => {
                    const productKey = (p as any).id || (p as any)._id;
                    if (!productKey || !isValidObjectId(String(productKey))) return;
                    try {
                        const url = Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", productKey);
                        const res = await axios.get(url, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const fetchedVariants = res.data.data || [];
                        variantCacheRef.current[productKey] = fetchedVariants;
                        setVariantMap(prev => ({ ...prev, [productKey]: fetchedVariants }));
                    } catch {
                        variantCacheRef.current[productKey] = [];
                        setVariantMap(prev => ({ ...prev, [productKey]: [] }));
                    }
                }));
            };

            if (showDropdown && products.length > 0) {
                fetchVariantsForDropdown();
            }
            products.forEach((p) => {
                const key = (p as any).id || (p as any)._id;
                if (key) productCacheRef.current[key] = p;
            });
        }, [showDropdown, products, token]);

        const formatProductLabel = (product: Product, variantLabel?: string) => {
            const category = product.category?.category_name || "Uncategorized";
            const brand = product.brand?.brand_name || "No Brand";
            const variant = variantLabel || "Select Variant";
            return `${category} / ${brand} / ${getProductLabel(product)} / ${variant}`;
        };

        const getDropdownItems = () => {
            const term = searchInput.trim().toLowerCase();
            const items: Array<
                | { type: "product"; product: Product }
                | { type: "variant"; product: Product; variant: Variant }
            > = [];

            if (term.length > 0) {
                searchVariants.forEach((v) => {
                    const productId = getVariantProductId(v);
                    if (!productId) return;
                    const populatedProduct = buildProductFromVariant(v);
                    const cached = productCacheRef.current[productId] || populatedProduct;
                    if (populatedProduct) {
                        productCacheRef.current[productId] = populatedProduct;
                    }
                    const fallbackProduct: Product = cached || {
                        id: String(productId),
                        _id: String(productId),
                        name: typeof v.productId === "object" && v.productId !== null ? v.productId.name : "",
                        code: typeof v.productId === "object" && v.productId !== null ? v.productId.code : "",
                        hsn_code: "",
                        unit: null,
                        prices: {},
                        tax: null,
                        category: null,
                        brand: typeof v.productId === "object" && v.productId !== null ? v.productId.brand : null,
                    };
                    items.push({ type: "variant", product: fallbackProduct, variant: v });
                });
                return items;
            }

            products.forEach((p) => items.push({ type: "product", product: p }));
            return items;
        };

        const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (!showDropdown) return;
            const dropdownItems = getDropdownItems();
            if (dropdownItems.length === 0) return;
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev < dropdownItems.length - 1 ? prev + 1 : prev));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    break;
                case "Enter":
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeIndex > -1) {
                        const selected = dropdownItems[activeIndex];
                        if (selected.type === "product") {
                            handleProductSelect(selected.product);
                            setTimeout(() => variantInputRef.current?.focus(), 0);
                        } else {
                            handleVariantSelectFromProduct(selected.product, selected.variant);
                        }
                    }
                    break;
                case "Escape":
                    e.stopPropagation();
                    setShowDropdown(false);
                    break;
            }
        };

        const handleVariantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
            }
            if (!showVariantDropdown || variants.length === 0) return;
            const filteredVariants = variants.filter((v) =>
                `${v.designNo} ${v.color} ${v.size}`.toLowerCase().includes((variantInput || "").toLowerCase())
            );
            if (filteredVariants.length === 0) return;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    e.stopPropagation();
                    setVariantActiveIndex((prev) => (prev < filteredVariants.length - 1 ? prev + 1 : prev));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    e.stopPropagation();
                    setVariantActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    break;
                case "Enter":
                    e.preventDefault();
                    e.stopPropagation();
                    if (variantActiveIndex > -1) handleVariantSelect(filteredVariants[variantActiveIndex]);
                    break;
                case "Escape":
                    e.stopPropagation();
                    setShowVariantDropdown(false);
                    break;
            }
        };

        /* ---------------- PRODUCT SELECT ---------------- */
        const handleProductSelect = async (product: Product) => {
            const rate = product.prices?.purchase ?? 0;
            const productKey = (product as any).id || (product as any)._id;
            const taxGroupId = product.tax?.group_id || null;
            setVariantInput("");
            setSelectedProduct(product);

            // Normal flow if no variants
            onInLineItemChange({
                ...item,
                product_id: productKey,
                name: getProductLabel(product),
                hsn_code: product.hsn_code,
                unit: product.unit?.name ?? "",
                qty: 1,
                rate,
                tax_group_id: taxGroupId,
                productBrandName: product.brand?.brand_name ?? item.productBrandName,
                variantId: null,
            });

            setSearchInput(formatProductLabel(product));
            setShowDropdown(false);
            setShowVariantDropdown(true);
            setVariantActiveIndex(0);
            setTimeout(() => variantInputRef.current?.focus(), 0);
        };

        const handleVariantSelectFromProduct = async (product: Product | null, v: Variant) => {
            const productId = product?.id || getVariantProductId(v);
            const populatedProduct = buildProductFromVariant(v);
            if (populatedProduct) {
                productCacheRef.current[String(populatedProduct.id)] = populatedProduct;
            }
            const resolvedProduct = product || populatedProduct || await ensureProductLoaded(productId);
            const safeProduct = resolvedProduct || product;
            if (!safeProduct) return;
            const rate = v.purchase_price ?? safeProduct.prices?.purchase ?? 0;
            const qty = item.qty || 1;
            const taxGroupId = safeProduct.tax?.group_id || item.tax_group_id || null;
            const displayLabel = formatVariantDisplay({
                brandName: getBrandName(safeProduct.brand),
                designNo: v.designNo,
                size: v.size,
            }) || v.designNo || getProductLabel(safeProduct);
            onInLineItemChange({
                ...item,
                product_id: safeProduct.id,
                name: displayLabel,
                hsn_code: safeProduct.hsn_code,
                unit: safeProduct.unit?.name ?? "",
                qty,
                rate,
                tax_group_id: taxGroupId,
                productBrandName: safeProduct.brand?.brand_name ?? item.productBrandName,
                variantId: v._id,
                variantName: `${v.color || ""} - ${v.size || ""}`.trim(),
                variantDesignNo: v.designNo,
                variantColor: v.color,
                variantSize: v.size,
                variantBarcode: (v as any).barcode,
                variantMrp: (v as any).mrp
            });

            setSelectedProduct(safeProduct);
            setSearchInput(displayLabel);
            setVariantInput(`${v.designNo || ""} - ${v.color || ""} - ${v.size || ""}`);
            setShowDropdown(false);
            setShowVariantDropdown(false);

            const lastRow = availableItems[availableItems.length - 1];
            const isLastRow =
                lastRow === item ||
                (lastRow && item && lastRow.rowId && item.rowId && lastRow.rowId === item.rowId) ||
                (lastRow && item && lastRow.id && item.id && lastRow.id === item.id);
            const hasEmptyRow = availableItems.some((row) => !row.product_id && !row.name);
            if (isLastRow && !hasEmptyRow) {
                addNewProduct();
            }
        };

        /* ---------------- VARIANT SELECT ---------------- */
        const handleVariantSelect = (v: Variant) => {
            const rate = v.purchase_price ?? item.rate ?? 0;
            const qty = item.qty || 1;
            const taxGroupId = selectedProduct?.tax?.group_id || item.tax_group_id || null;
            const displayLabel = formatVariantDisplay({
                brandName: getBrandName(selectedProduct?.brand ?? item.productBrandName),
                designNo: v.designNo,
                size: v.size,
            }) || v.designNo || item.name;

            const variantLabel = `${v.color || ""} - ${v.size || ""}`.trim();
            setVariantInput(`${v.designNo || ""} - ${v.color || ""} - ${v.size || ""}`);

            onInLineItemChange({
                ...item,
                name: displayLabel,
                variantId: v._id,
                variantName: `${v.color} - ${v.size}`,
                variantDesignNo: v.designNo,
                variantColor: v.color,
                variantSize: v.size,
                productBrandName: selectedProduct?.brand?.brand_name ?? item.productBrandName,
                rate,
                qty,
                tax_group_id: taxGroupId,
            });

            setSearchInput(displayLabel);
            setShowVariantDropdown(false);

            const lastRow = availableItems[availableItems.length - 1];
            const isLastRow =
                lastRow === item ||
                (lastRow && item && lastRow.rowId && item.rowId && lastRow.rowId === item.rowId) ||
                (lastRow && item && lastRow.id && item.id && lastRow.id === item.id);
            const hasEmptyRow = availableItems.some((row) => !row.product_id && !row.name);
            if (isLastRow && !hasEmptyRow) {
                addNewProduct();
            }
        };

        const preventEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        /* ---------------- MANUAL CHANGE ---------------- */
        const handleChange = (key: string, value: any) => {
            const updated = { ...item, [key]: value };
            onInLineItemChange(updated);
        };

        return (
            <>
                <tr ref={ref} className="bg-white text-gray-950 border-b border-gray-200">
                    {/* S.No */}
                    <td className="p-2 text-sm text-gray-700 font-medium text-center">
                        {index !== undefined ? index + 1 : "-"}
                    </td>

                    {/* PRODUCT */}
                    <td className="p-2 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                        {item.name || "-"}
                    </td>

                    {/* COLOR / SIZE */}
                    <td className="p-2 text-sm text-gray-700">
                        {item.variantName || "-"}
                    </td>

                    {/* QTY */}
                    <td className="p-2 text-sm text-gray-700">
                        {item.qty}
                    </td>

                    {/* RATE */}
                    <td className="p-2 text-sm text-gray-700">
                        {Number(item.rate || 0).toFixed(2)}
                    </td>

                    {/* DISCOUNT */}
                    <td className="p-2 text-sm text-gray-700">
                        {item.discount ? Number(item.discount).toFixed(2) : "0.00"}
                    </td>

                    {/* TAX */}
                    <td className="p-2 text-sm text-gray-700">
                        {currencySymbol}{Number(item.tax || 0).toFixed(2)}
                    </td>

                    {/* AMOUNT */}
                    <td className="p-2 font-semibold text-gray-800">
                        {currencySymbol}{Number(item.amount || 0).toFixed(2)}
                    </td>

                    {/* ACTIONS */}
                    <td className="p-2 flex items-center gap-2">
                        {item.isCreatedFromModalProduct && onOpenProductEditor && (
                            <button
                                type="button"
                                onClick={() => onOpenProductEditor(item)}
                                title="Edit product"
                            >
                                <PencilLine size={16} className="text-primary hover:text-purple-700" />
                            </button>
                        )}
                        <button type="button" onClick={() => onEditItem(item)} aria-label="Edit item"><Edit2 size={16} className="text-gray-600 hover:text-primary" /></button>
                        <button type="button" onClick={() => onDeleteItem(item)}>
                            <Trash2 size={16} className="text-red-500 hover:text-red-600" />
                        </button>
                        {(resolvedBarcode || item.variantId) && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (resolvedBarcode) {
                                        openPrintBarcodeModal();
                                        void resolveBrandNameInBackground();
                                        return;
                                    }
                                    if (!item.variantId) return;
                                    const key = String(item.variantId);
                                    const cached = barcodeCacheRef.current[key];
                                    if (cached) {
                                        setResolvedBarcodeOverride(cached);
                                        openPrintBarcodeModal();
                                        void resolveBrandNameInBackground();
                                        return;
                                    }

                                    const currentVariantMatch = variants.find(
                                        (v) => String(v._id || (v as any).id) === key
                                    );
                                    if (currentVariantMatch?.barcode) {
                                        barcodeCacheRef.current[key] = currentVariantMatch.barcode;
                                        setResolvedBarcodeOverride(currentVariantMatch.barcode);
                                        if (typeof currentVariantMatch.mrp === "number") {
                                            setResolvedPriceOverride(currentVariantMatch.mrp);
                                        }
                                        if (typeof currentVariantMatch.sale_price === "number") {
                                            setResolvedSalePriceOverride(currentVariantMatch.sale_price);
                                        }
                                        openPrintBarcodeModal();
                                        void resolveBrandNameInBackground();
                                        return;
                                    }
                                    try {
                                        setIsResolvingBarcode(true);
                                        const fallbackProductId =
                                            String(item.product_id || item.productId || "").trim() ||
                                            String(getVariantProductId(currentVariantMatch as Variant) || "").trim();

                                        let scopedVariants = variants;
                                        if (fallbackProductId && isValidObjectId(fallbackProductId)) {
                                            scopedVariants =
                                                variantCacheRef.current[fallbackProductId] ||
                                                variantMap[fallbackProductId] ||
                                                await fetchVariants(fallbackProductId);
                                        }

                                        const match = (Array.isArray(scopedVariants) ? scopedVariants : []).find(
                                            (v) => String(v._id || (v as any).id) === key
                                        );

                                        if (match?.barcode) {
                                            barcodeCacheRef.current[key] = match.barcode;
                                            setResolvedBarcodeOverride(match.barcode);
                                            if (typeof match.mrp === "number") {
                                                setResolvedPriceOverride(match.mrp);
                                            }
                                            if (typeof match.sale_price === "number") {
                                                setResolvedSalePriceOverride(match.sale_price);
                                            }

                                            openPrintBarcodeModal();

                                            const productId = getVariantProductId(match);
                                            if (productId) {
                                                void ensureProductLoaded(String(productId)).then((loaded) => {
                                                    if (loaded?.brand?.brand_name) {
                                                        setResolvedBrandNameOverride(loaded.brand.brand_name);
                                                    }
                                                });
                                            } else {
                                                void resolveBrandNameInBackground();
                                            }
                                        } else {
                                            alert("Barcode not found for this item.");
                                        }
                                    } catch {
                                        alert("Failed to resolve barcode for this item.");
                                    } finally {
                                        setIsResolvingBarcode(false);
                                    }
                                }}
                                aria-label="Print barcode"
                                title="Print Barcode"
                                disabled={isResolvingBarcode}
                            >
                                <Printer size={16} className="text-blue-600 hover:text-blue-700" />
                            </button>
                        )}
                    </td>
                </tr>

                {showPrintBarcode && resolvedBarcode && ReactDOM.createPortal(
                    <PrintBarcode
                        barcode={resolvedBarcode}
                        productName={resolvedPrintProductName}
                        brandName={resolvedBrandName}
                        variantSize={item.variantSize}
                        price={resolvedPrice}
                        salePrice={resolvedSalePrice}
                        defaultQuantity={Number(item.qty) > 0 ? Number(item.qty) : 1}
                        onClose={() => setShowPrintBarcode(false)}
                    />,
                    document.body
                )}
            </>
        );
    }
);

export default React.memo(PurchaseInvoiceTableRow);
