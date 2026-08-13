import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FC, ChangeEvent, FormEvent } from "react";
import Constants from "../../../constants/api";
import axios, { AxiosError } from "axios";
import Table from "../../../components/admin/Table";
import PaginationWrapper from "../../../components/admin/PaginationWrapper";
import { Upload, Edit, Trash2Icon, CirclePlusIcon } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "../../../components/admin/Modal";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store";
import TableRow from "@components/admin/TableRow";
import type { PermissionAction } from "@models/permissions";
import { hasPermission } from "@utils/hasPermission";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import SubmitButton from "@components/admin/SubmitButton";
import SupplierProfileCard from "@components/SupplierProfileImage";
import SmartDropdown from "@components/admin/SmartDropdown";
import { useDebounce } from "@hooks/useDebounce";

// Interface for the Category data object
interface Category {
    _id: string;
    category_name: string;
    slug: string;
    status: boolean;
    categoryImageUrl: string;
    defaultUnitId?: { _id: string; unit_name: string; short_name?: string } | string | null;
    defaultTaxId?: { _id: string; tax_name: string; total_tax_rate?: number } | string | null;
}

// Interface for the form state, including a potential file upload
interface CategoryFormState extends Omit<Partial<Category>, 'status'> {
    status?: boolean;
    category_image?: File | null;
    defaultUnitId?: string | null;
    defaultTaxId?: string | null;
}

// Interface for pagination data from the API
interface CategoryPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Define a type for the form errors state
type FormErrors = {
    [key: string]: string;
};

