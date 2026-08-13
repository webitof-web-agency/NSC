import { CirclePlusIcon, Edit, Trash2Icon, Upload, Download, LayoutDashboard } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Table from "@components/admin/Table";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import { hasPermission } from "@utils/hasPermission";
import type { PermissionAction } from "@models/permissions";
import useDateFormatter from "@hooks/useDateFormatter";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import ProfileCard from "@components/admin/ProfileImage";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import NoRecords from "@components/admin/NoRecords";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@store/index";
import { setCustomerSession } from "@store/customerAuthSlice";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface CustomerList {
    id: number;
    name: string;
    email: string;
    phone: string;
    totalInvoiceCount: number;
    balanceAmount: number;
    createdAt: string;
}

const CustomerList: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [customers, setCustomers] = useState<CustomerList[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [deleteItem, setDeleteItem] = useState<CustomerList | null>(null);
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const { formatDate } = useDateFormatter();
    const { format } = useCurrencyFormatter();
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isAllSelected, setIsAllSelected] = useState(false);
    const dispatch: AppDispatch = useDispatch();
    const handleCreateClick = () => {
        navigate('/admin/customers/new');
    };

    const handleExportClick = async () => {
        try {
            const response = await axios.get(Constants.EXPORT_CUSTOMERS_EXCEL_URL, {
                params: selectedIds.length > 0 ? { ids: selectedIds.join(',') } : { search },
                responseType: 'blob',
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `Customers_Export_${today}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Customers exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export customers');
        }
    };

    const tableActions = [
        {
            label: 'User Dashboard',
            icon: <LayoutDashboard size={14} />,
            onClick: (item: CustomerList) => { handleOpenUserDashboard(item) }
        },
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: CustomerList) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: CustomerList) => { handleDeleteClick(item) }
        }
    ];

    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionLabel = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionLabel)) {
            return true;
        }

        return hasPermission(permissions, 'customers', actionLabel);
    });
    useEffect(() => {
        fetchCustomers(search, limit, page);
    }, [search, limit, page]);

    const fetchCustomers = async (search?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_CUSTOMERS_FOR_LIST_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setCustomers(response.data.data.customers || []);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to fetch customers.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (item: CustomerList) => {
        navigate(`/admin/customers/edit/${item.id}`);
    }
    const handleOpenUserDashboard = async (item: CustomerList) => {
        try {
            const response = await axios.post(`${Constants.ADMIN_CUSTOMER_PORTAL_ACCESS_URL}/${item.id}/portal-access`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            dispatch(setCustomerSession({
                token: response.data.token,
                customer: response.data.customer
            }));
            navigate("/customer/dashboard");
        } catch (error) {
            console.error("Error opening customer dashboard:", error);
            toast.error("Failed to open customer dashboard");
        }
    };
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
        setSelectedIds(checked ? customers.map((customer) => customer.id) : []);
        setIsAllSelected(checked);
    };
    const handleRowSelect = (id: number, checked: boolean) => {
        if (isAllSelected) {
            setIsAllSelected(false);
        }
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };

    const handleDeleteClick = async (item: CustomerList) => {
        setDeleteItem(item);
        setDeleteModalOpen(true);
    }

    const handleConfirmDelete = async () => {
        if (deleteItem) {
            try {
                setIsDeleting(true);
                await axios.delete(`${Constants.DELETE_CUSTOMER_URL}/${deleteItem.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success("Customer deleted successfully.");
                fetchCustomers(search, limit, page);
                setDeleteModalOpen(false);
            } catch (error) {
                console.error("Error deleting customer:", error);
                toast.error("Failed to delete customer.");
            } finally {
                setIsDeleting(false);
            }
        }
    }

    const handleConfirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_CUSTOMER_URL, {
                ids: selectedIds
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} customer(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} customer(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchCustomers(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };
    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 ">Customer</h1>
                {(hasPermission(permissions, 'customers', 'create') || hasPermission(permissions, 'customers', 'delete')) &&
                    <div className="flex flex-wrap gap-2">
                        {hasPermission(permissions, 'customers', 'delete') && (
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
                        {hasPermission(permissions, 'customers', 'create') && (
                        <button
                            onClick={handleExportClick}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <Download size={14} /> Export Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                        )}
                        {hasPermission(permissions, 'customers', 'create') && (
                        <button
                            onClick={() => navigate('/admin/customers/bulk-import')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <Upload size={14} /> Upload Excel
                        </button>
                        )}
                        {hasPermission(permissions, 'customers', 'create') && (
                        <button
                            onClick={() => { handleCreateClick(); }}
                            className="bg-primary hover:bg-primary text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <CirclePlusIcon size={14} /> New Customer
                        </button>
                        )}
                    </div>
                }
            </div>
            {/* Search Input & PageLength */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-800  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-800  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-800 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>
            {/* Table */}
            <div className="w-full overflow-x-auto">
                <Table
                    headers={[
                        "#",
                        <CustomCheckbox
                            checked={allSelected}
                            onChange={handleToggleSelectAll}
                            disabled={customers.length === 0}
                            name="select-all-customers"
                        />,
                        "Customer Phone",
                        "Balance",
                        "Total Invoice",
                        "Created On",
                        "Status",
                        ...(allowedActions.length > 0 ? ["Actions"] : [])
                    ]}
                >
                    {!isLoading && customers && customers.map((customer: any, index: number) => (
                        <TableRow
                            key={customer.id}
                            index={index + 1}
                            row={customer}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(customer.id)}
                                    onChange={(checked) => handleRowSelect(customer.id, checked)}
                                    name={`select-customer-${customer.id}`}
                                />,
                                <ProfileCard
                                    phone={customer.phone}
                                />,
                                format(customer.balanceAmount || 0),
                                customer.totalInvoiceCount || 0,
                                formatDate(customer.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                                customer.status
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        >

                        </TableRow>
                    ))}
                    {!isLoading && !customers.length &&
                        <NoRecords colSpan={allowedActions.length > 0 ? 8 : 7} message="No customers found" />
                    }

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-1 text-gray-950  font-semibold" colSpan={allowedActions.length > 0 ? 8 : 7}>
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
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
                title="Delete Customer"
                message="Are you sure you want to delete this customer? This action cannot be undone."
            />
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={handleConfirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Delete Customers"
                message={`Are you sure you want to delete ${selectedIds.length} customer(s)? This action cannot be undone.`}
            />
        </div>
    );
}

export default CustomerList;
