import type { RootState } from "@store/index";
import { hasPermission } from "@utils/hasPermission";
import { CirclePlusIcon, Edit, Link, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import ExpenseFormModal from "./ExpenseFormModal";
import Constants from "@constants/api";
import axios from "axios";
import type { ExpenseListShape } from "@models/expense";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import type { PermissionAction } from "@models/permissions";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { toast } from "react-toastify";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import InvoiceStatusBadge from "@components/admin/InvoiceStatusBadge";

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
interface ExpenseResponse {
    success: boolean;
    message: string;
    data: {
        expenses: ExpenseListShape[]
        pagination: Pagination
    }
}
interface FilterParams {
    search?: string;
    limit?: number;
    page?: number;
}
const ExpenseList: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenses, setExpenses] = useState<ExpenseListShape[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [filterParams, setFilterParams] = useState<FilterParams>({});
    const { search = '', limit = 10, page = 1 } = filterParams;
    const [isLoading, setIsLoading] = useState(false);
    const [itemToEdit, setEditingItem] = useState<ExpenseListShape | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteItem, setDeletingItem] = useState<ExpenseListShape | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchExpenses();
    }, [filterParams]);

    const fetchExpenses = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get<ExpenseResponse>(Constants.FETCH_EXPENSES_FOR_LIST_URL, {
                params: filterParams,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data.success && response.data.data.expenses) {
                setExpenses(response.data.data.expenses);
                setPagination(response.data.data.pagination);
            }
        } catch (error) {

        } finally {
            setIsLoading(false);
        }
    }
    const handleCreateClick = () => {
        setIsModalOpen(true);
        setEditingItem(null);
    };

    const handleSuccess = () => {
        setIsModalOpen(false);
        fetchExpenses();
    }

    const handleFilterChange = (key: string, value: string | number) => {
        setFilterParams({ ...filterParams, [key]: value });
    }

    const handleEditClick = (item: ExpenseListShape) => {
        setEditingItem({ ...item });
        setIsModalOpen(true);
    }

    const handleDeleteClick = (item: ExpenseListShape) => {
        setDeletingItem({ ...item });
        setDeleteModalOpen(true);
    }

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            const response = await axios.delete(`${Constants.DELETE_EXPENSE_URL}/${deleteItem?.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data.success) {
                toast.success(response.data.message);
                setDeleteModalOpen(false);
                fetchExpenses();
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setIsDeleting(false);
        }
    }
    const handleAttachmentClick = (item: ExpenseListShape) => {
        if (item.attachment) {
            window.open(item.attachment, '_blank');
        } else {
            toast.error('No attachment found');
        }
    }
    const tableActions = [
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: ExpenseListShape) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: ExpenseListShape) => { handleDeleteClick(item) }
        },
        {
            label: 'View Attachment',
            icon: <Link size={14} />,
            onClick: (item: ExpenseListShape) => { handleAttachmentClick(item) }
        }
    ];
    const tableHeaders = ['#', 'Expense ID', 'Amount', 'Expense Date', 'Payment Status', 'Created On', 'Actions'];
    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        let actionaLabel = action.label.toLowerCase();
        if (restrictedActions.includes(actionaLabel)) {
            const actionKey = actionaLabel.toLowerCase() as PermissionAction;
            return hasPermission(permissions, 'expenses', actionKey);
        }
        return true;
    });

    if (allowedActions.length === 0) tableHeaders.pop();

    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-950 ">Expenses</h1>
                {hasPermission(permissions, 'expenses', 'create') &&
                    <button
                        onClick={() => { handleCreateClick(); }}
                        className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                        <CirclePlusIcon size={14} /> New Expense
                    </button>
                }
            </div>

            {/* Search Input & PageLength */}
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>

            <Table headers={tableHeaders}>
                {!isLoading && expenses && expenses.map((expense, index) => (
                    <TableRow
                        key={expense.id}
                        row={expense}
                        index={index + 1}
                        columns={[
                            <span className="text-indigo-600">{expense.expenseId}</span>,
                            format(expense.amount),
                            formatDate(expense.expenseDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                            <InvoiceStatusBadge status={expense.paymentStatus} />,
                            formatDate(expense.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                        ]}
                        actions={allowedActions && allowedActions.length > 0 ? allowedActions : undefined}
                    />
                ))}

                {!isLoading && expenses && expenses.length === 0 && (
                    <tr>
                        <td colSpan={8} className="text-center text-gray-800  py-2 font-semibold">No Records Found</td>
                    </tr>
                )}

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={8}>
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
                onChange={(_, newPage) => handleFilterChange('page', newPage)}
                paginationVariant="outlined"
                paginationShape="rounded"
            />

            {isModalOpen &&
                <ExpenseFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => handleSuccess()}
                    editItem={itemToEdit || undefined}
                />
            }

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Expense"
                message="Are you sure you want to delete this expense?"
                isDeleting={isDeleting}
            ></DeleteConfirmationModal>
        </div>
    );
};

export default ExpenseList;
