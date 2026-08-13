import { useEffect, useState, type FC } from "react";
import { CirclePlusIcon, Edit, EyeIcon, Trash2Icon, Upload, Download, Printer } from "lucide-react";
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
import { hasPermission } from "@utils/hasPermission";
import type { PermissionAction } from "@models/permissions";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import useDateFormatter from "@hooks/useDateFormatter";
import SupplierProfileCard from "@components/SupplierProfileImage";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface Purchase {
    id: string;
    purchaseId: string;
    supplier_bill_number?: string | null;
    purchaseDate: string;
    billFrom: string;
    billTo?: {
        id: string;
        name: string;
        email: string;
        phone: string;
        profileImage: string;
    };
    totalAmount: number;

    paymentMode?: {
        id: string;
        name: string;
        slug: string;
        status: boolean;
    } | null;

    status: string;
    createdAt: string;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const PurchaseList: FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const navigate = useNavigate();

    // State for the list of purchases and pagination
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });

    // State for the delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<Purchase | null>(null);

    // Using URL search parameters to manage state for search, limit, and page
    const [searchParams, setSearchParams] = useSearchParams();
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({
        search,
        limit,
        setSearchParams,
        extraParams: { status }
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isAllSelected, setIsAllSelected] = useState(false);
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    // Handlers for updating URL search parameters
    const handleSearch = (keyword: string) => {
        setSearchInput(keyword);
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ search, status, limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ search, status, limit: String(limit), page: String(newPage) });
    };

    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? purchases.map((purchase) => purchase.id) : []);
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
    const handleNewPurchaseClick = () => {
        navigate("/admin/purchases/new");
    };


    // Handler to export purchases
    const handleExport = async () => {
        try {
            setIsExporting(true);
            const response = await axios.get(Constants.EXPORT_PURCHASE_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob', // Important for file handling
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `purchases-export-${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            toast.success('Purchases exported successfully');
        } catch (error) {
            console.error('Error exporting purchases:', error);
            toast.error('Failed to export purchases.');
        } finally {
            setIsExporting(false);
        }
    };

    // Fetch purchases whenever search, limit, or page changes
    useEffect(() => {
        fetchPurchases(search, status, limit, page);
    }, [search, status, limit, page, token]);

    const fetchPurchases = async (search?: string, status?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_PURCHASE_URL, {
                params: { search, limit, page, status: status !== 'all' ? status : undefined },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setPurchases(response.data.data?.purchases ?? []);
            setPagination(response.data.data.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 });
        } catch (error) {
            console.error('Error fetching purchases:', error);
            toast.error('Failed to fetch purchases.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (item: Purchase) => {
        navigate(`/admin/purchases/edit/${item.id}`);
    };

    const handleDeleteClick = (item: Purchase) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_PURCHASE_URL}/${itemToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Purchase deleted successfully');
            fetchPurchases(search, status, limit, page);
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete purchase:', error);
            toast.error('Failed to delete purchase.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_PURCHASE_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} purchase(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} purchase(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchPurchases(search, status, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleViewClick = (item: Purchase) => {
        navigate(`/admin/purchases/view/${item.id}`);
    }

    const handleViewExpense = async (item: Purchase) => {
        try {
            const response = await axios.get(Constants.GET_MONTHLY_EXPENSES_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    search: item.purchaseId,
                    sourceType: "PURCHASE",
                    limit: 1,
                    page: 1,
                },
            });
            const expense = response.data?.data?.[0];
            if (expense?._id) {
                navigate(`/admin/purchase-expenses/view/${expense._id}`);
                return;
            }
            navigate(`/admin/purchase-expenses?purchaseId=${encodeURIComponent(item.purchaseId)}`);
        } catch (error) {
            console.error("Failed to fetch purchase expense:", error);
            toast.error("No purchase expense found yet.");
            navigate(`/admin/purchase-expenses?purchaseId=${encodeURIComponent(item.purchaseId)}`);
        }
    };
    const getTableActions = (item: Purchase) => {
        const actions = [
            {
                label: 'Edit',
                icon: <Edit size={14} />,
                onClick: (item: Purchase) => { handleEditClick(item) },
                hideWhen: []
            },
            {
                label: 'View',
                icon: <EyeIcon size={14} />,
                onClick: (item: Purchase) => { handleViewClick(item) },
                hideWhen: []
            },
            {
                label: 'Print Bill',
                icon: <Printer size={14} />,
                onClick: (item: Purchase) => {
                    navigate(`/admin/purchases/view/${item.id}?print=true`);
                },
                hideWhen: []
            },
            {
                label: 'View Expense',
                icon: <EyeIcon size={14} />,
                onClick: (item: Purchase) => { handleViewExpense(item) },
                hideWhen: []
            },
            {
                label: 'Delete',
                icon: <Trash2Icon size={14} />,
                onClick: (item: Purchase) => { handleDeleteClick(item) },
                // hideWhen: ['paid', 'partially_paid', 'completed']
            }
        ]

        return actions.filter((action) => {
            const actionLabel = action.label.toLowerCase();

            //Hide if status matches
            if (action.hideWhen?.includes(item.status)) {
                return false;
            }

            //If restricted action, check permission
            if (restrictedActions.includes(actionLabel)) {
                const permissionAction: PermissionAction =
                    actionLabel === 'delete' ? 'delete' : 'edit';
                return hasPermission(permissions, 'purchase-list', permissionAction);
            }

            //Otherwise always allow
            return true;
        });
    }

    const tableHeaders = ["#", "Purchase Number", "Supplier Bill No", "Purchase Date", "Supplier", "Amount", "Payment Mode", "Due Date", "Status", "Action"];
    const restrictedActions = ['edit', 'delete'];
    const statusTabs = [
        { label: "All", value: "all" },
        { label: "Paid", value: "paid" },
        { label: "Partially Paid", value: "partially_paid" },
        { label: "Unpaid / Payment Due", value: "pending" },
    ];

    const handleStatusChange = (value: string) => {
        setSearchParams({ search, status: value, limit: String(limit), page: '1' });
    };

    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Purchases</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'purchase-list', 'delete') && (
                        <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            disabled={selectedIds.length === 0}
                            className={`px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                                }`}
                        >
                            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                    )}
                    {hasPermission(permissions, 'purchase-list', 'create') &&
                        <>
                            <button
                                onClick={handleExport}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                                {isExporting ? <LoaderSpinner size={14} /> : <Download size={14} />} Export Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                            </button>
                            <button
                                onClick={() => navigate("/admin/purchases/bulk-import")}
                                className="border border-gray-100 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                                <Upload size={14} /> Upload Excel
                            </button>
                            <button
                                onClick={handleNewPurchaseClick}
                                className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                                <CirclePlusIcon size={14} /> New Purchase
                            </button>
                        </>
                    }
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {statusTabs.map(tab => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => handleStatusChange(tab.value)}
                        className={`px-3 py-1 text-sm font-medium rounded-md border ${status === tab.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search Input & PageLength */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
                            disabled={purchases.length === 0}
                            name="select-all-purchases"
                        />,
                        "Purchase Number",
                        "Supplier Bill No",
                        "Purchase Date",
                        "Supplier",
                        "Amount",
                        "Payment Mode",
                        "Due Date",
                        "Status",
                        "Action",
                    ]}
                >
                    {!isLoading && purchases && purchases.map((purchase, index) => (
                        <TableRow
                            key={purchase.id}
                            index={(page - 1) * limit + index + 1}
                            row={purchase}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(purchase.id)}
                                    onChange={(checked) => handleRowSelect(purchase.id, checked)}
                                    name={`select-purchase-${purchase.id}`}
                                />,
                                <button
                                    type="button"
                                    onClick={() => handleViewClick(purchase)}
                                    className="text-indigo-600 hover:underline"
                                >
                                    {purchase.purchaseId}
                                </button>,
                                purchase.supplier_bill_number || "-",
                                formatDate(purchase.purchaseDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                                <SupplierProfileCard
                                    imageUrl={purchase.billTo?.profileImage}
                                    name={purchase.billTo?.name || 'UNKNOWN SUPPLIER'}
                                />,
                                format(purchase.totalAmount),
                                <PaymentModeBadge mode={purchase.paymentMode?.slug || purchase.paymentMode?.name || 'cash'} />,
                                (() => {
                                    if (!purchase.dueDate) return "N/A";
                                    const diffTime = new Date(purchase.dueDate).getTime() - new Date().getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const isOverdue = diffDays < 0;
                                    const daysText = isOverdue ? `${Math.abs(diffDays)} days overdue` : diffDays === 0 ? "Due today" : `${diffDays} days left`;

                                    return (
                                        <div className="flex flex-col">
                                            <span>{formatDate(purchase.dueDate, systemSettings?.dateFormat.format || 'd-m-Y')}</span>
                                            {purchase.status !== 'paid' && (
                                                <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-orange-500'}`}>
                                                    {daysText}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })(),
                                <StatusBadge status={purchase.status} />,
                            ]}
                            actions={getTableActions(purchase)}
                        />
                    ))}

                    {!isLoading && purchases.length === 0 && (
                        <tr>
                            <td colSpan={11} className="text-center py-4 text-gray-950  font-semibold">
                                No purchases found
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
                message={`Are you sure you want to delete the purchase ${itemToDelete?.purchaseId}?`}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} purchase(s)?`}
            >
            </DeleteConfirmationModal>
        </div>
    );
}

export default PurchaseList;
