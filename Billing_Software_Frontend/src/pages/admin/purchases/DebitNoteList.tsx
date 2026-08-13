import { useEffect, useState, type FC } from "react";
import { CirclePlusIcon, Eye, Pencil, Trash2Icon, Printer } from "lucide-react";
import Table from "@components/admin/Table";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import TableRow from "@components/admin/TableRow";
import { toast } from "react-toastify";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import StatusBadge from "@components/admin/StatusBadge";
import PaymentModeBadge from "@components/admin/PaymentModeBadge";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import type { PermissionAction } from "@models/permissions";
import { hasPermission } from "@utils/hasPermission";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import useDateFormatter from "@hooks/useDateFormatter";
import SupplierProfileCard from "@components/SupplierProfileImage";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface DebitNoteList {
    id: string;
    debitNoteId: string;
    referenceNo: string;
    vendor: {
        id: string;
        name: string;
        email: string;
        phone: string;
        profileImage: string | null;
    };
    purchase: {
        id: string;
        purchaseId: string;
        supplierBillNumber?: string | null;
        purchaseDate: string;
        totalAmount: number;
    };
    paymentMode?: {
        id: string;
        name: string;
        slug: string;
    };
    debitNoteDate: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    sign_type: string;
    signatureName: string | null;
    signatureImage: string | null;
    notes: string;
    createdBy: {
        id: string;
        name: string;
    };
    approvedBy?: {
        id: string;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const DebitNoteList: FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const navigate = useNavigate();
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    // State for the list of purchases and pagination
    const [debitNotes, setDebitNotes] = useState<DebitNoteList[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });

    // State for the delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<DebitNoteList | null>(null);

    // Using URL search parameters to manage state for search, limit, and page
    const [searchParams, setSearchParams] = useSearchParams();
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isAllSelected, setIsAllSelected] = useState(false);
    // Handlers for updating URL search parameters
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
        setSelectedIds(checked ? debitNotes.map((note) => note.id) : []);
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

    // Handler to navigate to the 'new purchase' page
    const handleNewDebitNoteClick = () => {
        navigate("/admin/debit-notes/new");
    };

    // Fetch debitNotes whenever search, limit, or page changes
    useEffect(() => {
        fetchDebitNotes(search, limit, page);
    }, [search, limit, page, token]);

    const fetchDebitNotes = async (search?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_FOR_DEBIT_NOTE_LIST_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setDebitNotes(response.data.data?.debitNotes ?? []);
            setPagination(response.data.data.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 });
        } catch (error) {
            console.error('Error fetching purchases:', error);
            toast.error('Failed to fetch purchases.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (item: DebitNoteList) => {
        navigate(`/admin/debit-notes/edit/${item.id}`);
    };

    const handleDeleteClick = (item: DebitNoteList) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_DEBIT_NOTE_URL}/${itemToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Debit note deleted successfully');
            fetchDebitNotes(search, limit, page);
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete debit note:', error);
            toast.error('Failed to delete debit note.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_DEBIT_NOTE_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} debit note(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} debit note(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchDebitNotes(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const tableActions = [
        {
            label: 'View',
            icon: <Eye size={14} />,
            onClick: (item: DebitNoteList) => { navigate(`/admin/debit-notes/view/${item.id}`); }
        },
        {
            label: 'Edit',
            icon: <Pencil size={14} />,
            onClick: (item: DebitNoteList) => { handleEditClick(item); }
        },
        {
            label: 'Print Bill',
            icon: <Printer size={14} />,
            onClick: (item: DebitNoteList) => {
                navigate(`/admin/debit-notes/view/${item.id}?print=true`);
            }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: DebitNoteList) => { handleDeleteClick(item) }
        }
    ];

    const tableHeaders = ["#", "Debit Note ID", "Purchase ID", "Supplier Bill No", "Debit Note Date", "Supplier", "Amount", "Created On", "Status", "Action"];   // also added previously "Payment Mode"
    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionLabel = action.label.toLowerCase() as PermissionAction;
        if (!restrictedActions.includes(actionLabel)) {
            return true;
        }
        return hasPermission(permissions, 'debit-notes', actionLabel);
    });

    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }
    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Debit Notes (Purchase Returns)</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'debit-notes', 'delete') && (
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
                    {hasPermission(permissions, 'debit-notes', 'create') && (
                        <button
                            onClick={handleNewDebitNoteClick}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <CirclePlusIcon size={14} /> New Debit Note
                        </button>
                    )}
                </div>
            </div>

            {/* Search Input & PageLength */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>

            <div className="w-full overflow-x-auto">
                <Table
                    headers={[
                        "#",
                        <CustomCheckbox
                            checked={allSelected}
                            onChange={handleToggleSelectAll}
                            disabled={debitNotes.length === 0}
                            name="select-all-debit-notes"
                        />,
                        "Debit Note ID",
                        "Purchase ID",
                        "Supplier Bill No",
                        "Debit Note Date",
                        "Supplier",
                        "Amount",
                        "Created On",
                        "Status",
                        "Action",
                    ]}
                >
                    {!isLoading && debitNotes && debitNotes.map((debitNote, index) => (
                        <TableRow
                            key={debitNote.id}
                            index={(page - 1) * limit + index + 1}
                            row={debitNote}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(debitNote.id)}
                                    onChange={(checked) => handleRowSelect(debitNote.id, checked)}
                                    name={`select-debit-note-${debitNote.id}`}
                                />,
                                <a href={`/admin/debit-notes/view/${debitNote.id}`} className="text-indigo-600 cursor-pointer hover:underline">{debitNote.debitNoteId}</a>,
                                debitNote.purchase?.purchaseId || "",
                                debitNote.purchase?.supplierBillNumber || "-",
                                formatDate(debitNote.debitNoteDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                                <SupplierProfileCard
                                    imageUrl={debitNote.vendor?.profileImage}
                                    name={debitNote.vendor.name}
                                />,
                                format(debitNote.totalAmount),
                                formatDate(debitNote.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                                <StatusBadge status={debitNote.status} />,
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        />
                    ))}

                    {!isLoading && debitNotes.length === 0 && (
                        <tr>
                            <td colSpan={11} className="text-center py-4 text-gray-950  font-semibold">
                                No debit notes found
                            </td>
                        </tr>
                    )}

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950  font-semibold" colSpan={11}>
                                <LoaderSpinner />
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

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


            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message="Are you sure you want to delete this debit note?"
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} debit note(s)?`}
            >
            </DeleteConfirmationModal>
        </div>
    );
}

export default DebitNoteList;
