import { DateRangePicker } from "@components/admin/DateRangePicker";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import SupplierProfileCard from "@components/SupplierProfileImage";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import { useDebounce } from "@hooks/useDebounce";
import type { OutOfStockReportShape } from "@models/inventory-reports";
import type { RootState } from "@store/index";
import { formatLocalDateTime, toTitleCase } from "@utils/converters";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
interface OutOfStockReportResponse {
    success: boolean;
    message: string;
    records: OutOfStockReportShape[];
    pagination: PaginationData;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const OutOfStockReport: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [outOfStockReport, setOutOfStockStockReport] = useState<OutOfStockReportShape[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const { format } = useCurrencyFormatter();
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
    useEffect(() => {
        if (token) {
            fetchOutOfStockStockReport();
        }
    }, [token, debouncedSearchTerm, page, limit]);

    const fetchOutOfStockStockReport = async (range = dateRange) => {
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
            const response = await axios.get<OutOfStockReportResponse>(Constants.GET_OUT_OF_STOCK_STOCK_REPORT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params
            });


            if (response.data.records) {
                setOutOfStockStockReport(response.data.records || []);
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
            fetchOutOfStockStockReport(range);
        } else {
            setDateRangeError('Please select start date and end date');
        }
    }

    const clearAllFilters = () => {
        setDateRange({ startDate: null, endDate: null });
        setSearchInput('');
        fetchOutOfStockStockReport({ startDate: null, endDate: null });
    }

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ limit: String(limit), page: String(newPage) });
    };

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-600"> Out of Stock Report </h1>
            </div>
            {/* Filters*/}
            {/* Filters*/}
            <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="w-full md:w-auto">
                    <input type="text" name="search" id="search" placeholder="Search..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600" />
                </div>
                <div className="hidden">
                    <DateRangePicker
                        value={dateRange}
                        onChange={handleRangeInputChange}
                    />
                    {dateRangeError && <p className="text-red-500 text-sm">{dateRangeError}</p>}
                </div>
                {/* clear filters */}
                <div className="w-full md:w-auto">
                    <button
                        onClick={clearAllFilters}
                        className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-auto text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                    >
                        Clear Filters
                    </button>
                </div>
                <div className="md:ml-auto w-full md:w-auto">
                    <select
                        value={limit}
                        onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                        className="border border-gray-300 px-3 py-2 rounded-md bg-white text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
                    >
                        {[10, 25, 50].map((num) => (
                            <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                        ))}
                    </select>
                </div>
            </div>
            {/* Table */}
            {/* Table */}
            <div className="w-full overflow-x-auto">
                <Table headers={['#', 'Design No', 'Item Type', 'Category', 'Unit', 'Purchase Price', 'Selling Price', 'Current Stock']}>
                    {!isLoading && outOfStockReport && outOfStockReport.map((item: OutOfStockReportShape, index: number) => (
                        <TableRow
                            key={item._id}
                            row={item}
                            index={index + 1}

                            columns={[
                                <div className="flex flex-col">

                                    {/* ✅ Variant details */}
                                    {item.variant && (
                                        <div className="text-md text-gray-500">
                                            <div><span className="font-bold text-gray-600"> {item.variant.designNo}</span>-{item.variant.color}-{item.variant.size}</div>
                                        </div>
                                    )}
                                </div>,


                                toTitleCase(item.type),
                                item.categoryName ? toTitleCase(item.categoryName) : '-',
                                item.unit ? toTitleCase(item.unit) : '-',
                                format(item.purchasePrice || 0),
                                format(item.sellingPrice || 0),
                                item.stock ?? 0
                            ]}
                        />
                    ))}

                    {!isLoading && outOfStockReport.length === 0 && (
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

export default OutOfStockReport;
