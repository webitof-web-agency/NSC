import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import OptionSelectionModal from "@components/admin/OptionSelectionModal";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import ProfileCard from "@components/admin/ProfileImage";
import StatsCard from "@components/admin/StatsCard";
import StatusBadge from "@components/admin/StatusBadge";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import InvoicePaymentSummary from "@components/admin/InvoicePaymentSummary";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import { useDebounce } from "@hooks/useDebounce";
import type { SalesReportShape } from "@models/transaction-reports";
import type { RootState } from "@store/index";
import { formatLocalDateTime } from "@utils/converters";
import axios from "axios";
import { format as formatDateValue } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Box, CheckCircleIcon, Download } from "lucide-react";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { BiMoneyWithdraw } from "react-icons/bi";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
interface SalesReportResponse {
    success: boolean;
    message: string;
    data: ChartData;
    records: SalesReportShape[];
    pagination: PaginationData;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface ChartData {
    TotalRevenue: {
        currentMonthAmount: number;
        previousMonthAmount: number;
        change: number;
        trend: 'down' | 'up' | 'equal';
    },
    ActiveInvoices: {
        currentMonthCount: number;
        previousMonthCount: number;
        change: number;
        trend: 'down' | 'up' | 'equal';
    },
    BestSellingProduct: {
        name: string;
        currentMonthQty: number;
        previousMonthQty: number;
        change: number;
        trend: 'down' | 'up' | 'equal';
    },
}
const SalesReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { format, symbol, locale } = useCurrencyFormatter();
    const [salesReport, setSalesReport] = useState<SalesReportShape[]>([]);
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
    const [statusFilter, setStatusFilter] = useState<string>('all');
    useEffect(() => {
        if (token) {
            fetchSalesReport();
        }
    }, [token, debouncedSearchTerm, page, limit, statusFilter]);

    const fetchSalesReport = async (range = dateRange) => {
        try {
            setIsLoading(true);
            const params: Record<string, string> = {};
            if (range.startDate && range.endDate) {
                params.startDate = formatLocalDateTime(range.startDate, 'start', true);
                params.endDate = formatLocalDateTime(range.endDate, 'end', true);
            }
            if (statusFilter !== 'all') {
                params.status = statusFilter.toUpperCase();
            }
            params.search = debouncedSearchTerm;
            params.limit = Number(searchParams.get('limit') || 10).toString();
            params.page = Number(searchParams.get('page') || 1).toString();
            const response = await axios.get<SalesReportResponse>(Constants.GET_SALES_REPORT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params
            });

            if (response.data.success) {
                setSalesReport(response.data.records);
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
            fetchSalesReport(range);
        } else {
            setDateRangeError('Please select start date and end date');
        }
    }

    const clearAllFilters = () => {
        setDateRange({ startDate: null, endDate: null });
        setSearchInput('');
        setStatusFilter('all');
        setDateRangeError(null);
        fetchSalesReport({ startDate: null, endDate: null });
    }

