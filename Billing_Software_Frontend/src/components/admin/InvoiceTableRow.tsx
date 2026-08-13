import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { Trash2, Edit2 } from "lucide-react";
import { useDebounce } from "@hooks/useDebounce";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import type { ProductItem } from "@models/product";
import { formatVariantDisplay, getBrandName } from "@utils/formatVariantDisplay";

interface Product {
    id: string;
    item_type: string;
    name?: string;
    code: string;
    hsn_code: string;
    unit: { id: string; name: string } | null;
    prices?: { selling?: number; purchase?: number };
    tax?: { group_id: string; group_name: string; total_rate: number } | null;
    brand?: { _id: string; brand_name: string };
}

interface Variant {
    _id: string;
    productId?: any;
    designNo?: string;
    color?: string;
    size?: string;
    sale_price?: number;
    purchase_price?: number;
    opening_qty?: number;
    discount_value?: number; // ✅ ADD THIS
    barcode?: string;
    mrp?: number;
}

interface InvoiceTableRowProps {
    item: ProductItem & any; // allow extra variant fields
    currencySymbol: string;
    onEditItem: (item: ProductItem) => void;
    onDeleteItem: (item: ProductItem) => void;
    availableItems: ProductItem[];
    onInLineItemChange: (updatedItem: ProductItem) => void;
    addNewProduct: () => void;
    selectedStaffId: string | null;
    selectedStaffName: string | null;
    index?: number;
}

