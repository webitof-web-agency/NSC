import { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { toast } from 'react-toastify';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import SmartDropdown from '@components/admin/SmartDropdown';
import CreateCategoryModal from '@pages/admin/productAndServices/CreateCategoryModal';
import CreateBrandModal from '@pages/admin/productAndServices/CreateBrandModal';
import Modal from '@components/admin/Modal';
import { useDebounce } from '@hooks/useDebounce';

interface Brand {
    _id: string;
    brand_name: string;
    hsn_code?: string;
}

interface Category {
    _id: string;
    category_name: string;
    defaultUnitId?: { _id?: string; id?: string; unit_name?: string; short_name?: string } | null;
    defaultTaxId?: { _id?: string; id?: string; tax_name?: string; total_tax_rate?: number } | null;
}

interface Product {
    _id: string;
    name: string;
    code: string;
    brand: Brand | null;
    category: Category | null;
}

type VariantProductRef = string | (Product & { id?: string });

interface ProductVariant {
    _id: string;
    productId: VariantProductRef;
    designNo: string;
    color: string;
    size: string;
    purchase_price: number;
    sale_price: number;
    mrp: number;
    min_sale_price: number;
    reorder_limit: number;
    discount_value: number;
    barcode: string;
}

interface ProductSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProductSidebar({ isOpen, onClose }: ProductSidebarProps) {
    const { token } = useSelector((state: RootState) => state.auth);
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({});
    const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingVariants, setIsLoadingVariants] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 350);
    const [autoExpandedProducts, setAutoExpandedProducts] = useState<Set<string>>(new Set());
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [variantModalProductId, setVariantModalProductId] = useState<string | null>(null);
    const [isSavingVariant, setIsSavingVariant] = useState(false);
    const [mrpMultiplier, setMrpMultiplier] = useState<number>(0);
    const [saleMultiplier, setSaleMultiplier] = useState<number>(0);
    const [allowManualOverride, setAllowManualOverride] = useState(true);
    const [allowSaleManualOverride, setAllowSaleManualOverride] = useState(true);
    const [variantForm, setVariantForm] = useState({
        designNo: "",
        color: "",
        size: "",
        purchase_price: "",
        sale_price: "",
        mrp: "",
        barcode: ""
    });
    const [sizes, setSizes] = useState<{ id: string; name: string }[]>([]);
    const [colors, setColors] = useState<{ id: string; name: string }[]>([]);
    const [sizeSearchInput, setSizeSearchInput] = useState("");
    const [colorSearchInput, setColorSearchInput] = useState("");
    const [showProductModal, setShowProductModal] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categorySearchInput, setCategorySearchInput] = useState("");
    const [brandSearchInput, setBrandSearchInput] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
    const [resumeAddProductAfterCreate, setResumeAddProductAfterCreate] = useState(false);

    const getVariantProductId = (variant: ProductVariant) => {
        const raw = variant.productId;
        if (!raw) return null;
        if (typeof raw === "string") return raw;
        return raw._id || raw.id || null;
    };

    const getVariantProduct = (variant: ProductVariant): Product | null => {
        const raw = variant.productId;
        if (!raw || typeof raw === "string") return null;
        return raw;
    };

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        fetchProducts(debouncedSearchQuery, controller.signal);
        fetchAllVariants(debouncedSearchQuery, controller.signal);

        return () => controller.abort();
    }, [isOpen, debouncedSearchQuery, token]);

    useEffect(() => {
        const handleProductCreated = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            const productId = detail.productId || detail.product?._id;
            fetchProducts(debouncedSearchQuery);
            fetchAllVariants();

            if (productId) {
                setExpandedProductId(productId);
                setVariants(prev => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
                });
                fetchVariantsForProduct(productId, true);
            }
        };

        const handleVariantCreated = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            const productId = detail.productId;
            fetchAllVariants();
            fetchProducts(debouncedSearchQuery);

            if (productId) {
                setVariants(prev => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
                });
                fetchVariantsForProduct(productId, true);
            }
        };

        const handleVariantDeleted = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            const productId = detail.productId;
            fetchAllVariants();
            fetchProducts(debouncedSearchQuery);

            if (productId) {
                setVariants(prev => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
                });
                fetchVariantsForProduct(productId, true);
            }
        };

        window.addEventListener("productCreated", handleProductCreated);
        window.addEventListener("variantCreated", handleVariantCreated);
        window.addEventListener("variantDeleted", handleVariantDeleted);

        return () => {
            window.removeEventListener("productCreated", handleProductCreated);
            window.removeEventListener("variantCreated", handleVariantCreated);
            window.removeEventListener("variantDeleted", handleVariantDeleted);
        };
    }, [token, debouncedSearchQuery]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredProducts(products);
            setExpandedProductId(null);
            setAutoExpandedProducts(new Set());
        } else {
            const query = searchQuery.toLowerCase();
            const productMap = new Map<string, Product>();
            products.forEach(product => productMap.set(product._id, product));
            allVariants.forEach(variant => {
                const variantProduct = getVariantProduct(variant);
                if (variantProduct) {
                    productMap.set(variantProduct._id, variantProduct);
                }
            });
            const searchableProducts = Array.from(productMap.values());

            const filtered = searchableProducts.filter(product => {
                const productMatch =
                    (product.name || '').toLowerCase().includes(query) ||
                    (product.code || '').toLowerCase().includes(query) ||
                    product.brand?.brand_name.toLowerCase().includes(query) ||
                    product.category?.category_name.toLowerCase().includes(query);

                if (productMatch) return true;

                const productVariants = allVariants.filter(v => getVariantProductId(v) === product._id);
                const variantMatch = productVariants.some(variant =>
                    variant.barcode?.toLowerCase().includes(query) ||
                    variant.color?.toLowerCase().includes(query) ||
                    variant.size?.toLowerCase().includes(query) ||
                    variant.designNo?.toLowerCase().includes(query)
                );

                return variantMatch;
            });

            setFilteredProducts(filtered);

            const productsToExpand = new Set<string>();
            filtered.forEach(product => {
                const productMatch =
                    (product.name || '').toLowerCase().includes(query) ||
                    (product.code || '').toLowerCase().includes(query) ||
                    product.brand?.brand_name.toLowerCase().includes(query) ||
                    product.category?.category_name.toLowerCase().includes(query);

                if (!productMatch) {
                    const productVariants = allVariants.filter(v => getVariantProductId(v) === product._id);
                    const hasVariantMatch = productVariants.some(variant =>
                        variant.barcode?.toLowerCase().includes(query) ||
                        variant.color?.toLowerCase().includes(query) ||
                        variant.size?.toLowerCase().includes(query) ||
                        variant.designNo?.toLowerCase().includes(query)
                    );

                    if (hasVariantMatch) {
                        productsToExpand.add(product._id);
                    }
                }
            });

            setAutoExpandedProducts(productsToExpand);

            if (productsToExpand.size > 0 && filtered.length > 0) {
                const firstVariantMatch = filtered.find(p => productsToExpand.has(p._id));
                if (firstVariantMatch) {
                    setExpandedProductId(firstVariantMatch._id);
                    fetchVariantsForProduct(firstVariantMatch._id);
                }
            }
        }
    }, [searchQuery, products, allVariants]);

    const fetchProducts = async (search = "", signal?: AbortSignal) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_PRODUCTS_URL, {
                params: {
                    search,
                    limit: search.trim() ? 50 : 100,
                    populate: 'unit,tax'
                },
                headers: { Authorization: `Bearer ${token}` },
                signal
            });
            const productData = response.data.data.products || [];
            setProducts(productData);
            setFilteredProducts(productData);
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error('Error fetching products:', error);
            toast.error('Failed to fetch products');
        } finally {
            if (!signal?.aborted) {
                setIsLoading(false);
            }
        }
    };

    const fetchAllVariants = async (search = debouncedSearchQuery, signal?: AbortSignal) => {
        const trimmedSearch = search.trim();
        if (trimmedSearch.length < 2) {
            setAllVariants([]);
            setAutoExpandedProducts(new Set());
            return;
        }

        try {
            const response = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                params: { search: trimmedSearch, limit: 50 },
                headers: { Authorization: `Bearer ${token}` },
                signal
            });
            const variantData = response.data.data?.variants || [];
            setAllVariants(variantData);
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error('Error fetching all variants:', error);
        }
    };

    const fetchVariantsForProduct = async (productId: string, force = false) => {
        if (!force && variants[productId]) {
            return;
        }

        try {
            setIsLoadingVariants(true);
            const response = await axios.get(
                Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(':id', productId),
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setVariants(prev => ({
                ...prev,
                [productId]: response.data.data || []
            }));
        } catch (error) {
            console.error('Error fetching variants:', error);
            toast.error('Failed to fetch variants');
        } finally {
            setIsLoadingVariants(false);
        }
    };

    const toggleProduct = async (productId: string) => {
        if (expandedProductId === productId) {
            setExpandedProductId(null);
        } else {
            setExpandedProductId(productId);
            await fetchVariantsForProduct(productId);
        }
    };

    const handleOpenVariantModal = async (productId: string) => {
        setVariantModalProductId(productId);
        setShowVariantModal(true);
        await fetchVariantsForProduct(productId);
    };

    const handleCloseVariantModal = async () => {
        setShowVariantModal(false);
        setVariantModalProductId(null);
        setVariantForm({
            designNo: "",
            color: "",
            size: "",
            purchase_price: "",
            sale_price: "",
            mrp: "",
            barcode: ""
        });
    };

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
        if (!token || !showVariantModal) return;
        fetchSizes();
        fetchColors();
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
    }, [token, showVariantModal]);

    const calcMrpFromPurchase = (purchase: string) => {
        const p = Number(purchase);
        if (!Number.isFinite(p)) return "";
        if (mrpMultiplier > 0) return String(p * mrpMultiplier);
        return "";
    };

    const calcSaleFromPurchase = (purchase: string) => {
        const p = Number(purchase);
        if (!Number.isFinite(p)) return "";
        if (saleMultiplier > 0) return String(p * saleMultiplier);
        return "";
    };

    useEffect(() => {
        if (!token || !showProductModal) return;
        fetchCategories();
        fetchBrands();
    }, [token, showProductModal]);

    const generateRandomCode = (): string => {
        return `PROD-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    };

    const fetchCategories = async (search = "") => {
        try {
            const res = await axios.get(Constants.FETCH_CATEGORY_LIST_URL, {
                params: { search, limit: 1000 },
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = res.data?.data?.categories || [];
            setCategories(data);
        } catch {
            setCategories([]);
        }
    };

    const fetchBrands = async (search = "") => {
        try {
            const res = await axios.get(Constants.FETCH_BRAND_LIST_URL, {
                params: { search, limit: 1000 },
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = res.data?.data?.brands || [];
            setBrands(data);
        } catch {
            setBrands([]);
        }
    };

    const handleOpenProductModal = () => {
        setSelectedCategory(null);
        setSelectedBrand(null);
        setCategorySearchInput("");
        setBrandSearchInput("");
        setShowProductModal(true);
    };

    const handleCloseProductModal = () => {
        setShowProductModal(false);
        setSelectedCategory(null);
        setSelectedBrand(null);
        setCategorySearchInput("");
        setBrandSearchInput("");
        setResumeAddProductAfterCreate(false);
    };

    const handleOpenCreateCategoryFromProduct = () => {
        setResumeAddProductAfterCreate(true);
        setShowProductModal(false);
        setShowCreateCategoryModal(true);
    };

    const handleOpenCreateBrandFromProduct = () => {
        setResumeAddProductAfterCreate(true);
        setShowProductModal(false);
        setShowCreateBrandModal(true);
    };

    const handleSaveProduct = async () => {
        if (!selectedCategory?._id || !selectedBrand?._id) {
            toast.error("Please select Category and Brand");
            return;
        }

        const unitId =
            selectedCategory.defaultUnitId?._id ||
            selectedCategory.defaultUnitId?.id ||
            null;
        const taxId =
            selectedCategory.defaultTaxId?._id ||
            selectedCategory.defaultTaxId?.id ||
            null;

        if (!unitId || !taxId) {
            toast.error("Selected category must have default Unit and Tax");
            return;
        }

        try {
            setIsSavingProduct(true);
            const payload = {
                item_type: "Product",
                code: generateRandomCode(),
                hsn_code: selectedBrand.hsn_code || "",
                category: selectedCategory._id,
                brand: selectedBrand._id,
                unit: unitId,
                tax: taxId,
            };

            const res = await axios.post(Constants.CREATE_PRODUCT_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const createdProduct = res.data?.data || null;
            toast.success("Product created successfully");
            window.dispatchEvent(new CustomEvent("productCreated", { detail: { product: createdProduct } }));
            await fetchProducts();
            handleCloseProductModal();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to create product");
        } finally {
            setIsSavingProduct(false);
        }
    };

    const normalizeNum = (v: string | number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

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
        const productVariants = variantModalProductId ? (variants[variantModalProductId] || []) : [];
        const existing = productVariants.find((v) => {
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

    const handleVariantBarcodeGenerate = () => {
        setVariantForm((prev) => ({
            ...prev,
            barcode: resolveBarcodeForConfig(
                prev.designNo,
                prev.color,
                prev.size,
                prev.purchase_price,
                prev.sale_price,
                prev.mrp
            ),
        }));
    };

    const handleSaveVariant = async () => {
        if (!variantModalProductId) return;
        if (!variantForm.designNo.trim()) {
            toast.error("Please fill Design No");
            return;
        }
        if (!variantForm.mrp || Number(variantForm.mrp) <= 0) {
            toast.error("Please enter valid MRP");
            return;
        }

        try {
            setIsSavingVariant(true);
            const barcodeToUse =
                variantForm.barcode && variantForm.barcode.trim().length >= 6
                    ? variantForm.barcode.trim()
                    : resolveBarcodeForConfig(
                        variantForm.designNo,
                        variantForm.color,
                        variantForm.size,
                        variantForm.purchase_price,
                        variantForm.sale_price,
                        variantForm.mrp
                    );
            const payload = {
                productId: variantModalProductId,
                designNo: variantForm.designNo.trim(),
                color: variantForm.color.trim(),
                size: variantForm.size.trim(),
                purchase_price: variantForm.purchase_price === "" ? null : Number(variantForm.purchase_price),
                sale_price: variantForm.sale_price === "" ? null : Number(variantForm.sale_price),
                mrp: Number(variantForm.mrp),
                barcode: barcodeToUse,
            };
            await axios.post(Constants.CREATE_PRODUCTS_VARIANT_URL, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Variant added");
            await fetchVariantsForProduct(variantModalProductId, true);
            await fetchAllVariants();
            window.dispatchEvent(new CustomEvent("variantCreated", { detail: { productId: variantModalProductId } }));
            handleCloseVariantModal();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to add variant");
        } finally {
            setIsSavingVariant(false);
        }
    };

    const isVariantMatch = (variant: ProductVariant, query: string) => {
        if (!query.trim()) return false;
        const q = query.toLowerCase();
        return (
            variant.barcode?.toLowerCase().includes(q) ||
            variant.color?.toLowerCase().includes(q) ||
            variant.size?.toLowerCase().includes(q) ||
            variant.designNo?.toLowerCase().includes(q)
        );
    };

    const getDisplayVariants = (productId: string): ProductVariant[] => {
        const productVariants = variants[productId] || [];

        if (!searchQuery.trim()) {
            return productVariants;
        }

        const query = searchQuery.toLowerCase();

        const product = products.find(p => p._id === productId);
        if (product) {
            const productMatch =
                product.name.toLowerCase().includes(query) ||
                product.code.toLowerCase().includes(query) ||
                product.brand?.brand_name.toLowerCase().includes(query) ||
                product.category?.category_name.toLowerCase().includes(query);

            if (productMatch) {
                return productVariants;
            }
        }

        return productVariants.filter(variant => isVariantMatch(variant, query));
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
                <div className="bg-primary text-white px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Products & Variants</h2>
                    <button
                        type="button"
                        onClick={handleOpenProductModal}
                        className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-1.5 rounded-md"
                    >
                        + Add New Product
                    </button>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 p-2 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <input
                        type="text"
                        placeholder="Search by design no, size, color, barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border border-gray-300 rounded-md px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-600 text-gray-950"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <LoaderSpinner />
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            {searchQuery ? 'No products match your search' : 'No products found'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredProducts.map((product) => (
                                <div
                                    key={product._id}
                                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    <button
                                        onClick={() => toggleProduct(product._id)}
                                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex-1 text-left">
                                            <div className="flex gap-3 mt-1 text-sm text-gray-600">
                                                {product.brand && (
                                                    <span>• {product.brand.brand_name}</span>
                                                )}
                                                {product.category && (
                                                    <span>• {product.category.category_name}</span>
                                                )}
                                            </div>
                                        </div>
                                        {expandedProductId === product._id ? (
                                            <ChevronDown className="text-primary flex-shrink-0" size={20} />
                                        ) : (
                                            <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
                                        )}
                                    </button>

                                    {expandedProductId === product._id && (
                                        <div className="bg-white border-t border-gray-200">
                                            <div className="px-4 py-2 border-b border-gray-100 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenVariantModal(product._id);
                                                    }}
                                                    className="text-sm font-semibold text-primary hover:text-primary/80"
                                                >
                                                    + Add New Variant
                                                </button>
                                            </div>
                                            {isLoadingVariants && !variants[product._id] ? (
                                                <div className="px-4 py-3 text-center">
                                                    <LoaderSpinner />
                                                </div>
                                            ) : getDisplayVariants(product._id).length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    {searchQuery ? 'No matching variants' : 'No variants available'}
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100">
                                                    {getDisplayVariants(product._id).map((variant) => (
                                                        <div
                                                            key={variant._id}
                                                            onClick={() => {
                                                                const event = new CustomEvent('addVariantToInvoice', {
                                                                    detail: { variant, product }
                                                                });
                                                                window.dispatchEvent(event);
                                                            }}
                                                            className={`px-4 py-3 transition-colors cursor-pointer hover:shadow-sm ${isVariantMatch(variant, searchQuery)
                                                                ? "bg-amber-50 border-l-4 border-amber-400"
                                                                : "hover:bg-third"
                                                                }`}
                                                        >
                                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Design:</span>
                                                                    <span className="ml-2 text-gray-900">{variant.designNo}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Color:</span>
                                                                    <span className="ml-2 text-gray-900">{variant.color}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Size:</span>
                                                                    <span className="ml-2 text-gray-900">{variant.size}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">MRP:</span>
                                                                    <span className="ml-2 text-primary font-semibold">₹{variant.mrp}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Sale Price:</span>
                                                                    <span className="ml-2 text-primary font-semibold">₹{variant.sale_price}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Purchase Price:</span>
                                                                    <span className="ml-2 text-primary font-semibold">₹{variant.purchase_price}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-700">Barcode:</span>
                                                                    <span className="ml-2 text-gray-900 font-mono text-xs">{variant.barcode}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 text-center">
                        {searchQuery ? (
                            <>
                                Showing: <span className="font-semibold text-gray-900">{filteredProducts.length}</span> of {products.length}
                            </>
                        ) : (
                            <>
                                Total Products: <span className="font-semibold text-gray-900">{products.length}</span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {showVariantModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg w-[520px] max-w-[92vw] p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Add Variant</h3>
                            <button onClick={handleCloseVariantModal} className="p-1 rounded hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <LabeledInput
                                label="Design No *"
                                value={variantForm.designNo}
                                onChange={(v) => setVariantForm(s => ({ ...s, designNo: v }))}
                            />
                            <label className="text-xs font-medium text-gray-600">Color</label>
                            <SmartDropdown
                                items={colors}
                                value={colorSearchInput}
                                onChange={setColorSearchInput}
                                onSelect={(selected) => {
                                    const name = selected?.name || "";
                                    setVariantForm(v => ({ ...v, color: name }));
                                    setColorSearchInput(name);
                                }}
                                placeholder="Type to search color..."
                                selectedItem={variantForm.color ? { id: variantForm.color, name: variantForm.color } : null}
                            />
                            <label className="text-xs font-medium text-gray-600">Size</label>
                            <SmartDropdown
                                items={sizes}
                                value={sizeSearchInput}
                                onChange={setSizeSearchInput}
                                onSelect={(selected) => {
                                    const name = selected?.name || "";
                                    setVariantForm(v => ({ ...v, size: name }));
                                    setSizeSearchInput(name);
                                }}
                                placeholder="Type to search size..."
                                selectedItem={variantForm.size ? { id: variantForm.size, name: variantForm.size } : null}
                            />
                            <LabeledInput
                                label="Purchase Price"
                                type="number"
                                value={variantForm.purchase_price}
                                onChange={(v) => {
                                    if (mrpMultiplier > 0 || saleMultiplier > 0) {
                                        const nextMrp = mrpMultiplier > 0 ? calcMrpFromPurchase(v) : undefined;
                                        const nextSale = saleMultiplier > 0 ? calcSaleFromPurchase(v) : undefined;
                                        setVariantForm(s => ({
                                            ...s,
                                            purchase_price: v,
                                            ...(mrpMultiplier > 0 ? { mrp: nextMrp } : {}),
                                            ...(saleMultiplier > 0 ? { sale_price: nextSale } : {}),
                                        }));
                                    } else {
                                        setVariantForm(s => ({ ...s, purchase_price: v }));
                                    }
                                }}
                            />
                            <LabeledInput
                                label="Sale Price"
                                type="number"
                                value={variantForm.sale_price}
                                onChange={(v) => setVariantForm(s => ({ ...s, sale_price: v }))}
                                disabled={saleMultiplier > 0 && !allowSaleManualOverride}
                            />
                            <LabeledInput
                                label="MRP *"
                                type="number"
                                value={variantForm.mrp}
                                onChange={(v) => setVariantForm(s => ({ ...s, mrp: v }))}
                                disabled={mrpMultiplier > 0 && !allowManualOverride}
                            />
                            <div>
                                <label className="block text-xs font-medium text-gray-600">Barcode</label>
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="text"
                                        value={variantForm.barcode}
                                        onChange={(e) => setVariantForm(s => ({ ...s, barcode: e.target.value }))}
                                        className="w-full p-2 border rounded-md text-sm border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                                        placeholder="Enter barcode (optional)"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleVariantBarcodeGenerate}
                                        className="px-3 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={handleCloseVariantModal} className="px-4 py-2 border rounded text-sm">Cancel</button>
                            <button onClick={handleSaveVariant} disabled={isSavingVariant} className="px-4 py-2 bg-primary text-white rounded text-sm">
                                {isSavingVariant ? "Saving..." : "Add Variant"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={showProductModal} onClose={handleCloseProductModal} title="Add Product" size="lg">
                <div className="grid grid-cols-1 gap-3">
                    <SmartDropdown
                        label="Category *"
                        items={categories.map((c) => ({ id: c._id, name: c.category_name }))}
                        value={categorySearchInput}
                        onChange={setCategorySearchInput}
                        onSelect={(selected) => {
                            const found = categories.find((c) => c._id === selected?.id);
                            setSelectedCategory(found || null);
                            setCategorySearchInput(found?.category_name || "");
                        }}
                        onAddNew={handleOpenCreateCategoryFromProduct}
                        placeholder="Type to search category..."
                        selectedItem={
                            selectedCategory ? { id: selectedCategory._id, name: selectedCategory.category_name } : null
                        }
                        addNewLabel="New Category"
                    />
                    <SmartDropdown
                        label="Brand *"
                        items={brands.map((b) => ({ id: b._id, name: b.brand_name }))}
                        value={brandSearchInput}
                        onChange={setBrandSearchInput}
                        onSelect={(selected) => {
                            const found = brands.find((b) => b._id === selected?.id);
                            setSelectedBrand(found || null);
                            setBrandSearchInput(found?.brand_name || "");
                        }}
                        onAddNew={handleOpenCreateBrandFromProduct}
                        placeholder="Type to search brand..."
                        selectedItem={
                            selectedBrand ? { id: selectedBrand._id, name: selectedBrand.brand_name } : null
                        }
                        addNewLabel="New Brand"
                    />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={handleCloseProductModal} className="px-4 py-2 border rounded text-sm">Cancel</button>
                    <button onClick={handleSaveProduct} disabled={isSavingProduct} className="px-4 py-2 bg-primary text-white rounded text-sm">
                        {isSavingProduct ? "Saving..." : "Create Product"}
                    </button>
                </div>
            </Modal>

            <CreateCategoryModal
                isOpen={showCreateCategoryModal}
                onClose={() => {
                    setShowCreateCategoryModal(false);
                    if (resumeAddProductAfterCreate) {
                        setShowProductModal(true);
                    }
                }}
                hideImage
                onSuccess={(created) => {
                    if (created?.id && created?.name) {
                        const newCategory: Category = {
                            _id: created.id,
                            category_name: created.name,
                            defaultUnitId: created.defaultUnitId ? { _id: created.defaultUnitId } : undefined,
                            defaultTaxId: created.defaultTaxId ? { _id: created.defaultTaxId } : undefined,
                        };
                        setCategories(prev => [newCategory, ...prev]);
                        setSelectedCategory(newCategory);
                        setCategorySearchInput(created.name);
                    }
                    setShowCreateCategoryModal(false);
                    if (resumeAddProductAfterCreate) {
                        setShowProductModal(true);
                    }
                }}
            />

            <CreateBrandModal
                isOpen={showCreateBrandModal}
                onClose={() => {
                    setShowCreateBrandModal(false);
                    if (resumeAddProductAfterCreate) {
                        setShowProductModal(true);
                    }
                }}
                hideImage
                onSuccess={(created) => {
                    if (created?.id && created?.name) {
                        const newBrand: Brand = {
                            _id: created.id,
                            brand_name: created.name,
                            hsn_code: created.hsnCode || "",
                        };
                        setBrands(prev => [newBrand, ...prev]);
                        setSelectedBrand(newBrand);
                        setBrandSearchInput(created.name);
                    }
                    setShowCreateBrandModal(false);
                    if (resumeAddProductAfterCreate) {
                        setShowProductModal(true);
                    }
                }}
            />
        </>
    );
}

function LabeledInput({
    label,
    value,
    onChange,
    type = "text",
    disabled = false,
}: {
    label: string;
    value: any;
    onChange: (v: string) => void;
    type?: string;
    disabled?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="mt-1 w-full p-2 border rounded-md text-sm border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
            />
        </div>
    );
}
