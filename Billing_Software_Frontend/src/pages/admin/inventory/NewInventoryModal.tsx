import Modal from "@components/admin/Modal";
import SearchableDropdown from "@components/admin/SearchableDropdown";
import SubmitButton from "@components/admin/SubmitButton";
import Constants from "@constants/api";
import { useDebounce } from "@hooks/useDebounce";
import type { RootState } from "@store/index";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void
}

interface Options {
    id: string;
    name: string;
    code: string;
    unit: { id: string; name: string; } | null;
    prices: { selling: number; purchase: number; };
}

interface InventoryFormData {
    productId: string;
    variantId: string;
    quantity: number;
    type: string;
    notes: string | null;
}

interface VariantOption {
    id: string;
    name: string;
    raw: any;   // full variant object
}

const initialFormData: InventoryFormData = { productId: '', variantId: '', quantity: 0, type: '', notes: null };
const NewInventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [products, setProducts] = useState<Options[]>([]);
    const [productSearchInput, setProductSearchInput] = useState<string>("");
    const [selectedProduct, setSelectedProduct] = useState<Options | null>(null);
    const [formData, setFormData] = useState<InventoryFormData>(initialFormData);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const debouncedSearchTerm = useDebounce(productSearchInput, 500);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [variants, setVariants] = useState<any[]>([]);
    const [variantSearchInput, setVariantSearchInput] = useState<string>("");
    const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
    const [existingInventoryVariantIds, setExistingInventoryVariantIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!selectedProduct) {
            setVariants([]);
            setSelectedVariant(null);
            return;
        }

        const fetchVariants = async () => {
            try {
                const url = Constants.GET_PRODUCTS_VARIANT_BY_ID_URL.replace(":id", selectedProduct.id);
                const res = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setVariants(res.data.data || []);
            } catch (error) {
                console.error("Failed to load product variants:", error);
                setVariants([]);
            }
        };

        fetchVariants();
    }, [selectedProduct]);

    useEffect(() => {
        if (!selectedVariant) return;

        setFormData((prev) => ({
            ...prev,
            variantId: selectedVariant._id,                 // new
            // quantity: selectedVariant.opening_qty || 0,           // new
            quantity: 0,
            type: 'stock_in',
            notes: `Variant Selected: ${selectedVariant.designNo} ${selectedVariant.color} ${selectedVariant.size}`
        }));
    }, [selectedVariant]);

    useEffect(() => {
        setSelectedProduct(null);
        setProductSearchInput('');
        setFormErrors({});
        setFormData(initialFormData);
        setExistingInventoryVariantIds(new Set());
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchExistingInventory = async () => {
            try {
                const response = await axios.get(Constants.FETCH_INVENTORY_LIST_URL, {
                    params: { page: 1, limit: 10000 },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const inventoryList = response.data?.data ?? [];
                const variantIds = inventoryList
                    .map((inv: any) => String(inv.variantId || inv.variantDetails?._id || ''))
                    .filter(Boolean);
                setExistingInventoryVariantIds(new Set(variantIds));
            } catch (error) {
                console.error("Error fetching inventory list:", error);
                setExistingInventoryVariantIds(new Set());
            }
        };

        fetchExistingInventory();
    }, [isOpen, token]);

    useEffect(() => {
        const fetchProductsByQuery = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCTS_WITH_SEARCH_URL}?search=${debouncedSearchTerm}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const rawProducts = response.data?.data?.products ?? response.data?.data ?? [];
                const normalized = Array.isArray(rawProducts)
                    ? rawProducts.map((p: any) => ({ ...p, name: p.code || p.name || "" }))
                    : [];
                setProducts(normalized);
            } catch (error) {
                console.error('Error fetching products:', error);
                setProducts([]);
            }
        }

        fetchProductsByQuery();
    }, [debouncedSearchTerm]);

    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        if (!selectedProduct) {
            errors.product = 'Product/Service is required';
        }
        if (!selectedVariant) {
            errors.variant = "Variant selection is required";
        }
        if (formData.quantity <= 0) {
            errors.quantity = 'Quantity must be greater than 0';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    const variantOptions: VariantOption[] = variants
        .filter(v => !existingInventoryVariantIds.has(String(v._id)))
        .map(v => ({
            id: v._id,
            name: `${v.designNo} - ${v.color} - ${v.size}`,
            raw: v
        }));

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            setIsSubmitting(true);
            const payload = {
                ...formData,
                productId: selectedProduct?.id || '',
                variantId: selectedVariant?._id || '',
                type: 'stock_in',
            };
            await axios.post(Constants.UPDATE_INVENTORY_URL, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Inventory created successfully');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating inventory:', error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Inventory">
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="product" className="block text-gray-700  font-semibold mb-2">Product/Service <em className="text-red-500">*</em></label>
                    <SearchableDropdown
                        options={products}
                        placeholder="Search by PROD id..."
                        onInputChange={(_, value) => setProductSearchInput(value)}
                        onChange={(_, value) => setSelectedProduct(value as Options)}
                        value={selectedProduct}
                    />
                    {formErrors.product && <p className="text-red-500 text-sm mt-1">{formErrors.product}</p>}
                </div>
                <div className="flex gap-4">
                    <div className="mb-4 w-1/2">
                        <label className="block text-gray-700  font-semibold mb-2">Code</label>
                        <input
                            type="text"
                            value={selectedProduct?.code || ''}
                            readOnly
                            className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                    </div>
                    <div className="mb-4 w-1/2">
                        <label className="block text-gray-700  font-semibold mb-2">Unit</label>
                        <input
                            type="text"
                            value={selectedProduct?.unit?.name || ''}
                            readOnly
                            className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                    </div>
                </div>
                {selectedProduct && (
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">
                            Select Variant <em className="text-red-500">*</em>
                        </label>


                        <SearchableDropdown
                            options={variantOptions}
                            placeholder="Select a variant..."
                            onInputChange={(_, value) => setVariantSearchInput(value)}
                            onChange={(_, selected) =>
                                setSelectedVariant((selected as VariantOption)?.raw || null)
                            }
                            value={
                                selectedVariant
                                    ? {
                                        id: selectedVariant._id,
                                        name: `${selectedVariant.designNo} - ${selectedVariant.color} - ${selectedVariant.size}`
                                    }
                                    : null
                            }
                        />

                        {formErrors.variant && (
                            <p className="text-red-500 text-sm mt-1">{formErrors.variant}</p>
                        )}
                    </div>
                )}
                {selectedVariant && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-md border">

                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Design No</label>
                            <input
                                value={selectedVariant.designNo}
                                readOnly
                                className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Color</label>
                            <input
                                value={selectedVariant.color}
                                readOnly
                                className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Size</label>
                            <input
                                value={selectedVariant.size}
                                readOnly
                                className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Sale Price</label>
                            <input
                                value={selectedVariant.sale_price}
                                readOnly
                                className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Purchase Price</label>
                            <input
                                value={selectedVariant.sale_price}
                                readOnly
                                className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                        </div>


                    </div>
                )}
                <div className="mb-4">
                    <label htmlFor="type" className="block text-gray-700  font-semibold mb-2">Type <em className="text-red-500">*</em></label>
                    <input
                        type="text"
                        value={`Stock In`}
                        readOnly
                        className="border border-gray-300 bg-gray-100 mt-1 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                    {formErrors.type && <span className="text-red-500 text-sm">{formErrors.type}</span>}
                </div>
                <div className="mb-4">
                    <label htmlFor="quantity" className="block text-gray-700  font-semibold mb-2">Quantity <em className="text-red-500">*</em></label>
                    <input
                        type="number"
                        id="quantity"
                        name="quantity"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                        className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                        placeholder="Enter quantity..."
                    />
                    {formErrors.quantity && <span className="text-red-500 text-sm">{formErrors.quantity}</span>}
                </div>
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-950 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode="create" />
                </div>
            </form>
        </Modal>
    );
}

export default NewInventoryModal;
