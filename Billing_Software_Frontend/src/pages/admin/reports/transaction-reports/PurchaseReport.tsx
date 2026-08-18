import { ChartCard } from "@components/admin/ChartCard";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import OptionSelectionModal from "@components/admin/OptionSelectionModal";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import StatusBadge from "@components/admin/StatusBadge";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import SupplierProfileCard from "@components/SupplierProfileImage";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import { useDebounce } from "@hooks/useDebounce";
import type { PurchaseReportShape } from "@models/transaction-reports";
import type { RootState } from "@store/index";
import { formatLocalDateTime } from "@utils/converters";
import axios from "axios";
import { format as formatDateValue } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

interface PurchaseReportResponse {
    success: boolean;
    message: string;
    data: ChartData;
    records: PurchaseReportShape[];
    pagination: PaginationData;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface ChartData {
    totalPurchases: {
        count: number;
        totalAmount: number;
    },
    completedOrders: {
        count: number;
        totalAmount: number;
    },
    pendingOrders: {
        count: number;
        totalAmount: number;
    },
    cancelledOrders: {
        count: number;
        totalAmount: number;
    }
}
const PurchaseReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { format, symbol, locale } = useCurrencyFormatter();
    const [purchaseReport, setPurchaseReport] = useState<PurchaseReportShape[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const { formatDate } = useDateFormatter();
    const [dateRange, setDateRange] = useState<{ startDate: Date | null, endDate: Date | null }>({
        startDate: null,
        endDate: null,
    });
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState<string>('');
    const debouncedSearchTerm = useDebounce(searchInput, 500);
    const [searchParams, setSearchParams] = useSearchParams();
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);

    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    useEffect(() => {
        if (token) {
            fetchPurchaseReport();
        }
    }, [token, debouncedSearchTerm, page, limit]);

