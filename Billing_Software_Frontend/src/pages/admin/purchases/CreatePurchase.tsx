import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { PlusCircle, Phone, MapPin, CreditCard, Receipt, Plus, X, PencilLine, Download, FileSearch, Trash2, Edit2 } from 'lucide-react';
import DateInput from '@components/admin/DateInput';
import axios from 'axios';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { useDebounce } from '@hooks/useDebounce';
import Modal from '@components/admin/Modal';
import ProductDetailsModal from '@components/admin/ProductDetailsModal';
import { numberToWords } from '@utils/converters';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '@pages/admin/purchases/PaymentModal';
import FullPageLoader from '@components/admin/FullPageLoader';
import PrintBarcode from '@components/admin/PrintBarcode';
import CreateCategoryModal from '@pages/admin/productAndServices/CreateCategoryModal';
import CreateBrandModal from '@pages/admin/productAndServices/CreateBrandModal';
import CreateSupplierForm from './CreateSupplierForm';
import SubmitButton from '@components/admin/SubmitButton';
import type { OptionType, SelectedAdmin } from '@models/common';
import type { Product, ProductItem } from '@models/product';
import SmartDropdown from '@components/admin/SmartDropdown';
import PurchaseInvoiceTableRow from '@components/admin/PurchaseInvoiceTableRow';
import ProductItemsSummaryFooter from '@components/admin/ProductItemsSummaryFooter';
import ProductVariantInline from '../productAndServices/ProductVariantInline';
import CreateBankAccountModal from '../invoices/CreateBankAccountModal';
import type { BankAccountCreatedResponse } from '@models/bank-account';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import { formatVariantDisplay, getBrandName } from '@utils/formatVariantDisplay';
import AiDocumentScanModal from '@components/admin/AiDocumentScanModal';

interface PurchaseFormData {
    _id?: string;
    userId: string;
    billFrom: string;
    billTo: string;
    referenceNo: string;
    purchaseId?: string;
    supplier_bill_number?: string;
    purchaseDate: Date | null;
    purchaseBillDate: Date | null;
    dueDate: Date | null;
    dueDays: number | null;
    status: string;
    items: ProductItem[];
    notes: string;
    termsAndCondition: string;
    paymentMode: string;
    paymentModeSlug: string;
    checkNumber?: string;
    bank?: string | null;
    overall_discount?: number;
    taxType: "GST" | "Non-GST";
    gstType?: "Inclusive" | "Exclusive" | null;
    sp_referenceNumber?: string;
    sp_paymentDate?: Date | null;
    sp_paymentMode?: string;
    sp_amount?: number;
    sp_paid_amount?: number;
    sp_due_amount?: number;
    sp_notes?: string | null;
    sp_attachment?: File | null;

    // Broker / Deal details
    brokerId?: string | null;
    brokerName?: string;
    brokerPhone?: string;
    brokerCommissionType?: 'Fixed' | 'Percentage';
    brokerCommissionValue?: number;
    brokerCommissionAmount?: number;
}

interface SupplierDetails {
    id: string;
    userId?: string | null;
    company_name: string;
    phone_number: string;
    company_address?: string;
    city?: string;
    state?: string;
    pin_code?: string;
    gst_no?: string;
    pan_no?: string;
}

interface taxGroup {
    _id: string;
    tax_name: string;
    total_tax_rate: number;
    tax_rates: {
        _id: string;
        tax_name: string;
        tax_rate: number;
    }[];
}

interface IPaymentMode {
    id: string;
    name: string;
    slug: string;
}

interface BrokerOption {
    id: string;
    name: string;
    phone: string;
    commissionType: 'Fixed' | 'Percentage';
    commissionValue: number;
}

interface CategoryOption {
    _id: string;
    category_name: string;
    defaultUnitId?: { _id?: string; id?: string; unit_name?: string; short_name?: string } | null;
    defaultTaxId?: { _id?: string; id?: string; tax_name?: string; total_tax_rate?: number } | null;
}

interface BrandOption {
    _id: string;
    brand_name: string;
    hsn_code?: string;
}

interface ExpenseCategoryOption {
    _id: string;
    title: string;
}

interface PurchaseExpenseFormData {
    amount: string;
    expenseDate: Date | null;
    description: string;
    paymentMode: string;
    paymentDate: Date | null;
    paymentDueDate: Date | null;
    customFields: { key: string; value: string }[];
}

type PurchaseHeaderProps = {
    // Purchase fields
    purchaseDate: Date | null;
    purchaseBillDate: Date | null;
    dueDate: Date | null;
    dueDays: number | null;
    supplierBillNumber: string;
    brokers: BrokerOption[];
    brokerInputValue: string;
    selectedBroker: BrokerOption | null;
    brokerCommissionAmount: number;
    // Supplier fields
    suppliers: OptionType[];
    supplierSearchInput: string;
    selectedSupplier: OptionType | null;
    supplierDetails: SupplierDetails | null;
    // Handlers
    formErrors: { [key: string]: string };
    onPurchaseDateChange: (date: Date | null) => void;
    onPurchaseBillDateChange: (date: Date | null) => void;
    onDueDateChange: (date: Date | null) => void;
    onDueDaysChange: (value: number | null) => void;
    onSupplierBillNumberChange: (value: string) => void;
    onBrokerInputChange: (value: string) => void;
    onBrokerSelect: (broker: BrokerOption | null) => void;
    onAddBroker: () => void;
    onSupplierSearchChange: (value: string) => void;
    onSupplierSelect: (item: OptionType) => void;
    onAddSupplier: () => void;
};

