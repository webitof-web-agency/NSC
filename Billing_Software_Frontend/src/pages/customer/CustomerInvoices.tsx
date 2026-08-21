import { useEffect, useState } from "react";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { useDebounce } from "@hooks/useDebounce";
import { Search, FileText } from "lucide-react";
import CustomerInvoiceAccordion from "@components/customer/CustomerInvoiceAccordion";

interface InvoiceRow {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    status: string;
    payment_method: string;
    TotalAmount: number;
    totalPaid: number;
    balanceAmount: number;
}

const CustomerInvoices: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.customerAuth);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 500);
    const [rows, setRows] = useState<InvoiceRow[]>([]);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                setLoading(true);
                const response = await axios.get(Constants.CUSTOMER_PORTAL_INVOICES_URL, {
                    params: { search: debouncedSearch, limit: 100 },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRows(response.data.data.invoices || []);
            } catch (error) {
                console.error("Error fetching customer invoices:", error);
            } finally {
                setLoading(false);
            }
        };
        if (!token) return;
        fetchInvoices();
    }, [debouncedSearch, token]);

    return (
        <div className="space-y-4">

            {/* Page header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Tap an invoice to view or save it without leaving this page.</p>
                </div>
                {/* Search */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search invoice..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:border-[#A43275] transition"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                        <LoaderSpinner />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-14 text-center">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No invoices found.</p>
                    </div>
                ) : (
                    <CustomerInvoiceAccordion
                        invoices={rows.map((invoice) => ({
                            id: invoice.id,
                            invoiceNumber: invoice.invoiceNumber,
                            invoiceDate: invoice.invoiceDate,
                            dueDate: invoice.dueDate,
                            status: invoice.status,
                            totalAmount: invoice.TotalAmount,
                            totalPaid: invoice.totalPaid,
                            balanceAmount: invoice.balanceAmount,
                            paymentMethod: invoice.payment_method,
                        }))}
                    />
                )}
            </div>
        </div>
    );
};

export default CustomerInvoices;
