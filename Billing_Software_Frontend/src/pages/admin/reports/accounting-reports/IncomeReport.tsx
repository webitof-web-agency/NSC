import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import InvoicePaymentSummary from "@components/admin/InvoicePaymentSummary";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import ProfileCard from "@components/admin/ProfileImage";
import StatsCard from "@components/admin/StatsCard";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import { useDebounce } from "@hooks/useDebounce";
import type { IncomeReportShape } from "@models/accounting-reports";
import type { RootState } from "@store/index";
import { formatLocalDateTime } from "@utils/converters";
import axios from "axios";
import { CheckCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BiMoneyWithdraw } from "react-icons/bi";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
interface IncomeReportResponse {
    success: boolean;
    message: string;
    data: ChartData;
    records: IncomeReportShape[];
    pagination: PaginationData;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface ChartData {
    product_sales: {
        previousMonthAmount: number;
        currentMonthAmount: number;
        percentage: number;
        trend: 'down' | 'up' | 'equal';
    },
    total_income: {
        previousMonthAmount: number;
        currentMonthAmount: number;
        percentage: number;
        trend: 'down' | 'up' | 'equal';
    },
    service_revenue: {
        previousMonthAmount: number;
        currentMonthAmount: number;
        percentage: number;
        trend: 'down' | 'up' | 'equal';
    },
}
const IncomeReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [incomeReport, setIncomeReport] = useState<IncomeReportShape[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
    const [dateRange, setDateRange] = useState<{ startDate: Date | null, endDate: Date | null }>({
        startDate: null,
        endDate: null,
    });
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState<string>('');
    const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
    const debouncedSearchTerm = useDebounce(searchInput, 500);
    const [searchParams, setSearchParams] = useSearchParams();
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        if (token) {
            fetchIncomeReport();
        }
    }, [token, debouncedSearchTerm, paymentModeFilter, page, limit]);

    const fetchIncomeReport = async (range = dateRange) => {
        try {
            setIsLoading(true);
            const params: Record<string, string> = {};
            if (range.startDate && range.endDate) {
                params.startDate = formatLocalDateTime(range.startDate, 'start', true);
                params.endDate = formatLocalDateTime(range.endDate, 'end', true);
            }
            params.search = debouncedSearchTerm;
            if (paymentModeFilter && paymentModeFilter !== 'all') {
                params.paymentMode = paymentModeFilter;
            }
            params.limit = Number(searchParams.get('limit') || 10).toString();
            params.page = Number(searchParams.get('page') || 1).toString();
            const response = await axios.get<IncomeReportResponse>(Constants.GET_INCOME_REPORT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params
            });

            if (response.data.success) {
                setIncomeReport(response.data.records);
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
            setSearchParams({ limit: String(limit), page: '1' });
            fetchIncomeReport(range);
        } else {
            setDateRangeError('Please select start date and end date');
        }
    }

    const clearAllFilters = () => {
        setDateRange({ startDate: null, endDate: null });
        setSearchInput('');
        setPaymentModeFilter('all');
        setSearchParams({ limit: String(limit), page: '1' });
        fetchIncomeReport({ startDate: null, endDate: null });
    }

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ limit: String(limit), page: String(newPage) });
    };

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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-600"> Income Report </h1>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Product Sales"
                    value={format(chartData?.product_sales.currentMonthAmount || 0)}
                    difference={chartData?.product_sales.percentage || 0}
                    icon={<BiMoneyWithdraw size={25} className={getColorClass(chartData?.product_sales.percentage)} />}
                    color={getColorClass(chartData?.product_sales.percentage, true)}
                />
                <StatsCard
                    title="Total Income"
                    value={format(chartData?.total_income.currentMonthAmount || 0)}
                    difference={chartData?.total_income.percentage || 0}
                    icon={<CheckCircleIcon size={25} className={getColorClass(chartData?.total_income.percentage)} />}
                    color={getColorClass(chartData?.total_income.percentage, true)}
                />
            </div>
            {/* Filters*/}
            <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="w-full sm:w-auto">
                    <input type="text" name="search" id="search" placeholder="Search..."
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setSearchParams({ limit: String(limit), page: '1' });
                        }}
                        className="border border-gray-300 rounded-md px-4 py-2  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600" />
                </div>
                <div className="w-full sm:w-auto">
                    <DateRangePicker
                        value={dateRange}
                        onChange={handleRangeInputChange}
                    />
                    {dateRangeError && <p className="text-red-500 text-sm">{dateRangeError}</p>}
                </div>
                <div className="w-full sm:w-auto min-w-[180px]">
                    <CustomSelectDropdown
                        value={paymentModeFilter}
                        onChange={(value) => {
                            setPaymentModeFilter(value);
                            setSearchParams({ limit: String(limit), page: '1' });
                        }}
                        options={[
                            { value: 'all', label: 'All Payment Modes' },
                            { value: 'cash', label: 'Cash' },
                            { value: 'card', label: 'Card' },
                            { value: 'upi', label: 'UPI' },
                            { value: 'phonepe', label: 'PhonePe' },
                            { value: 'mixed', label: 'Mixed' },
                            { value: 'credit', label: 'Credit' },
                        ]}
                        placeholder="Select Payment Mode"
                        className="w-full"
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
                <div className="ml-auto">
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
            <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="min-w-[900px] px-4 md:px-0">
                    <Table headers={['#', 'Invoice ID', 'Customer', 'Amount', 'Paid Date', 'Payment Mode', 'Created On']}>
                        {!isLoading && incomeReport && incomeReport.map((item: IncomeReportShape, index: number) => (
                            <TableRow
                                key={item.id}
                                row={item}
                                index={index + 1}
                                columns={[
                                    item.invoiceNumber,
                                    <ProfileCard
                                        phone={item.customer?.phone || "N/A"}
                                    />,
                                    format(item.amount),
                                    formatDate(item.paidDate, systemSettings?.dateFormat.format || 'd-m-Y'),
                                    <InvoicePaymentSummary
                                        mode={item.paymentMode?.name || ''}
                                        amount={Number(item.amount || 0)}
                                        cashAmount={item.cashAmount}
                                        cardAmount={item.cardAmount}
                                        upiAmount={item.upiAmount}
                                        creditAmount={item.creditAmount}
                                    />,
                                    formatDate(item.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                                ]}
                            />
                        ))}

                        {!isLoading && incomeReport.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-4 text-gray-600 font-semibold">No records found</td>
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
                </div>
            </div>

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
        </div>
    );
}

export default IncomeReport;