const PurchaseHeader: React.FC<PurchaseHeaderProps> = ({
    purchaseDate,
    purchaseBillDate,
    dueDate,
    dueDays,
    supplierBillNumber,
    brokers,
    brokerInputValue,
    selectedBroker,
    brokerCommissionAmount,
    suppliers,
    supplierSearchInput,
    selectedSupplier,
    supplierDetails,
    formErrors,
    onPurchaseDateChange,
    onPurchaseBillDateChange,
    onDueDateChange,
    onDueDaysChange,
    onSupplierBillNumberChange,
    onBrokerInputChange,
    onBrokerSelect,
    onAddBroker,
    onSupplierSearchChange,
    onSupplierSelect,
    onAddSupplier,
}) => {
    const addressParts = [
        supplierDetails?.company_address,
        supplierDetails?.city,
        supplierDetails?.state,
        supplierDetails?.pin_code,
    ].filter(Boolean);
    const addressValue = addressParts.join(', ');
    return (
        <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-3">
            {/* ── Row 1: Purchase fields grid (5 equal columns) ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-inline justify-between">
                {/* Purchase Date */}
                <div>
                    <DateInput
                        label="Purchase Date"
                        value={purchaseDate}
                        onChange={onPurchaseDateChange}
                        isRequired
                    />
                    {formErrors?.purchaseDate && (
                        <span className="text-red-500 text-xs">{formErrors.purchaseDate}</span>
                    )}
                </div>

                {/* Bill Date */}
                <div>
                    <DateInput
                        label="Purchase Bill Date"
                        value={purchaseBillDate}
                        onChange={onPurchaseBillDateChange}
                        isRequired
                    />
                    {formErrors?.purchaseBillDate && (
                        <span className="text-red-500 text-xs">{formErrors.purchaseBillDate}</span>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Days
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={dueDays ?? ''}
                        onChange={(e) => {
                            const next = e.target.value === '' ? null : Number(e.target.value);
                            onDueDaysChange(Number.isNaN(next as number) ? null : next);
                        }}
                        placeholder="Days"
                        className="border border-gray-300 rounded-md px-3 h-10 w-full text-sm text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                {/* Due Date */}
                <div>
                    <DateInput
                        label="Due Date"
                        value={dueDate}
                        onChange={onDueDateChange}
                    />
                </div>

                {/* Supplier Bill No */}
                <div>
                    <label htmlFor="supplier-bill-number" className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier Bill No
                    </label>
                    <input
                        id="supplier-bill-number"
                        name="supplier_bill_number"
                        type="text"
                        value={supplierBillNumber}
                        onChange={(e) => onSupplierBillNumberChange(e.target.value)}
                        placeholder="Enter bill no"
                        className="border border-gray-300 rounded-md px-3 h-10 w-full text-sm text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                {/* Broker */}
                <div className="min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <label className="block text-sm font-medium text-gray-700">
                            Broker
                        </label>
                        <button
                            type="button"
                            onClick={onAddBroker}
                            className="flex items-center text-xs text-primary font-semibold"
                        >
                            <PlusCircle className="h-3 w-3 mr-1" />
                            Add
                        </button>
                    </div>
                    <SearchableDropdown
                        label=""
                        value={selectedBroker ? { id: selectedBroker.id, name: `${selectedBroker.name} (${selectedBroker.phone})` } : null}
                        options={brokers.map((b) => ({ id: b.id, name: `${b.name} (${b.phone})` }))}
                        inputValue={brokerInputValue}
                        onInputChange={(_, value) => onBrokerInputChange(value)}
                        onChange={(_, value) => {
                            const broker = brokers.find((b) => b.id === value?.id) || null;
                            onBrokerSelect(broker);
                        }}
                        placeholder="Search broker..."
                        noAsterisk
                    />
                    {selectedBroker && (
                        <p className="mt-1 text-xs text-gray-500 truncate">
                            Comm: {selectedBroker.commissionType === 'Percentage'
                                ? `${selectedBroker.commissionValue}%`
                                : selectedBroker.commissionValue
                            } • ₹{brokerCommissionAmount.toFixed(2)}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-gray-100" />

            {/* ── Row 2: Supplier search (left) + supplier info text (right) ── */}
            <div className="flex flex-col md:flex-row gap-3 items-start relative z-30">
                {/* Supplier search – ~35% */}
                <div className="w-full md:w-[35%] relative z-50">
                    <div className="flex justify-between items-center mb-0.5">
                        <label className="block text-sm font-medium text-gray-700">
                            Supplier <span className="text-red-500">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={onAddSupplier}
                            className="flex items-center text-xs text-primary font-semibold"
                        >
                            <PlusCircle className="h-3 w-3 mr-1" />
                            New
                        </button>
                    </div>
                    <SmartDropdown
                        items={suppliers}
                        value={supplierSearchInput}
                        onChange={onSupplierSearchChange}
                        onSelect={(item) => onSupplierSelect(item as OptionType)}
                        selectedItem={selectedSupplier}
                        placeholder="Type to search supplier..."
                        onAddNew={onAddSupplier}
                        addNewLabel="New Supplier"
                    />
                    {!selectedSupplier && formErrors?.billTo && (
                        <span className="text-red-500 text-xs mt-0.5 block">{formErrors.billTo}</span>
                    )}
                </div>

                {/* Supplier details – ~65% */}
                <div className="w-full md:w-[65%] flex items-center h-full pt-0 md:pt-5">
                    {selectedSupplier && supplierDetails ? (
                        <div className="text-sm text-gray-700 leading-relaxed w-full">
                            <p className="font-semibold text-gray-900 text-base leading-tight mb-1">
                                {supplierDetails.company_name}
                            </p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                                {supplierDetails.phone_number && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-blue-400" />
                                        {supplierDetails.phone_number}
                                    </span>
                                )}
                                {supplierDetails.gst_no && (
                                    <span className="flex items-center gap-1">
                                        <Receipt className="h-3 w-3 text-green-400" />
                                        GST: <span className="font-medium text-gray-700">{supplierDetails.gst_no}</span>
                                    </span>
                                )}
                                {supplierDetails.pan_no && (
                                    <span className="flex items-center gap-1">
                                        <CreditCard className="h-3 w-3 text-primary" />
                                        PAN: <span className="font-medium text-gray-700">{supplierDetails.pan_no}</span>
                                    </span>
                                )}
                                {addressValue && (
                                    <span className="flex items-center gap-1 max-w-sm truncate" title={addressValue}>
                                        <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                                        {addressValue}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">Select a supplier to view details</p>
                    )}
                </div>
            </div>
        </div>
    );
};

type CreateProductWithVariantsModalProps = {
    isOpen: boolean;
    token: string | null;
    onClose: () => void;
    mode?: 'create' | 'edit';
    productId?: string | null;
    onSaved: (product: any, variants: any[], mode: 'create' | 'edit') => void;
};

export const CreateProductWithVariantsModal: React.FC<CreateProductWithVariantsModalProps> = ({
    isOpen,
    token,
    onClose,
    mode = 'create',
    productId = null,
    onSaved,
}) => {
    const isEditMode = mode === 'edit' && !!productId;
    const [isSaving, setIsSaving] = useState(false);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [categorySearchInput, setCategorySearchInput] = useState("");
    const [brandSearchInput, setBrandSearchInput] = useState("");
    const debouncedCategorySearchInput = useDebounce(categorySearchInput, 300);
    const debouncedBrandSearchInput = useDebounce(brandSearchInput, 300);
    const [isCategoryLoading, setIsCategoryLoading] = useState(false);
    const [isBrandLoading, setIsBrandLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(null);
    const [localVariants, setLocalVariants] = useState<any[]>([]);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
    const [editingProductSnapshot, setEditingProductSnapshot] = useState<any | null>(null);
    const brandInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLocalVariants([]);
        if (mode !== 'edit') {
            setEditingProductSnapshot(null);
        }
    }, [isOpen, mode, productId]);

    const generateRandomCode = (): string => {
        return `PROD-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    };

    useEffect(() => {
        if (!isOpen || !token) return;

        const fetchCategories = async () => {
            try {
                setIsCategoryLoading(true);
                const res = await axios.get(Constants.FETCH_CATEGORY_LIST_URL, {
                    params: { search: debouncedCategorySearchInput, limit: 50 },
                    headers: { Authorization: `Bearer ${token}` },
                });
                setCategories(res.data?.data?.categories || []);
            } catch {
                setCategories([]);
            } finally {
                setIsCategoryLoading(false);
            }
        };

        fetchCategories();
    }, [isOpen, token, debouncedCategorySearchInput]);

    useEffect(() => {
        if (!isOpen || !token || !isEditMode || !productId) return;

        const fetchProductDetails = async () => {
            try {
                const res = await axios.get(`${Constants.GET_PRODUCT_URL}/${productId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const product = res.data?.data || res.data?.product || res.data || null;
                if (!product) return;
                setEditingProductSnapshot(product);

                const categoryValue = product.category
                    ? {
                        _id: product.category._id || product.category.id,
                        category_name: product.category.category_name || product.category.name || '',
                        defaultUnitId: product.unit || undefined,
                        defaultTaxId: product.tax || undefined,
                    }
                    : null;
                const brandValue = product.brand
                    ? {
                        _id: product.brand._id || product.brand.id,
                        brand_name: product.brand.brand_name || product.brand.name || '',
                        hsn_code: product.hsn_code || product.brand.hsn_code || '',
                    }
                    : null;

                if (categoryValue?._id) {
                    setCategories((prev) => prev.some((item) => item._id === categoryValue._id) ? prev : [categoryValue, ...prev]);
                    setSelectedCategory(categoryValue);
                    setCategorySearchInput(categoryValue.category_name || '');
                }

                if (brandValue?._id) {
                    setBrands((prev) => prev.some((item) => item._id === brandValue._id) ? prev : [brandValue, ...prev]);
                    setSelectedBrand(brandValue);
                    setBrandSearchInput(brandValue.brand_name || '');
                }
            } catch {
                toast.error('Failed to load product details');
            }
        };

        fetchProductDetails();
    }, [isOpen, token, isEditMode, productId]);

    useEffect(() => {
        if (!isOpen || !token) return;

        const fetchBrands = async () => {
            try {
                setIsBrandLoading(true);
                const res = await axios.get(Constants.FETCH_BRAND_LIST_URL, {
                    params: { search: debouncedBrandSearchInput, limit: 50 },
                    headers: { Authorization: `Bearer ${token}` },
                });
                setBrands(res.data?.data?.brands || []);
            } catch {
                setBrands([]);
            } finally {
                setIsBrandLoading(false);
            }
        };

        fetchBrands();
    }, [isOpen, token, debouncedBrandSearchInput]);

    const handleClose = () => {
        setSelectedCategory(null);
        setSelectedBrand(null);
        setCategorySearchInput("");
        setBrandSearchInput("");
        setLocalVariants([]);
        onClose();
    };

    const handleExportDraftExcel = async () => {
        if (!token) return;
        if (!selectedCategory?._id || !selectedBrand?._id) {
            toast.error("Please select Category and Brand first");
            return;
        }

        if (localVariants.length === 0) {
            toast.error("Please add at least one variant to export");
            return;
        }

        try {
            const response = await axios.post(
                Constants.EXPORT_DRAFT_PRODUCTS_EXCEL_URL,
                {
                    categoryName: selectedCategory.category_name || "",
                    brandName: selectedBrand.brand_name || "",
                    unitName: selectedCategory.defaultUnitId?.unit_name || selectedCategory.defaultUnitId?.short_name || "",
                    hsnCode: selectedBrand.hsn_code || "",
                    taxGroupId: selectedCategory.defaultTaxId?._id || selectedCategory.defaultTaxId?.id || "",
                    variants: localVariants,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                }
            );

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            const safeBrand = (selectedBrand.brand_name || 'Product').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Product';
            link.download = `${safeBrand}_Draft_Product_Export_${today}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Draft product exported successfully!');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to export draft product');
        }
    };

    const handleSave = async () => {
        if (!token) return;
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
        if (!isEditMode && localVariants.length === 0) {
            toast.error("Please add at least one variant");
            return;
        }

        try {
            setIsSaving(true);
            const payload = {
                item_type: "Product",
                ...(isEditMode ? {} : { code: generateRandomCode() }),
                hsn_code: selectedBrand.hsn_code || "",
                category: selectedCategory._id,
                brand: selectedBrand._id,
                unit: unitId,
                tax: taxId,
            };

            if (isEditMode && productId) {
                const submissionData = new FormData();
                submissionData.append('item_type', payload.item_type || 'Product');
                submissionData.append('code', String(editingProductSnapshot?.code || ''));
                submissionData.append('hsn_code', String(payload.hsn_code || ''));
                submissionData.append('category', String(payload.category || ''));
                submissionData.append('brand', String(payload.brand || ''));
                submissionData.append('unit', String(payload.unit || ''));
                submissionData.append('tax', String(payload.tax || ''));
                submissionData.append('name', String(editingProductSnapshot?.name || ''));
                submissionData.append('status', String(editingProductSnapshot?.status ?? true));

                await axios.put(`${Constants.UPDATE_PRODUCT_URL}/${productId}`, submissionData, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const [productRes, variantsRes] = await Promise.all([
                    axios.get(`${Constants.GET_PRODUCT_URL}/${productId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    axios.get(Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", productId), {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                const updatedProduct = productRes.data?.data || productRes.data?.product || productRes.data || null;
                const savedVariants = variantsRes.data?.data || [];
                toast.success("Product updated successfully!");
                window.dispatchEvent(new CustomEvent("productCreated", { detail: { product: updatedProduct } }));
                onSaved(updatedProduct, savedVariants, 'edit');
                handleClose();
                return;
            }

            const res = await axios.post(Constants.CREATE_PRODUCT_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const createdProduct = res.data?.data || null;
            const createdProductId = createdProduct?.id || createdProduct?._id;
            const enrichedProduct = createdProduct
                ? {
                    ...createdProduct,
                    tax: {
                        group_id: taxId,
                        id: taxId
                    },
                    unit: createdProduct.unit || { _id: unitId, id: unitId }
                }
                : createdProduct;

            let savedVariants: any[] = [];
            if (createdProductId) {
                for (const v of localVariants) {
                    await axios.post(
                        Constants.CREATE_PRODUCTS_VARIANT_URL,
                        { ...v, productId: createdProductId },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
                const variantsRes = await axios.get(
                    Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", createdProductId),
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                savedVariants = variantsRes.data?.data || [];
            }

            const normalizeNum = (v: any) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const makeVariantKey = (v: any) => {
                return [
                    String(v.designNo || "").trim().toLowerCase(),
                    String(v.color || "").trim().toLowerCase(),
                    String(v.size || "").trim().toLowerCase(),
                    normalizeNum(v.purchase_price),
                    normalizeNum(v.sale_price),
                    normalizeNum(v.mrp),
                ].join("|");
            };
            const newVariantKeys = new Set(localVariants.map(makeVariantKey));
            const onlyNewVariants = savedVariants.filter((v: any) => newVariantKeys.has(makeVariantKey(v)));

            toast.success("Product & Variants created successfully!");
            window.dispatchEvent(new CustomEvent("productCreated", { detail: { product: enrichedProduct } }));
            window.dispatchEvent(new CustomEvent("variantCreated", { detail: { productId: createdProductId } }));
            onSaved(enrichedProduct, onlyNewVariants, 'create');
            handleClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || `Failed to ${isEditMode ? "update" : "create"} product`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">{isEditMode ? 'Edit Product & Variants' : 'Add Product & Variants'}</h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-3 py-1 rounded text-sm bg-gray-200"
                    >
                        Close
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <SmartDropdown
                            label="Category *"
                            items={categories.map((c) => ({ id: c._id, name: c.category_name }))}
                            value={categorySearchInput}
                            onChange={setCategorySearchInput}
                            onSelect={(selected) => {
                                const found = categories.find((c) => c._id === selected?.id);
                                setSelectedCategory(found || null);
                                setCategorySearchInput(found?.category_name || "");
                                if (found) {
                                    setTimeout(() => {
                                        brandInputRef.current?.focus();
                                    }, 0);
                                }
                            }}
                            onAddNew={() => setShowCreateCategoryModal(true)}
                            placeholder="Type to search category..."
                            selectedItem={
                                selectedCategory ? { id: selectedCategory._id, name: selectedCategory.category_name } : null
                            }
                            addNewLabel="New Category"
                            serverside={true}
                            loading={isCategoryLoading}
                        />
                        <SmartDropdown
                            label="Brand *"
                            inputRef={brandInputRef}
                            items={brands.map((b) => ({ id: b._id, name: b.brand_name }))}
                            value={brandSearchInput}
                            onChange={setBrandSearchInput}
                            onSelect={(selected) => {
                                const found = brands.find((b) => b._id === selected?.id);
                                setSelectedBrand(found || null);
                                setBrandSearchInput(found?.brand_name || "");
                            }}
                            onAddNew={() => setShowCreateBrandModal(true)}
                            placeholder="Type to search brand..."
                            selectedItem={selectedBrand ? { id: selectedBrand._id, name: selectedBrand.brand_name } : null}
                            addNewLabel="New Brand"
                            serverside={true}
                            loading={isBrandLoading}
                        />
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent("open-price-multiplier-modal:purchase-add-product"))}
                                className="w-full inline-flex min-h-[42px] items-center justify-center gap-2 px-4 py-2.5 border border-purple-200 rounded-md bg-white text-sm font-medium text-primary hover:bg-purple-50 transition-colors"
                            >
                                <PencilLine size={16} />
                                Edit Price Multipliers
                            </button>
                        </div>
                    </div>

                    <ProductVariantInline
                        productId={isEditMode ? productId : null}
                        localVariants={localVariants}
                        setLocalVariants={setLocalVariants}
                        multiplierEventKey="purchase-add-product"
                    />
                </div>

                <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleExportDraftExcel}
                        className="px-3 py-1 rounded text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 inline-flex items-center gap-2"
                    >
                        <Download size={15} />
                        Export Excel
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-3 py-1 rounded text-sm bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded text-sm bg-primary text-white"
                    >
                        {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Create Product"}
                    </button>
                </div>
            </div>

            <CreateCategoryModal
                isOpen={showCreateCategoryModal}
                onClose={() => setShowCreateCategoryModal(false)}
                hideImage
                useFormTag={false}
                onSuccess={(created) => {
                    if (created?.id && created?.name) {
                        const newCategory: CategoryOption = {
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
                }}
            />

            <CreateBrandModal
                isOpen={showCreateBrandModal}
                onClose={() => setShowCreateBrandModal(false)}
                hideImage
                useFormTag={false}
                onSuccess={(created) => {
                    if (created?.id && created?.name) {
                        const newBrand: BrandOption = {
                            _id: created.id,
                            brand_name: created.name,
                            hsn_code: created.hsnCode || "",
                        };
                        setBrands(prev => [newBrand, ...prev]);
                        setSelectedBrand(newBrand);
                        setBrandSearchInput(created.name);
                    }
                    setShowCreateBrandModal(false);
                }}
            />
        </div>
    );
};

type PurchaseItemsTableProps = {
    items: ProductItem[];
    currencySymbol: string;
    formErrors: { [key: string]: string };
    taxType: "GST" | "Non-GST";
    gstMode: "Inclusive" | "Exclusive";
    onInlineItemChange: (updatedItem: ProductItem, itemId: string) => void;
    onEditItem: (item: ProductItem) => void;
    onRemoveItem: (item: ProductItem) => void;
    onAddVariants: (variants: any[], product: any, itemId: string) => void;
    onAddNewProduct: () => void;
    productList: Product[];
    variantList: any[];
    onQuickAddVariant: (variant: any, product: Product, qty?: number, rate?: number, discount?: number) => void;
    onCreateProduct?: () => void;
    onOpenProductEditor?: (item: ProductItem & any) => void;
};

const PurchaseItemsTable: React.FC<PurchaseItemsTableProps> = ({
    items,
    currencySymbol,
    formErrors,
    taxType,
    gstMode,
    onInlineItemChange,
    onEditItem,
    onRemoveItem,
    onAddVariants,
    onAddNewProduct,
    productList,
    variantList,
    onQuickAddVariant,
    onCreateProduct,
    onOpenProductEditor
}) => {
    const [quickAddSearch, setQuickAddSearch] = useState('');
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(-1);
    const [isQuickAddQuantityModalOpen, setIsQuickAddQuantityModalOpen] = useState(false);
    const [quickAddQuantity, setQuickAddQuantity] = useState('1');
    const [quickAddRate, setQuickAddRate] = useState<string>('');
    const [quickAddDiscount, setQuickAddDiscount] = useState<string>('');
    const [pendingQuickAddEntry, setPendingQuickAddEntry] = useState<{ type: "variant"; product: Product; variant: any } | null>(null);
    const quickAddRef = useRef<HTMLDivElement>(null);
    const quickAddListRef = useRef<HTMLUListElement>(null);
    const quickAddInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
                setShowQuickAdd(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const quickAddItems = useMemo(() => {
        const term = quickAddSearch.trim().toLowerCase();
        if (!term) return [] as Array<{ type: "variant"; product: Product; variant: any }>;
        const items: Array<{ type: "variant"; product: Product; variant: any }> = [];

        for (const v of variantList) {
            const searchable = `${v.designNo || ""} ${v.color || ""} ${v.size || ""} ${v.productId?.brand?.brand_name || ""}`.toLowerCase();
            if (!searchable.includes(term)) continue;
            const sourceProduct =
                typeof v.productId === "object" && v.productId !== null
                    ? v.productId
                    : null;
            const productId = sourceProduct?.id || sourceProduct?._id || v.productId;
            const product =
                productList.find((p: any) => String((p as any).id || p._id) === String(productId)) ||
                ({
                    id: String(productId || ""),
                    _id: String(productId || ""),
                    item_type: sourceProduct?.item_type || "Product",
                    name: sourceProduct?.name || "",
                    code: sourceProduct?.code || "",
                    hsn_code: sourceProduct?.hsn_code || "",
                    barcode: sourceProduct?.barcode || v.barcode || "",
                    unit: sourceProduct?.unit
                        ? {
                            id: sourceProduct.unit.id || sourceProduct.unit._id || "",
                            name:
                                sourceProduct.unit.short_name ||
                                sourceProduct.unit.name ||
                                sourceProduct.unit.unit_name ||
                                "",
                        }
                        : null,
                    prices: {
                        selling: Number(v.sale_price || 0),
                        purchase: Number(v.purchase_price || 0),
                    },
                    variant: v,
                    discount: null,
                    quantity: 0,
                    rate: Number(v.purchase_price || 0),
                    amount: 0,
                    tax: sourceProduct?.tax
                        ? {
                            group_id: sourceProduct.tax.group_id || sourceProduct.tax._id || "",
                            group_name: sourceProduct.tax.group_name || sourceProduct.tax.tax_name || "",
                            total_rate:
                                Number(sourceProduct.tax.total_rate) ||
                                Number(
                                    Array.isArray(sourceProduct.tax.tax_rate_ids)
                                        ? sourceProduct.tax.tax_rate_ids.reduce(
                                            (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                                            0
                                        )
                                        : 0
                                ),
                        }
                        : null,
                    category: sourceProduct?.category || null,
                    brand: sourceProduct?.brand || { _id: "", brand_name: "" },
                } as Product);
            items.push({ type: "variant", product, variant: v });
            if (items.length >= 50) break;
        }

        return items;
    }, [quickAddSearch, variantList, productList]);

    useEffect(() => {
        if (quickAddActiveIndex > -1 && quickAddListRef.current) {
            const items = quickAddListRef.current.querySelectorAll('[data-quick-add-row="true"]');
            const activeItem = items[quickAddActiveIndex] as HTMLLIElement | undefined;
            if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [quickAddActiveIndex, showQuickAdd, quickAddItems.length]);

    const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const items = quickAddItems;
        if (!showQuickAdd || items.length === 0) return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setQuickAddActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
                break;
            case "ArrowUp":
                e.preventDefault();
                setQuickAddActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
                break;
            case "Enter":
                e.preventDefault();
                if (quickAddActiveIndex > -1) {
                    const entry = items[quickAddActiveIndex];
                    if (entry.type === "variant") {
                        handleOpenQuickAddQuantityModal(entry);
                    }
                }
                break;
            case "Escape":
                setShowQuickAdd(false);
                break;
        }
    };

    const handleOpenQuickAddQuantityModal = (entry: any) => {
        const productName = formatVariantDisplay({
            brandName: getBrandName(entry.product?.brand),
            designNo: entry.variant?.designNo,
            size: entry.variant?.size,
        }) || entry.variant?.designNo || entry.product?.name;

        setPendingQuickAddEntry({ ...entry, name: productName });
        setQuickAddQuantity('1');
        setQuickAddRate(entry.variant?.purchase_price ?? entry.variant?.purchasePrice ?? entry.product?.prices?.purchase ?? '');
        setQuickAddDiscount('');
        setIsQuickAddQuantityModalOpen(true);
        setShowQuickAdd(false);
        setQuickAddActiveIndex(-1);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 relative z-0">
            <div className="p-2 space-y-3">
                {formErrors?.items && <span className="text-red-500 text-sm">{formErrors.items}</span>}


                <div className="p-1 flex flex-wrap gap-6 items-center">
                    <div ref={quickAddRef} className="relative flex-1 min-w-[320px]">
                        <input
                            type="text"
                            value={quickAddSearch}
                            onChange={(e) => {
                                setQuickAddSearch(e.target.value);
                                setShowQuickAdd(true);
                                setQuickAddActiveIndex(0);
                            }}
                            onFocus={() => setShowQuickAdd(true)}
                            ref={quickAddInputRef}
                            onKeyDown={handleQuickAddKeyDown}
                            placeholder="Search by design no. or brand..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        />
                        {showQuickAdd && (
                            <ul ref={quickAddListRef} className="absolute top-full left-0 w-full bg-white border border-gray-200 z-50 max-h-56 overflow-auto rounded-md shadow-lg">
                                {quickAddItems.length === 0 ? (
                                    <li className="p-3 text-center text-sm text-gray-500">No results</li>
                                ) : (
                                    quickAddItems.map((entry, index) => {
                                        const label = formatVariantDisplay({
                                            brandName: getBrandName(entry.product?.brand),
                                            designNo: entry.variant.designNo,
                                            size: entry.variant.size,
                                            includeSize: true,
                                        });
                                        return (
                                            <li
                                                data-quick-add-row="true"
                                                key={`quick-variant-${entry.product.id}-${entry.variant._id}`}
                                                className={`p-2 pl-6 cursor-pointer hover:bg-third ${index === quickAddActiveIndex ? "bg-third" : ""}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleOpenQuickAddQuantityModal(entry);
                                                }}
                                            >
                                                <div className="text-sm text-gray-800">
                                                    {label || "Variant"} - {currencySymbol}{entry.variant.purchase_price ?? 0}
                                                </div>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                        )}
                    </div>
                    {onCreateProduct && (
                        <button
                            type="button"
                            onClick={() => onCreateProduct?.()}
                            className="flex items-center text-sm text-primary font-semibold"
                        >
                            <PlusCircle className="h-4 w-4 mr-1" />
                            Add New Product
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
                    <div className="w-full">
                        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 overflow-x-auto">
                            <colgroup>
                                <col className="w-[4rem]" />
                                <col className="w-[30%]" />
                                <col className="w-[14%]" />
                                <col className="w-[10%]" />
                                <col className="w-[10%]" />
                                <col className="w-[10%]" />
                                <col className="w-[10%]" />
                                <col className="w-[12%]" />
                                <col className="w-[6rem]" />
                            </colgroup>
                            <thead className="bg-gray-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 text-left text-xs font-semibold rounded-tl-md w-12">S.No.</th>
                                    <th className="p-2 text-left text-xs font-semibold">Product</th>
                                    <th className="p-2 text-left text-xs font-semibold">Color / Size</th>
                                    <th className="p-2 text-left text-xs font-semibold">Quantity</th>
                                    <th className="p-2 text-left text-xs font-semibold">Rate</th>
                                    <th className="p-2 text-left text-xs font-semibold">Discount</th>
                                    <th className="p-2 text-left text-xs font-semibold">
                                        {taxType === "GST" && gstMode === "Inclusive" ? "Inc. Tax" : "Tax"}
                                    </th>
                                    <th className="p-2 text-left text-xs font-semibold">Amount</th>
                                    <th className="p-2 text-left text-xs font-semibold rounded-tr-md">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <PurchaseInvoiceTableRow
                                        key={item.id}
                                        index={index}
                                        item={item}
                                        currencySymbol={currencySymbol}
                                        onInLineItemChange={(updatedItem) => onInlineItemChange(updatedItem, item.id)}
                                        onEditItem={onEditItem}
                                        onDeleteItem={onRemoveItem}
                                        availableItems={items}
                                        addNewProduct={onAddNewProduct}
                                        onAddVariants={(variants: any[], product: any) => onAddVariants(variants, product, item.id)}
                                        onOpenProductEditor={onOpenProductEditor}
                                    />
                                ))}
                                {items.length === 0 && (
                                    <tr className="bg-white text-gray-950">
                                        <td className="p-3 font-medium text-center" colSpan={9}>
                                            No Items Selected
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <ProductItemsSummaryFooter
                    items={items}
                    columns={["serial", "label", "colorSize", "quantity", "rate", "discount", "tax", "amount", "action"]}
                    currencySymbol={currencySymbol}
                    minWidthClassName="min-w-[980px]"
                    colClassNames={["w-[4rem]", "w-[30%]", "w-[14%]", "w-[10%]", "w-[10%]", "w-[10%]", "w-[10%]", "w-[12%]", "w-[6rem]"]}
                />

                <ProductDetailsModal
                    isOpen={isQuickAddQuantityModalOpen}
                    onClose={() => {
                        setIsQuickAddQuantityModalOpen(false);
                        setPendingQuickAddEntry(null);
                    }}
                    title="Add Item"
                    item={pendingQuickAddEntry ? {
                        ...pendingQuickAddEntry,
                        qty: 1,
                        rate: pendingQuickAddEntry.variant.purchase_price ?? pendingQuickAddEntry.product.purchase_price ?? '',
                        discount_value: 0
                    } : null}
                    onSave={(qty, rate, discount) => {
                        if (pendingQuickAddEntry) {
                            onQuickAddVariant(pendingQuickAddEntry.variant, pendingQuickAddEntry.product, qty, rate, discount);
                            setQuickAddSearch('');
                            setIsQuickAddQuantityModalOpen(false);
                            setPendingQuickAddEntry(null);
                            setQuickAddActiveIndex(-1);
                            window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
                        }
                    }}
                    currencySymbol={currencySymbol}
                />
            </div>
        </div>
    );
};

type PurchaseSummaryProps = {
    subTotal: number;
    totalTax: number;
    itemDiscount: number;
    overallDiscountValue: number;
    overallDiscountType: "Fixed" | "Percentage";
    finalAmount: number;
    currencySymbol: string;
    totalInWords: string;
    isInclusive: boolean;
    onOverallDiscountChange: (value: number) => void;
    onOverallDiscountTypeChange: (value: "Fixed" | "Percentage") => void;
};

const PurchaseSummary: React.FC<PurchaseSummaryProps> = ({
    subTotal,
    totalTax,
    itemDiscount,
    overallDiscountValue,
    overallDiscountType,
    finalAmount,
    currencySymbol,
    totalInWords,
    isInclusive,
    onOverallDiscountChange,
    onOverallDiscountTypeChange
}) => {
    return (
        <div className="bg-white p-2 rounded-lg space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
                <span>Amount</span>
                <span>{currencySymbol}{subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
                <span>{isInclusive ? "Inc. Tax" : "Tax"}</span>
                <span>{currencySymbol}{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
                <span>Discount</span>
                <div className="flex items-center gap-2">
                    <select
                        value={overallDiscountType}
                        onChange={(e) =>
                            onOverallDiscountTypeChange(e.target.value as "Fixed" | "Percentage")
                        }
                        className="p-1 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none"
                    >
                        <option value="Fixed">Fixed</option>
                        <option value="Percentage">%</option>
                    </select>
                    <span>- {overallDiscountType === "Fixed" ? currencySymbol : "%"}</span>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter discount"
                        className="w-24 p-1 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none"
                        value={overallDiscountValue ? overallDiscountValue : ""}
                        onChange={(e) => {
                            const raw = Number(e.target.value) || 0;
                            if (overallDiscountType === "Percentage") {
                                const safe = Math.min(Math.max(0, raw), 100);
                                onOverallDiscountChange(safe);
                                return;
                            }
                            const safe = Math.max(0, raw);
                            onOverallDiscountChange(safe);
                        }}
                    />
                </div>
            </div>
            {itemDiscount > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Item Discount</span>
                    <span>{currencySymbol}{itemDiscount.toFixed(2)}</span>
                </div>
            )}
            <hr className="border-gray-200" />
            <div className="flex justify-between font-bold text-gray-950">
                <span>
                    Total <small className="text-xs text-gray-500 font-medium">(Rounded)</small>
                </span>
                <span>{currencySymbol}{finalAmount.toFixed(2)}</span>
            </div>
            <p className="text-sm text-gray-500 capitalize">{totalInWords}</p>
        </div>
    );
};


const createEmptyItem = (): ProductItem => ({
    id: crypto.randomUUID(),
    name: '',
    hsn_code: '',
    unit: '',
    qty: 1,
    rate: 0,
    discount: 0,
    tax: 0,
    tax_group_id: null,
    amount: 0
});

type CreatePurchaseProps = {
    editId?: string;
};

const CreatePurchase: React.FC<CreatePurchaseProps> = ({ editId }) => {
    const navigate = useNavigate();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [adminUsers, setAdminUsers] = useState<OptionType[]>([]);
    const [suppliers, setSuppliers] = useState<OptionType[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<OptionType | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<OptionType | null>(null);
    const [brokers, setBrokers] = useState<BrokerOption[]>([]);
    const [selectedBroker, setSelectedBroker] = useState<BrokerOption | null>(null);
    const [showBrokerModal, setShowBrokerModal] = useState(false);
    const [isSavingBroker, setIsSavingBroker] = useState(false);
    const [brokerForm, setBrokerForm] = useState({
        name: '',
        phone: '',
        commissionType: 'Percentage' as 'Percentage' | 'Fixed',
        commissionValue: '',
        country: '',
        state: '',
        city: '',
        address: '',
    });
    const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
    const [stateOptions, setStateOptions] = useState<{ id: string; name: string }[]>([]);
    const [cityOptions, setCityOptions] = useState<{ id: string; name: string }[]>([]);
    const [countrySearchKeyword, setCountrySearchKeyword] = useState('');
    const [stateSearchKeyword, setStateSearchKeyword] = useState('');
    const [citySearchKeyword, setCitySearchKeyword] = useState('');
    const debouncedCountrySearch = useDebounce(countrySearchKeyword, 300);
    const debouncedStateSearch = useDebounce(stateSearchKeyword, 300);
    const debouncedCitySearch = useDebounce(citySearchKeyword, 300);
    const [selectedCountryId, setSelectedCountryId] = useState<string>('');
    const [selectedStateId, setSelectedStateId] = useState<string>('');
    const [companyDetails, setCompanyDetails] = useState<SelectedAdmin | null>(null);
    const [supplierDetails, setSupplierDetails] = useState<SupplierDetails | null>(null);
    const [paymentModes, setPaymentModes] = useState<IPaymentMode[]>([]);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const isEditMode = Boolean(editId);
    const [purchaseFormData, setPurchaseFormData] = useState<PurchaseFormData>({
        _id: '',
        userId: user?.id || '',
        billFrom: '',
        billTo: '',
        referenceNo: '',
        purchaseId: '',
        supplier_bill_number: '',
        purchaseDate: new Date(),
        purchaseBillDate: new Date(),
        dueDate: new Date(),
        dueDays: null,
        status: '',
        items: [],
        notes: '',
        termsAndCondition: '',
        paymentMode: '',
        paymentModeSlug: '',
        checkNumber: '',
        bank: null,
        overall_discount: 0,
        taxType: 'GST',
        gstType: 'Exclusive',
        // sign_type: 'digitalSignature',
        // signatureId: null,
        // signatureName: '',
        // esignDataUrl: null,
        // subTotal: null,
        // totalTax: null,
        // totalDiscount: null,
        // grandTotal: null,
        sp_referenceNumber: '',
        sp_paymentDate: null,
        sp_paymentMode: '',
        sp_amount: 0,
        sp_paid_amount: 0,
        sp_due_amount: 0,

        brokerId: null,
        brokerName: '',
        brokerPhone: '',
        brokerCommissionType: 'Percentage',
        brokerCommissionValue: 0,
        brokerCommissionAmount: 0
    });
    const [overallDiscountType, setOverallDiscountType] = useState<"Fixed" | "Percentage">("Fixed");
    const [pendingPurchaseData, setPendingPurchaseData] = useState<PurchaseFormData | null>(null);
    let effectiveGstMode: "Inclusive" | "Exclusive" = "Exclusive";


    // Edit Modal State
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
    const [taxes, setTaxes] = useState<taxGroup[]>([]);

    // Extra Information State
    const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'termsAndCondition' | 'bank' | 'expense'>('notes');
    const [bankAccounts, setBankAccounts] = useState<OptionType[]>([]);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [supplierSearchInput, setSupplierSearchInput] = useState<string>('');
    const debouncedSupplierSearch = useDebounce(supplierSearchInput, 500);
    const [brokerSearchInput, setBrokerSearchInput] = useState<string>('');
    const debouncedBrokerSearch = useDebounce(brokerSearchInput, 500);
    const [variantList, setVariantList] = useState<any[]>([]);
    const [productList, setProductList] = useState<Product[]>([]);
    const [showCreateProductModal, setShowCreateProductModal] = useState(false);
    const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
    const [editingModalProductId, setEditingModalProductId] = useState<string | null>(null);
    const [showAiPurchaseScanModal, setShowAiPurchaseScanModal] = useState(false);
    const [isPurchaseExpenseModalOpen, setIsPurchaseExpenseModalOpen] = useState(false);
    const [isSavingPurchaseExpense, setIsSavingPurchaseExpense] = useState(false);
    const [pendingPurchaseExpenses, setPendingPurchaseExpenses] = useState<PurchaseExpenseFormData[]>([]);
    const [editingPurchaseExpenseIndex, setEditingPurchaseExpenseIndex] = useState<number | null>(null);
    const [purchaseExpenseForm, setPurchaseExpenseForm] = useState<PurchaseExpenseFormData>({
        amount: '',
        expenseDate: new Date(),
        description: '',
        paymentMode: '',
        paymentDate: null,
        paymentDueDate: null,
        customFields: [],
    });
    const scanBufferRef = useRef('');
    const scanTimeoutRef = useRef<number | null>(null);
    const lastScanTimeRef = useRef<number>(0);
    const [showDuplicateBarcodeModal, setShowDuplicateBarcodeModal] = useState(false);
    const [duplicateBarcodeMatches, setDuplicateBarcodeMatches] = useState<any[]>([]);
    const [pendingBarcodeRowId, setPendingBarcodeRowId] = useState<string | null>(null);
    const [pendingBarcodeSource, setPendingBarcodeSource] = useState<"scan" | "row">("scan");
    const [showPrintAllBarcodes, setShowPrintAllBarcodes] = useState(false);
    const [printAllBarcodes, setPrintAllBarcodes] = useState<Array<{ barcode: string; productName?: string; brandName?: string; variantSize?: string; price?: number; salePrice?: number; defaultQuantity?: number }>>([]);
    const printProductCacheRef = useRef<Record<string, any>>({});
    const [isCreateBankAccountModalOpen, setIsCreateBankAccountModalOpen] = useState(false);

    const recalculateItem = useCallback(
        (item: ProductItem, taxType: string, gstType: string, taxList: taxGroup[]) => {
            const qty = Number(item.qty) || 0;
            const rate = Number(item.rate) || 0;
            const discountValue = Number((item as any).discount_value) || Number(item.discount) || 0;
            const taxGroupId = item.tax_group_id;

            let taxRate = 0;
            if (taxType === "GST") {
                const selectedTaxGroup = taxList.find((t) => String(t._id) === String(taxGroupId));
                taxRate = selectedTaxGroup?.total_tax_rate || 0;
            }

            const gross = qty * rate;
            let discountAmount = Math.max(0, discountValue);
            if (discountAmount > gross) discountAmount = gross;

            let calculatedTax = 0;
            let finalAmount = 0;

            if (taxType === "GST" && gstType === "Inclusive") {
                const netInclusive = gross - discountAmount;
                const divisor = 1 + taxRate / 100;
                const baseAmount = divisor > 0 ? netInclusive / divisor : netInclusive;
                calculatedTax = netInclusive - baseAmount;
                finalAmount = netInclusive;
            } else {
                const netBase = gross - discountAmount;
                calculatedTax = taxType === "GST" ? netBase * (taxRate / 100) : 0;
                finalAmount = netBase + calculatedTax;
            }

            return {
                ...item,
                discount: discountAmount,
                tax: calculatedTax,
                amount: finalAmount
            };
        },
        []
    );

    useEffect(() => {
        if (!purchaseFormData.items.length) return;
        setPurchaseFormData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                recalculateItem(item, prev.taxType, effectiveGstMode, taxes)
            )
        }));
    }, [purchaseFormData.taxType, effectiveGstMode, taxes, recalculateItem]);

    useEffect(() => {
        fetchPaymentModes();
        fetchAdminUsers();
        if (!isEditMode) {
            fetchNextPurchaseId();
        }
        fetchTaxes();
    }, [isEditMode]);

    useEffect(() => {
        const fetchPurchase = async () => {
            if (!editId) return;
            try {
                setIsFetching(true);
                const response = await axios.get(`${Constants.FETCH_PURCHASE_DETAILS_URL}/${editId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = response.data.data;
                if (data) {
                    if (data.billTo) {
                        const _supplier = { id: data.billTo.id, name: data.billTo.name };
                        handleSupplierChange(_supplier);
                    }
                    if (data.billFrom) {
                        const _admin = { id: data.billFrom.id, name: data.billFrom.name };
                        handleAdminChange(_admin);
                    }
                    if (data.bank) {
                        setBankAccounts((prev) => {
                            const exists = prev.find(bank => bank.id === data.bank.id);
                            if (exists) return prev;
                            return [...prev, { id: data.bank.id, name: data.bank.bankName }];
                        });
                    }
                    setPurchaseFormData(prev => ({
                        ...prev,
                        _id: data.id,
                        purchaseId: data.purchaseId || '',
                        userId: user?.id || '',
                        billFrom: data.billFrom?.id || '',
                        billTo: data.billTo?.id || '',
                        supplier_bill_number: data.supplier_bill_number || '',
                        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
                        purchaseBillDate: data.purchaseBillDate ? new Date(data.purchaseBillDate) : null,
                        dueDate: data.dueDate ? new Date(data.dueDate) : null,
                        dueDays: data.dueDays ?? null,
                        status: data.status || '',
                        items: (data.items || []).map((item: any) => {
                            const rowId = item._id || crypto.randomUUID();
                            const qty = Number(item.qty) || 0;
                            const rate = Number(item.rate) || 0;
                            const discount = Number(item.discount) || 0;
                            const isValidObjectId = (value: unknown) =>
                                typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
                            const normalizedProductId =
                                item.product_id ||
                                item.productId ||
                                item.product?.id ||
                                item.product?._id ||
                                item.productId?.id ||
                                item.productId?._id ||
                                (typeof item.id === "object" && item.id !== null
                                    ? (item.id._id || item.id.id)
                                    : (isValidObjectId(item.id) ? item.id : undefined));
                            const normalizedVariantId =
                                item.variantId ||
                                item.variant?.id ||
                                item.variant?._id;
                            const normalizedName =
                                item.name ||
                                item.product_name ||
                                item.product?.name ||
                                item.product_id?.name ||
                                item.productId?.name ||
                                "";
                            const normalizedUnit =
                                item.unit?.name ||
                                item.unit ||
                                item.product?.unit?.name ||
                                item.product_id?.unit?.name ||
                                item.productId?.unit?.name ||
                                "";
                            const normalizedVariantSize =
                                item.variantSize ||
                                item.variant?.size ||
                                "";
                            const normalizedVariantColor =
                                item.variantColor ||
                                item.variant?.color ||
                                "";
                            const normalizedVariantName =
                                item.variantName ||
                                item.variant_name ||
                                `${normalizedVariantColor || ''} - ${normalizedVariantSize || ''}`.trim().replace(/^-\s*|\s*-\s*$/g, '');
                            return {
                                ...item,
                                id: rowId,
                                name: normalizedName,
                                product_id: normalizedProductId,
                                variantId: normalizedVariantId,
                                unit: normalizedUnit,
                                qty,
                                rate,
                                discount,
                                tax: Number(item.tax) || 0,
                                tax_group_id: item.tax_group_id || item.tax_group?.id || null,
                                amount: Math.max(qty * rate - discount, 0),
                                variantName: normalizedVariantName,
                                variantSize: normalizedVariantSize,
                                variantColor: normalizedVariantColor,
                                variantBarcode: item.variantBarcode || item.variant?.barcode,
                                productBrandName:
                                    item.productBrandName ||
                                    item.product?.brand?.brand_name ||
                                    item.variant?.productId?.brand?.brand_name ||
                                    "",
                                variantMrp: item.variantMrp ?? item.variant?.mrp ?? item.mrp,
                            };
                        }),
                        notes: data.notes || '',
                        termsAndCondition: data.termsAndCondition || '',
                        checkNumber: data.checkNumber || '',
                        bank: data.bank?.id || null,
                        overall_discount: data.overall_discount || 0,
                        taxType: data.taxType || prev.taxType,
                        gstType: data.gstType ?? prev.gstType,
                        sp_referenceNumber: data.sp_referenceNumber || '',
                        sp_paymentDate: data.sp_paymentDate ? new Date(data.sp_paymentDate) : null,
                        sp_paymentMode: data.sp_paymentMode || '',
                        sp_amount: data.sp_amount || 0,
                        sp_paid_amount: data.sp_paid_amount || 0,
                        sp_due_amount: data.sp_due_amount || 0,
                        brokerId: data.broker?.brokerId || null,
                        brokerName: data.broker?.name || '',
                        brokerPhone: data.broker?.phone || '',
                        brokerCommissionType: data.broker?.commissionType || 'Percentage',
                        brokerCommissionValue: data.broker?.commissionValue || 0,
                        brokerCommissionAmount: data.broker?.commissionAmount || 0,
                    }));
                    if (data.broker?.brokerId) {
                        const broker = {
                            id: data.broker.brokerId,
                            name: data.broker.name || '',
                            phone: data.broker.phone || '',
                            commissionType: data.broker.commissionType || 'Percentage',
                            commissionValue: data.broker.commissionValue || 0,
                        } as BrokerOption;
                        setSelectedBroker(broker);
                        setBrokerSearchInput(broker.name);
                    }
                }
            } catch (error) {
                console.error('Error fetching purchase:', error);
            } finally {
                setIsFetching(false);
            }
        };

        fetchPurchase();
    }, [editId, token]);

    const fetchAllVariants = useCallback(async () => {
        try {
            const res = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: { all: true }
            });
            const responseData = res.data.data;
            const variants = responseData?.variants || [];
            setVariantList(Array.isArray(variants) ? variants : []);
            return Array.isArray(variants) ? variants : [];
        } catch (err) {
            console.error('Variant list error:', err);
            setVariantList([]);
            return [];
        }
    }, [token]);

    const fetchVariantsByBarcode = useCallback(async (barcode: string) => {
        try {
            const normalizedBarcode = barcode.trim();
            const res = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: { search: normalizedBarcode, all: true }
            });
            const responseData = res.data.data;
            const variants = Array.isArray(responseData?.variants) ? responseData.variants : [];
            return variants.filter((variant: any) => String(variant?.barcode || '').trim() === normalizedBarcode);
        } catch (err) {
            console.error('Barcode variant lookup error:', err);
            return [];
        }
    }, [token]);

    const closeProductModal = useCallback(() => {
        setShowCreateProductModal(false);
        setProductModalMode('create');
        setEditingModalProductId(null);
    }, []);

    const handleCreateProductModalOpen = useCallback(() => {
        setProductModalMode('create');
        setEditingModalProductId(null);
        setShowCreateProductModal(true);
    }, []);

    const syncItemsWithUpdatedProduct = useCallback((items: ProductItem[], updatedProduct: any, latestVariants: any[] = []) => {
        const normalizedProductId = String(updatedProduct?.id || updatedProduct?._id || '');
        if (!normalizedProductId) return items;

        const productBrandName = getBrandName(updatedProduct?.brand || updatedProduct?.productBrandName || updatedProduct?.brand_name) || '';
        const productHsn = updatedProduct?.hsn_code || '';
        const productUnitName = updatedProduct?.unit?.name || updatedProduct?.unit?.unit_name || '';
        const productTaxGroupId = updatedProduct?.tax?.group_id || updatedProduct?.tax?.id || updatedProduct?.tax?._id || null;

        const syncedItems = items.map((row) => {
            if (String(row.product_id || '') !== normalizedProductId) return row;
            const matchedVariant = latestVariants.find((variant: any) => String(variant._id || variant.id) === String((row as any).variantId || ''));
            const updatedRow = {
                ...row,
                hsn_code: productHsn,
                unit: productUnitName,
                tax_group_id: productTaxGroupId,
                productBrandName,
                isCreatedFromModalProduct: true,
            } as ProductItem & any;

            if (matchedVariant) {
                updatedRow.name =
                    formatVariantDisplay({
                        brandName: productBrandName,
                        designNo: matchedVariant.designNo,
                        size: matchedVariant.size,
                    }) || matchedVariant.designNo || updatedProduct?.name || row.name || '';
                updatedRow.variantName = `${matchedVariant.color || ''} - ${matchedVariant.size || ''}`.trim();
                updatedRow.variantDesignNo = matchedVariant.designNo;
                updatedRow.variantColor = matchedVariant.color;
                updatedRow.variantSize = matchedVariant.size;
                updatedRow.variantBarcode = matchedVariant.barcode;
                updatedRow.variantMrp = matchedVariant.mrp;
                updatedRow.variantSalePrice = matchedVariant.sale_price;
                if (typeof matchedVariant.purchase_price === 'number') {
                    updatedRow.rate = matchedVariant.purchase_price;
                }
            }

            return recalculateItem(updatedRow, purchaseFormData.taxType, effectiveGstMode, taxes);
        });

        const existingVariantIds = new Set(
            syncedItems
                .filter((row) => String(row.product_id || '') === normalizedProductId)
                .map((row: any) => String(row.variantId || ''))
                .filter(Boolean)
        );

        const appendedItems = latestVariants
            .filter((variant: any) => {
                const variantId = String(variant._id || variant.id || '');
                return variantId && !existingVariantIds.has(variantId);
            })
            .map((variant: any) => {
                const rate = Number(variant.purchase_price) || 0;
                const baseRow = {
                    id: crypto.randomUUID(),
                    product_id: normalizedProductId,
                    name:
                        formatVariantDisplay({
                            brandName: productBrandName,
                            designNo: variant.designNo,
                            size: variant.size,
                        }) || variant.designNo || updatedProduct?.name || '',
                    hsn_code: productHsn,
                    unit: productUnitName,
                    qty: 1,
                    rate,
                    discount: 0,
                    tax: 0,
                    tax_group_id: productTaxGroupId,
                    productBrandName,
                    variantId: variant._id || variant.id,
                    variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
                    variantDesignNo: variant.designNo,
                    variantColor: variant.color,
                    variantSize: variant.size,
                    variantBarcode: variant.barcode,
                    variantMrp: variant.mrp,
                    variantSalePrice: variant.sale_price,
                    isCreatedFromModalProduct: true,
                } as ProductItem & any;

                return recalculateItem(baseRow, purchaseFormData.taxType, effectiveGstMode, taxes);
            });

        return appendedItems.length ? [...syncedItems, ...appendedItems] : syncedItems;
    }, [effectiveGstMode, purchaseFormData.taxType, recalculateItem, taxes]);

    const handleOpenCreatedProductEditor = useCallback((selectedItem: ProductItem & any) => {
        const productId = selectedItem?.product_id || selectedItem?.productId;
        if (!productId) {
            toast.error('Product not found for editing');
            return;
        }
        setEditingModalProductId(String(productId));
        setProductModalMode('edit');
        setShowCreateProductModal(true);
    }, []);

    const handleProductModalSaved = useCallback((product: any, variants: any[] = [], mode: 'create' | 'edit') => {
        if (!product) {
            closeProductModal();
            return;
        }

        setProductList(prev => {
            const id = product.id || product._id;
            const filtered = prev.filter(p => String((p as any).id || (p as any)._id) !== String(id));
            return [product, ...filtered];
        });
        fetchAllVariants();

        if (mode === 'create') {
            handleProductCreatedFromModal(product, variants);
            closeProductModal();
            return;
        }

        setPurchaseFormData(prev => ({
            ...prev,
            items: syncItemsWithUpdatedProduct(prev.items, product, variants),
        }));
        toast.success('Purchase items updated with latest product details');
        closeProductModal();
    }, [closeProductModal, fetchAllVariants, syncItemsWithUpdatedProduct]);

    const handleProductCreatedFromModal = useCallback((product: any, variants: any[] = []) => {
        if (!product) return;
        setProductList(prev => {
            const id = product.id || product._id;
            const exists = prev.some(p => String((p as any).id || (p as any)._id) === String(id));
            if (exists) return prev;
            return [product, ...prev];
        });
        fetchAllVariants();

        if (!variants.length) return;
        const normalizedProductId = product.id || product._id;
        const productBrandName = getBrandName((product as any).brand || (product as any).productBrandName || (product as any).brand_name) || "";
        const productHsn = product.hsn_code || "";
        const productUnitName = product.unit?.name || product.unit?.unit_name || "";
        const productTaxGroupId = product.tax?.group_id || product.tax?.id || null;

        const newItems = variants.map((v) => {
            const rate = v.purchase_price ?? 0;
            const qty = 1;
            const discount = 0;
            const amount = Math.max(qty * rate - discount, 0);
            return {
                id: crypto.randomUUID(),
                product_id: normalizedProductId,
                name:
                    formatVariantDisplay({
                        brandName: productBrandName,
                        designNo: v.designNo,
                        size: v.size,
                    }) || v.designNo || product.name || "",
                hsn_code: productHsn,
                unit: productUnitName,
                qty,
                rate,
                discount,
                tax: 0,
                tax_group_id: productTaxGroupId,
                amount,
                productBrandName,
                variantId: v._id,
                variantName: `${v.color || ''} - ${v.size || ''}`.trim(),
                variantDesignNo: v.designNo,
                variantColor: v.color,
                variantSize: v.size,
                variantBarcode: v.barcode,
                variantMrp: v.mrp,
                isCreatedFromModalProduct: true
            } as ProductItem;
        });
        const recalculatedItems = newItems.map((item) =>
            recalculateItem(item, purchaseFormData.taxType, effectiveGstMode, taxes)
        );

        setPurchaseFormData(prev => {
            const emptyIndex = prev.items.findIndex(i => !i.name || i.name.trim() === '');
            if (emptyIndex === -1) {
                return { ...prev, items: [...prev.items, ...recalculatedItems] };
            }
            const itemsCopy = [...prev.items];
            itemsCopy.splice(emptyIndex, 1, ...recalculatedItems);
            return { ...prev, items: itemsCopy };
        });
    }, [fetchAllVariants, recalculateItem, purchaseFormData.taxType, effectiveGstMode, taxes]);

    useEffect(() => {
        if (token) {
            fetchAllVariants();
        }
    }, [token, fetchAllVariants]);

    useEffect(() => {
        const fetchProductsForPurchase = async () => {
            try {
                const res = await axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const products = res?.data?.data?.products ?? [];
                setProductList(products);
            } catch (err) {
                toast.error('Failed to load products');
                setProductList([]);
            }
        };

        if (token) {
            fetchProductsForPurchase();
        }
    }, [token]);


    useEffect(() => {
        if (user?.id && !purchaseFormData.billFrom) {
            setPurchaseFormData(prev => ({
                ...prev,
                billFrom: user.id
            }));
        }
    }, [user?.id, purchaseFormData.billFrom]);

    // Legacy selection removed: Purchase is now created directly.

    const fetchPaymentModes = async () => {
        try {
            const response = await axios.get(Constants.GET_ALL_PAYMENT_MODES_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPaymentModes(response.data.data);
        } catch (error) {
            console.error('Error fetching payment modes:', error);
        }
    }

    const fetchNextPurchaseId = async () => {
        try {
            if (!token) return;
            const response = await axios.get(Constants.GET_NEXT_PURCHASE_ID_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const nextId = response.data?.data?.purchaseId || '';
            if (nextId) {
                setPurchaseFormData(prev => ({ ...prev, purchaseId: nextId }));
            }
        } catch (error) {
            console.error('Error fetching next purchase ID:', error);
        }
    }

    const resetPurchaseExpenseForm = () => {
        setPurchaseExpenseForm({
            amount: '',
            expenseDate: new Date(),
            description: '',
            paymentMode: '',
            paymentDate: null,
            paymentDueDate: null,
            customFields: [],
        });
    };

    const handleOpenPurchaseExpenseModal = (index?: number) => {
        if (!purchaseFormData.purchaseId) {
            toast.error("Please save the purchase to generate a Purchase ID first.");
            return;
        }
        if (typeof index === 'number') {
            setEditingPurchaseExpenseIndex(index);
            setPurchaseExpenseForm(pendingPurchaseExpenses[index]);
        } else {
            setEditingPurchaseExpenseIndex(null);
            resetPurchaseExpenseForm();
        }
        setIsPurchaseExpenseModalOpen(true);
    };

    const handleDeletePurchaseExpense = (index: number) => {
        setPendingPurchaseExpenses(prev => prev.filter((_, i) => i !== index));
    };

    const handlePurchaseExpenseFieldChange = (field: keyof PurchaseExpenseFormData, value: any) => {
        setPurchaseExpenseForm(prev => ({ ...prev, [field]: value }));
    };

    const addPurchaseExpenseCustomField = () => {
        setPurchaseExpenseForm(prev => ({
            ...prev,
            customFields: [...prev.customFields, { key: '', value: '' }]
        }));
    };

    const updatePurchaseExpenseCustomField = (index: number, field: 'key' | 'value', value: string) => {
        setPurchaseExpenseForm(prev => {
            const updated = [...prev.customFields];
            updated[index][field] = value;
            return { ...prev, customFields: updated };
        });
    };

    const removePurchaseExpenseCustomField = (index: number) => {
        setPurchaseExpenseForm(prev => ({
            ...prev,
            customFields: prev.customFields.filter((_, i) => i !== index)
        }));
    };

    const ensurePurchaseExpenseCategoryId = async (purchaseId: string) => {
        const searchTerm = purchaseId.trim();
        const response = await axios.get(Constants.FETCH_EXPENSE_CATEGORIES_WITH_SEARCH_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { search: searchTerm },
        });
        const categories: ExpenseCategoryOption[] = (response.data?.data || [])
            .filter((cat: any) => cat._id || cat.id)
            .map((cat: any) => ({
                _id: String(cat._id || cat.id),
                title: cat.title,
            }));

        const existing = categories.find(
            (cat) => cat.title?.toLowerCase() === searchTerm.toLowerCase()
        );

        if (existing) return existing._id;

        const created = await axios.post(
            Constants.CREATE_NEW_EXPENSE_CATEGORY_URL,
            {
                title: searchTerm,
                description: `Purchase expense for ${searchTerm}`,
                status: true,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return String(created.data?.data?.id || created.data?.data?._id);
    };

    const handleCreatePurchaseExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purchaseFormData.purchaseId) {
            toast.error("Purchase ID not found. Please save the purchase first.");
            return;
        }
        if (!purchaseExpenseForm.amount) {
            toast.error("Please enter the expense amount.");
            return;
        }
        setIsSavingPurchaseExpense(true);
        const processedExpense = {
            ...purchaseExpenseForm,
            customFields: (purchaseExpenseForm.customFields || []).filter(f => f.key && f.value),
        };

        if (editingPurchaseExpenseIndex !== null) {
            setPendingPurchaseExpenses(prev => {
                const updated = [...prev];
                updated[editingPurchaseExpenseIndex] = processedExpense;
                return updated;
            });
        } else {
            setPendingPurchaseExpenses(prev => [...prev, processedExpense]);
        }
        setIsSavingPurchaseExpense(false);
        setIsPurchaseExpenseModalOpen(false);
        toast.info(editingPurchaseExpenseIndex !== null ? "Expense updated." : "Expense saved. It will be created after the purchase is saved.");
    };

    const handlePrintSelectedBarcodes = async () => {
        const getAnyRefValue = (value: any) => {
            if (!value) return "";
            if (typeof value === "object") {
                return String(value.id || value._id || value.code || "");
            }
            return String(value);
        };
        const getProductByReference = (productRef: any, products: any[]) => {
            const normalizedRef = getAnyRefValue(productRef);
            if (!normalizedRef) return null;

            return (
                products.find((p) => {
                    const candidateIds = [
                        p?.id,
                        p?._id,
                        p?.code,
                    ]
                        .map((candidate) => getAnyRefValue(candidate))
                        .filter(Boolean);

                    return candidateIds.includes(normalizedRef);
                }) || null
            );
        };
        const resolveBarcode = (item: any, variants: any[]) => {
            if (item.variantBarcode) return item.variantBarcode;
            if (item.variant?.barcode) return item.variant.barcode;
            const variantId = item.variantId || item.variant?._id || item.variant?.id;
            if (!variantId) return undefined;
            const match = variants.find(v => String(v._id || v.id) === String(variantId));
            return match?.barcode;
        };
        const resolveBrandName = (item: any, variants: any[], products: any[]) => {
            if (item.productBrandName) return item.productBrandName;
            if (item.product?.brand?.brand_name) return item.product.brand.brand_name;
            if (item.variant?.productId?.brand?.brand_name) return item.variant.productId.brand.brand_name;

            const productRef = item.product_id || item.productId || item.product;
            const productMatch = getProductByReference(productRef, products);
            if (productMatch?.brand?.brand_name) {
                return productMatch.brand.brand_name;
            }

            if (typeof productRef === "object" && productRef?.brand?.brand_name) {
                return productRef.brand.brand_name;
            }

            const variantId = item.variantId || item.variant?._id || item.variant?.id;
            if (variantId) {
                const variantMatch = variants.find(v => String(v._id || v.id) === String(variantId));
                if (variantMatch?.productId?.brand?.brand_name) {
                    return variantMatch.productId.brand.brand_name;
                }

                const variantProductMatch = getProductByReference(variantMatch?.productId, products);
                if (variantProductMatch?.brand?.brand_name) {
                    return variantProductMatch.brand.brand_name;
                }
            }
            return "";
        };
        const resolveProductId = (item: any, variants: any[]) => {
            const directProductRef = item.product_id || item.productId || item.product;
            const directProductId = getAnyRefValue(directProductRef);
            if (directProductId) return directProductId;

            const variantId = item.variantId || item.variant?._id || item.variant?.id;
            if (!variantId) return "";

            const variantMatch = variants.find(v => String(v._id || v.id) === String(variantId));
            return getAnyRefValue(variantMatch?.productId);
        };
        const ensurePrintProductLoaded = async (productId: string) => {
            if (!productId) return null;
            if (printProductCacheRef.current[productId]) {
                return printProductCacheRef.current[productId];
            }

            try {
                const res = await axios.get(`${Constants.GET_PRODUCT_URL}/${productId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const product = res.data?.data || null;
                if (product) {
                    printProductCacheRef.current[productId] = product;
                }
                return product;
            } catch {
                return null;
            }
        };
        const resolveSalePrice = (item: any, variants: any[]) => {
            if (item.variantSalePrice != null) return item.variantSalePrice;
            const variantId = item.variantId || item.variant?._id || item.variant?.id;
            if (!variantId) return undefined;
            const match = variants.find(v => String(v._id || v.id) === String(variantId));
            return match?.sale_price;
        };
        const resolvePrintProductName = (item: any, brandName: string) => {
            if (item.variantDesignNo) return item.variantDesignNo;
            if (item.variant?.designNo) return item.variant.designNo;

            const currentName = String(item.name || "").trim();
            const currentBrand = String(brandName || "").trim();
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
        };
        const resolveMrp = (item: any, variants: any[]) => {
            if (item.variantMrp != null) return item.variantMrp;
            if (item.variant?.mrp != null) return item.variant.mrp;
            const variantId = item.variantId || item.variant?._id || item.variant?.id;
            if (!variantId) return undefined;
            const match = variants.find(v => String(v._id || v.id) === String(variantId));
            return match?.mrp;
        };

        let variants = variantList;
        let products = productList;
        let itemsToPrint = purchaseFormData.items
            .map((item) => ({
                ...item,
                _resolvedBarcode: resolveBarcode(item, variants),
                _resolvedBrandName: resolveBrandName(item, variants, products),
            }))
            .filter((item) => item.name?.trim() && item._resolvedBarcode);

        if (!itemsToPrint.length && (!variants.length || !products.length)) {
            if (!variants.length) {
                variants = await fetchAllVariants();
            }
            if (!products.length) {
                const res = await axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                products = res?.data?.data?.products ?? [];
            }
            itemsToPrint = purchaseFormData.items
                .map((item) => ({
                    ...item,
                    _resolvedBarcode: resolveBarcode(item, variants),
                    _resolvedBrandName: resolveBrandName(item, variants, products),
                }))
                .filter((item) => item.name?.trim() && item._resolvedBarcode);
        }

        if (!itemsToPrint.length) {
            toast.error("No items with barcodes to print.");
            return;
        }

        const initialPrintItems = itemsToPrint.map((item) => {
            const brandName = item._resolvedBrandName || "";
            return {
                barcode: item._resolvedBarcode as string,
                productName: resolvePrintProductName(item, brandName),
                brandName,
                variantSize: item.variantSize || "",
                price: resolveMrp(item, variants),
                salePrice: resolveSalePrice(item, variants),
                defaultQuantity: Number(item.qty) > 0 ? Number(item.qty) : 1,
            };
        });

        setPrintAllBarcodes(initialPrintItems);
        setShowPrintAllBarcodes(true);

        if (initialPrintItems.some((item) => !String(item.brandName || "").trim())) {
            void (async () => {
                const enrichedItems = await Promise.all(itemsToPrint.map(async (item, index) => {
                    let brandName = initialPrintItems[index]?.brandName || "";

                    if (!brandName) {
                        const productId = resolveProductId(item, variants);
                        const loadedProduct = await ensurePrintProductLoaded(productId);
                        brandName =
                            loadedProduct?.brand?.brand_name ||
                            loadedProduct?.brand_name ||
                            "";
                    }

                    return {
                        ...initialPrintItems[index],
                        brandName,
                        productName: resolvePrintProductName(item, brandName),
                    };
                }));

                setPrintAllBarcodes(enrichedItems);
            })();
        }
    };
    const fetchTaxes = async () => {
        if (!token) return;
        try {
            const response = await axios.get(Constants.FETCH_TAX_GROUP_LIST_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = response.data?.data;
            const taxGroups = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];
            setTaxes(taxGroups);
        } catch (error) {
            console.error('Error fetching taxes:', error);
            setTaxes([]);
        }
    };


    const handleAdminChange = async (user: OptionType) => {
        setSelectedAdmin(user);
        try {
            setIsFetching(true);
            const response = await axios.get(`${Constants.FETCH_COMPANY_SETTINGS_URL}/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            //set billFrom to prev purchaseFormData
            setPurchaseFormData(prev => ({ ...prev, billFrom: user.id }));
            setCompanyDetails(response.data.data);
        } catch (error) {
            setCompanyDetails(null);
        } finally {
            setIsFetching(false);
        }
    };

    const handleSupplierChange = async (user: OptionType) => {
        setSelectedSupplier(user);
        try {
            setIsFetching(true);
            const response = await axios.get(`${Constants.GET_SUPPLIER_BY_ID_URL}/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            //set billTo to prev formData
            setPurchaseFormData(prev => ({ ...prev, billTo: user.id }));
            setSupplierDetails(response.data.data);
        } catch (error) {
            setSupplierDetails(null);
        } finally {
            setIsFetching(false);
        }
    };

    const parseAiDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const findTaxGroupIdByRate = (rate?: number) => {
        const numericRate = Number(rate || 0);
        const matchedTax = taxes.find((tax) => Number(tax.total_tax_rate || 0) === numericRate);
        return matchedTax?._id || null;
    };

    const isValidMongoId = (value?: string | null) => /^[a-f\d]{24}$/i.test(String(value || ""));

    const resolveProductIdFromVariant = (variantId?: string | null, fallbackProductId?: string | null) => {
        if (isValidMongoId(fallbackProductId)) {
            return String(fallbackProductId);
        }

        const normalizedVariantId = String(variantId || "");
        if (!normalizedVariantId) return "";

        const variantMatch = variantList.find(
            (variant: any) => String(variant?._id || variant?.id || "") === normalizedVariantId
        );

        const productId = typeof variantMatch?.productId === "object" && variantMatch?.productId !== null
            ? (variantMatch.productId.id || variantMatch.productId._id)
            : variantMatch?.productId;

        return isValidMongoId(productId) ? String(productId) : "";
    };

    const normalizePurchaseItemsForSubmission = (items: ProductItem[] = []) => {
        return items
            .filter((item) => item.name?.trim())
            .map((item) => {
                const resolvedVariantId = String((item as any).variantId || "");
                const resolvedProductId = resolveProductIdFromVariant(resolvedVariantId, String((item as any).product_id || ""));

                return {
                    ...item,
                    product_id: resolvedProductId,
                    variantId: resolvedVariantId,
                };
            })
            .filter((item: any) => isValidMongoId(item.product_id) && isValidMongoId(item.variantId));
    };

    const createAiPurchaseItem = (sourceItem: any, matchedItem: any): ProductItem => {
        const product = matchedItem?.product;
        const variant = matchedItem?.variant;
        const quantity = Math.max(Number(sourceItem?.quantity || 1), 1);
        const rate = Number(sourceItem?.rate || variant?.purchase_price || 0);

        const baseItem: any = {
            id: crypto.randomUUID(),
            product_id: product?.id || matchedItem?.productId || '',
            name: product
                ? (formatVariantDisplay({
                    brandName: getBrandName(product.brand),
                    designNo: variant?.designNo || sourceItem?.designNumber || sourceItem?.description,
                    size: variant?.size || sourceItem?.size,
                }) || sourceItem?.description || product.name || '')
                : (sourceItem?.description || sourceItem?.designNumber || ''),
            hsn_code: sourceItem?.hsnCode || product?.hsn_code || '',
            unit: sourceItem?.unit || product?.unit?.name || '',
            productBrandName: product?.brand?.brand_name || sourceItem?.brand || '',
            qty: quantity,
            rate,
            discount: Number(sourceItem?.discount || 0),
            tax: 0,
            tax_group_id: (typeof product?.tax === 'object' && product?.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product?.tax) || findTaxGroupIdByRate(sourceItem?.taxRate),
            amount: Number(sourceItem?.amount || quantity * rate || 0),
            variantId: variant?._id || matchedItem?.variantId || '',
            variantName: `${variant?.color || sourceItem?.color || ''} - ${variant?.size || sourceItem?.size || ''}`.trim(),
            variantDesignNo: variant?.designNo || sourceItem?.designNumber || '',
            variantColor: variant?.color || sourceItem?.color || '',
            variantSize: variant?.size || sourceItem?.size || '',
            variantBarcode: variant?.barcode || sourceItem?.barcode || '',
            variantMrp: Number(variant?.mrp || 0),
        };

        return recalculateItem(baseItem, purchaseFormData.taxType, effectiveGstMode, taxes);
    };

    const applyAiPurchaseExtraction = async (payload: any) => {
        const extracted = payload?.extracted || {};
        const matches = payload?.matches || {};

        if (matches?.supplier?.id) {
            const supplierOption = suppliers.find((supplier) => String(supplier.id) === String(matches.supplier.id));
            if (supplierOption) {
                await handleSupplierChange(supplierOption);
                setSupplierSearchInput(supplierOption.name);
            }
        } else if (extracted.supplierPhone) {
            setSupplierSearchInput(String(extracted.supplierPhone).replace(/\D/g, '').slice(0, 10));
        } else if (extracted.supplierName) {
            setSupplierSearchInput(extracted.supplierName);
        }

        const nextItems = (extracted.items || [])
            .map((item: any, index: number) => ({ item, match: matches?.items?.[index] }))
            .filter((entry: any) => entry.match?.matched)
            .map((entry: any) => createAiPurchaseItem(entry.item, entry.match));

        setPurchaseFormData((prev) => ({
            ...prev,
            supplier_bill_number: extracted.supplierBillNumber || prev.supplier_bill_number || '',
            purchaseDate: parseAiDate(extracted.purchaseDate) || prev.purchaseDate,
            purchaseBillDate: parseAiDate(extracted.purchaseDate) || prev.purchaseBillDate,
            dueDate: parseAiDate(extracted.dueDate) || prev.dueDate,
            notes: extracted.notes || prev.notes,
            items: nextItems.length > 0 ? nextItems : prev.items,
        }));
    };

    const handleBrokerChange = (broker: BrokerOption | null) => {
        setSelectedBroker(broker);
        if (!broker) {
            setPurchaseFormData(prev => ({
                ...prev,
                brokerId: null,
                brokerName: '',
                brokerPhone: '',
                brokerCommissionType: 'Percentage',
                brokerCommissionValue: 0,
                brokerCommissionAmount: 0
            }));
            return;
        }
        const commissionValue = Number(broker.commissionValue) || 0;
        const commissionAmount = broker.commissionType === 'Percentage'
            ? (finalAmountRounded * commissionValue) / 100
            : commissionValue;
        setPurchaseFormData(prev => ({
            ...prev,
            brokerId: broker.id,
            brokerName: broker.name,
            brokerPhone: broker.phone,
            brokerCommissionType: broker.commissionType,
            brokerCommissionValue: broker.commissionValue,
            brokerCommissionAmount: commissionAmount
        }));
    };

    const resetBrokerForm = () => {
        setBrokerForm({
            name: '',
            phone: '',
            commissionType: 'Percentage',
            commissionValue: '',
            country: '',
            state: '',
            city: '',
            address: '',
        });
        setCountrySearchKeyword('');
        setStateSearchKeyword('');
        setCitySearchKeyword('');
        setSelectedCountryId('');
        setSelectedStateId('');
    };

    const handleOpenBrokerModal = () => {
        resetBrokerForm();
        setShowBrokerModal(true);
    };

    const handleCloseBrokerModal = () => {
        setShowBrokerModal(false);
    };

    const handleCreateBroker = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!brokerForm.name.trim() || !brokerForm.phone.trim()) {
            toast.error('Broker name and phone are required');
            return;
        }
        try {
            setIsSavingBroker(true);
            const payload = {
                name: brokerForm.name.trim(),
                phone: brokerForm.phone.trim(),
                address: brokerForm.address,
                city: brokerForm.city,
                state: brokerForm.state,
                country: brokerForm.country,
                commissionType: brokerForm.commissionType,
                commissionValue: Number(brokerForm.commissionValue) || 0,
            };
            const response = await axios.post(Constants.CREATE_BROKER_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const created = response.data?.broker || response.data?.data || null;
            const createdBroker: BrokerOption | null = created
                ? {
                    id: created._id || created.id,
                    name: created.name || brokerForm.name.trim(),
                    phone: created.phone || brokerForm.phone.trim(),
                    commissionType: created.commissionType || brokerForm.commissionType,
                    commissionValue: Number(created.commissionValue ?? payload.commissionValue) || 0,
                }
                : null;
            if (createdBroker) {
                setBrokers(prev => {
                    const exists = prev.some(b => b.id === createdBroker.id);
                    return exists ? prev : [createdBroker, ...prev];
                });
                setBrokerSearchInput(createdBroker.name);
                handleBrokerChange(createdBroker);
            }
            toast.success('Broker created');
            setShowBrokerModal(false);
            resetBrokerForm();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error creating broker');
        } finally {
            setIsSavingBroker(false);
        }
    };

    // --- ITEM & FORM HANDLERS ---
    const handleFormChange = (field: keyof PurchaseFormData, value: any) => {
        setPurchaseFormData(prev => ({ ...prev, [field]: value }));
    };

    const taxTypeOptions = [
        { id: "GST", name: "GST" },
        { id: "Non-GST", name: "Non-GST" },
    ];

    const TaxTypeSelector = () => (
        <div className="w-full">
            <div className="mt-1">
                <SmartDropdown
                    items={taxTypeOptions}
                    value={purchaseFormData.taxType}
                    selectedItem={taxTypeOptions.find(o => o.id === purchaseFormData.taxType)}
                    onSelect={(item) => {
                        if (item) {
                            handleFormChange("taxType", item.id);
                        }
                    }}
                    placeholder="Select Tax Type"
                    serverside={false}
                    onChange={() => { }}
                />
            </div>
        </div>
    );

    const handleRemoveItem = (itemToRemove: ProductItem) => {
        handleFormChange('items', purchaseFormData.items.filter(item => item.id !== itemToRemove.id));
    };

    const handleEditItem = (itemToEdit: ProductItem) => {
        setEditingItem({ ...itemToEdit });
        setIsEditProductModalOpen(true);
    };


    const handleEditingItemChange = (field: keyof ProductItem, value: string | number) => {
        setEditingItem(prev => {
            if (!prev) return null;

            const updated = {
                ...prev,
                [field]: field === 'qty' || field === 'rate'
                    ? Number(value) || 0
                    : value
            };
            return recalculateItem(updated, purchaseFormData.taxType, effectiveGstMode, taxes);
        });
    };


    const handleDueDaysChange = (value: number | null) => {
        setPurchaseFormData(prev => {
            const baseDate = prev.purchaseBillDate || prev.purchaseDate || new Date();
            const dueDate = value !== null
                ? new Date(new Date(baseDate).setDate(new Date(baseDate).getDate() + value))
                : prev.dueDate;
            return {
                ...prev,
                dueDays: value,
                dueDate
            };
        });
    };

    useEffect(() => {
        if (purchaseFormData.dueDays === null || purchaseFormData.dueDays === undefined) return;
        const baseDate = purchaseFormData.purchaseBillDate || purchaseFormData.purchaseDate || new Date();
        const computed = new Date(baseDate);
        computed.setDate(computed.getDate() + purchaseFormData.dueDays);
        const current = purchaseFormData.dueDate ? new Date(purchaseFormData.dueDate) : null;
        if (!current || current.toDateString() !== computed.toDateString()) {
            setPurchaseFormData(prev => ({ ...prev, dueDate: computed }));
        }
    }, [purchaseFormData.purchaseBillDate, purchaseFormData.purchaseDate, purchaseFormData.dueDays]);


    const { subTotal, totalDiscount, totalTax } = useMemo(() => {
        return purchaseFormData.items.reduce(
            (acc, item) => {
                const qty = Number(item.qty) || 0;
                const rate = Number(item.rate) || 0;
                const discount = Number(item.discount) || 0;
                const tax = Number(item.tax) || 0;
                acc.subTotal += qty * rate;
                acc.totalDiscount += discount;
                acc.totalTax += tax;
                return acc;
            },
            { subTotal: 0, totalDiscount: 0, totalTax: 0 }
        );
    }, [purchaseFormData.items]);


    const overallDiscountValue = Number(purchaseFormData.overall_discount) || 0;
    const isInclusive = purchaseFormData.taxType === "GST" && (effectiveGstMode as string) === "Inclusive";
    const overallDiscountBase = Math.max(
        (isInclusive ? subTotal : subTotal + totalTax) - totalDiscount,
        0
    );
    const appliedOverallDiscount = overallDiscountType === "Percentage"
        ? Math.min((overallDiscountBase * Math.min(Math.max(overallDiscountValue, 0), 100)) / 100, overallDiscountBase)
        : Math.min(Math.max(overallDiscountValue, 0), overallDiscountBase);
    const finalAmount = Math.max(
        (isInclusive ? subTotal : subTotal + totalTax) - totalDiscount - appliedOverallDiscount,
        0
    );
    const finalAmountRounded = Math.round(finalAmount);
    const brokerCommissionAmount = useMemo(() => {
        if (!selectedBroker) return 0;
        const baseAmount = finalAmountRounded;
        const commissionValue = Number(selectedBroker.commissionValue) || 0;
        return selectedBroker.commissionType === 'Percentage'
            ? (baseAmount * commissionValue) / 100
            : commissionValue;
    }, [selectedBroker, finalAmountRounded]);
    const currencySymbol = systemSettings?.currency.symbol ?? '$';
    const totalInWords = numberToWords(finalAmountRounded);
    const defaultPaymentType = useMemo(() => {
        if (purchaseFormData.status === 'paid') return 'full';
        if (purchaseFormData.status === 'pending' || purchaseFormData.status === 'cancelled' || purchaseFormData.status === '') return 'none';
        return 'partial';
    }, [purchaseFormData.status]);


    const fetchAdminUsers = async () => {
        if (adminUsers.length > 0 && selectedAdmin) return;
        if (user?.id) {
            const defaultAdmin = {
                id: user.id,
                name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || user.email || 'Admin'
            };
            setAdminUsers([defaultAdmin]);
            if (!selectedAdmin || selectedAdmin.id !== defaultAdmin.id) {
                setSelectedAdmin(defaultAdmin);
                handleAdminChange(defaultAdmin);
            }
            return;
        }
        try {
            const response = await axios.get(`${Constants.FETCH_USERS_URL}/1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const list = Array.isArray(response.data?.data) ? response.data.data : [];
            if (list.length > 0) {
                const formattedUsers = list.map((user: any) => ({ id: user.id, name: `${user.firstName} ${user.lastName}` }));
                setAdminUsers(formattedUsers);
                const defaultAdmin = formattedUsers[0];
                setSelectedAdmin(defaultAdmin);
                handleAdminChange(defaultAdmin);
            } else {
                setAdminUsers([]);
            }
        } catch (error) {
            console.error('Error fetching admin users:', error);
        }
    };

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const response = await axios.get(Constants.GET_SUPPLIERS_URL, {
                    params: { search: debouncedSupplierSearch, limit: 20, page: 1 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const supplierData = response.data.data?.suppliers ?? [];
                if (supplierData.length > 0) {
                    const formattedSuppliers = supplierData
                        .filter((supplier: any) => supplier.userId)
                        .map((supplier: any) => ({
                            id: supplier.userId,
                            name: supplier.company_name || supplier.email || supplier.phone_number || 'Supplier'
                        }));
                    setSuppliers(formattedSuppliers);
                } else {
                    setSuppliers([]);
                }
            } catch (error) {
                console.error('Error fetching suppliers:', error);
            }
        };

        fetchSuppliers();
    }, [debouncedSupplierSearch]);

    useEffect(() => {
        const fetchBrokers = async () => {
            try {
                const response = await axios.get(Constants.GET_BROKERS_URL, {
                    params: { search: debouncedBrokerSearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const list = response.data?.brokers || [];
                const formatted = list.map((b: any) => ({
                    id: b._id || b.id,
                    name: b.name,
                    phone: b.phone,
                    commissionType: b.commissionType || 'Percentage',
                    commissionValue: Number(b.commissionValue) || 0
                }));
                setBrokers(formatted);
            } catch (error) {
                console.error('Error fetching brokers:', error);
                setBrokers([]);
            }
        };

        if (token) {
            fetchBrokers();
        }
    }, [debouncedBrokerSearch, token]);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const response = await axios.get(Constants.FETCH_COUNTRIES_URL, {
                    params: { search: debouncedCountrySearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((country: any) => ({
                    id: String(country._id),
                    name: country.name,
                }));
                setCountryOptions(formatted);
            } catch {
                setCountryOptions([]);
            }
        };
        if (token) {
            fetchCountries();
        }
    }, [debouncedCountrySearch, token]);

    useEffect(() => {
        if (!selectedCountryId) {
            setStateOptions([]);
            return;
        }
        const fetchStates = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_STATES_URL}/${selectedCountryId}`, {
                    params: { search: debouncedStateSearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((state: any) => ({
                    id: String(state._id),
                    name: state.name,
                }));
                setStateOptions(formatted);
            } catch {
                setStateOptions([]);
            }
        };
        fetchStates();
    }, [debouncedStateSearch, selectedCountryId, token]);

    useEffect(() => {
        if (!selectedStateId) {
            setCityOptions([]);
            return;
        }
        const fetchCities = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_CITIES_URL}/${selectedStateId}`, {
                    params: { search: debouncedCitySearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((city: any) => ({
                    id: String(city._id),
                    name: city.name,
                }));
                setCityOptions(formatted);
            } catch {
                setCityOptions([]);
            }
        };
        fetchCities();
    }, [debouncedCitySearch, selectedStateId, token]);


    const handleInLineItemChange = (product: ProductItem, rowId: string) => {
        const updatedProduct = recalculateItem(product, purchaseFormData.taxType, effectiveGstMode, taxes);

        setPurchaseFormData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === rowId ? updatedProduct : item
            )
        }));
    };

    const handleNewRow = (): string => {
        const newId = crypto.randomUUID();
        setPurchaseFormData((prev) => ({
            ...prev,
            items: [...prev.items, { ...createEmptyItem(), id: newId }]
        }));
        return newId;
    }

    const handleAddVariants = (variants: any[], product: any, rowId: string) => {
        const newItems: ProductItem[] = [];
        const productTaxGroupId = product?.tax?.group_id || product?.tax?.id || null;

        variants.forEach((v) => {
            const rate = v.purchase_price || 0;
            const qty = 1;
            const amount = qty * rate;

            newItems.push({
                id: crypto.randomUUID(),
                product_id: product.id,
                name: v.designNo || product.name,
                hsn_code: product.hsn_code || '',
                unit: product.unit?.name || '',
                productBrandName: product.brand?.brand_name || '',
                qty,
                rate,
                discount: 0,
                tax: 0,
                tax_group_id: productTaxGroupId,
                amount,
                variantId: v._id,
                variantName: `${v.color} - ${v.size}`,
                variantDesignNo: v.designNo,
                variantColor: v.color,
                variantSize: v.size,
            });
        });

        const recalculatedItems = newItems.map((item) =>
            recalculateItem(item, purchaseFormData.taxType, effectiveGstMode, taxes)
        );

        setPurchaseFormData(prev => {
            // Find index of the current row (the empty one that triggered this)
            const rowIndex = prev.items.findIndex(item => item.id === rowId);

            if (rowIndex === -1) return prev;

            // Replace the current empty row with the first variant, and insert the rest after it
            const currentItems = [...prev.items];
            currentItems.splice(rowIndex, 1, ...recalculatedItems);

            return {
                ...prev,
                items: currentItems
            };
        });
    };

    const addVariantToPurchase = useCallback((variant: any, product: any, requestedQty = 1, requestedRate?: number, requestedDiscount?: number) => {
        const existingIndex = purchaseFormData.items.findIndex(
            item => item.variantId === variant._id
        );
        if (existingIndex > -1) {
            setPurchaseFormData(prev => {
                const nextItems = [...prev.items];
                const existingRow = nextItems[existingIndex];
                const updatedQty = (Number(existingRow.qty) || 0) + requestedQty;
                const updatedRow = recalculateItem(
                    { ...existingRow, qty: updatedQty },
                    prev.taxType,
                    effectiveGstMode,
                    taxes
                );
                nextItems[existingIndex] = updatedRow;
                const reorderedItems = nextItems.filter((_, idx) => idx !== existingIndex);
                return { ...prev, items: [updatedRow, ...reorderedItems] };
            });
            toast.success('Quantity updated for existing variant');
            return;
        }

        const fallbackProduct = typeof variant.productId === 'object' && variant.productId !== null
            ? {
                id: variant.productId.id || variant.productId._id || "",
                _id: variant.productId._id || variant.productId.id || "",
                item_type: variant.productId.item_type || "Product",
                name: variant.productId.name || "",
                code: variant.productId.code || "",
                hsn_code: variant.productId.hsn_code || "",
                barcode: variant.productId.barcode || variant.barcode || "",
                unit: variant.productId.unit
                    ? {
                        id: variant.productId.unit.id || variant.productId.unit._id || "",
                        name:
                            variant.productId.unit.short_name ||
                            variant.productId.unit.name ||
                            variant.productId.unit.unit_name ||
                            "",
                    }
                    : null,
                prices: {
                    selling: Number(variant.sale_price || 0),
                    purchase: Number(variant.purchase_price || 0),
                },
                discount: null,
                tax: variant.productId.tax
                    ? {
                        group_id: variant.productId.tax.group_id || variant.productId.tax._id || "",
                        group_name: variant.productId.tax.group_name || variant.productId.tax.tax_name || "",
                        total_rate:
                            Number(variant.productId.tax.total_rate) ||
                            Number(
                                Array.isArray(variant.productId.tax.tax_rate_ids)
                                    ? variant.productId.tax.tax_rate_ids.reduce(
                                        (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                                        0
                                    )
                                    : 0
                            ),
                    }
                    : null,
                brand: variant.productId.brand || { _id: "", brand_name: "" },
            }
            : null;

        const completeProduct = productList.find(p =>
            String((p as any).id || (p as any)._id) === String((product as any)._id || (product as any).id)
        ) || product || fallbackProduct;

        const rate = requestedRate !== undefined ? requestedRate : (variant.purchase_price || 0);
        const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
        const amount = Math.max(qty * rate, 0);
        const discountAmount = requestedDiscount !== undefined ? requestedDiscount : 0;

        const newItem = {
            id: crypto.randomUUID(),
            product_id: completeProduct.id || completeProduct._id,
            name:
                formatVariantDisplay({
                    brandName: getBrandName(completeProduct.brand),
                    designNo: variant.designNo,
                    size: variant.size,
                }) ||
                variant.designNo ||
                completeProduct.name,
            hsn_code: completeProduct.hsn_code || '',
            unit: completeProduct.unit?.name || '',
            productBrandName: completeProduct.brand?.brand_name || '',
            qty,
            rate,
            discount_value: discountAmount,
            discount_type: "Fixed",
            tax: 0,
            tax_group_id: typeof completeProduct.tax === 'object' && completeProduct.tax !== null ? (completeProduct.tax._id || completeProduct.tax.group_id || completeProduct.tax.id || null) : (completeProduct.tax || null),
            amount,
            variantId: variant._id,
            variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
            variantDesignNo: variant.designNo,
            variantColor: variant.color,
            variantSize: variant.size,
            variantBarcode: variant.barcode,
            variantMrp: variant.mrp
        };

        setPurchaseFormData(prev => ({
            ...prev,
            items: [recalculateItem(newItem, prev.taxType, effectiveGstMode, taxes), ...prev.items]
        }));

        const productLabel = completeProduct.name || completeProduct.code || completeProduct.id || "Product";
        toast.success(`Added ${productLabel}'s variant ${variant.color || ''} ${variant.size || ''} to purchase`);
    }, [productList, purchaseFormData.items, recalculateItem, effectiveGstMode, taxes]);

    useEffect(() => {
        const handleVariantAdd = (event: any) => {
            const { variant, product } = event.detail || {};
            if (variant && product) {
                addVariantToPurchase(variant, product);
            }
        };

        window.addEventListener('addVariantToInvoice', handleVariantAdd);
        return () => window.removeEventListener('addVariantToInvoice', handleVariantAdd);
    }, [addVariantToPurchase]);

    const applyVariantToPurchase = (variant: any, rowId?: string) => {
        const productId = typeof variant.productId === 'object' && variant.productId !== null
            ? (variant.productId.id || variant.productId._id)
            : variant.productId;

        const fallbackProduct = typeof variant.productId === 'object' && variant.productId !== null
            ? {
                id: variant.productId.id || variant.productId._id || "",
                _id: variant.productId._id || variant.productId.id || "",
                item_type: variant.productId.item_type || "Product",
                name: variant.productId.name || "",
                code: variant.productId.code || "",
                hsn_code: variant.productId.hsn_code || "",
                barcode: variant.productId.barcode || variant.barcode || "",
                unit: variant.productId.unit
                    ? {
                        id: variant.productId.unit.id || variant.productId.unit._id || "",
                        name:
                            variant.productId.unit.short_name ||
                            variant.productId.unit.name ||
                            variant.productId.unit.unit_name ||
                            "",
                    }
                    : null,
                prices: {
                    selling: Number(variant.sale_price || 0),
                    purchase: Number(variant.purchase_price || 0),
                },
                discount: null,
                tax: variant.productId.tax
                    ? {
                        group_id: variant.productId.tax.group_id || variant.productId.tax._id || "",
                        group_name: variant.productId.tax.group_name || variant.productId.tax.tax_name || "",
                        total_rate:
                            Number(variant.productId.tax.total_rate) ||
                            Number(
                                Array.isArray(variant.productId.tax.tax_rate_ids)
                                    ? variant.productId.tax.tax_rate_ids.reduce(
                                        (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                                        0
                                    )
                                    : 0
                            ),
                    }
                    : null,
                brand: variant.productId.brand || { _id: "", brand_name: "" },
            }
            : null;

        const product = productList.find(p =>
            String((p as any).id || (p as any)._id) === String(productId)
        ) || fallbackProduct;
        if (!product) {
            toast.error('Parent product not found!');
            return;
        }

        const normalizedProductId = String((product as any).id || (product as any)._id);
        const existingRow = purchaseFormData.items.find(
            item => String(item.product_id) === normalizedProductId && item.variantId === variant._id
        );

        if (existingRow) {
            const updatedQty = (existingRow.qty || 0) + 1;
            const rate = variant.purchase_price ?? existingRow.rate ?? 0;

            setPurchaseFormData(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === existingRow.id
                        ? recalculateItem(
                            { ...item, qty: updatedQty, rate },
                            prev.taxType,
                            effectiveGstMode,
                            taxes
                        )
                        : item
                )
            }));
            return;
        }

        const emptyRow = purchaseFormData.items.find(i => i.name.trim() === '');
        const targetRowId = rowId || (emptyRow ? emptyRow.id : handleNewRow());

        const rate = variant.purchase_price ?? 0;
        const qty = 1;
        const discount = 0;
        const amount = Math.max(qty * rate - discount, 0);

        const filledItem = {
            id: targetRowId,
            product_id: (product as any).id || (product as any)._id,
            name:
                formatVariantDisplay({
                    brandName: getBrandName((product as any).brand),
                    designNo: variant.designNo,
                    size: variant.size,
                }) ||
                variant.designNo ||
                product.name,
            hsn_code: product.hsn_code,
            unit: product.unit?.name || '',
            productBrandName: product.brand?.brand_name || '',
            qty,
            rate,
            discount,
            tax: 0,
            tax_group_id: typeof product.tax === 'object' && product.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id || null) : (product.tax || null),
            amount,
            variantId: variant._id,
            variantDesignNo: variant.designNo,
            variantColor: variant.color,
            variantSize: variant.size,
            variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
            variantBarcode: variant.barcode,
            variantMrp: variant.mrp
        };

        setPurchaseFormData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === targetRowId
                    ? recalculateItem(filledItem, prev.taxType, effectiveGstMode, taxes)
                    : item
            )
        }));
    };


    const handleBarcodeScanned = useCallback(async (code: string) => {
        if (!code.trim()) return;

        if (!Array.isArray(variantList)) {
            toast.error('Variant list not loaded. Please refresh the page.');
            return;
        }

        const normalizedCode = code.trim();
        let matches = variantList.filter(v => String(v.barcode || '').trim() === normalizedCode);
        if (matches.length === 0) {
            matches = await fetchVariantsByBarcode(normalizedCode);
        }
        if (matches.length === 0) {
            toast.error('Variant not found!');
            return;
        }
        if (matches.length > 1) {
            setDuplicateBarcodeMatches(matches);
            setPendingBarcodeRowId(null);
            setPendingBarcodeSource("scan");
            setShowDuplicateBarcodeModal(true);
            return;
        }

        applyVariantToPurchase(matches[0]);
    }, [variantList, fetchVariantsByBarcode, applyVariantToPurchase]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isEditable =
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);

            const key = typeof e.key === "string" ? e.key : "";
            const currentBuffer = typeof scanBufferRef.current === "string" ? scanBufferRef.current : "";

            if (key === "Enter") {
                if (currentBuffer.length >= 4) {
                    const code = currentBuffer;
                    scanBufferRef.current = '';
                    if (scanTimeoutRef.current) {
                        window.clearTimeout(scanTimeoutRef.current);
                        scanTimeoutRef.current = null;
                    }
                    if (isEditable) e.preventDefault();
                    handleBarcodeScanned(code);
                }
                return;
            }

            if (key.length === 1) {
                const now = Date.now();
                if (now - lastScanTimeRef.current > 100) {
                    scanBufferRef.current = '';
                }
                scanBufferRef.current = `${typeof scanBufferRef.current === "string" ? scanBufferRef.current : ""}${key}`;
                lastScanTimeRef.current = now;

                if (scanTimeoutRef.current) {
                    window.clearTimeout(scanTimeoutRef.current);
                }
                scanTimeoutRef.current = window.setTimeout(() => {
                    scanBufferRef.current = '';
                }, 200);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimeoutRef.current) {
                window.clearTimeout(scanTimeoutRef.current);
            }
        };
    }, [handleBarcodeScanned]);

    const handleDuplicateBarcodeSelect = (variant: any) => {
        setShowDuplicateBarcodeModal(false);
        setDuplicateBarcodeMatches([]);

        if (pendingBarcodeSource === "row" && pendingBarcodeRowId) {
            applyVariantToPurchase(variant, pendingBarcodeRowId);
        } else {
            applyVariantToPurchase(variant);
        }

        setPendingBarcodeRowId(null);
        setPendingBarcodeSource("scan");
    };


    const validatePurchaseData = () => {
        const newErrors: { [key: string]: string } = {};
        //order date required
        if (!purchaseFormData.purchaseDate) newErrors.purchaseDate = 'Order date is required.';
        if (!purchaseFormData.purchaseBillDate) newErrors.purchaseBillDate = 'Purchase bill date is required.';
        // status will be derived from payment flow if not selected
        //billFrom required
        if (!purchaseFormData.billFrom.trim()) newErrors.billFrom = 'Bill from is required.';
        //billTo required
        if (!purchaseFormData.billTo.trim()) newErrors.billTo = 'Bill to is required.';
        //atleast 1 item required
        const hasItemPopulated = purchaseFormData.items.some(item => item.name.trim() !== '');
        if (!hasItemPopulated) newErrors.items = 'At least one item is required.';
        purchaseFormData.items.forEach((item, index) => {
            if (!item.name.trim()) return;
            const qty = Number(item.qty) || 0;
            const rate = Number(item.rate) || 0;
            const discount = Number(item.discount) || 0;
            const maxDiscount = qty * rate;
            if (discount < 0) newErrors[`items.${index}.discount`] = 'Discount cannot be negative.';
            if (discount > maxDiscount) newErrors[`items.${index}.discount`] = 'Discount cannot exceed item total.';
        });

        setFormErrors(newErrors);
        return newErrors;
    }

    const handleStartPurchase = (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validatePurchaseData();

        if (Object.keys(errors).length > 0) {
            const firstErrorField = Object.keys(errors)[0];
            const firstErrorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLInputElement | null;
            firstErrorElement?.focus();
            return;
        }

        const itemsToSubmit = purchaseFormData.items.filter(item => item.name.trim() !== '');
        const preparedData: PurchaseFormData = {
            ...purchaseFormData,
            status: purchaseFormData.status.trim() || 'pending',
            items: itemsToSubmit,
            dueDate: purchaseFormData.dueDate || purchaseFormData.purchaseBillDate,
            brokerCommissionAmount,
            overall_discount: appliedOverallDiscount,
            gstType: purchaseFormData.taxType === "GST" ? effectiveGstMode : null
        };

        if (isEditMode) {
            if (
                preparedData.status === 'paid' &&
                (!preparedData.sp_paymentDate ||
                    !preparedData.sp_paymentMode ||
                    !preparedData.sp_paid_amount)
            ) {
                setIsPaymentModalOpen(true);
                return;
            }
            savePurchase(preparedData);
            return;
        }

        setPendingPurchaseData(preparedData);
        setIsPaymentModalOpen(true);
    };

    const savePurchase = async (data: PurchaseFormData) => {
        const itemsToSubmit = data.items.filter(item => item.name.trim() !== '');
        const sanitizedData = { ...data, items: itemsToSubmit };

        const formData = new FormData();
        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value?.toDate === 'function') return value.toDate();
            return null;
        };

        for (const [key, value] of Object.entries(sanitizedData)) {
            const dateValue = toDateValue(value);
            if (dateValue) {
                const year = dateValue.getFullYear();
                const month = String(dateValue.getMonth() + 1).padStart(2, "0");
                const day = String(dateValue.getDate()).padStart(2, "0");

                formData.append(key, `${year}-${month}-${day}`);
            } else if (Array.isArray(value) && key === 'items') {
                normalizePurchaseItemsForSubmission(value as ProductItem[]).forEach((item, index) => {
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        if (itemValue !== undefined && itemValue !== null) {
                            if (itemKey === 'tax_group_id' && itemValue === '') {
                                return;
                            }
                            formData.append(`items[${index}][${itemKey}]`, String(itemValue));
                        }
                    });
                });
            } else if (typeof value !== 'object' && value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        }

        //remove null value parameters
        for (const [key, value] of formData.entries()) {
            if (
                value === null ||                     // true null
                value === undefined ||                // undefined (rare in FormData, but safe check)
                value === 'null' ||                   // string "null"
                value === ''                          // empty string
            ) {
                formData.delete(key);
            }
        }


        try {
            setIsSubmitting(true);
            let savedPurchaseId = sanitizedData.purchaseId || purchaseFormData.purchaseId || '';
            if (isEditMode) {
                const response = await axios.put(`${Constants.UPDATE_PURCHASE_URL}/${purchaseFormData._id || editId}`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
                savedPurchaseId =
                    response?.data?.data?.purchaseId ||
                    response?.data?.purchase?.purchaseId ||
                    savedPurchaseId;
            } else {
                const response = await axios.post(Constants.CREATE_NEW_PURCHASE_URL, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
                savedPurchaseId =
                    response?.data?.data?.purchaseId ||
                    response?.data?.purchase?.purchaseId ||
                    savedPurchaseId;
            }

            if (pendingPurchaseExpenses.length > 0 && savedPurchaseId) {
                try {
                    const expenseCategoryId = await ensurePurchaseExpenseCategoryId(savedPurchaseId);
                    await Promise.all(pendingPurchaseExpenses.map(async (expense) => {
                        const payload = {
                            expenseCategory: expenseCategoryId,
                            amount: Number(expense.amount),
                            expenseDate: expense.expenseDate?.toISOString(),
                            description: expense.description,
                            paymentMode: expense.paymentMode,
                            paymentDate: expense.paymentDate?.toISOString() || null,
                            paymentDueDate: expense.paymentDueDate?.toISOString() || null,
                            customFields: [
                                { key: 'Purchase ID', value: savedPurchaseId },
                                ...(expense.customFields || []),
                            ],
                            sourceType: "PURCHASE",
                            sourceId: savedPurchaseId,
                        };
                        return axios.post(Constants.CREATE_MONTHLY_EXPENSE_URL, payload, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                    }));
                    toast.success("Purchase expenses created successfully");
                    setPendingPurchaseExpenses([]);
                    resetPurchaseExpenseForm();
                } catch (expenseError: any) {
                    toast.error(expenseError?.response?.data?.message || "Failed to create some purchase expenses");
                }
            }

            toast.success(isEditMode ? 'Purchase updated successfully.' : 'Purchase saved successfully.');
            navigate('/admin/purchases');
        } catch (error: any) {
            if (error.response?.status !== 200 && error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            } else {
                toast.error(
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    'An unexpected error occurred.'
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    };


    const handlePaymentConfirm = (paymentModalData: Partial<PurchaseFormData>) => {
        const baseData = pendingPurchaseData ?? purchaseFormData;
        const mergedData: PurchaseFormData = {
            ...baseData,
            ...paymentModalData,
            sp_amount: paymentModalData.sp_amount ?? finalAmount,
            sp_due_amount: paymentModalData.sp_due_amount ?? (finalAmount - (paymentModalData.sp_paid_amount || 0)),
            brokerCommissionAmount
        } as PurchaseFormData;

        savePurchase(mergedData);
        setIsPaymentModalOpen(false);
        setPendingPurchaseData(null);
    }
    return (
        <div className="md:p-4 bg-white-50 min-h-screen border border-gray-200 rounded pb-4 md:pb-24 relative">
            <form onSubmit={handleStartPurchase}>
                <div className="max-w-7xl mx-auto space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-950">{isEditMode ? 'Edit Purchase' : 'New Purchase'}</h1>
                            <div className="w-full md:w-48">
                                <TaxTypeSelector />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAiPurchaseScanModal(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-primary hover:bg-purple-100 cursor-pointer"
                            >
                                <FileSearch className="h-4 w-4" />
                                Scan Purchase Bill
                            </button>
                        </div>
                        <img src={systemSettings?.company.siteLogo || undefined} alt="" className="w-32" />
                    </div>
                    <PurchaseHeader
                        purchaseDate={purchaseFormData.purchaseDate}
                        purchaseBillDate={purchaseFormData.purchaseBillDate}
                        dueDate={purchaseFormData.dueDate}
                        dueDays={purchaseFormData.dueDays}
                        supplierBillNumber={purchaseFormData.supplier_bill_number || ''}
                        brokers={brokers}
                        brokerInputValue={brokerSearchInput}
                        selectedBroker={selectedBroker}
                        brokerCommissionAmount={brokerCommissionAmount}
                        suppliers={suppliers}
                        supplierSearchInput={supplierSearchInput}
                        selectedSupplier={selectedSupplier}
                        supplierDetails={supplierDetails}
                        formErrors={formErrors}
                        onPurchaseDateChange={(newDate) => handleFormChange('purchaseDate', newDate)}
                        onPurchaseBillDateChange={(newDate) => handleFormChange('purchaseBillDate', newDate)}
                        onDueDateChange={(newDate) => handleFormChange('dueDate', newDate)}
                        onDueDaysChange={handleDueDaysChange}
                        onSupplierBillNumberChange={(value) => handleFormChange('supplier_bill_number', value)}
                        onBrokerInputChange={setBrokerSearchInput}
                        onBrokerSelect={handleBrokerChange}
                        onAddBroker={handleOpenBrokerModal}
                        onSupplierSearchChange={setSupplierSearchInput}
                        onSupplierSelect={handleSupplierChange}
                        onAddSupplier={() => setIsSupplierModalOpen(true)}
                    />

                    <PurchaseItemsTable
                        items={purchaseFormData.items}
                        currencySymbol={currencySymbol}
                        formErrors={formErrors}
                        taxType={purchaseFormData.taxType}
                        gstMode={effectiveGstMode}
                        onInlineItemChange={handleInLineItemChange}
                        onEditItem={handleEditItem}
                        onRemoveItem={handleRemoveItem}
                        onAddVariants={handleAddVariants}
                        onAddNewProduct={handleNewRow}
                        productList={productList}
                        variantList={variantList}
                        onQuickAddVariant={addVariantToPurchase}
                        onCreateProduct={handleCreateProductModalOpen}
                        onOpenProductEditor={handleOpenCreatedProductEditor}
                    />
                </div>

                <ProductDetailsModal
                    isOpen={isEditProductModalOpen}
                    onClose={() => {
                        setIsEditProductModalOpen(false);
                        setEditingItem(null);
                    }}
                    title={isEditProductModalOpen ? "Edit Item" : "Add Item"}
                    item={editingItem}
                    onSave={(qty, rate, discount) => {
                        if (editingItem) {
                            const updated = {
                                ...editingItem,
                                qty,
                                rate,
                                discount_value: discount
                            };
                            const recalculated = recalculateItem(updated, purchaseFormData.taxType, effectiveGstMode, taxes);
                            const updatedItems = purchaseFormData.items.map(item =>
                                item.id === recalculated.id ? recalculated : item
                            );
                            handleFormChange('items', updatedItems);
                            setIsEditProductModalOpen(false);
                            setEditingItem(null);
                        }
                    }}
                    currencySymbol={systemSettings?.currency.symbol}
                />

                {showBrokerModal && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
                        onClick={handleCloseBrokerModal}
                    >
                        <div
                            className="bg-white rounded-lg shadow-xl w-[95vw] max-w-3xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800">Add Broker</h2>
                                <button
                                    type="button"
                                    onClick={handleCloseBrokerModal}
                                    className="px-3 py-1 rounded text-sm bg-gray-200"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="p-4 space-y-4 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Broker Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={brokerForm.name}
                                            onChange={(e) => setBrokerForm(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                            placeholder="Enter broker name"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Broker Phone <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={brokerForm.phone}
                                            onChange={(e) => setBrokerForm(prev => ({ ...prev, phone: e.target.value }))}
                                            required
                                            placeholder="Enter phone number"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type</label>
                                        <SmartDropdown
                                            items={[
                                                { id: 'Percentage', name: 'Percentage' },
                                                { id: 'Fixed', name: 'Fixed' },
                                            ]}
                                            value={brokerForm.commissionType}
                                            onChange={() => { }}
                                            onSelect={(item) => {
                                                const selected = item as { id: string; name: string } | null;
                                                const type = (selected?.id as 'Percentage' | 'Fixed') || 'Percentage';
                                                setBrokerForm(prev => ({ ...prev, commissionType: type }));
                                            }}
                                            placeholder="Select commission type"
                                            selectedItem={{ id: brokerForm.commissionType, name: brokerForm.commissionType }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Commission Value</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={brokerForm.commissionValue}
                                            onChange={(e) => setBrokerForm(prev => ({ ...prev, commissionValue: e.target.value }))}
                                            placeholder="Enter commission"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                        <SmartDropdown
                                            items={countryOptions}
                                            value={countrySearchKeyword}
                                            onChange={setCountrySearchKeyword}
                                            onSelect={(item) => {
                                                const selected = item as { id: string; name: string } | null;
                                                const countryId = selected?.id || '';
                                                setSelectedCountryId(countryId);
                                                setSelectedStateId('');
                                                setStateOptions([]);
                                                setCityOptions([]);
                                                setStateSearchKeyword('');
                                                setCitySearchKeyword('');
                                                setBrokerForm(prev => ({
                                                    ...prev,
                                                    country: selected?.name || '',
                                                    state: '',
                                                    city: ''
                                                }));
                                            }}
                                            placeholder="Type to search country"
                                            selectedItem={countryOptions.find(c => c.name === brokerForm.country) || null}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <SmartDropdown
                                            items={stateOptions}
                                            value={stateSearchKeyword}
                                            onChange={setStateSearchKeyword}
                                            onSelect={(item) => {
                                                const selected = item as { id: string; name: string } | null;
                                                const stateId = selected?.id || '';
                                                setSelectedStateId(stateId);
                                                setCityOptions([]);
                                                setCitySearchKeyword('');
                                                setBrokerForm(prev => ({
                                                    ...prev,
                                                    state: selected?.name || '',
                                                    city: ''
                                                }));
                                            }}
                                            placeholder="Type to search state"
                                            selectedItem={stateOptions.find(s => s.name === brokerForm.state) || null}
                                            disabled={!selectedCountryId}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <SmartDropdown
                                            items={cityOptions}
                                            value={citySearchKeyword}
                                            onChange={setCitySearchKeyword}
                                            onSelect={(item) => {
                                                const selected = item as { id: string; name: string } | null;
                                                setBrokerForm(prev => ({ ...prev, city: selected?.name || '' }));
                                            }}
                                            placeholder="Type to search city"
                                            selectedItem={cityOptions.find(c => c.name === brokerForm.city) || null}
                                            disabled={!selectedStateId}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <textarea
                                        value={brokerForm.address}
                                        onChange={(e) => setBrokerForm(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="Enter address"
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCloseBrokerModal}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSavingBroker}
                                        onClick={() => handleCreateBroker()}
                                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        {isSavingBroker ? 'Saving...' : 'Add Broker'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <CreateProductWithVariantsModal
                    isOpen={showCreateProductModal}
                    token={token}
                    mode={productModalMode}
                    productId={editingModalProductId}
                    onClose={closeProductModal}
                    onSaved={handleProductModalSaved}
                />

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 items-start">
                    <div className="bg-white p-2 rounded-lg border border-gray-200">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-gray-950">Extra Information</h3>
                                <button
                                    type="button"
                                    onClick={() => handleOpenPurchaseExpenseModal()}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-md hover:bg-gray-950"
                                >
                                    <Plus size={14} />
                                    Add Expense
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                                <button type='button' onClick={() => setActiveInfoTab('notes')} className={`px-3 py-1.5 text-xs cursor-pointer font-medium rounded-md ${activeInfoTab === 'notes' ? 'bg-primary text-white' : 'bg-gray-200  text-gray-700 '}`}>Add Notes</button>
                                <button type='button' onClick={() => setActiveInfoTab('termsAndCondition')} className={`px-3 py-1.5 text-xs cursor-pointer font-medium rounded-md ${activeInfoTab === 'termsAndCondition' ? 'bg-primary text-white' : 'bg-gray-200  text-gray-700 '}`}>Add Terms & Conditions</button>
                                {pendingPurchaseExpenses.length > 0 && (
                                    <button
                                        type='button'
                                        onClick={() => setActiveInfoTab(activeInfoTab === 'expense' ? 'notes' : 'expense')}
                                        className={`px-3 py-1.5 text-xs cursor-pointer font-medium rounded-md ${activeInfoTab === 'expense' ? 'bg-primary text-white' : 'bg-purple-100 text-purple-700'}`}
                                    >
                                        View Expense{pendingPurchaseExpenses.length > 1 ? 's' : ''}
                                    </button>
                                )}
                            </div>

                            {activeInfoTab === 'expense' && pendingPurchaseExpenses.length > 0 && (
                                <div className="space-y-3 p-3 bg-purple-50 rounded-md border border-purple-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-semibold text-purple-800">Expense Details</h4>
                                        <button type="button" onClick={() => handleOpenPurchaseExpenseModal()} className="text-xs text-primary font-medium hover:underline">+ Add Another Expense</button>
                                    </div>
                                    <div className="overflow-x-auto border border-purple-200/60 rounded-md bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-purple-100/50 text-purple-900 text-xs font-semibold">
                                                <tr>
                                                    <th className="p-2 border-b border-purple-200/60">Amount</th>
                                                    <th className="p-2 border-b border-purple-200/60">Payment Mode</th>
                                                    <th className="p-2 border-b border-purple-200/60">Date</th>
                                                    <th className="p-2 border-b border-purple-200/60">Description</th>
                                                    <th className="p-2 border-b border-purple-200/60 text-right w-20">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-purple-200/60">
                                                {pendingPurchaseExpenses.map((expense, index) => (
                                                    <tr key={index} className="hover:bg-purple-50/50 transition-colors">
                                                        <td className="p-2 text-sm text-gray-900 font-medium">{expense.amount}</td>
                                                        <td className="p-2 text-sm text-gray-600">{expense.paymentMode || '-'}</td>
                                                        <td className="p-2 text-sm text-gray-600">{expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '-'}</td>
                                                        <td className="p-2 text-sm text-gray-600 max-w-[200px] truncate" title={expense.description}>{expense.description || '-'}</td>
                                                        <td className="p-2 text-right">
                                                            <div className="flex justify-end space-x-2">
                                                                <button type="button" onClick={() => handleOpenPurchaseExpenseModal(index)} className="text-gray-500 hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                                <button type="button" onClick={() => handleDeletePurchaseExpense(index)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeInfoTab === 'notes' && (
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
                                    <textarea value={purchaseFormData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} rows={3} placeholder="Enter Notes" className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                                </div>
                            )}

                            {showDuplicateBarcodeModal && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
                                    <div className="bg-white p-5 rounded shadow-md space-y-4 w-[90vw] max-w-md">
                                        <h2 className="text-lg font-semibold text-gray-800">
                                            Multiple Variants Found
                                        </h2>
                                        <p className="text-sm text-gray-600">
                                            Select the variant you want to add.
                                        </p>
                                        <div className="max-h-60 overflow-auto border border-gray-200 rounded">
                                            {duplicateBarcodeMatches.map((variant: any) => {
                                                const productId = typeof variant.productId === 'object' && variant.productId !== null
                                                    ? (variant.productId.id || variant.productId._id)
                                                    : variant.productId;
                                                const product = productList.find(p =>
                                                    String((p as any).id || (p as any)._id) === String(productId)
                                                );
                                                const label = formatVariantDisplay({
                                                    brandName: getBrandName(product?.brand),
                                                    designNo: variant.designNo,
                                                    size: variant.size,
                                                });
                                                return (
                                                    <button
                                                        key={variant._id}
                                                        type="button"
                                                        onClick={() => handleDuplicateBarcodeSelect(variant)}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100"
                                                    >
                                                        <div className="font-medium text-gray-800">{label || "Variant"}</div>
                                                        <div className="text-xs text-gray-500">Barcode: {variant.barcode}</div>
                                                    </button>
                                                );
                                            })}
                                            {duplicateBarcodeMatches.length === 0 && (
                                                <div className="p-3 text-sm text-gray-500 text-center">No variants found</div>
                                            )}
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setShowDuplicateBarcodeModal(false);
                                                    setDuplicateBarcodeMatches([]);
                                                    setPendingBarcodeRowId(null);
                                                    setPendingBarcodeSource("scan");
                                                }}
                                                className="px-3 py-1 bg-gray-300 text-black rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeInfoTab === 'termsAndCondition' && (
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Terms & Conditions</label>
                                    <textarea value={purchaseFormData.termsAndCondition} onChange={(e) => handleFormChange('termsAndCondition', e.target.value)} rows={3} placeholder="Enter Terms & Conditions" className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-gray-200">
                        <PurchaseSummary
                            subTotal={subTotal}
                            totalTax={totalTax}
                            itemDiscount={totalDiscount}
                            overallDiscountValue={overallDiscountValue}
                            overallDiscountType={overallDiscountType}
                            finalAmount={finalAmountRounded}
                            currencySymbol={currencySymbol}
                            totalInWords={totalInWords}
                            isInclusive={isInclusive}
                            onOverallDiscountChange={(value) => handleFormChange('overall_discount', value)}
                            onOverallDiscountTypeChange={(value) => setOverallDiscountType(value)}
                        />
                    </div>
                </div>

                {/* Action Buttons - Sticky at bottom on larger screens */}
                <div className="relative md:fixed bottom-0 left-0 md:left-60 right-0 bg-white border-t border-gray-200 shadow-lg md:z-40 mt-4 md:mt-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handlePrintSelectedBarcodes}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                            >
                                Print Barcodes
                            </button>
                            <button type='button' onClick={() => navigate('/admin/purchases')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">Cancel</button>
                            <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? 'edit' : 'create'} />
                        </div>
                    </div>
                </div>

            </form>

            <Modal
                isOpen={isPurchaseExpenseModalOpen}
                onClose={() => {
                    setIsPurchaseExpenseModalOpen(false);
                    resetPurchaseExpenseForm();
                }}
                title="Add New Expense"
            >
                <form onSubmit={handleCreatePurchaseExpense} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category (Purchase ID)
                            </label>
                            <input
                                type="text"
                                value={purchaseFormData.purchaseId || ''}
                                disabled
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Total Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={purchaseExpenseForm.amount}
                                onChange={e => handlePurchaseExpenseFieldChange('amount', e.target.value)}
                                required
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date</label>
                            <DateInput
                                label=""
                                value={purchaseExpenseForm.expenseDate}
                                onChange={date => handlePurchaseExpenseFieldChange('expenseDate', date)}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={purchaseExpenseForm.description}
                                onChange={e => handlePurchaseExpenseFieldChange('description', e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <SearchableDropdown
                                label="Payment Mode"
                                value={purchaseExpenseForm.paymentMode ? { id: purchaseExpenseForm.paymentMode, name: purchaseExpenseForm.paymentMode } : null}
                                options={['Cash', 'Online', 'Cheque', 'RTGS/NEFT'].map(mode => ({ id: mode, name: mode }))}
                                onChange={(_, value) => handlePurchaseExpenseFieldChange('paymentMode', value?.id || '')}
                                placeholder="Select Payment Mode"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                            <DateInput
                                label=""
                                value={purchaseExpenseForm.paymentDate}
                                onChange={date => handlePurchaseExpenseFieldChange('paymentDate', date)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label>
                            <DateInput
                                label=""
                                value={purchaseExpenseForm.paymentDueDate}
                                onChange={date => handlePurchaseExpenseFieldChange('paymentDueDate', date)}
                            />
                        </div>

                        {/* Custom Fields */}
                        <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Custom Fields (Optional)
                                </label>
                                <button
                                    type="button"
                                    onClick={addPurchaseExpenseCustomField}
                                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                                >
                                    <Plus size={16} />
                                    Add Field
                                </button>
                            </div>

                            {purchaseExpenseForm.customFields.length > 0 ? (
                                <div className="space-y-2">
                                    {purchaseExpenseForm.customFields.map((field, index) => (
                                        <div key={index} className="grid grid-cols-5 gap-2 items-start">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={field.key}
                                                    onChange={e => updatePurchaseExpenseCustomField(index, 'key', e.target.value)}
                                                    placeholder="Field Name"
                                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={field.value}
                                                    onChange={e => updatePurchaseExpenseCustomField(index, 'value', e.target.value)}
                                                    placeholder="Value"
                                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                                                />
                                            </div>
                                            <div className="flex justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removePurchaseExpenseCustomField(index)}
                                                    className="text-red-600 hover:text-red-800 p-1"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">
                                    No custom fields added. Click "Add Field" to add expense-specific details.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => {
                                setIsPurchaseExpenseModalOpen(false);
                                resetPurchaseExpenseForm();
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingPurchaseExpense}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-gray-900 disabled:opacity-60"
                        >
                            {isSavingPurchaseExpense ? "Saving..." : "Create Expense"}
                        </button>
                    </div>
                </form>
            </Modal>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirm={handlePaymentConfirm}
                totalAmount={finalAmount}
                paymentModes={paymentModes}
                allowNoPayment
                defaultPaymentType={defaultPaymentType}
            />

            <CreateSupplierForm
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSuccess={(newSupplier: any) => {
                    const formattedNewSupplier = {
                        id: newSupplier.user_id || newSupplier.userId,
                        name: newSupplier.company_name || 'Supplier'
                    };
                    setSuppliers([formattedNewSupplier, ...suppliers]);
                    handleSupplierChange(formattedNewSupplier);
                    setIsSupplierModalOpen(false);
                }}
            />


            <CreateBankAccountModal
                isOpen={isCreateBankAccountModalOpen}
                onClose={() => setIsCreateBankAccountModalOpen(false)}
                onSuccess={(newBankAccount: BankAccountCreatedResponse) => {
                    const formattedBankAccount: OptionType = {
                        id: newBankAccount.id,
                        name: newBankAccount.bankName
                    };
                    setBankAccounts(prevBankAccounts => [formattedBankAccount, ...prevBankAccounts]);
                    setIsCreateBankAccountModalOpen(false);
                }}
            />
            <AiDocumentScanModal
                isOpen={showAiPurchaseScanModal}
                onClose={() => setShowAiPurchaseScanModal(false)}
                type="purchase"
                onApply={applyAiPurchaseExtraction}
            />
            {showPrintAllBarcodes && (
                <PrintBarcode
                    barcodes={printAllBarcodes}
                    onClose={() => {
                        setShowPrintAllBarcodes(false);
                        setPrintAllBarcodes([]);
                    }}
                />
            )}
            {isFetching && <FullPageLoader />}
        </div>
    );
};

export default CreatePurchase;
