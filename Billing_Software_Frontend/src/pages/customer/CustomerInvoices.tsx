import { useEffect, useState } from "react";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import { useDebounce } from "@hooks/useDebounce";
import useDateFormatter from "@hooks/useDateFormatter";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, FileText } from "lucide-react";

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

const statusMeta = (status: string) => {
    switch (status?.toUpperCase()) {
        case "PAID":    return { label: "Paid",    cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
        case "PARTIAL": return { label: "Partial", cls: "bg-amber-100 text-amber-700",    dot: "bg-amber-500"   };
        default:        return { label: "Unpaid",  cls: "bg-red-100 text-red-700",        dot: "bg-red-500"     };
    }
};

const CustomerInvoices: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.customerAuth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    const navigate = useNavigate();
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
                    <p className="text-sm text-gray-500 mt-0.5">Browse and download your invoice history.</p>
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
                    <>
                        {/* Mobile: card list */}
                        <div className="lg:hidden divide-y divide-gray-100">
                            {rows.map(inv => {
                                const s = statusMeta(inv.status);
                                return (
                                    <div
                                        key={inv.id}
                                        onClick={() => navigate(`/customer/invoices/${inv.id}`)}
                                        className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 cursor-pointer"
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${s.dot}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-900 truncate">{inv.invoiceNumber}</span>
                                                <span className="text-sm font-semibold text-gray-800 flex-shrink-0">{format(inv.TotalAmount)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1 gap-2">
                                                <span className="text-[11px] text-gray-400">
                                                    {formatDate(inv.invoiceDate, systemSettings?.dateFormat?.format || "d-m-Y")}
                                                    {inv.payment_method ? ` · ${inv.payment_method}` : ""}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                                            </div>
                                            {inv.balanceAmount > 0 && (
                                                <p className="text-[11px] text-red-500 mt-0.5">
                                                    Balance due: {format(inv.balanceAmount)}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {["Invoice", "Date", "Amount", "Paid", "Balance", "Payment", "Status", ""].map((h, i) => (
                                            <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.map(inv => {
                                        const s = statusMeta(inv.status);
                                        return (
                                            <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-[#A43275]">{inv.invoiceNumber}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                    {formatDate(inv.invoiceDate, systemSettings?.dateFormat?.format || "d-m-Y")}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-gray-800">{format(inv.TotalAmount)}</td>
                                                <td className="px-4 py-3 text-emerald-600">{format(inv.totalPaid)}</td>
                                                <td className="px-4 py-3 text-red-500">{format(inv.balanceAmount)}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{inv.payment_method || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => navigate(`/customer/invoices/${inv.id}`)}
                                                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-[#A43275] hover:bg-[#fce6f4] transition-colors whitespace-nowrap"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CustomerInvoices;
