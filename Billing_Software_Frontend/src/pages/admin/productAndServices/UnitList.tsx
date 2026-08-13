import { useEffect, useState, type FC, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store";
import Constants from "@constants/api";
import Table from "@components/admin/Table";
import Modal from "@components/admin/Modal";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import TableRow from "@components/admin/TableRow";
import { CirclePlusIcon, Edit, Trash2Icon } from "lucide-react";
import type { PermissionAction } from "@models/permissions";
import { hasPermission } from "@utils/hasPermission";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import SubmitButton from "@components/admin/SubmitButton";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import { useDebounce } from "@hooks/useDebounce";

// Define the shape of your data
interface Unit {
    _id: string;
    unit_name: string;
    short_name: string;
    status: boolean;
}

// Define the shape for pagination data from the API
interface UnitPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

type NewUnit = {
    unit_name: string;
    status: boolean;
    short_name?: string;
};

// Define the shape for form validation errors
interface FormErrors {
    unit_name?: string;
}

const UnitList: FC = () => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [pagination, setPagination] = useState<UnitPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [searchParams, setSearchParams] = useSearchParams();

    const [showModal, setShowModal] = useState<boolean>(false);
    const [editingUnit, setEditingUnit] = useState<string | null>(null);
    const [newUnit, setNewUnit] = useState<NewUnit>({
        unit_name: '',
        status: true,
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<Unit | null>(null);
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    // Get search, limit, and page from URL params
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

    const fetchUnits = async (search?: string, limit?: number, page?: number): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_UNITS_URL, {
                params: { search, limit, page },
                headers: { Authorization: `Bearer ${token}` },
            });
            setUnits(response.data.data.units || []);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error('Error fetching units:', error);
            toast.error("Failed to fetch units.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUnits(search, limit, page);
    }, [search, limit, page]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (debouncedSearchInput === search) return;
        setSearchParams({ search: debouncedSearchInput, limit: String(limit), page: '1' });
    }, [debouncedSearchInput, search, limit, setSearchParams]);

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
        setSelectedIds(checked ? units.map((unit) => unit._id) : []);
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


    const handleNewUnitChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value, type, checked } = e.target;
        setNewUnit((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleNewUnitSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setFormErrors({});

        try {
            setIsSubmitting(true);
            const headers = { Authorization: `Bearer ${token}` };

            if (editingUnit) {
                await axios.put(`${Constants.UPDATE_UNIT_URL}/${editingUnit}`, newUnit, { headers });
                toast.success('Unit updated successfully');
            } else {
                await axios.post(Constants.CREATE_UNIT_URL, newUnit, { headers });
                toast.success('Unit added successfully');
            }

            fetchUnits(search, limit, page); // Refetch current page
            setShowModal(false);
            setNewUnit({ unit_name: '', status: true });
            setEditingUnit(null);
        } catch (err: any) {
            if (err.response?.status === 422 && err.response.data?.errors) {
                setFormErrors(err.response.data.errors);
            } else {
                console.error('Error:', err);
                const message = editingUnit ? 'Failed to update unit.' : 'Failed to add unit.';
                toast.error(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = async (unit: Unit): Promise<void> => {
        try {
            const response = await axios.get<Unit>(`${Constants.GET_UNIT_URL}/${unit._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setEditingUnit(unit._id);
            setNewUnit({
                unit_name: response.data.unit_name,
                status: response.data.status,
            });
            setFormErrors({});
            setShowModal(true);
        } catch (error) {
            console.error('Failed to load unit:', error);
            toast.error('Failed to load unit data.');
        }
    };

    const handleDeleteClick = (item: Unit): void => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async (): Promise<void> => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_UNIT_URL}/${itemToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Unit deleted successfully');
            fetchUnits(search, limit, page); // Refetch current page
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete unit:', error);
            toast.error('Failed to delete unit.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async (): Promise<void> => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_UNIT_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} unit(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} unit(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchUnits(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const tableActions = [
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: Unit) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: Unit) => { handleDeleteClick(item) }
        }
    ];
    const tableHeaders = [
        '#',
        <CustomCheckbox
            checked={allSelected}
            onChange={handleToggleSelectAll}
            disabled={units.length === 0}
            name="select-all-units"
        />,
        'Unit Name',
        'Action'
    ];
    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionLabel = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionLabel)) {
            return true;
        }

        return hasPermission(permissions, 'product-services', actionLabel);
    });

    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Units</h1>
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
                                setEditingUnit(null);
                                setShowModal(true);
                                setNewUnit({ unit_name: '', status: true });
                                setFormErrors({});
                            }}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                        >
                            <CirclePlusIcon size={14} /> New Unit
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                    className="border border-gray-300 px-4 py-2 rounded-md w-full md:w-64 bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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

            <Table headers={tableHeaders}>
                {!isLoading && units.length > 0 && (
                    units.map((unit, index) => (
                        <TableRow
                            key={unit._id}
                            index={(page - 1) * limit + index + 1}
                            row={unit}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(unit._id)}
                                    onChange={(checked) => handleRowSelect(unit._id, checked)}
                                    name={`select-unit-${unit._id}`}
                                />,
                                <p className="capitalize text-indigo-600">{unit.unit_name}</p>,
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        />
                    ))
                )}

                {!isLoading && units.length === 0 && (
                    <tr>
                        <td colSpan={tableHeaders.length} className="text-center py-2 text-gray-500 font-semibold">
                            No Units Found
                        </td>
                    </tr>
                )}
                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={tableHeaders.length}>
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

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUnit ? 'Edit Unit' : 'Add New Unit'}>
                <form onSubmit={handleNewUnitSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Unit Name <em className="text-red-600">*</em></label>
                        <input
                            type="text"
                            name="unit_name"
                            value={newUnit.unit_name}
                            onChange={handleNewUnitChange}
                            className="mt-1 block w-full border border-gray-300  rounded-md p-2 bg-white  text-gray-950 "
                        />
                        {formErrors.unit_name && (
                            <p className="text-sm text-red-600 mt-1">{formErrors.unit_name}</p>
                        )}
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
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={editingUnit ? "edit" : "create"} />
                    </div>
                </form>
            </Modal>

            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this unit?"
                isDeleting={isDeleting}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} unit(s)?`}
                isDeleting={isBulkDeleting}
            >
            </DeleteConfirmationModal>
        </div >
    );
};

export default UnitList;
