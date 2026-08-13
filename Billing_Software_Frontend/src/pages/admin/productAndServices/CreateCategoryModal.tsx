import { useEffect, useState } from "react";
import Modal from "@components/admin/Modal";
import axios, { AxiosError } from "axios";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import { useSelector } from "react-redux";
import SubmitButton from "@components/admin/SubmitButton";
import { toast } from "react-toastify";
import { Upload } from "lucide-react";
import SmartDropdown from "@components/admin/SmartDropdown";
import { useDebounce } from "@hooks/useDebounce";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (category?: { id: string; name: string; defaultUnitId?: string | null; defaultUnitName?: string | null; defaultTaxId?: string | null; defaultTaxName?: string | null }) => void;
    hideImage?: boolean;
    useFormTag?: boolean;
}

interface CategoryFormData {
    _id: string;
    category_name: string;
    slug: string;
    status: boolean;
    category_image: File | null;
    categoryImageUrl: string;
    defaultUnitId?: string | null;
    defaultTaxId?: string | null;
}

const CreateCategoryModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, hideImage = false, useFormTag = true }) => {
    const setInitialFormData = (): CategoryFormData => ({
        _id: '',
        category_name: '',
        slug: '',
        status: true,
        category_image: null,
        categoryImageUrl: '',
        defaultUnitId: null,
        defaultTaxId: null
    });
    const { token } = useSelector((state: RootState) => state.auth);
    const [formData, setFormData] = useState<CategoryFormData>(setInitialFormData());
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [taxes, setTaxes] = useState<{ id: string; name: string }[]>([]);
    const [unitSearchInput, setUnitSearchInput] = useState('');
    const [taxSearchInput, setTaxSearchInput] = useState('');
    const [selectedUnit, setSelectedUnit] = useState<{ id: string; name: string } | null>(null);
    const [selectedTax, setSelectedTax] = useState<{ id: string; name: string } | null>(null);
    const debouncedUnitSearch = useDebounce(unitSearchInput, 500);
    const debouncedTaxSearch = useDebounce(taxSearchInput, 500);
    // Reset form whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(setInitialFormData());
            setFormErrors({});
            setSelectedUnit(null);
            setSelectedTax(null);
            setUnitSearchInput('');
            setTaxSearchInput('');
        }
    }, [isOpen]);

    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_UNITS_URL}?search=${debouncedUnitSearch}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const formattedUnits = response.data.data.map((unit: any) => ({
                    id: unit.id,
                    name: unit.unitName
                }));
                setUnits(formattedUnits);
            } catch (error) {
                setUnits([]);
            }
        };
        if (token) {
            fetchUnits();
        }
    }, [debouncedUnitSearch, token]);

    useEffect(() => {
        const fetchTaxes = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_PRODUCT_TAXES_URL}?search=${debouncedTaxSearch}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const formattedTaxes = response.data.data.map((tax: any) => ({
                    id: tax.id,
                    name: tax.taxGroupName
                }));
                setTaxes(formattedTaxes);
            } catch (error) {
                setTaxes([]);
            }
        };
        if (token) {
            fetchTaxes();
        }
    }, [debouncedTaxSearch, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const updated = {
                ...prev,
                [name]: value,
            };

            if (name === "category_name") {
                updated.slug = value.trim().replace(/\s+/g, "-").toLowerCase();
            }

            return updated;
        });
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                category_image: file,
                categoryImageUrl: URL.createObjectURL(file)
            }));
        }
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.category_name.trim()) {
            newErrors.category_name = 'Category name is required.';
        }
        // Image is now optional

        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        if (!formData.slug.trim()) {
            setFormData(prev => ({
                ...prev,
                slug: prev.category_name.trim().replace(/\s+/g, "-").toLowerCase(),
            }));
        }

        const data = new FormData();
        const resolvedSlug =
            formData.slug.trim() ||
            formData.category_name.trim().replace(/\s+/g, "-").toLowerCase();
        data.append('category_name', formData.category_name);
        data.append('slug', resolvedSlug);
        data.append('status', String(formData.status || false));
        data.append('defaultUnitId', formData.defaultUnitId || '');
        data.append('defaultTaxId', formData.defaultTaxId || '');

        if (formData.category_image instanceof File) {
            data.append('category_image', formData.category_image);
        }

        try {
            setIsSubmitting(true);
            const response = await axios.post(Constants.CREATE_CATEGORY_URL, data, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Category created successfully');
            const created = response?.data?.data;
            if (created?._id && created?.category_name) {
                onSuccess({
                    id: created._id,
                    name: created.category_name,
                    defaultUnitId: created.defaultUnitId?._id || created.defaultUnitId || null,
                    defaultUnitName: created.defaultUnitId?.unit_name || null,
                    defaultTaxId: created.defaultTaxId?._id || created.defaultTaxId || null,
                    defaultTaxName: created.defaultTaxId?.tax_name || null,
                });
            } else {
                onSuccess();
            }
        } catch (error: any | AxiosError) {
            setFormErrors(error?.response?.data?.errors || {});
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const content = (
        <div className="space-y-6">
            {!hideImage && (
                <div>
                    <label className="block text-sm font-medium text-gray-700  mb-1">Image</label>
                    <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50 ">
                            {formData.categoryImageUrl ? (
                                <img src={formData.categoryImageUrl} alt="Preview" className="w-full h-full object-cover rounded" />
                            ) : (
                                <Upload className="text-primary w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-gray-950">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Image
                                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleFileChange} />
                            </label>
                            <p className="text-xs text-gray-500  mt-1">JPG, PNG. Max 5MB.</p>
                        </div>
                    </div>
                    {formErrors.category_image && <p className="text-red-500 text-xs mt-1">{formErrors.category_image}</p>}
                </div>
            )}
            {/* Name Input */}
            <div>
                <label htmlFor="category_name" className="block text-sm font-medium text-gray-700  mb-1">Name <span className="text-red-500">*</span></label>
                <input id="category_name" name="category_name" type="text" value={formData.category_name || ""} onChange={handleChange} placeholder="Enter Category Name" className="w-full bg-white  text-gray-950  px-4 py-2 border border-gray-300  rounded-md text-sm focus:ring-purple-600 focus:border-primary" />
                {formErrors.category_name && <p className="text-red-500 text-xs mt-1">{formErrors.category_name}</p>}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Default Unit</label>
                <SmartDropdown
                    items={units}
                    value={unitSearchInput}
                    onChange={setUnitSearchInput}
                    onSelect={(selected) => {
                        const unit = selected ? { id: String(selected.id), name: selected.name } : null;
                        setSelectedUnit(unit);
                        setFormData(prev => ({ ...prev, defaultUnitId: unit?.id || null }));
                    }}
                    placeholder="Type to search unit..."
                    selectedItem={selectedUnit}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Default Tax</label>
                <SmartDropdown
                    items={taxes}
                    value={taxSearchInput}
                    onChange={setTaxSearchInput}
                    onSelect={(selected) => {
                        const tax = selected ? { id: String(selected.id), name: selected.name } : null;
                        setSelectedTax(tax);
                        setFormData(prev => ({ ...prev, defaultTaxId: tax?.id || null }));
                    }}
                    placeholder="Type to search tax..."
                    selectedItem={selectedTax}
                />
            </div>
            <div className="flex justify-end pt-2 space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-700   cursor-pointer">Cancel</button>
                {useFormTag ? (
                    <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={"create"} />
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-950 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving..." : "Create"}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Category">
            {useFormTag ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                >
                    {content}
                </form>
            ) : (
                content
            )}
        </Modal>
    );
}

export default CreateCategoryModal;