    const getExportFileBaseName = () => {
        const today = new Date().toISOString().split('T')[0];
        if (dateRange.startDate && dateRange.endDate) {
            return `Sales_Report_${formatDateValue(dateRange.startDate, "yyyy-MM-dd")}_${formatDateValue(dateRange.endDate, "yyyy-MM-dd")}`;
        }
        return `Sales_Report_Export_${today}`;
    };

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);

            // Build query parameters with current filters
            const params: any = {};
            if (dateRange.startDate) {
                params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
            }
            if (dateRange.endDate) {
                params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
            }
            if (debouncedSearchTerm) {
                params.search = debouncedSearchTerm;
            }
            if (statusFilter !== 'all') {
                params.status = statusFilter.toUpperCase();
            }

            // Make request to download Excel file
            const response = await axios.get(Constants.EXPORT_SALES_REPORT_EXCEL_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params,
                responseType: 'blob'  // Important for file download
            });

            // Create blob from response
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${getExportFileBaseName()}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Sales report exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export sales report');
        } finally {
            setIsExporting(false);
        }
    }

    const fetchAllSalesReportRows = async () => {
        const params: Record<string, string> = {};
        if (dateRange.startDate && dateRange.endDate) {
            params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
            params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
        }
        if (statusFilter !== 'all') {
            params.status = statusFilter.toUpperCase();
        }
        params.search = debouncedSearchTerm;
        params.page = '1';
        params.limit = String(Math.max(pagination.total || 0, salesReport.length || 0, 1));

        const response = await axios.get<SalesReportResponse>(Constants.GET_SALES_REPORT_URL, {
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
            const allSalesRows = await fetchAllSalesReportRows();

        const pdfCurrencyPrefix = /^[\x20-\x7E]+$/.test(symbol) ? symbol : "INR ";
        const formatPdfAmount = (amount: number) =>
            `${pdfCurrencyPrefix}${new Intl.NumberFormat(locale || "en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(Number(amount || 0))}`;

        const doc = new jsPDF("p", "mm", "a4");
        doc.setFontSize(16);
        doc.text("Sales Report", 14, 14);
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
                ["Total Revenue", formatPdfAmount(chartData?.TotalRevenue.currentMonthAmount || 0)],
                ["Active Invoices", String(chartData?.ActiveInvoices.currentMonthCount || 0)],
                ["Best Selling Product", chartData?.BestSellingProduct.name || "N/A"],
                ["Best Selling Qty", String(chartData?.BestSellingProduct.currentMonthQty || 0)],
            ],
            theme: "grid",
            styles: { fontSize: 9 },
            headStyles: { fillColor: [17, 24, 39] },
        });

        const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 33;

        autoTable(doc, {
            startY: finalY + 8,
            head: [[
                "Invoice ID",
                "Customer Phone",
                "Total Amount",
                "Paid Amount",
                "Remaining Balance",
                "Status",
                "Invoice Date",
            ]],
            body: allSalesRows.map((item) => [
                item.invoiceNumber,
                item.customer?.phone || "N/A",
                formatPdfAmount(item.amount),
                formatPdfAmount(item.paidAmount),
                formatPdfAmount(item.remainingBalance),
                item.status,
                formatDate(item.invoiceDate, systemSettings?.dateFormat.format || 'dd-MM-yyyy'),
            ]),
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: { fillColor: [17, 24, 39] },
        });

        doc.save(`${getExportFileBaseName()}.pdf`);
        toast.success("Sales report exported in PDF");
        } catch (error) {
            console.error('PDF export failed:', error);
            toast.error('Failed to export sales report');
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

        if (selectedFormat === "pdf") {
            handleExportPdf();
        }
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ limit: String(limit), page: String(newPage) });
    };

    useEffect(() => {
        setSearchParams((prev) => {
            if ((prev.get('page') || '1') === '1') {
                return prev;
            }
            const next = new URLSearchParams(prev);
            next.set('page', '1');
            return next;
        });
    }, [dateRange.startDate, dateRange.endDate, statusFilter, debouncedSearchTerm, setSearchParams]);

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const getColorClass = (value?: number | null, rawColor = false) => {
        if (value === undefined || value === null) {
            return "";
        }
        if (rawColor) {
            return value >= 0 ? "green" : "red";
        }
        return value >= 0 ? "text-green-600" : "text-red-600";
    };

    const parsePercentage = (value?: string | number | null): number | null => {
        if (value === undefined || value === null) return null;

        // If it's already a number
        if (typeof value === "number") {
            return Math.abs(value);
        }

        // If it's a string, remove % and spaces
        const cleaned = value.replace("%", "").trim();
        const num = Number(cleaned);

        if (isNaN(num)) return null;

        return Math.abs(num);
    }

    const totalRevenuePercentage = parsePercentage(chartData?.TotalRevenue.change || 0);
    const activeInvoicesPercentage = parsePercentage(chartData?.ActiveInvoices.change || 0);
    const bestSellingProductPercentage = parsePercentage(chartData?.BestSellingProduct.change || 0);
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-600"> Sales Report </h1>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Revenue"
                    value={format(chartData?.TotalRevenue.currentMonthAmount || 0)}
                    difference={totalRevenuePercentage || 0}
                    icon={<BiMoneyWithdraw size={25} className={getColorClass(totalRevenuePercentage)} />}
                    color={getColorClass(totalRevenuePercentage, true)}
                />
                <StatsCard
                    title="Active Invoices"
                    value={chartData?.ActiveInvoices.currentMonthCount || 0}
                    difference={activeInvoicesPercentage || 0}
                    icon={<CheckCircleIcon size={25} className={getColorClass(activeInvoicesPercentage)} />}
                    color={getColorClass(activeInvoicesPercentage, true)}
                />
                <StatsCard
                    title={`Best Selling Product` + (chartData?.BestSellingProduct.name ? ` - ${chartData?.BestSellingProduct.name}` : '')}
                    value={chartData?.BestSellingProduct.currentMonthQty || 0}
                    difference={bestSellingProductPercentage || 0}
                    icon={<Box size={25} className={getColorClass(bestSellingProductPercentage)} />}
                    color={getColorClass(bestSellingProductPercentage, true)}
                />
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
                <div className="w-full sm:w-auto">
                    <CustomSelectDropdown
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: 'all', label: 'All Invoices' },
                            { value: 'paid', label: 'Paid' },
                            { value: 'unpaid', label: 'Unpaid' },
                            { value: 'partially_paid', label: 'Partially Paid' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'exchange', label: 'Exchange' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ]}
                        placeholder="Select Status"
                        className="min-w-[180px] w-full"
                    />
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
                <div className="ml-auto flex gap-2">
                    {/* Export Excel */}
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        disabled={isExporting}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-3 py-2 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        <Download size={16} />
                        {isExporting ? 'Exporting...' : 'Export'}
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
            <Table headers={['#', 'Invoice ID', 'Customer', 'Total Amount', 'Paid Amount', 'Remaining Balance', 'Payment Mode', 'Status', 'Invoice Date']}>
                {!isLoading && salesReport.map((item, index) => (
                    <TableRow
                        key={item.invoiceId}
                        row={item}
                        index={(pagination.page - 1) * pagination.limit + index + 1}
                        columns={[
                            item.invoiceNumber,
                            <ProfileCard
                                phone={item.customer?.phone || "N/A"}
                            />,
                            format(item.amount),
                            format(item.paidAmount),
                            format(item.remainingBalance),
                            <InvoicePaymentSummary
                                mode={item.paymentMethod}
                                amount={Number(item.paidAmount || 0)}
                                cashAmount={item.cashAmount}
                                cardAmount={item.cardAmount}
                                upiAmount={item.upiAmount}
                                outstandingAmount={Number(item.remainingBalance || 0)}
                            />,
                            <StatusBadge status={item.status} />,
                            formatDate(item.invoiceDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                        ]}
                    />
                ))}

                {!isLoading && salesReport.length === 0 && (
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
                title="Export Sales Report"
                description="Choose the format you want to export for the current filtered sales report."
                options={[
                    {
                        value: "excel",
                        label: "Excel",
                        description: "Download the report as an Excel file.",
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

export default SalesReport;
