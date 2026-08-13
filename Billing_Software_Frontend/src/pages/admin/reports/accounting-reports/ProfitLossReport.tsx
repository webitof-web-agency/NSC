import { ChartCard } from "@components/admin/ChartCard";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import OptionSelectionModal from "@components/admin/OptionSelectionModal";
import PaymentModeBadge from "@components/admin/PaymentModeBadge";
import StatusBadge from "@components/admin/StatusBadge";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import type {
    ProfitLossRecordShape,
    ProfitLossPaymentModeShape,
    ProfitLossSummaryShape,
} from "@types/accounting-reports";
import type { RootState } from "@store/index";
import axios from "axios";
import { format as formatDate } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    ArrowDownRight,
    ArrowUpRight,
    Download,
    Minus,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

interface ProfitLossResponse {
    success: boolean;
    message: string;
    filters: {
        reportType: "monthly" | "yearly" | "range";
        year: number;
        month: number;
        startDate?: string | null;
        endDate?: string | null;
    };
    summary: ProfitLossSummaryShape;
    records: ProfitLossRecordShape[];
}

const monthOptions = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

const reportTypeOptions = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
];

const ProfitLossReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { format: formatCurrency, symbol, locale } = useCurrencyFormatter();

    const now = new Date();
    const [reportType, setReportType] = useState<"monthly" | "yearly">("monthly");
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
        startDate: null,
        endDate: null,
    });
    const [summary, setSummary] = useState<ProfitLossSummaryShape | null>(null);
    const [records, setRecords] = useState<ProfitLossRecordShape[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 7 }, (_, index) => ({
            value: String(currentYear - 5 + index),
            label: String(currentYear - 5 + index),
        }));
    }, []);

    const hasDateRange = Boolean(dateRange.startDate && dateRange.endDate);

    const buildQueryParams = () => ({
        reportType,
        year,
        month,
        startDate:
            hasDateRange && dateRange.startDate
                ? formatDate(dateRange.startDate, "yyyy-MM-dd")
                : undefined,
        endDate:
            hasDateRange && dateRange.endDate
                ? formatDate(dateRange.endDate, "yyyy-MM-dd")
                : undefined,
    });

    useEffect(() => {
        if (token) {
            fetchProfitLossReport();
        }
    }, [token, reportType, year, month, dateRange.startDate, dateRange.endDate]);

    const fetchProfitLossReport = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get<ProfitLossResponse>(
                Constants.GET_PROFIT_LOSS_REPORT_URL,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    params: buildQueryParams(),
                }
            );

            if (response.data.success) {
                setSummary(response.data.summary);
                setRecords(response.data.records || []);
            }
        } catch (error) {
            console.error("Failed to load profit/loss report:", error);
            toast.error("Failed to load profit/loss report");
        } finally {
            setIsLoading(false);
        }
    };

    const getExportFileBaseName = () => {
        if (hasDateRange && dateRange.startDate && dateRange.endDate) {
            return `Profit_Loss_${formatDate(dateRange.startDate, "yyyy-MM-dd")}_${formatDate(dateRange.endDate, "yyyy-MM-dd")}`;
        }

        return reportType === "yearly"
            ? `Profit_Loss_${year}`
            : `Profit_Loss_${year}-${String(month).padStart(2, "0")}`;
    };

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);
            const response = await axios.get(Constants.EXPORT_PROFIT_LOSS_REPORT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: buildQueryParams(),
                responseType: "blob",
            });

            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${getExportFileBaseName()}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("Profit/Loss report exported in Excel");
        } catch (error) {
            console.error("Failed to export profit/loss report:", error);
            toast.error("Failed to export profit/loss report");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPdf = () => {
        if (!summary) {
            toast.error("No report data available to export");
            return;
        }

        const pdfCurrencyPrefix = /^[\x20-\x7E]+$/.test(symbol) ? symbol : "INR ";
        const formatPdfAmount = (amount: number) =>
            `${pdfCurrencyPrefix}${new Intl.NumberFormat(locale || "en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(Number(amount || 0))}`;

        const doc = new jsPDF("p", "mm", "a4");
        doc.setFontSize(16);
        doc.text("Profit / Loss Report", 14, 14);

        doc.setFontSize(10);
        doc.text(`Period: ${periodLabel}`, 14, 21);
        doc.text(`Generated: ${formatDate(new Date(), "dd MMM yyyy")}`, 14, 27);

        autoTable(doc, {
            startY: 33,
            head: [["Summary Breakdown", "Amount"]],
            body: breakdownRows.map((row) => [row.label, formatPdfAmount(row.value)]),
            theme: "grid",
            styles: { fontSize: 9 },
            headStyles: { fillColor: [17, 24, 39] },
        });

        const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 33;

        if ((summary.paymentModeBreakdown || []).length > 0) {
            autoTable(doc, {
                startY: finalY + 8,
                head: [["Payment Mode", "Net Sales", "Sales %", "Gross Profit", "Allocated Exp.", "Net P/L", "Status"]],
                body: (summary.paymentModeBreakdown || []).map((mode) => [
                    mode.label,
                    formatPdfAmount(mode.netSales),
                    `${mode.salesSharePercentage.toFixed(2)}%`,
                    formatPdfAmount(mode.grossProfit),
                    formatPdfAmount(mode.allocatedExpenses),
                    formatPdfAmount(mode.netProfitLoss),
                    mode.status,
                ]),
                theme: "grid",
                styles: { fontSize: 8 },
                headStyles: { fillColor: [17, 24, 39] },
            });
        }

        const recordsStartY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || finalY) + 8;

        autoTable(doc, {
            startY: recordsStartY,
            head: [[
                "Period",
                "Net Sales",
                "Net COGS",
                "Gross Profit",
                "Purchase Exp.",
                "Op. Expenses",
                "Broker Comm.",
                "Staff Comm.",
                "Net P/L",
                "Status",
            ]],
            body: records.map((record) => [
                record.period,
                formatPdfAmount(record.netSales),
                formatPdfAmount(record.netCogs),
                formatPdfAmount(record.grossProfit),
                formatPdfAmount(record.purchaseExpenses),
                formatPdfAmount(record.operatingExpenses),
                formatPdfAmount(record.brokerCommission),
                formatPdfAmount(record.staffCommission),
                formatPdfAmount(record.netProfitLoss),
                record.status,
            ]),
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: { fillColor: [17, 24, 39] },
        });

        doc.save(`${getExportFileBaseName()}.pdf`);
        toast.success("Profit/Loss report exported in PDF");
    };

    const handleExportSelect = async (format: string) => {
        setIsExportModalOpen(false);

        if (format === "excel") {
            await handleExportExcel();
            return;
        }

        if (format === "pdf") {
            handleExportPdf();
        }
    };

    const isProfit = summary?.status !== "LOSS";
    const paymentModeBreakdown: ProfitLossPaymentModeShape[] = summary?.paymentModeBreakdown || [];

    const breakdownRows = summary
        ? [
            { label: "Gross Sales", value: summary.grossSales, type: "normal" as const },
            { label: "Sales Return", value: summary.salesReturn, type: "deduct" as const },
            { label: "Net Sales", value: summary.netSales, type: "subtotal" as const },
            { label: "Gross COGS", value: summary.grossCogs, type: "normal" as const },
            { label: "Return COGS", value: summary.salesReturnCogs, type: "deduct" as const },
            { label: "Net COGS", value: summary.netCogs, type: "subtotal" as const },
            { label: "Gross Profit", value: summary.grossProfit, type: "subtotal" as const },
            { label: "Purchase Expenses", value: summary.purchaseExpenses, type: "deduct" as const },
            { label: "Operating Expenses", value: summary.operatingExpenses, type: "deduct" as const },
            { label: "Broker Commission", value: summary.brokerCommission, type: "deduct" as const },
            { label: "Staff Commission", value: summary.staffCommission, type: "deduct" as const },
            { label: "Total Expenses", value: summary.totalExpenses, type: "subtotal" as const },
            { label: "Net Profit / Loss", value: summary.netProfitLoss, type: "highlight" as const },
        ]
        : [];

    const getRowStyle = (type: string) => {
        switch (type) {
            case "highlight":
                return "font-bold text-gray-900 border-t-2 border-gray-300 pt-3 mt-1";
            case "subtotal":
                return "font-semibold text-gray-800 border-t border-gray-100 pt-2";
            case "deduct":
                return "text-gray-600 pl-2";
            default:
                return "text-gray-700";
        }
    };

    const periodLabel = useMemo(() => {
        if (hasDateRange && dateRange.startDate && dateRange.endDate) {
            return `${formatDate(dateRange.startDate, "dd MMM yyyy")} - ${formatDate(dateRange.endDate, "dd MMM yyyy")}`;
        }
        if (reportType === "yearly") return `Year ${year}`;
        const m = monthOptions.find((o) => o.value === String(month));
        return `${m?.label || ""} ${year}`;
    }, [hasDateRange, dateRange.startDate, dateRange.endDate, reportType, year, month]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Profit / Loss Report</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Financial overview for{" "}
                        <span className="font-medium text-primary">{periodLabel}</span>
                    </p>
                </div>

                {/* Filters + Export */}
                <div className="flex flex-wrap items-center gap-2">
                    <CustomSelectDropdown
                        value={reportType}
                        onChange={(val) => setReportType(val as "monthly" | "yearly")}
                        options={reportTypeOptions}
                        className="w-32"
                    />
                    <CustomSelectDropdown
                        value={String(year)}
                        onChange={(val) => setYear(Number(val))}
                        options={yearOptions}
                        className="w-28"
                    />
                    {reportType === "monthly" && (
                        <CustomSelectDropdown
                            value={String(month)}
                            onChange={(val) => setMonth(Number(val))}
                            options={monthOptions}
                            className="w-36"
                        />
                    )}
                    <div className="min-w-[260px]">
                        <DateRangePicker
                            value={dateRange}
                            onChange={setDateRange}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setDateRange({ startDate: null, endDate: null })}
                        disabled={!hasDateRange}
                        className="px-3 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Range
                    </button>
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <LoaderSpinner className="w-4 h-4 text-emerald-700" />
                        ) : (
                            <Download size={15} />
                        )}
                        Export
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <ChartCard
                    title="Net Sales"
                    value={formatCurrency(summary?.netSales || 0)}
                    color="#16a34a"
                />
                <ChartCard
                    title="Net COGS"
                    value={formatCurrency(summary?.netCogs || 0)}
                    color="#2563eb"
                />
                <ChartCard
                    title="Gross Profit"
                    value={formatCurrency(summary?.grossProfit || 0)}
                    color="#7c3aed"
                />
                <ChartCard
                    title="Total Expenses"
                    value={formatCurrency(summary?.totalExpenses || 0)}
                    color="#dc2626"
                />
                <ChartCard
                    title={isProfit ? "Net Profit" : "Net Loss"}
                    value={formatCurrency(Math.abs(summary?.netProfitLoss || 0))}
                    color={isProfit ? "#0f766e" : "#dc2626"}
                />
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center">
                    <LoaderSpinner />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
                    {/* ── Summary Breakdown Panel ── */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <Wallet size={16} className="text-primary" />
                                <h2 className="text-sm font-semibold text-gray-800">Summary Breakdown</h2>
                            </div>
                            {summary && (
                                <div className="flex items-center gap-1.5">
                                    {isProfit ? (
                                        <TrendingUp size={14} className="text-emerald-600" />
                                    ) : (
                                        <TrendingDown size={14} className="text-red-600" />
                                    )}
                                    <StatusBadge status={isProfit ? "profit" : "loss"} />
                                </div>
                            )}
                        </div>

                        {/* Breakdown Rows */}
                        <div className="px-5 py-4 space-y-2.5">
                            {breakdownRows.map((row) => (
                                <div
                                    key={row.label}
                                    className={`flex items-center justify-between text-sm ${getRowStyle(row.type)}`}
                                >
                                    <span className="flex items-center gap-1">
                                        {row.type === "deduct" && (
                                            <Minus size={10} className="text-gray-400 shrink-0" />
                                        )}
                                        {row.type === "highlight" && isProfit && (
                                            <ArrowUpRight size={14} className="text-emerald-600 shrink-0" />
                                        )}
                                        {row.type === "highlight" && !isProfit && (
                                            <ArrowDownRight size={14} className="text-red-600 shrink-0" />
                                        )}
                                        {row.label}
                                    </span>
                                    <span
                                        className={
                                            row.type === "highlight"
                                                ? isProfit
                                                    ? "text-emerald-600"
                                                    : "text-red-600"
                                                : ""
                                        }
                                    >
                                        {formatCurrency(row.value)}
                                    </span>
                                </div>
                            ))}

                            {!summary && (
                                <p className="text-center text-gray-400 text-sm py-6">
                                    No summary data available.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                                <h2 className="text-sm font-semibold text-gray-800">Profit / Loss By Payment Mode</h2>
                                <span className="text-xs text-gray-400">{paymentModeBreakdown.length} mode(s)</span>
                            </div>

                            <div className="overflow-x-auto">
                                <Table
                                    headers={[
                                        "#",
                                        "Payment Mode",
                                        "Net Sales",
                                        "Sales %",
                                        "Gross Profit",
                                        "Allocated Exp.",
                                        "Net P/L",
                                        "Status",
                                    ]}
                                >
                                    {paymentModeBreakdown.map((mode, index) => (
                                        <TableRow
                                            key={mode.mode}
                                            index={index + 1}
                                            row={mode}
                                            columns={[
                        <PaymentModeBadge mode={mode.label} />,
                                                formatCurrency(mode.netSales),
                                                `${mode.salesSharePercentage.toFixed(2)}%`,
                                                formatCurrency(mode.grossProfit),
                                                formatCurrency(mode.allocatedExpenses),
                                                <span
                                                    className={`font-semibold ${mode.netProfitLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}
                                                >
                                                    {formatCurrency(mode.netProfitLoss)}
                                                </span>,
                                                <StatusBadge status={mode.status === "PROFIT" ? "profit" : "loss"} />,
                                            ]}
                                        />
                                    ))}

                                    {paymentModeBreakdown.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                                                No payment mode breakdown available for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </Table>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                                <h2 className="text-sm font-semibold text-gray-800">
                                    {reportType === "yearly" ? "Month-wise Details" : "Selected Period Details"}
                                </h2>
                                <span className="text-xs text-gray-400">{records.length} record(s)</span>
                            </div>

                            <div className="overflow-x-auto">
                                <Table
                                    headers={[
                                        "#",
                                        "Period",
                                        "Net Sales",
                                        "Net COGS",
                                        "Gross Profit",
                                        "Purchase Exp.",
                                        "Op. Expenses",
                                        "Broker Comm.",
                                        "Staff Comm.",
                                        "Net P/L",
                                        "Status",
                                    ]}
                                >
                                    {records.map((record, index) => (
                                        <TableRow
                                            key={record.periodKey}
                                            index={index + 1}
                                            row={record}
                                            columns={[
                                                <span className="font-medium text-gray-800">{record.period}</span>,
                                                formatCurrency(record.netSales),
                                                formatCurrency(record.netCogs),
                                                <span
                                                    className={
                                                        record.grossProfit >= 0
                                                            ? "text-emerald-600 font-medium"
                                                            : "text-red-600 font-medium"
                                                    }
                                                >
                                                    {formatCurrency(record.grossProfit)}
                                                </span>,
                                                formatCurrency(record.purchaseExpenses),
                                                formatCurrency(record.operatingExpenses),
                                                formatCurrency(record.brokerCommission),
                                                formatCurrency(record.staffCommission),
                                                <span
                                                    className={`font-semibold ${record.netProfitLoss >= 0
                                                        ? "text-emerald-600"
                                                        : "text-red-600"
                                                        }`}
                                                >
                                                    {formatCurrency(record.netProfitLoss)}
                                                </span>,
                                                <StatusBadge
                                                    status={record.status === "PROFIT" ? "profit" : "loss"}
                                                />,
                                            ]}
                                        />
                                    ))}

                                    {records.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={12}
                                                className="text-center py-10 text-gray-400 text-sm"
                                            >
                                                No records found for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <OptionSelectionModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Export Profit / Loss Report"
                description="Choose the format you want to export for the current filtered report."
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
};

export default ProfitLossReport;