const InvoiceTableRow: React.ForwardRefRenderFunction<HTMLTableRowElement, InvoiceTableRowProps> = (
    {
        item,
        currencySymbol,
        onEditItem,
        onDeleteItem,
        availableItems,
        onInLineItemChange,
        addNewProduct,
        selectedStaffId,
        selectedStaffName,
        index
    },
    ref
) => {
    const formatWholeAmount = (value: number | string | null | undefined) =>
        Number(value || 0).toFixed(2);

    const { token } = useSelector((state: RootState) => state.auth);
    const [searchInput, setSearchInput] = useState<string>(item.name || "");
    const debouncedSearchTerm = useDebounce(searchInput, 700);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchVariants, setSearchVariants] = useState<Variant[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);
    const variantDropdownRef = useRef<HTMLUListElement>(null);
    const variantInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    // VARIANTS
    const [variants, setVariants] = useState<Variant[]>([]);
    const [variantMap, setVariantMap] = useState<Record<string, Variant[]>>({});
    const variantCacheRef = useRef<Record<string, Variant[]>>({});
    const productCacheRef = useRef<Record<string, Product>>({});
    const [showVariantDropdown, setShowVariantDropdown] = useState(false);
    const [variantActiveIndex, setVariantActiveIndex] = useState(-1);
    const [variantInput, setVariantInput] = useState("");   // <-- replaces selectedVariant + variantSearchInput
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const [staffList, setStaffList] = useState<any[]>([]);
    const [showStaffDropdown, setShowStaffDropdown] = useState(false);
    const resolvedStaffName =
        item.staffName ||
        staffList.find((staff) => String(staff.id) === String(item.staffId || ""))?.name ||
        "";


    const getProductLabel = (product?: Product | null) =>
        product?.name || product?.code || product?.id || "";

    const getVariantProductId = (v: Variant) =>
        typeof v.productId === "object" && v.productId !== null
            ? (v.productId.id || v.productId._id)
            : v.productId;

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_STAFF_FOR_LIST_STAFF_URL}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const staffArray = response.data?.data ?? [];
                const formatted = staffArray.map((u: any) => ({ id: u.id, name: u.name }));
                setStaffList(formatted);
            } catch (error) {
                console.error("Error loading staff list:", error);
            }
        };
        fetchStaff();
    }, [token]);

    // Hide dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
            if (!event.target || !(event.target as HTMLElement).closest(".staff-select")) {
                setShowStaffDropdown(false);
            }
            if (!event.target || !(event.target as HTMLElement).closest(".variant-select")) {
                setShowVariantDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        setSearchInput(item.name);
        if (item.product_id) {
            fetchVariantsForProduct(item.product_id, { setActive: true });
        }
    }, [item.name, item.product_id]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setIsLoadingProducts(true);
                const term = debouncedSearchTerm.trim();
                if (!term) {
                    const response = await axios.get(`${Constants.FETCH_PRODUCTS_FOR_INVOICE_URL}?search=`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const productsArray: Product[] =
                        response.data?.data?.products ?? response.data?.data ?? [];

                    setProducts(productsArray);
                    setSearchVariants([]);
                    productsArray.forEach((p) => {
                        productCacheRef.current[p.id] = p;
                    });
                } else {
                    const response = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                        params: { search: term, all: true, limit: 0 },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const variantsArray: Variant[] =
                        response.data?.data?.variants ?? response.data?.data ?? [];
                    setSearchVariants(Array.isArray(variantsArray) ? variantsArray : []);
                    setProducts([]);
                }
            } catch (error) {
                console.error("Error fetching products:", error);
                setProducts([]);
                setSearchVariants([]);
            } finally {
                setIsLoadingProducts(false);
            }
        };
        fetchProducts();
    }, [debouncedSearchTerm, token, availableItems]);

    useEffect(() => {
        if (!products.length) return;
        products.forEach((p) => {
            if (!variantCacheRef.current[p.id]) {
                fetchVariantsForProduct(p.id);
            }
            productCacheRef.current[p.id] = p;
        });
    }, [products]);

    useEffect(() => {
        if (activeIndex > -1 && dropdownRef.current) {
            const items = dropdownRef.current.querySelectorAll('[data-dropdown-row="true"]');
            const activeItem = items[activeIndex] as HTMLLIElement | undefined;
            if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [activeIndex]);

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
                const cached = productCacheRef.current[productId];
                const fallbackProduct: Product = cached || {
                    id: String(productId),
                    item_type: "Product",
                    name: typeof v.productId === "object" && v.productId !== null ? v.productId.name : "",
                    code: typeof v.productId === "object" && v.productId !== null ? v.productId.code : "",
                    hsn_code: "",
                    unit: null,
                    prices: {},
                    tax: null,
                    brand: typeof v.productId === "object" && v.productId !== null ? v.productId.brand : undefined,
                };
                items.push({ type: "variant", product: fallbackProduct, variant: v });
            });
            return items;
        }

        products.forEach((p) => items.push({ type: "product", product: p }));
        return items;
    };

    useEffect(() => {
        if (variantActiveIndex > -1 && variantDropdownRef.current) {
            const variantItems = variantDropdownRef.current.querySelectorAll('[data-variant-row="true"]');
            const activeItem = variantItems[variantActiveIndex] as HTMLLIElement | undefined;
            if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [variantActiveIndex]);

    const isValidObjectId = (value?: string | null) =>
        !!value && /^[a-fA-F0-9]{24}$/.test(value);

    // Fetch variants for a product
    const fetchVariantsForProduct = async (productId: string, options?: { setActive?: boolean }) => {
        if (!isValidObjectId(productId)) {
            if (options?.setActive) {
                setVariants([]);
            }
            setVariantMap((prev) => ({ ...prev, [productId]: [] }));
            return [];
        }
        try {
            const url = Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", productId);
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            const list = res.data.data || [];
            variantCacheRef.current[productId] = list;
            setVariantMap((prev) => ({ ...prev, [productId]: list }));
            if (options?.setActive) {
                setVariants(list);
            }
            return list;
        } catch (err) {
            console.error("Failed to fetch variants:", err);
            if (options?.setActive) {
                setVariants([]);
            }
            setVariantMap((prev) => ({ ...prev, [productId]: [] }));
            return [];
        }
    };

    const ensureProductLoaded = async (productId?: string | null) => {
        if (!productId) return null;
        const existing = productCacheRef.current[productId];
        if (existing) return existing;
        try {
            const res = await axios.get(`${Constants.GET_PRODUCT_URL}/${productId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = res.data?.data ?? res.data?.product ?? res.data ?? {};
            const product: Product = {
                id: data._id || data.id || productId,
                item_type: data.item_type || "Product",
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
                brand: data.brand
                    ? { _id: data.brand._id || data.brand.id, brand_name: data.brand.brand_name || data.brand.name }
                    : undefined,
            };
            productCacheRef.current[productId] = product;
            return product;
        } catch (error) {
            console.error("Failed to load product details:", error);
            return null;
        }
    };

    // Select product
    const handleProductSelect = (product: Product) => {
        setSearchInput(getProductLabel(product));
        setShowDropdown(false);
        setActiveIndex(-1);
        setSelectedProduct(product);

        const rate = product.prices?.selling ?? 0;
        const tax = (rate * (product.tax?.total_rate ?? 0)) / 100;

        // fetch variants for this product immediately
        fetchVariantsForProduct(product.id, { setActive: true });

        if (item.product_id !== product.id) {
            setVariantInput("");
        }
        setShowVariantDropdown(true);  // open dropdown automatically
        setVariantActiveIndex(0);
        setTimeout(() => variantInputRef.current?.focus(), 0);

        onInLineItemChange({
            ...item,
            id: item.id || crypto.randomUUID(),
            product_id: product.id,
            name: getProductLabel(product),
            hsn_code: product.hsn_code,
            unit: product.unit?.name ?? "",
            qty: 1,
            rate,
            tax,
            tax_group_id: product.tax?.group_id,
            productBrandName: product.brand?.brand_name,
            // clear variant-specific fields until user selects
            variantId: null,
            variantDesignNo: undefined,
            variantColor: undefined,
            variantSize: undefined,
        });

        setShowVariantDropdown(true);
        setVariantActiveIndex(0);
        setTimeout(() => variantInputRef.current?.focus(), 0);
    };

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

    const applyVariantSelection = (product: Product | null, v: Variant) => {
        const safeProduct = product || selectedProduct;
        const qty = item.qty && item.qty > 0 ? item.qty : 1;
        const rate = v.sale_price ?? (item.rate || safeProduct?.prices?.selling || 0);
        const productLabel = getProductLabel(safeProduct || undefined);
        const designLabel = formatVariantDisplay({
            brandName: getBrandName(safeProduct?.brand),
            designNo: v.designNo,
            size: v.size,
        }) || v.designNo || productLabel || item.name || "";

        const existingDiscountValue = Number(item.discount_value ?? item.discount ?? 0);
        const existingDiscountType = item.discount_type || "Fixed";
        const hasExistingDiscount = existingDiscountValue > 0;

        const variantDiscountPercent = Number(v.discount_value || 0);
        const nextDiscountType = hasExistingDiscount
            ? existingDiscountType
            : variantDiscountPercent > 0
                ? "Percentage"
                : "Fixed";
        const nextDiscountValue = hasExistingDiscount
            ? existingDiscountValue
            : variantDiscountPercent > 0
                ? variantDiscountPercent
                : 0;

        setSearchInput(designLabel);
        setVariantInput(`${v.color || ""} - ${v.size || ""}`.trim());
        setShowVariantDropdown(false);
        setShowDropdown(false);
        setActiveIndex(-1);

        onInLineItemChange({
            ...item,
            id: item.id || crypto.randomUUID(),
            product_id: safeProduct?.id || item.product_id,
            name: designLabel,
            hsn_code: safeProduct?.hsn_code || item.hsn_code || "",
            unit: safeProduct?.unit?.name ?? item.unit ?? "",
            qty,
            rate,
            tax_group_id: safeProduct?.tax?.group_id ?? item.tax_group_id,
            productBrandName: safeProduct?.brand?.brand_name ?? item.productBrandName,
            variantId: v._id,
            variantName: `${v.color || ""} - ${v.size || ""}`.trim(),
            variantDesignNo: v.designNo,
            variantColor: v.color,
            variantSize: v.size,
            variantBarcode: v.barcode,
            variantMrp: v.mrp,
            discount_type: nextDiscountType,
            discount_value: nextDiscountValue,
        });

        setTimeout(() => qtyInputRef.current?.focus(), 0);

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

    // Select variant
    const handleVariantSelect = (v: Variant) => {
        applyVariantSelection(selectedProduct || null, v);
    };

    const handleVariantSelectFromProduct = async (product: Product | null, v: Variant) => {
        const productId = product?.id || getVariantProductId(v);
        const resolvedProduct = await ensureProductLoaded(productId);
        if (resolvedProduct) {
            setSelectedProduct(resolvedProduct);
            setVariants(variantMap[resolvedProduct.id] || []);
        }
        applyVariantSelection(resolvedProduct || product || null, v);
    };

    const handleRowDiscountChange = (value: string) => {
        const qty = Number(item.qty) || 0;
        const rate = Number(item.rate) || 0;
        const lineTotal = qty * rate;
        const rawDiscount = Number(value) || 0;
        const safeDiscount = Math.max(0, rawDiscount);
        const clampedDiscount = Math.min(safeDiscount, lineTotal);

        onInLineItemChange({
            ...item,
            discount_type: "Fixed",
            discount_value: clampedDiscount,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    const preventEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
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
                if (variantActiveIndex > -1) {
                    handleVariantSelect(filteredVariants[variantActiveIndex]);
                }
                break;
            case "Escape":
                e.stopPropagation();
                setShowVariantDropdown(false);
                break;
        }
    };

    const handleManualChange = (key: keyof ProductItem & string, value: any) => {
        const updated = { ...item, [key]: value } as ProductItem & any;
        if (key === "qty" || key === "rate") {
            updated.amount = (updated.qty || 0) * (updated.rate || 0);
        }
        onInLineItemChange(updated);
    };

    return (
        <>
            <tr ref={ref} className="bg-white text-gray-950 border-b border-gray-200">
                {/* S.No. */}
                <td className="p-2 text-sm text-gray-700 w-12 text-center">
                    {index !== undefined ? index + 1 : "-"}
                </td>

                {/* Product */}
                <td className="p-2 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                    {item.name || "-"}
                </td>

                {/* Color / Size */}
                <td className="p-2 text-sm text-gray-700">
                    {item.variantName || "-"}
                </td>

                {/* Unit */}

                {/* Quantity */}
                <td className="p-2 text-sm text-gray-700">
                    {item.qty}
                </td>

                {/* Rate */}
                <td className="p-2 text-sm text-gray-700">
                    {formatWholeAmount(item.rate)}
                </td>

                {/* Discount */}
                <td className="p-2 text-sm text-gray-700">
                    {item.discount ? formatWholeAmount(item.discount) : "0"}
                </td>

                {/* Tax */}
                <td className="text-sm text-gray-700 text-left p-2">
                    {formatWholeAmount(item.tax)}
                </td>

                {/* Staff */}
                <td className="p-2 text-sm text-gray-700">
                    {resolvedStaffName || "-"}
                </td>

                {/* Amount */}
                <td className="p-2 font-semibold text-gray-800">{currencySymbol}{formatWholeAmount(item.amount)}</td>

                {/* Actions */}
                <td className="p-2 flex items-center gap-2">
                    <button type="button" onClick={() => onEditItem(item)} aria-label="Edit item"><Edit2 size={16} className="text-gray-600 hover:text-primary" /></button>
                    <button type="button" onClick={() => onDeleteItem(item)} aria-label="Remove item"><Trash2 size={16} className="text-red-500 hover:text-red-600" /></button>
                </td>
            </tr>
        </>
    );
};

export default React.memo(React.forwardRef(InvoiceTableRow));