    const fetchPurchaseReport = async (range = dateRange) => {
        try {
            setIsLoading(true);
            const params: Record<string, string> = {};
            if (range.startDate && range.endDate) {
                params.startDate = formatLocalDateTime(range.startDate, 'start', true);
                params.endDate = formatLocalDateTime(range.endDate, 'end', true);
            }
            params.search = debouncedSearchTerm;
            params.limit = Number(searchParams.get('limit') || 10).toString();
            params.page = Number(searchParams.get('page') || 1).toString();
            const response = await axios.get<PurchaseReportResponse>(Constants.GET_PURCHASE_REPORT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params
            });

            if (response.data.success) {
                setPurchaseReport(response.data.records);
                setChartData(response.data.data);
                setPagination(response.data.pagination);
            }
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoading(false);
        }
    }
    const handleRangeInputChange = (range: { startDate: Date | null, endDate: Date | null }) => {
        setDateRange(range);
        if (range.startDate && range.endDate) {
            setDateRangeError(null);
            fetchPurchaseReport(range);
        } else {
            setDateRangeError('Please select start date and end date');
        }
    }

    const clearAllFilters = () => {
        setDateRange({ startDate: null, endDate: null });
        setSearchInput('');
        fetchPurchaseReport({ startDate: null, endDate: null });
    }

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ limit: String(limit), page: String(newPage) });
    };

    const getExportFileBaseName = () => {
        const today = new Date().toISOString().split('T')[0];
        if (dateRange.startDate && dateRange.endDate) {
            return `Purchase_Report_${formatDateValue(dateRange.startDate, "yyyy-MM-dd")}_${formatDateValue(dateRange.endDate, "yyyy-MM-dd")}`;
        }
        return `Purchase_Report_${today}`;
    };

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);
            const params: Record<string, string> = {
                search: debouncedSearchTerm,
            };
            if (dateRange.startDate && dateRange.endDate) {
                params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
                params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
            }

            const response = await axios.get(Constants.EXPORT_PURCHASE_REPORT_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${getExportFileBaseName()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportGstExcel = async () => {
        try {
            setIsExporting(true);
            const params: Record<string, string> = {
                search: debouncedSearchTerm,
            };
            if (dateRange.startDate && dateRange.endDate) {
                params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
                params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
            }

            const response = await axios.get(Constants.EXPORT_PURCHASE_GST_REPORT_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `GST_Purchase_Report_${today}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const fetchAllPurchaseReportRows = async () => {
        const params: Record<string, string> = {
            search: debouncedSearchTerm,
            page: '1',
            limit: String(Math.max(pagination.total || 0, purchaseReport.length || 0, 1)),
        };
        if (dateRange.startDate && dateRange.endDate) {
            params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
            params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
        }

        const response = await axios.get<PurchaseReportResponse>(Constants.GET_PURCHASE_REPORT_URL, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params,
        });

        return response.data.records || [];
    };

    const handleExportPdf = async () => {
        try {
            setIsExporting(true);
            const allPurchaseRows = await fetchAllPurchaseReportRows();

            const pdfCurrencyPrefix = /^[\x20-\x7E]+$/.test(symbol) ? symbol : "INR ";
            const formatPdfAmount = (amount: number) =>
                `${pdfCurrencyPrefix}${new Intl.NumberFormat(locale || "en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(Number(amount || 0))}`;

            const doc = new jsPDF("p", "mm", "a4");
            doc.setFontSize(16);
            doc.text("Purchase Report", 14, 14);
            doc.setFontSize(10);
            doc.text(
                `Period: ${dateRange.startDate && dateRange.endDate
                    ? `${formatDateValue(dateRange.startDate, "dd MMM yyyy")} - ${formatDateValue(dateRange.endDate, "dd MMM yyyy")}`
                    : "All Dates"
                }`,
                14,
                21
            );
            doc.text(`Generated: ${formatDateValue(new Date(), "dd MMM yyyy")}`, 14, 27);

            autoTable(doc, {
                startY: 33,
                head: [["Metric", "Value"]],
                body: [
                    ["Total Purchases", formatPdfAmount(chartData?.totalPurchases.totalAmount || 0)],
                    ["Completed Orders", formatPdfAmount(chartData?.completedOrders.totalAmount || 0)],
                    ["Pending Orders", formatPdfAmount(chartData?.pendingOrders.totalAmount || 0)],
                    ["Returned Orders", formatPdfAmount(chartData?.cancelledOrders.totalAmount || 0)],
                ],
                theme: "grid",
                styles: { fontSize: 9 },
                headStyles: { fillColor: [17, 24, 39] },
            });

            const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 33;

            autoTable(doc, {
                startY: finalY + 8,
                head: [[
                    "Purchase ID",
                    "Supplier Bill No",
                    "Supplier",
                    "Total Amount",
                    "Paid Amount",
                    "Balance",
                    "Status",
                    "Purchase Date",
                ]],
                body: allPurchaseRows.map((item: any) => [
                    item.purchaseId,
                    item.supplierBillNumber || '-',
                    item.vendor?.name || 'N/A',
                    formatPdfAmount(item.totalAmount),
                    formatPdfAmount(item.paidAmount),
                    formatPdfAmount(item.balance),
                    item.status,
                    formatDate(item.purchaseDate, systemSettings?.dateFormat.format || 'dd-MM-yyyy'),
                ]),
                theme: "grid",
                styles: { fontSize: 8 },
                headStyles: { fillColor: [17, 24, 39] },
            });

            doc.save(`${getExportFileBaseName()}.pdf`);
            toast.success("Purchase report exported in PDF");
        } catch (error) {
            console.error('PDF export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportSelect = async (selectedFormat: string) => {
        setIsExportModalOpen(false);

        if (selectedFormat === "excel") {
            await handleExportExcel();
            return;
        }

        if (selectedFormat === "gst-excel") {
            await handleExportGstExcel();
            return;
        }

        if (selectedFormat === "pdf") {
            handleExportPdf();
        }
    };

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-600"> Purchase Report </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ChartCard title="Total Purchases" value={format(chartData?.totalPurchases.totalAmount || 0)} color="#8b5cf6" />
                <ChartCard title="Completed Orders" value={format(chartData?.completedOrders.totalAmount || 0)} color="#22c55e" />
                <ChartCard title="Pending Orders" value={format(chartData?.pendingOrders.totalAmount || 0)} color="#eab308" />
                <ChartCard title="Returned Orders" value={format(chartData?.cancelledOrders.totalAmount || 0)} color="#ef4444" />
            </div>
            {/* Filters*/}
            <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="w-full sm:w-auto">
                    <input type="text" name="search" id="search" placeholder="Search..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="border border-gray-300 rounded-md px-4 py-2  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600" />
                </div>
                <div className="w-full sm:w-auto">
                    <DateRangePicker
                        value={dateRange}
                        onChange={handleRangeInputChange}
                    />
                    {dateRangeError && <p className="text-red-500 text-sm">{dateRangeError}</p>}
                </div>
                {/* clear filters */}
                <div>
                    <button
                        onClick={clearAllFilters}
                        className="border border-gray-300 rounded-md px-4 py-2  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                    >
                        Clear Filters
                    </button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        disabled={isExporting}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-4 py-2 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        {isExporting ? <LoaderSpinner className="w-4 h-4 text-white" /> : <Download size={18} />}
                        Export
                    </button>
                    <select
                        value={limit}
                        onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                        className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    >
                        {[10, 25, 50].map((num) => (
                            <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                        ))}
                    </select>
                </div>
            </div>
            {/* Table */}
            <Table headers={['#', 'Supplier', 'Supplier Bill No', 'Total Amount', 'Paid Amount', 'Balance', 'Status', 'Purchase Date']}>
                {!isLoading && purchaseReport && purchaseReport.map((item: any, index: number) => (
                    <TableRow
                        key={item.purchaseId}
                        row={item}
                        index={index + 1}
                        columns={[
                            <SupplierProfileCard
                                imageUrl={item.vendor?.image}
                                name={item.vendor?.name}
                            />,
                            item.supplierBillNumber || '-',
                            format(item.totalAmount),
                            format(item.paidAmount),
                            format(item.balance),
                            <StatusBadge status={item.status} />,
                            formatDate(item.purchaseDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                        ]}
                    />
                ))}

                {!isLoading && purchaseReport.length === 0 && (
                    <tr>
                        <td colSpan={9} className="text-center py-4 text-gray-600 font-semibold">No records found</td>
                    </tr>
                )}

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={9}>
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

            <OptionSelectionModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Export Purchase Report"
                description="Choose the format you want to export for the current filtered purchase report."
                options={[
                    {
                        value: "excel",
                        label: "Excel",
                        description: "Download the report as an Excel file.",
                    },
                    {
                        value: "gst-excel",
                        label: "GST Excel",
                        description: "Download the GST formatted report as an Excel file.",
                    },
                    {
                        value: "pdf",
                        label: "PDF",
                        description: "Download the report as a PDF file.",
                    },
                ]}
                onSelect={handleExportSelect}
            />
        </div>
    );
}

export default PurchaseReport;
