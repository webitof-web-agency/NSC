import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Constants from '../../../constants/api';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import SubmitButton from '@components/admin/SubmitButton';
import { useDebounce } from '@hooks/useDebounce';
import SmartDropdown from '@components/admin/SmartDropdown';
import CreateCategoryModal from './CreateCategoryModal';
import CreateBrandModal from './CreateBrandModal';
import CreateUnitModal from './CreateUnitModal';
import CreateTaxGroupModal from './CreateTaxGroupModal';
import ProductVariantInline from './ProductVariantInline';
import { PencilLine } from 'lucide-react';

interface OptionType {
    id: string;
    name: string;
    hsnCode?: string;
    defaultUnitId?: string | null;
    defaultTaxId?: string | null;
    defaultUnitName?: string | null;
    defaultTaxName?: string | null;
}
// For the main product data object (used in props)
interface IProduct {
    _id: string;
    item_type: 'Product'
    name: string;
    code: string;
    hsn_code: string;
    category?: { _id: string; category_name?: string };
    brand?: { _id: string; brand_name?: string };
    unit?: { _id: string };
    tax?: { _id: string };
}

// For the component's props
interface ProductFormProps {
    productData?: IProduct;
}

// For the form's state
interface IFormData {
    item_type: 'Product';
    name: string;
    code: string;
    hsn_code: string;
    category: string;
    brand: string;
    unit: string;
    tax: string;
}

// For form validation errors
type FormErrors = Partial<Record<keyof IFormData | 'product_image', string>>;


// --- Component ---

