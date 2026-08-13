import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import PaymentModeBadge from "@components/admin/PaymentModeBadge";
import SupplierProfileCard from "@components/SupplierProfileImage";
import { Eye, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface MonthlyExpense {
    _id: string;
    expenseCategory: string | { _id: string; title: string };
    amount: number;
    expenseDate: string;
    description: string;
    paymentMode: string;
    paymentDate?: string | null;
    paymentDueDate?: string | null;
    customFields?: { key: string; value: string }[];
    purchase?: {
        purchaseId?: string | null;
        supplierName?: string | null;
        supplierBillNumber?: string | null;
        supplierImage?: string | null;
        supplierEmail?: string | null;
    } | null;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const PurchaseExpenses: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, pages: 1 });
    const [isLoading, setIsLoading] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const search = searchParams.get("search") || "";
    const purchaseIdFilter = searchParams.get("purchaseId") || "";
    const paymentMode = searchParams.get("paymentMode") || "";
    const limit = Number(searchParams.get("limit") || 10);
    const page = Number(searchParams.get("page") || 1);

    const effectiveSearch = useMemo(() => {
        return purchaseIdFilter || search;
    }, [purchaseIdFilter, search]);

    useEffect(() => {
        if (token) {
            fetchExpenses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, effectiveSearch, paymentMode, limit, page]);

    const fetchExpenses = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_MONTHLY_EXPENSES_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    page,
                    limit,
                    search: effectiveSearch,
                    paymentMode: paymentMode || undefined,
                    sourceType: "PURCHASE",
                },
            });

            setExpenses(response.data.data || []);
            setPagination(response.data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
        } catch (error) {
            console.error("Error fetching purchase expenses:", error);
            toast.error("Failed to fetch purchase expenses.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchParams({
            search: value,
            paymentMode,
            limit: String(limit),
            page: "1",
        });
    };

    const handlePaymentModeChange = (value: string) => {
        setSearchParams({
            search,
            paymentMode: value,
            limit: String(limit),
            page: "1",
        });
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({
            search,
            paymentMode,
            limit: String(newLimit),
            page: "1",
        });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({
            search,
            paymentMode,
            limit: String(limit),
            page: String(newPage),
        });
    };

    const resolvePurchaseId = (expense: MonthlyExpense) => {
        if (expense.purchase?.purchaseId) {
            return expense.purchase.purchaseId;
        }
        if (typeof expense.expenseCategory === "object" && expense.expenseCategory?.title) {
            return expense.expenseCategory.title;
        }
        const field = expense.customFields?.find((f) => f.key.toLowerCase() === "purchase id");
        return field?.value || "N/A";
    };

    const resolveSupplierName = (expense: MonthlyExpense) => expense.purchase?.supplierName || "N/A";
    const resolveSupplierBillNumber = (expense: MonthlyExpense) => expense.purchase?.supplierBillNumber || "N/A";

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950">Purchases Expenses</h1>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by Purchase ID..."
                            value={effectiveSearch}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    </div>
                </div>
                <div className="w-full md:w-52">
                    <select
                        value={paymentMode}
                        onChange={(e) => handlePaymentModeChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                        <option value="">All Payment Modes</option>
                        <option value="Cash">Cash</option>
                        <option value="Online">Online</option>
                        <option value="Cheque">Cheque</option>
                        <option value="RTGS/NEFT">RTGS/NEFT</option>
                    </select>
                </div>
                <div className="w-full md:w-auto">
                    <select
                        value={limit}
                        onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                        className="w-full md:w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                    </select>
                </div>
            </div>

            <div className="w-full overflow-x-auto">
                <Table headers={["#", "Purchase ID", "Supplier", "Supplier Bill No", "Expense Date", "Amount", "Payment Mode", "Actions"]}>
                    {!isLoading && expenses.length === 0 && (
                        <tr>
                            <td colSpan={8} className="text-center py-4 text-gray-500">
                                No purchase expenses found
                            </td>
                        </tr>
                    )}
                    {!isLoading &&
                        expenses.map((expense, index) => (
                            <TableRow
                                key={expense._id}
                                index={(page - 1) * limit + index + 1}
                                row={expense}
                                columns={[
                                    resolvePurchaseId(expense),
                                    <SupplierProfileCard
                                        imageUrl={expense.purchase?.supplierImage}
                                        name={resolveSupplierName(expense)}
                                    />,
                                    resolveSupplierBillNumber(expense),
                                    new Date(expense.expenseDate).toLocaleDateString(),
                                    `₹${Number(expense.amount || 0).toFixed(2)}`,
                                    <PaymentModeBadge mode={expense.paymentMode || "N/A"} />,
                                ]}
                                actions={[
                                    {
                                        label: "View",
                                        icon: <Eye size={16} className="mr-2" />,
                                        onClick: () => navigate(`/admin/purchase-expenses/view/${expense._id}`),
                                    },
                                ]}
                            />
                        ))}
                    {isLoading && (
                        <tr>
                            <td colSpan={8} className="text-center py-4 text-gray-500">
                                Loading...
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

            <PaginationWrapper
                count={pagination.pages}
                page={page}
                total={pagination.total}
                from={from}
                to={to}
                onChange={(_, newPage) => handlePageChange(newPage)}
            />
        </div>
    );
};

export default PurchaseExpenses;