const CategoryList: FC = () => {
    // Hooks and State
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [searchParams, setSearchParams] = useSearchParams();

    // Component State
    const [categories, setCategories] = useState<Category[]>([]);
    const [pagination, setPagination] = useState<CategoryPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [category, setCategory] = useState<CategoryFormState>({});
    const [showModal, setShowModal] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [taxes, setTaxes] = useState<{ id: string; name: string }[]>([]);
    const [unitSearchInput, setUnitSearchInput] = useState<string>('');
    const [taxSearchInput, setTaxSearchInput] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<{ id: string; name: string } | null>(null);
    const [selectedTax, setSelectedTax] = useState<{ id: string; name: string } | null>(null);
    const debouncedUnitSearch = useDebounce(unitSearchInput, 500);
    const debouncedTaxSearch = useDebounce(taxSearchInput, 500);

    // Dropdown and Delete Modal State
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<Category | null>(null);

    // Get params from URL
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useState<string>(search);
    const debouncedSearchInput = useDebounce(searchInput, 500);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
    // Fetch categories based on search and pagination params
    const fetchCategories = async (search?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_CATEGORY_LIST_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setCategories(response.data.data.categories || []);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error("Error fetching categories:", error);
            toast.error("Failed to fetch categories.");
        } finally {
            setIsLoading(false);
        }
    };

    // Effect to fetch data when URL params change
    useEffect(() => {
        fetchCategories(search, limit, page);
    }, [search, limit, page]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (debouncedSearchInput === search) return;
        setSearchParams({ search: debouncedSearchInput, limit: String(limit), page: '1' });
    }, [debouncedSearchInput, search, limit, setSearchParams]);

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
                console.error("Error fetching units:", error);
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
                console.error("Error fetching taxes:", error);
                setTaxes([]);
            }
        };
        if (token) {
            fetchTaxes();
        }
    }, [debouncedTaxSearch, token]);

    // Handlers for search and pagination controls
    const handleSearch = (keyword: string) => {
        setSearchInput(keyword);
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ search, limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ search, limit: String(limit), page: String(newPage) });
    };

    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? categories.map((cat) => cat._id) : []);
        setIsAllSelected(checked);
    };
    const handleRowSelect = (id: string, checked: boolean) => {
        if (isAllSelected) {
            setIsAllSelected(false);
        }
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };


    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 5 * 1024 * 1024) {
            setCategory({
                ...category,
                category_image: file,
                categoryImageUrl: URL.createObjectURL(file),
            });
        } else if (file) {
            toast.error("Please upload a JPG or PNG image under 5MB.");
        }
    };

    const handleEditClick = async (categoryItem: Category) => {
        try {
            const response = await axios.get<Category>(`${Constants.GET_CATEGORY_URL}/${categoryItem._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = response.data;
            const defaultUnitId = typeof data.defaultUnitId === 'object' && data.defaultUnitId !== null
                ? data.defaultUnitId._id
                : data.defaultUnitId || null;
            const defaultTaxId = typeof data.defaultTaxId === 'object' && data.defaultTaxId !== null
                ? data.defaultTaxId._id
                : data.defaultTaxId || null;
            setCategory({
                ...data,
                defaultUnitId,
                defaultTaxId
            });
            setSelectedUnit(
                typeof data.defaultUnitId === 'object' && data.defaultUnitId !== null
                    ? { id: data.defaultUnitId._id, name: data.defaultUnitId.unit_name }
                    : null
            );
            setSelectedTax(
                typeof data.defaultTaxId === 'object' && data.defaultTaxId !== null
                    ? { id: data.defaultTaxId._id, name: data.defaultTaxId.tax_name }
                    : null
            );
            setIsEditMode(true);
            setFormErrors({});
            setShowModal(true);
        } catch (error) {
            console.error('Failed to load category:', error);
            toast.error('Failed to load category data.');
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormErrors({});

        const formData = new FormData();
        const nameValue = (category.category_name ?? "").trim();
        const autoSlug = nameValue ? nameValue.replace(/\s+/g, "-").toLowerCase() : "";
        formData.append("category_name", nameValue);
        formData.append("slug", autoSlug);
        formData.append("status", String(category.status ?? true));
        formData.append("defaultUnitId", category.defaultUnitId ?? "");
        formData.append("defaultTaxId", category.defaultTaxId ?? "");
        if (category.category_image) {
            formData.append("category_image", category.category_image);
        }

        const url = isEditMode
            ? `${Constants.UPDATE_CATEGORY_URL}/${category._id}`
            : Constants.CREATE_CATEGORY_URL;
        const method = isEditMode ? 'put' : 'post';

        try {
            setIsSubmitting(true);
            await axios[method](url, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success(`Category ${isEditMode ? 'updated' : 'added'} successfully`);
            setShowModal(false);
            fetchCategories(search, limit, page); // Refetch current page
        } catch (error) {
            const axiosError = error as AxiosError;
            const data = axiosError.response?.data as { errors?: FormErrors };
            if (data?.errors) {
                setFormErrors(data.errors);
            } else {
                console.error("Error submitting form:", error);
                toast.error(`Failed to ${isEditMode ? 'update' : 'add'} category.`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (categoryItem: Category) => {
        setItemToDelete(categoryItem);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_CATEGORY_URL}/${itemToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Category deleted successfully');
            fetchCategories(search, limit, page); // Refetch current page
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete category:', error);
            toast.error('Failed to delete category.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_CATEGORY_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} category(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} category(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchCategories(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Calculate display range for pagination
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const tableHeader = ["#", "Category Name", "Unit", "Tax", "Actions"];
    const restrictedActions = ['edit', 'delete'];
    const tableActions = [
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: Category) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: Category) => { handleDeleteClick(item) }
        }
    ];
    const allowedActions = tableActions.filter((action) => {
        const actionKey = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionKey)) {
            return true;
        }

        return hasPermission(permissions, 'product-services', actionKey);
    });
    if (allowedActions.length === 0) {
        tableHeader.pop();
    }
    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Categories</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'product-services', 'delete') && (
                        <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            disabled={selectedIds.length === 0}
                            className={`px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                                }`}
                        >
                            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                    )}
                    {hasPermission(permissions, 'product-services', 'create') &&
                        <button
                            onClick={() => {
                                setShowModal(true);
                                setFormErrors({});
                                setCategory({ status: true });
                                setSelectedUnit(null);
                                setSelectedTax(null);
                                setUnitSearchInput('');
                                setTaxSearchInput('');
                                setIsEditMode(false);
                            }}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                        >
                            <CirclePlusIcon size={14} /> New Category
                        </button>
                    }
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search by category name..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <select
                    value={limit}
                    onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>

            <Table
                headers={[
                    "#",
                    <CustomCheckbox
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        disabled={categories.length === 0}
                        name="select-all-categories"
                    />,
                    "Category",
                    "Default Unit",
                    "Default Tax",
                    ...(allowedActions.length > 0 ? ["Actions"] : [])
                ]}
            >
                {!isLoading && categories && categories.map((categoryItem, index) => (
                    <TableRow
                        key={categoryItem._id}
                        row={categoryItem}
                        index={index + 1}
                        columns={[
                            <CustomCheckbox
                                checked={selectedIds.includes(categoryItem._id)}
                                onChange={(checked) => handleRowSelect(categoryItem._id, checked)}
                                name={`select-category-${categoryItem._id}`}
                            />,
                            <SupplierProfileCard      // new coponent Similar to ProfileCard but works different
                                imageUrl={categoryItem.categoryImageUrl}
                                name={categoryItem.category_name}
                                primary
                            />,
                            typeof categoryItem.defaultUnitId === "object" && categoryItem.defaultUnitId
                                ? categoryItem.defaultUnitId.unit_name
                                : "-",
                            typeof categoryItem.defaultTaxId === "object" && categoryItem.defaultTaxId
                                ? categoryItem.defaultTaxId.tax_name
                                : "-",
                        ]}
                        actions={allowedActions.length > 0 ? allowedActions : undefined}
                    />
                ))}

                {!isLoading && categories.length === 0 &&
                    <tr>
                        <td colSpan={allowedActions.length > 0 ? 6 : 5} className="text-center py-4 font-semibold">No categories found.</td>
                    </tr>
                }

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={allowedActions.length > 0 ? 6 : 5}>
                            <LoaderSpinner />
                        </td>
                    </tr>
                )}
            </Table>

            <PaginationWrapper
                count={pagination.totalPages}
                page={page}
                from={from}
                to={to}
                total={pagination.total}
                onChange={(_, newPage) => handlePageChange(newPage)}
                paginationVariant="outlined"
                paginationShape="rounded"
            />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditMode ? 'Edit Category' : 'Add New Category'}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Upload Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700  mb-1">Image <em className="text-red-500">*</em></label>
                        <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50 ">
                                {category.categoryImageUrl ? (
                                    <img src={category.categoryImageUrl} alt="Preview" className="w-full h-full object-cover rounded" />
                                ) : (
                                    <Upload className="text-primary w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-gray-950">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Image
                                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageChange} />
                                </label>
                                <p className="text-xs text-gray-500  mt-1">JPG, PNG. Max 5MB.</p>
                            </div>
                        </div>
                        {formErrors.category_image && <p className="text-red-500 text-xs mt-1">{formErrors.category_image}</p>}
                    </div>
                    {/* Name Input */}
                    <div>
                        <label htmlFor="category_name" className="block text-sm font-medium text-gray-700  mb-1">Name <span className="text-red-500">*</span></label>
                        <input id="category_name" type="text" value={category.category_name || ""} onChange={(e) => setCategory({ ...category, category_name: e.target.value })} placeholder="Enter Category Name" className="w-full bg-white  text-gray-950  px-4 py-2 border border-gray-300  rounded-md text-sm focus:ring-purple-600 focus:border-primary" />
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
                                setCategory(prev => ({ ...prev, defaultUnitId: unit?.id || null }));
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
                                setCategory(prev => ({ ...prev, defaultTaxId: tax?.id || null }));
                            }}
                            placeholder="Type to search tax..."
                            selectedItem={selectedTax}
                        />
                    </div>
                    <div className="flex justify-end pt-2 space-x-2">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-700   cursor-pointer">Cancel</button>
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? "edit" : "create"} />
                    </div>
                </form>
            </Modal>

            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this category?"
                isDeleting={isDeleting}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} category(s)?`}
                isDeleting={isBulkDeleting}
            >
            </DeleteConfirmationModal>
        </div >
    );
};

export default CategoryList;
