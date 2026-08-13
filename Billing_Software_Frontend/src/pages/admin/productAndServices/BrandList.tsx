import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FC, ChangeEvent, FormEvent } from "react";
import Constants from "@constants/api";
import axios from "axios";
import Table from "@components/admin/Table";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { Upload, Trash2Icon, Edit, CirclePlusIcon } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "@components/admin/Modal";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index"
import type { PermissionAction } from "@models/permissions";
import { hasPermission } from "@utils/hasPermission";
import TableRow from "@components/admin/TableRow";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import SubmitButton from "@components/admin/SubmitButton";
import SupplierProfileCard from "@components/SupplierProfileImage";
import { useDebounce } from "@hooks/useDebounce";

// Interface for the brand data
interface Brand {
    _id: string;
    brand_name: string;
    hsn_code: string;
    status: boolean;
    brandImageUrl: string;
}

// Interface for pagination data from the API
interface BrandPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Interface for the form state
interface BrandFormState {
    _id?: string;
    brand_name?: string;
    hsn_code?: string;
    status?: boolean;
    brand_image?: File | null;
    brandImageUrl?: string;
}

// Interface for form validation errors
interface FormErrors {
    brand_name?: string;
    brand_image?: string;
    hsn_code?: string;
}

const BrandList: FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [searchParams, setSearchParams] = useSearchParams();

    // State management
    const [brands, setBrands] = useState<Brand[]>([]);
    const [pagination, setPagination] = useState<BrandPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [showModal, setShowModal] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [brand, setBrand] = useState<BrandFormState>({});
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    // Dropdown and Delete Modal state
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<Brand | null>(null);

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

    const initialFormState: BrandFormState = {
        brand_name: '',
        hsn_code: '',
        status: true,
        brand_image: null,
        brandImageUrl: ''
    };

    // Fetch brands based on URL params
    const fetchBrands = async (search?: string, limit?: number, page?: number): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_BRAND_LIST_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setBrands(response.data.data.brands || []);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error("Error fetching brands:", error);
            toast.error("Failed to fetch brands.");
        } finally {
            setIsLoading(false);
        }
    };

    // Effect to fetch data when params change
    useEffect(() => {
        fetchBrands(search, limit, page);
    }, [search, limit, page]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (debouncedSearchInput === search) return;
        setSearchParams({ search: debouncedSearchInput, limit: String(limit), page: '1' });
    }, [debouncedSearchInput, search, limit, setSearchParams]);

    // Handlers for search and pagination
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
        setSelectedIds(checked ? brands.map((brand) => brand._id) : []);
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


    const handleImageChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file && file.size <= 5 * 1024 * 1024) {
            setBrand({
                ...brand,
                brand_image: file,
                brandImageUrl: URL.createObjectURL(file),
            });
        } else if (file) {
            toast.error("Please upload a JPG or PNG image under 5MB.");
        }
    };

    const handleEditClick = async (brandToEdit: Brand): Promise<void> => {
        try {
            const response = await axios.get<Brand>(`${Constants.GET_BRAND_URL}/${brandToEdit._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setBrand(response.data);
            setIsEditMode(true);
            setFormErrors({});
            setShowModal(true);
        } catch (error) {
            console.error('Failed to load brand:', error);
            toast.error("Failed to load brand data.");
        }
    }

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setFormErrors({});

        const formData = new FormData();
        formData.append("brand_name", brand.brand_name ?? "");
        formData.append("hsn_code", brand.hsn_code ?? "");
        formData.append("status", String(brand.status ?? true));
        if (brand.brand_image) {
            formData.append("brand_image", brand.brand_image);
        }

        try {
            setIsSubmitting(true);
            const url = isEditMode
                ? `${Constants.UPDATE_BRAND_URL}/${brand._id}`
                : Constants.CREATE_BRAND_URL;
            const method = isEditMode ? 'put' : 'post';

            await axios[method](url, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success(`Brand ${isEditMode ? 'updated' : 'added'} successfully`);
            setShowModal(false);
            fetchBrands(search, limit, page); // Refetch current page
        } catch (error: any) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            } else {
                console.error("Error submitting form:", error);
                toast.error(`Failed to ${isEditMode ? 'update' : 'add'} brand.`);
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDeleteClick = (brandToDelete: Brand): void => {
        setItemToDelete(brandToDelete);
        setDeleteModalOpen(true);
    }

    const confirmDelete = async (): Promise<void> => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_BRAND_URL}/${itemToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Brand deleted successfully');
            fetchBrands(search, limit, page); // Refetch current page
            setDeleteModalOpen(false);
        } catch (error) {
            console.error('Failed to delete brand:', error);
            toast.error("Failed to delete brand.");
        } finally {
            setIsDeleting(false);
        }
    }

    const confirmBulkDelete = async (): Promise<void> => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_BRAND_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} brand(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} brand(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchBrands(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Calculate display range for pagination
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const restrictedActions = ['edit', 'delete'];
    const tableActions = [
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: Brand) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: Brand) => { handleDeleteClick(item) }
        }
    ];

    const allowedActions = tableActions.filter((action) => {
        const actionName = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionName)) {
            return true;
        }

        return hasPermission(permissions, 'product-services', actionName);
    });

    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }
    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Brands</h1>
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
                    {hasPermission(permissions, 'product-services', 'create') && (
                        <button
                            onClick={() => {
                                setShowModal(true);
                                setFormErrors({});
                                setBrand(initialFormState);
                                setIsEditMode(false);
                            }}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                        >
                            <CirclePlusIcon size={14} /> New Brand
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search by brand name..."
                    value={searchInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
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
                        disabled={brands.length === 0}
                        name="select-all-brands"
                    />,
                    "Brand Name",
                    "HSN Code",
                    ...(allowedActions.length > 0 ? ["Actions"] : [])
                ]}
            >
                {!isLoading && brands && brands.map((brandItem, index) => (
                    <TableRow
                        key={brandItem._id}
                        index={index + 1}
                        row={brandItem}
                        columns={[
                            <CustomCheckbox
                                checked={selectedIds.includes(brandItem._id)}
                                onChange={(checked) => handleRowSelect(brandItem._id, checked)}
                                name={`select-brand-${brandItem._id}`}
                            />,
                            <SupplierProfileCard   // new coponent Similar to ProfileCard but works different
                                imageUrl={brandItem.brandImageUrl}
                                name={brandItem.brand_name}
                                primary
                            />,
                            brandItem.hsn_code || "N/A",
                        ]}
                        actions={allowedActions.length > 0 ? allowedActions : undefined}
                    />
                ))}

                {!isLoading && brands.length === 0 &&
                    <tr>
                        <td colSpan={allowedActions.length > 0 ? 5 : 4} className="text-center py-4 font-semibold">No brands found.</td>
                    </tr>
                }

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={allowedActions.length > 0 ? 5 : 4}>
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

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditMode ? 'Edit Brand' : 'Add New Brand'}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700  mb-1">Image <em className="text-red-600">*</em></label>
                        <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50 ">
                                {brand.brandImageUrl ? (
                                    <img src={brand.brandImageUrl} alt="Preview" className="w-full h-full object-cover rounded" />
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
                        {formErrors.brand_image && <p className="text-red-500 text-xs mt-1">{formErrors.brand_image}</p>}
                    </div>

                    <div>
                        <label htmlFor="brand_name" className="block text-sm font-medium text-gray-700  mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="brand_name"
                            type="text"
                            value={brand.brand_name || ''}
                            onChange={(e) => setBrand({ ...brand, brand_name: e.target.value })}
                            placeholder="Enter brand name"
                            className="w-full text-gray-950  bg-white  px-4 py-2 border border-gray-300  rounded-md text-sm focus:ring-purple-600 focus:border-primary"
                        />
                        {formErrors.brand_name && <p className="text-red-500 text-xs mt-1">{formErrors.brand_name}</p>}
                    </div>

                    <div>
                        <label htmlFor="hsn_code" className="block text-sm font-medium text-gray-700  mb-1">
                            HSN Code
                        </label>
                        <input
                            id="hsn_code"
                            type="text"
                            value={brand.hsn_code || ''}
                            onChange={(e) => setBrand({ ...brand, hsn_code: e.target.value })}
                            placeholder="Enter HSN code"
                            className="w-full text-gray-950  bg-white  px-4 py-2 border border-gray-300  rounded-md text-sm focus:ring-purple-600 focus:border-primary"
                        />
                        {formErrors.hsn_code && <p className="text-red-500 text-xs mt-1">{formErrors.hsn_code}</p>}
                    </div>

                    <div className="flex justify-end pt-2 space-x-2">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-700   cursor-pointer"
                        >
                            Cancel
                        </button>
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? "edit" : "create"} />
                    </div>
                </form>
            </Modal>

            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this brand?"
                isDeleting={isDeleting}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} brand(s)?`}
                isDeleting={isBulkDeleting}
            >
            </DeleteConfirmationModal>
        </div >
    );
}

export default BrandList;
