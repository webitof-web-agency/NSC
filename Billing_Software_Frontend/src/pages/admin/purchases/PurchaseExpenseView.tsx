import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import Constants from "@constants/api";
import { toast } from "react-toastify";

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
    createdBy?: { _id: string; firstName: string; lastName: string };
    purchase?: {
        purchaseId?: string | null;
        supplierName?: string | null;
        supplierBillNumber?: string | null;
    } | null;
}

const PurchaseExpenseView: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const [expense, setExpense] = useState<MonthlyExpense | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (token && id) {
            fetchExpense();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, id]);

    const fetchExpense = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${Constants.GET_MONTHLY_EXPENSE_BY_ID_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setExpense(response.data.data || null);
        } catch (error) {
            console.error("Failed to fetch expense:", error);
            toast.error("Failed to load purchase expense.");
        } finally {
            setIsLoading(false);
        }
    };

    const resolvePurchaseId = () => {
        if (!expense) return "N/A";
        if (expense.purchase?.purchaseId) return expense.purchase.purchaseId;
        if (typeof expense.expenseCategory === "object" && expense.expenseCategory?.title) {
            return expense.expenseCategory.title;
        }
        const field = expense.customFields?.find((f) => f.key.toLowerCase() === "purchase id");
        return field?.value || "N/A";
    };

    const resolveSupplierName = () => expense?.purchase?.supplierName || "N/A";
    const resolveSupplierBillNumber = () => expense?.purchase?.supplierBillNumber || "N/A";

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-950">Purchase Expense</h1>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Back
                </button>
            </div>

            {isLoading && (
                <div className="text-center py-6 text-gray-500">Loading...</div>
            )}

            {!isLoading && expense && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Purchase ID</p>
                            <p className="text-base font-semibold text-gray-950">{resolvePurchaseId()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Amount</p>
                            <p className="text-base font-semibold text-gray-950">₹{Number(expense.amount || 0).toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Supplier</p>
                            <p className="text-base font-semibold text-gray-950">{resolveSupplierName()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Supplier Bill No</p>
                            <p className="text-base font-semibold text-gray-950">{resolveSupplierBillNumber()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Expense Date</p>
                            <p className="text-base font-semibold text-gray-950">
                                {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : "N/A"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Payment Mode</p>
                            <p className="text-base font-semibold text-gray-950">{expense.paymentMode || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Payment Date</p>
                            <p className="text-base font-semibold text-gray-950">
                                {expense.paymentDate ? new Date(expense.paymentDate).toLocaleDateString() : "N/A"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Payment Due Date</p>
                            <p className="text-base font-semibold text-gray-950">
                                {expense.paymentDueDate ? new Date(expense.paymentDueDate).toLocaleDateString() : "N/A"}
                            </p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-sm text-gray-500">Description</p>
                            <p className="text-base font-semibold text-gray-950">{expense.description || "-"}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-sm text-gray-500">Created By</p>
                            <p className="text-base font-semibold text-gray-950">
                                {expense.createdBy ? `${expense.createdBy.firstName} ${expense.createdBy.lastName}` : "N/A"}
                            </p>
                        </div>
                    </div>

                    {expense.customFields && expense.customFields.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2">Custom Fields</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {expense.customFields.map((field, idx) => (
                                    <div key={`${field.key}-${idx}`} className="border border-gray-200 rounded-md p-3">
                                        <p className="text-xs text-gray-500">{field.key}</p>
                                        <p className="text-sm font-medium text-gray-950">{field.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PurchaseExpenseView;