export default function ProductForm({ productData }: ProductFormProps) {
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const isEditMode = Boolean(productData);

    const [formData, setFormData] = useState<IFormData>({
        item_type: 'Product',
        name: '',
        code: '',
        hsn_code: '',
        category: '',
        brand: '',
        unit: '',
        // selling_price: '',
        // purchase_price: '',
        // discount_type: 'Fixed',
        // discount_value: 0,
        tax: '',
        // barcode: '',
        // alert_quantity: 0,
        // description: '',
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Dynamic data states
    const [categories, setCategories] = useState<OptionType[]>([]);
    const [brands, setBrands] = useState<OptionType[]>([]);
    const [units, setUnits] = useState<OptionType[]>([]);
    const [taxes, setTaxes] = useState<OptionType[]>([]);
    const [categorySearchInput, setCategorySearchInput] = useState<string>('');
    const debouncedCategorySearch = useDebounce(categorySearchInput, 500);
    const [brandSearchInput, setBrandSearchInput] = useState<string>('');
    const debouncedBrandSearch = useDebounce(brandSearchInput, 500);
    const [unitSearchInput, setUnitSearchInput] = useState<string>('');
    const debouncedUnitSearch = useDebounce(unitSearchInput, 500);
    const [taxSearchInput, setTaxSearchInput] = useState<string>('');
    const debouncedTaxSearch = useDebounce(taxSearchInput, 500);
    // Modals
    const [isCategoryCreateModalOpen, setIsCategoryCreateModalOpen] = useState(false);
    const [isCreateBrandModalOpen, setIsCreateBrandModalOpen] = useState(false);
    const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false);
    const [isCreateTaxModalOpen, setIsCreateTaxModalOpen] = useState(false);
    const [localVariants, setLocalVariants] = useState<any[]>([]);
    const brandFieldRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchCategoriesByQuery = async () => {
            const headers = { 'Authorization': `Bearer ${token}` };
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_CATEGORIES_URL}?search=${debouncedCategorySearch}`, { headers });
                const formattedCategories = response.data.data.map((category: any) => ({
                    id: category.id,
                    name: category.categoryName,
                    defaultUnitId: category.defaultUnitId || null,
                    defaultUnitName: category.defaultUnitName || null,
                    defaultTaxId: category.defaultTaxId || null,
                    defaultTaxName: category.defaultTaxName || null
                }));
                setCategories(formattedCategories);
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                toast.error("Failed to load required data for the form.");
            }
        }
        fetchCategoriesByQuery();
    }, [debouncedCategorySearch]);

    useEffect(() => {
        const fetchBrandsByQuery = async () => {
            const headers = { 'Authorization': `Bearer ${token}` };
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_BRANDS_URL}?search=${debouncedBrandSearch}`, { headers });
                const formattedBrands = response.data.data.map((brand: any) => ({
                    id: brand.id,
                    name: brand.brandName,
                    hsnCode: brand.hsnCode
                }));
                setBrands(formattedBrands);
            } catch (error) {
                console.error("Failed to fetch brands:", error);
                toast.error("Failed to load required data for the form.");
            }
        }
        fetchBrandsByQuery();
    }, [debouncedBrandSearch]);

    useEffect(() => {
        const fetchUnitsByQuery = async () => {
            const headers = { 'Authorization': `Bearer ${token}` };
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_UNITS_URL}?search=${debouncedUnitSearch}`, { headers });
                const formattedUnits = response.data.data.map((unit: any) => ({
                    id: unit.id,
                    name: unit.unitName
                }));
                setUnits(formattedUnits);
            } catch (error) {
                console.error("Failed to fetch units:", error);
                toast.error("Failed to load required data for the form.");
            }
        }
        fetchUnitsByQuery();
    }, [debouncedUnitSearch]);

    useEffect(() => {
        const fetchTaxesByQuery = async () => {
            const headers = { 'Authorization': `Bearer ${token}` };
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_TAXES_URL}?search=${debouncedTaxSearch}`, { headers });
                const formattedTaxes = response.data.data.map((tax: any) => ({
                    id: tax.id,
                    name: tax.taxGroupName
                }));
                setTaxes(formattedTaxes);
            } catch (error) {
                console.error("Failed to fetch taxes:", error);
                toast.error("Failed to load required data for the form.");
            }
        }
        fetchTaxesByQuery();
    }, [debouncedTaxSearch]);

    // Populate form if in edit mode
    useEffect(() => {
        if (isEditMode && productData) {
            setFormData({
                // item_type: productData.item_type || 'Product',
                item_type: "Product",
                name: productData.name || '',
                code: productData.code || '',
                hsn_code: productData.hsn_code || '',
                category: productData.category?._id || '',
                brand: productData.brand?._id || '',
                unit: productData.unit?._id || '',
                // selling_price: productData.selling_price || '',
                // purchase_price: productData.purchase_price || '',
                // discount_type: productData.discount_type || 'Fixed',
                // discount_value: productData.discount_value || 0,
                tax: productData.tax?._id || '',
                // barcode: productData.barcode || '',
                // alert_quantity: productData.alert_quantity || 0,
                // description: productData.description || '',
                // images_to_remove: [],
            });

            if (productData.category?._id) {
                setCategories(prev => {
                    const exists = prev.some(category => category.id === productData.category?._id);
                    if (exists) return prev;
                    return [
                        {
                            id: productData.category._id,
                            name: productData.category.category_name || 'Selected Category',
                        },
                        ...prev,
                    ];
                });
                if (productData.category.category_name) {
                    setCategorySearchInput(productData.category.category_name);
                }
            }

            if (productData.brand?._id) {
                setBrands(prev => {
                    const exists = prev.some(brand => brand.id === productData.brand?._id);
                    if (exists) return prev;
                    return [
                        {
                            id: productData.brand._id,
                            name: productData.brand.brand_name || 'Selected Brand',
                        },
                        ...prev,
                    ];
                });
                if (productData.brand.brand_name) {
                    setBrandSearchInput(productData.brand.brand_name);
                }
            }
        }
    }, [isEditMode, productData]);

    // Auto-fill HSN code when brand is selected (create mode only)
    useEffect(() => {
        if (formData.brand && !isEditMode) {
            const selectedBrand = brands.find(b => b.id === formData.brand);
            if (selectedBrand && selectedBrand.hsnCode) {
                setFormData(prev => ({ ...prev, hsn_code: selectedBrand.hsnCode || '' }));
            }
        }
    }, [formData.brand, brands, isEditMode]);

    // Auto-generate product code when component mounts (create mode only)
    useEffect(() => {
        if (!isEditMode && !formData.code) {
            generateProductCode();
        }
    }, [isEditMode]);


    // INPUT HANDLERS

    const focusBrandField = () => {
        setTimeout(() => {
            const brandInput = brandFieldRef.current?.querySelector('input') as HTMLInputElement | null;
            brandInput?.focus();
        }, 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };


    const generateProductCode = () => {
        let code = generateRandomCode();
        setFormData(prev => ({ ...prev, code: code }));
    }
    const generateRandomCode = (): string => {
        return `PROD-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    };


    const prefillAutoGeneratedFields = () => {
        let updated = { ...formData };

        if (!updated.code) {
            updated.code = generateRandomCode();
        }

        setFormData(updated);
        return updated;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormErrors({});

        const filledData = prefillAutoGeneratedFields();

        const submissionData = new FormData();
        Object.keys(filledData).forEach(key => {
            const formKey = key as keyof IFormData;
            const value = filledData[formKey];
            if (formKey === "name" && (!value || String(value).trim() === "")) {
                return;
            }
            if (value !== undefined && value !== null) {
                submissionData.append(formKey, Array.isArray(value) ? JSON.stringify(value) : String(value));
            }
        });


        try {
            setIsSubmitting(true);
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            if (isEditMode) {
                await axios.put(`${Constants.UPDATE_PRODUCT_URL}/${productData?._id}`, submissionData, config);
                toast.success("Product updated successfully!");
            } else {

                // 1️⃣ Create Product
                const res = await axios.post(Constants.CREATE_PRODUCT_URL, submissionData, config);
                const productId = res.data.data.id;
                const createdProduct = res.data?.data || null;

                // 2️⃣ Save all local variants to backend
                for (let v of localVariants) {
                    await axios.post(Constants.CREATE_PRODUCTS_VARIANT_URL, {
                        ...v,
                        productId,
                    }, config);
                }

                toast.success("Product & Variants created successfully!");
                window.dispatchEvent(new CustomEvent("productCreated", { detail: { product: createdProduct } }));
                window.dispatchEvent(new CustomEvent("variantCreated", { detail: { productId } }));
            }
            navigate('/admin/products');
        } catch (error: any) {
            if (error.response && error.response.status === 422) {
                setFormErrors(error.response.data.errors);
            } else {
                console.error("Submission failed:", error);
                toast.error(error.response?.data?.message || "An unexpected error occurred.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4 bg-white">
                {/* --- Product Image --- */}
                <div>
                    {/* justify-between when the Product image is uncomment */}
                </div>

                {/* --- Item Type --- */}


                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
                    {/* Name (hidden) */}

                    {/* Code (hidden) */}

                    {/* HSN Code (hidden) */}

                    {/* Category */}
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-red-500">Category *</label>
                        <SmartDropdown
                            items={categories}
                            value={categorySearchInput}
                            onChange={(value) => setCategorySearchInput(value)}
                            onSelect={(selected) => {
                                const sel = selected as OptionType | null;
                                if (!isEditMode) {
                                    if (sel?.defaultUnitId && sel.defaultUnitName) {
                                        const unitId = String(sel.defaultUnitId);
                                        const unitName = String(sel.defaultUnitName);
                                        setUnits(prev => prev.some(u => u.id === unitId)
                                            ? prev
                                            : [{ id: unitId, name: unitName }, ...prev]
                                        );
                                    }
                                    if (sel?.defaultTaxId && sel.defaultTaxName) {
                                        const taxId = String(sel.defaultTaxId);
                                        const taxName = String(sel.defaultTaxName);
                                        setTaxes(prev => prev.some(t => t.id === taxId)
                                            ? prev
                                            : [{ id: taxId, name: taxName }, ...prev]
                                        );
                                    }
                                }
                                setFormData(prev => ({
                                    ...prev,
                                    category: (sel?.id || '') as string,
                                    unit: !isEditMode ? (sel?.defaultUnitId || prev.unit) : prev.unit,
                                    tax: !isEditMode ? (sel?.defaultTaxId || prev.tax) : prev.tax,
                                }));
                                focusBrandField();
                            }}
                            placeholder="Type to search category..."
                            selectedItem={categories.find(cat => cat.id === formData.category) || null}
                            onAddNew={() => { setIsCategoryCreateModalOpen(true) }}
                            addNewLabel='New Category'
                        />
                        {formErrors.category && <p className="text-red-500 text-xs mt-1">{formErrors.category}</p>}
                    </div>

                    {/* Brand */}
                    <div ref={brandFieldRef}>
                        <label htmlFor="brand" className="block text-sm font-medium text-red-500">Brand *</label>
                        <SmartDropdown
                            items={brands}
                            value={brandSearchInput}
                            onChange={(value) => setBrandSearchInput(value)}
                            onSelect={(selected) => setFormData(prev => ({ ...prev, brand: (selected?.id || '') as string }))}
                            placeholder="Type to search brand..."
                            selectedItem={brands.find(brand => brand.id === formData.brand) || null}
                            onAddNew={() => { setIsCreateBrandModalOpen(true) }}
                            addNewLabel='New Brand'
                        />
                        {formErrors.brand && <p className="text-red-500 text-xs mt-1">{formErrors.brand}</p>}
                    </div>

                    <div className="flex flex-col">
                        <label className="invisible mb-1 block text-sm font-medium select-none">Edit Price Multipliers</label>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent("open-price-multiplier-modal:product-form"))}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-purple-200 rounded-md bg-white text-sm font-medium text-primary hover:bg-purple-50 transition-colors"
                        >
                            <PencilLine size={16} />
                            Edit Price Multipliers
                        </button>
                    </div>

                    {/* Selling Price */}

                    {/* Purchase Price */}

                    {/* Units (hidden) */}

                    {/* Discount Type */}

                    {/* Discount Value */}

                    {/* Barcode */}

                    {/* Alert Quantity */}

                    {/* Tax (hidden) */}

                </div>

                {/* --- Product Variants Section --- */}

                {/* --- Description --- */}

                {/* --- Gallery Images --- */}

                {/* --- Action Buttons --- */}
                <div className="relative md:fixed bottom-0 left-0 md:left-60 right-0 bg-white border-t border-gray-200 shadow-lg md:z-30 mt-6 md:mt-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/products')}
                                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? 'edit' : 'create'} />
                        </div>
                    </div>
                </div>
            </form>

            {/* --- Product Variants Section --- */}
            <ProductVariantInline
                productId={productData?._id || null}
                localVariants={localVariants}
                setLocalVariants={setLocalVariants}
                multiplierEventKey="product-form"
            />
            <div className="pb-28 md:pb-32" />

            <CreateCategoryModal
                isOpen={isCategoryCreateModalOpen}
                onClose={() => setIsCategoryCreateModalOpen(false)}
                onSuccess={(created) => {
                    setIsCategoryCreateModalOpen(false);
                    if (!created) return;
                    setCategories(prev => {
                        const exists = prev.some(c => c.id === created.id);
                        return exists ? prev : [{ id: created.id, name: created.name, defaultUnitId: created.defaultUnitId, defaultUnitName: created.defaultUnitName, defaultTaxId: created.defaultTaxId, defaultTaxName: created.defaultTaxName }, ...prev];
                    });
                    setCategorySearchInput(created.name);
                    setFormData(prev => ({
                        ...prev,
                        category: created.id,
                        unit: !isEditMode ? (created.defaultUnitId || prev.unit) : prev.unit,
                        tax: !isEditMode ? (created.defaultTaxId || prev.tax) : prev.tax,
                    }));
                    if (!isEditMode) {
                        if (created.defaultUnitId && created.defaultUnitName) {
                            const unitId = String(created.defaultUnitId);
                            const unitName = String(created.defaultUnitName);
                            setUnits(prev => prev.some(u => u.id === unitId)
                                ? prev
                                : [{ id: unitId, name: unitName }, ...prev]
                            );
                        }
                        if (created.defaultTaxId && created.defaultTaxName) {
                            const taxId = String(created.defaultTaxId);
                            const taxName = String(created.defaultTaxName);
                            setTaxes(prev => prev.some(t => t.id === taxId)
                                ? prev
                                : [{ id: taxId, name: taxName }, ...prev]
                            );
                        }
                    }
                }}
            />

            <CreateBrandModal
                isOpen={isCreateBrandModalOpen}
                onClose={() => setIsCreateBrandModalOpen(false)}
                onSuccess={(created) => {
                    setIsCreateBrandModalOpen(false);
                    if (!created) return;
                    setBrands(prev => {
                        const exists = prev.some(b => b.id === created.id);
                        return exists ? prev : [{ id: created.id, name: created.name, hsnCode: created.hsnCode || undefined }, ...prev];
                    });
                    setBrandSearchInput(created.name);
                    setFormData(prev => ({
                        ...prev,
                        brand: created.id,
                        hsn_code: prev.hsn_code || created.hsnCode || prev.hsn_code,
                    }));
                }}
            />

            <CreateUnitModal
                isOpen={isCreateUnitModalOpen}
                onClose={() => setIsCreateUnitModalOpen(false)}
                onSuccess={() => setIsCreateUnitModalOpen(false)}
            />

            <CreateTaxGroupModal
                isOpen={isCreateTaxModalOpen}
                onClose={() => setIsCreateTaxModalOpen(false)}
                onSuccess={() => setIsCreateTaxModalOpen(false)}
            />

        </>
    );
}
