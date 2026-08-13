import { useEffect, useState, type FC } from 'react';
import { CirclePlusIcon, Eye, Trash2Icon, Printer } from 'lucide-react';
import Table from '@components/admin/Table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import TableRow from '@components/admin/TableRow';
import { toast } from 'react-toastify';
import PaginationWrapper from '@components/admin/PaginationWrapper';
import PaymentFormModal from '@pages/admin/purchases/PaymentFormModal';
import PaymentModeBadge from '@components/admin/PaymentModeBadge';
import DeleteConfirmationModal from '@components/admin/DeleteConfirmationModal';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import { hasPermission } from '@utils/hasPermission';
import type { PermissionAction } from '@models/permissions';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import useDateFormatter from '@hooks/useDateFormatter';
import type { Pagination } from '@models/common';
import SupplierProfileCard from '@components/SupplierProfileImage';
import CustomCheckbox from '@components/admin/CustomCheckbox';
import { useDebouncedSearchParam } from '@hooks/useDebouncedSearchParam';

// --- INTERFACES ---

interface SupplierPayment {
    id: string;
    paymentId: string;
    paymentDate: any;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    notes: string;
    supplier: {
        id: string;
        name: string;
        email: string;
        phone: string;
        profileImage: string;
    };
    purchase: {
        id: string;
        purchaseId: string;
        supplierBillNumber?: string | null;
        totalAmount: number;
        purchaseDate: string;
    };
    paymentMode: string;
    attachment: string | null;
}

const SupplierPayments: FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const navigate = useNavigate();
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    // State for data and lists
    const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });

    // State for modals and editing
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<SupplierPayment | null>(null);

    // Search and pagination params from URL
    const [searchParams, setSearchParams] = useSearchParams();
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [isAllSelected, setIsAllSelected] = useState<boolean>(false);

    useEffect(() => {
        fetchSupplierPayments(search, limit, page);
    }, [search, limit, page, token]);

    const fetchSupplierPayments = async (search?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_SUPPLIER_PAYMENTS_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSupplierPayments(response.data.data.payments ?? []);
            setPagination(response.data.data.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 });
        } catch (error) {
            console.error('Error fetching supplier payments:', error);
            toast.error('Failed to fetch supplier payments.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewPaymentClick = () => {
        setIsPaymentModalOpen(true);
    };

    const handleDeleteClick = (item: SupplierPayment) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const handlePaymentConfirm = () => {
        setIsPaymentModalOpen(false);
        fetchSupplierPayments(search, limit, page);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_SUPPLIER_PAYMENT_URL}/${itemToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Payment deleted successfully');
            await fetchSupplierPayments(search, limit, page);
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete payment:', error);
            toast.error('Failed to delete payment.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_SUPPLIER_PAYMENT_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} payment(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} payment(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchSupplierPayments(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const tableActions = [
        {
            label: 'View',
            icon: <Eye size={14} />,
            onClick: (item: SupplierPayment) => { navigate(`/admin/supplier-payments/view/${item.id}`); }
        },
        {
            label: 'Print Bill',
            icon: <Printer size={14} />,
            onClick: (item: SupplierPayment) => {
                navigate(`/admin/supplier-payments/view/${item.id}?print=true`);
            }
        },
        { label: 'Delete', icon: <Trash2Icon size={14} />, onClick: handleDeleteClick }
    ];

    const tableHeaders = ["#", "Supplier", "Payment ID", "Purchase ID", "Supplier Bill No", "Payment Date", "Amount", "Payment Mode", "Action"];
    const restrictedActions = ['delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionLabel = action.label.toLowerCase() as PermissionAction;
        if (!restrictedActions.includes(actionLabel)) {
            return true;
        }
        return hasPermission(permissions, 'supplier-payments', actionLabel);
    });

    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }
    const handleSearch = (keyword: string) => setSearchInput(keyword);
    const handlePageLengthChange = (newLimit: number) => setSearchParams({ search, limit: String(newLimit), page: '1' });
    const handlePageChange = (newPage: number) => setSearchParams({ search, limit: String(limit), page: String(newPage) });

    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? supplierPayments.map((payment) => payment.id) : []);
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

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Supplier Payments</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'supplier-payments', 'delete') && (
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
                    {hasPermission(permissions, 'supplier-payments', 'create') && (
                        <button
                            onClick={handleNewPaymentClick}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <CirclePlusIcon size={14} /> New Payment
                        </button>
                    )}
                </div>
            </div>

            {/* Search and Filter Section */}
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
                            disabled={supplierPayments.length === 0}
                            name="select-all-supplier-payments"
                        />,
                        "Supplier",
                        "Payment ID",
                        "Purchase ID",
                        "Supplier Bill No",
                        "Payment Date",
                        "Amount",
                        "Payment Mode",
                        "Action",
                    ]}
                >
                    {!isLoading && supplierPayments.map((payment, index) => (
                        <TableRow
                            key={payment.id}
                            index={from + index}
                            row={payment}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(payment.id)}
                                    onChange={(checked) => handleRowSelect(payment.id, checked)}
                                    name={`select-supplier-payment-${payment.id}`}
                                />,
                                <SupplierProfileCard
                                    imageUrl={payment?.supplier?.profileImage}
                                    name={payment?.supplier?.name ?? ""}
                                />,
                                <a href={`/admin/supplier-payments/view/${payment.id}`} className='text-indigo-600 cursor-pointer hover:underline'>{payment.paymentId}</a>,
                                payment.purchase?.purchaseId ?? '-',
                                payment.purchase?.supplierBillNumber || '-',
                                formatDate(payment.paymentDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                                format(payment.paidAmount),
                                <PaymentModeBadge mode={payment.paymentMode} />,
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        />
                    ))}
                    {!isLoading && supplierPayments.length === 0 && (
                        <tr><td colSpan={10} className="text-center py-4 text-gray-950  font-semibold">No supplier payments found</td></tr>
                    )}

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950  font-semibold" colSpan={10}>
                                <LoaderSpinner />
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

            <PaginationWrapper count={pagination.totalPages} page={page} from={from} to={to} total={pagination.total} onChange={(_, newPage) => handlePageChange(newPage)} />

            {/* Modals */}
            {isPaymentModalOpen && (
                <PaymentFormModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onConfirm={handlePaymentConfirm}
                />
            )}

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message="Are you sure you want to delete the payment?"
            >

            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} payment(s)?`}
            >

            </DeleteConfirmationModal>
        </div>
    );
};

export default SupplierPayments;
