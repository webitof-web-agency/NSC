import { ChartCard } from "@components/admin/ChartCard";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import Table from "@components/admin/Table";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import type { RootState } from "@store/index";
import { formatLocalDateTime } from "@utils/converters";
import axios from "axios";
import { format as formatDate } from "date-fns";
import {
    Download,
    Layers,
    Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

interface HsnGstSummary {
    noOfHsn: number;
    totalValue: number;
    taxableValue: number;
    integratedTaxAmount: number;
    centralTaxAmount: number;
    stateTaxAmount: number;
    cessAmount: number;
}

interface HsnGstRecord {
    hsn: string;
    description: string;
    uqc: string;
    totalQuantity: number;
    totalValue: number;
    rate: number;
    taxableValue: number;
    integratedTaxAmount: number;
    centralTaxAmount: number;
    stateTaxAmount: number;
    cessAmount: number;
}

interface HsnGstSection {
    summary: HsnGstSummary;
    records: HsnGstRecord[];
}

interface HsnGstReportResponse {
    success: boolean;
    message: string;
    data: {
        b2b: HsnGstSection;
        b2c: HsnGstSection;
    };
}

type ActiveSheet = "b2b" | "b2c";

const emptySummary: HsnGstSummary = {
    noOfHsn: 0,
    totalValue: 0,
    taxableValue: 0,
    integratedTaxAmount: 0,
    centralTaxAmount: 0,
    stateTaxAmount: 0,
    cessAmount: 0,
};

const emptyReportData: HsnGstReportResponse["data"] = {
    b2b: { summary: emptySummary, records: [] },
    b2c: { summary: emptySummary, records: [] },
};

const HsnGstReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { format: formatCurrency } = useCurrencyFormatter();

    const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
        startDate: null,
        endDate: null,
    });
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [activeSheet, setActiveSheet] = useState<ActiveSheet>("b2b");
    const [reportData, setReportData] = useState<HsnGstReportResponse["data"]>(emptyReportData);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const hasDateRange = Boolean(dateRange.startDate && dateRange.endDate);

    const buildQueryParams = (range: { startDate: Date | null; endDate: Date | null }) => {
        const params: Record<string, string> = {};
        if (range.startDate && range.endDate) {
            params.startDate = formatLocalDateTime(range.startDate, "start", true);
            params.endDate = formatLocalDateTime(range.endDate, "end", true);
        }
        return params;
    };

    const activeSection = reportData[activeSheet];

    const combinedSummary = useMemo<HsnGstSummary>(() => {
        const b2b = reportData.b2b.summary;
        const b2c = reportData.b2c.summary;
        return {
            noOfHsn: b2b.noOfHsn + b2c.noOfHsn,
            totalValue: b2b.totalValue + b2c.totalValue,
            taxableValue: b2b.taxableValue + b2c.taxableValue,
            integratedTaxAmount: b2b.integratedTaxAmount + b2c.integratedTaxAmount,
            centralTaxAmount: b2b.centralTaxAmount + b2c.centralTaxAmount,
            stateTaxAmount: b2b.stateTaxAmount + b2c.stateTaxAmount,
            cessAmount: b2b.cessAmount + b2c.cessAmount,
        };
    }, [reportData]);

    const totalTax = combinedSummary.integratedTaxAmount +
        combinedSummary.centralTaxAmount +
        combinedSummary.stateTaxAmount +
        combinedSummary.cessAmount;

    const fetchHsnGstReport = useCallback(async (range: { startDate: Date | null; endDate: Date | null }) => {
        if (!token) return;
        try {
            setIsLoading(true);
            const response = await axios.get<HsnGstReportResponse>(Constants.GET_HSN_GST_REPORT_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: buildQueryParams(range),
            });
            if (response.data.success) {
                setReportData(response.data.data || emptyReportData);
            }
        } catch (error) {
            console.error("Failed to fetch HSN GST report:", error);
            toast.error("Failed to fetch HSN GST report");
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchHsnGstReport({ startDate: null, endDate: null });
        }
    }, [token, fetchHsnGstReport]);

    const handleRangeInputChange = (range: { startDate: Date | null; endDate: Date | null }) => {
        setDateRange(range);
        if (range.startDate && range.endDate) {
            setDateRangeError(null);
            fetchHsnGstReport(range);
            return;
        }
        setDateRangeError("Please select start date and end date");
    };

    const clearAllFilters = () => {
        const emptyRange = { startDate: null, endDate: null };
        setDateRange(emptyRange);
        setDateRangeError(null);
        fetchHsnGstReport(emptyRange);
    };

    const getExportFileName = () => {
        if (hasDateRange && dateRange.startDate && dateRange.endDate) {
            return `HSN_GST_Report_${formatDate(dateRange.startDate, "yyyy-MM-dd")}_${formatDate(dateRange.endDate, "yyyy-MM-dd")}.xlsx`;
        }
        return `HSN_GST_Report_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
    };

    const formatTaxRate = (rate: number) => {
        const value = Number(rate || 0);
        return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
    };

    const handleExportExcel = async () => {
        if (!token) {
            toast.error("Session expired. Please login again.");
            return;
        }
        if ((dateRange.startDate && !dateRange.endDate) || (!dateRange.startDate && dateRange.endDate)) {
            setDateRangeError("Please select both start date and end date");
            return;
        }
        try {
            setIsExporting(true);
            const response = await axios.get(Constants.EXPORT_HSN_GST_REPORT_EXCEL_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: buildQueryParams(dateRange),
                responseType: "blob",
            });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = getExportFileName();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("HSN GST report exported successfully");
        } catch (error) {
            console.error("Failed to export HSN GST report:", error);
            toast.error("Failed to export HSN GST report");
        } finally {
            setIsExporting(false);
        }
    };

    const periodLabel = hasDateRange && dateRange.startDate && dateRange.endDate
        ? `${formatDate(dateRange.startDate, "dd MMM yyyy")} – ${formatDate(dateRange.endDate, "dd MMM yyyy")}`
        : "All Time";

    // Per-sheet summary strip items
    const summaryStrip = [
        { label: "No. of HSN", value: activeSection.summary.noOfHsn },
        { label: "Total Value", value: formatCurrency(activeSection.summary.totalValue) },
        { label: "Taxable Value", value: formatCurrency(activeSection.summary.taxableValue) },
        { label: "IGST", value: formatCurrency(activeSection.summary.integratedTaxAmount) },
        { label: "CGST", value: formatCurrency(activeSection.summary.centralTaxAmount) },
        { label: "SGST / UTGST", value: formatCurrency(activeSection.summary.stateTaxAmount) },
        { label: "Cess", value: formatCurrency(activeSection.summary.cessAmount) },
    ];

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">HSN GST Report</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        HSN-wise tax summary for{" "}
                        <span className="font-medium text-primary">{periodLabel}</span>
                    </p>
                </div>

                {/* Filters + Export */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[260px]">
                        <DateRangePicker value={dateRange} onChange={handleRangeInputChange} />
                    </div>
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        disabled={!hasDateRange}
                        className="px-3 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Clear Range
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <LoaderSpinner className="w-4 h-4 text-emerald-700" />
                        ) : (
                            <Download size={15} />
                        )}
                        Export Excel
                    </button>
                </div>
            </div>

            {dateRangeError && (
                <p className="text-sm text-red-500">{dateRangeError}</p>
            )}

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <ChartCard
                    title="No. of HSN"
                    value={combinedSummary.noOfHsn}
                    color="#7c3aed"
                />
                <ChartCard
                    title="Total Value"
                    value={formatCurrency(combinedSummary.totalValue)}
                    color="#16a34a"
                />
                <ChartCard
                    title="Total Taxable Value"
                    value={formatCurrency(combinedSummary.taxableValue)}
                    color="#2563eb"
                />
                <ChartCard
                    title="Total Tax Amount"
                    value={formatCurrency(totalTax)}
                    color="#dc2626"
                />
            </div>

            {/* ── Main Panel ── */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

                {/* Panel Header — Tabs + record count */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        <h2 className="text-sm font-semibold text-gray-800">HSN Summary</h2>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveSheet("b2b")}
                            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                                activeSheet === "b2b"
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                            B2B
                            <span className={`ml-1.5 text-xs font-normal ${activeSheet === "b2b" ? "text-white/80" : "text-gray-400"}`}>
                                ({reportData.b2b.records.length})
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSheet("b2c")}
                            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                                activeSheet === "b2c"
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                            B2C
                            <span className={`ml-1.5 text-xs font-normal ${activeSheet === "b2c" ? "text-white/80" : "text-gray-400"}`}>
                                ({reportData.b2c.records.length})
                            </span>
                        </button>
                    </div>
                </div>

                {/* Per-sheet summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-gray-100 border-b border-gray-100">
                    {summaryStrip.map((item) => (
                        <div key={item.label} className="bg-white px-4 py-3">
                            <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                            <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="py-16 flex justify-center">
                        <LoaderSpinner />
                    </div>
                ) : (
                    <Table
                        headers={[
                            "#",
                            "HSN",
                            "Description",
                            "UQC",
                            "Total Qty",
                            "Total Value",
                            "Rate",
                            "Taxable Value",
                            "IGST",
                            "CGST",
                            "SGST / UTGST",
                            "Cess",
                        ]}
                    >
                        {activeSection.records.map((item, index) => (
                            <tr
                                key={`${item.hsn}-${item.description}-${item.uqc}-${item.rate}`}
                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                                <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{item.hsn}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={item.description}>
                                    {item.description || "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.uqc}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{item.totalQuantity}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatCurrency(item.totalValue)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{formatTaxRate(item.rate)}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatCurrency(item.taxableValue)}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(item.integratedTaxAmount)}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(item.centralTaxAmount)}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(item.stateTaxAmount)}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(item.cessAmount)}</td>
                            </tr>
                        ))}

                        {activeSection.records.length === 0 && (
                            <tr>
                                <td colSpan={12} className="text-center py-12 text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Tag size={32} className="text-gray-300" />
                                        <p className="text-sm font-medium">No HSN records found</p>
                                        <p className="text-xs text-gray-400">Try adjusting the date range</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </Table>
                )}
            </div>
        </div>
    );
};

export default HsnGstReport;
