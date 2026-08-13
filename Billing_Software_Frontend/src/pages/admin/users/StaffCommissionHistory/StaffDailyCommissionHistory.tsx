import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import { toast } from "react-toastify";
import { ArrowLeft, Search } from "lucide-react";
import CollapsibleRowTable from "@components/admin/CollapsibleRowTable";
import { format } from "date-fns";
import { DateRangePicker } from "@components/admin/DateRangePicker";

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const StaffDailyCommissionHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialInvoice = searchParams.get("invoice") || "";
  const initialStartDateStr = searchParams.get("startDate") || "";
  const initialEndDateStr = searchParams.get("endDate") || "";

  const limit = Number(searchParams.get("limit") || 20);
  const page = Number(searchParams.get("page") || 1);

  const { token } = useSelector((state: RootState) => state.auth);
  const { format: currency } = useCurrencyFormatter(true);

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>({ name: "", image: "" });

  // Local state
  const [invoiceInput, setInvoiceInput] = useState(initialInvoice);
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: initialStartDateStr ? new Date(initialStartDateStr) : null,
    endDate: initialEndDateStr ? new Date(initialEndDateStr) : null,
  });

  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  // Fetch whenever search params change
  useEffect(() => {
    fetchDailyHistory();
  }, [searchParams]);

  const fetchDailyHistory = async () => {
    try {
      setIsLoading(true);

      const res = await axios.get(
        Constants.FETCH_STAFF_DAILY_COMMISSION_HISTORY_FOR_LIST_STAFF_URL.replace(
          ":id",
          id!
        ),
        {
          params: {
            invoice: searchParams.get("invoice") || undefined,
            startDate: searchParams.get("startDate") || undefined,
            endDate: searchParams.get("endDate") || undefined,
            page,
            limit,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const apiData = res.data?.data;

      setRecords(apiData?.records ?? []);
      setStaff(apiData?.staff ?? {});
      setPagination(apiData?.pagination ?? pagination);
    } catch (err) {
      toast.error("Failed to load daily commission history");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const handleLimitChange = (newLimit: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", String(newLimit));
    params.set("page", "1"); // Reset to first page when limit changes
    setSearchParams(params);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();

    try {
      if (dateRange.startDate) {
        params.set("startDate", format(dateRange.startDate, "yyyy-MM-dd"));
      }
      if (dateRange.endDate) {
        params.set("endDate", format(dateRange.endDate, "yyyy-MM-dd"));
      }
    } catch (e) {
      console.error("Date format error", e);
    }

    if (invoiceInput.trim()) params.set("invoice", invoiceInput.trim());
    params.set("page", "1");
    params.set("limit", String(limit)); // Maintain current limit
    setSearchParams(params);
  };

  if (isLoading) return <div className="p-6">Loading...</div>; // Simple loading state

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/admin/staff/${id}/commission-dashboard`)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Daily Commission History – {staff.name}
            </h1>
            <p className="text-gray-500 text-sm">Detailed breakdown by Date</p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center flex-wrap gap-3">
        <div className="min-w-[260px]">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            value={invoiceInput}
            onChange={(e) => setInvoiceInput(e.target.value)}
          />
        </div>

        <button
          onClick={applyFilters}
          className="px-5 py-2.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap w-full sm:w-auto"
        >
          Apply Filters
        </button>

        <div className="sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-2.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
          >
            {[20, 50, 100].map((num) => (
              <option key={num} value={num}>
                {num} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">#</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">Invoice</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">Products</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">Total Amt</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">Total Comm.</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700">Date</th>
                <th className="px-3 py-2 text-sm font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec: any, index: number) => {
                const hasItems = rec.items && rec.items.length > 0;
                const totalAmount = hasItems
                  ? rec.items.reduce((sum: number, item: any) => sum + (item.amount || (item.qty * item.rate)), 0)
                  : (rec.qty * rec.rate);

                const totalCommission = rec.totalCommissionAmount || rec.commissionAmount || 0;

                return (
                  <CollapsibleRowTable
                    key={rec._id}
                    hasItems={hasItems}
                    expandedContent={
                      <>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide border-b border-gray-200 pb-1">
                          Commission Breakdown
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-2 text-left font-medium">Product</th>
                              <th className="py-2 text-left font-medium">Qty</th>
                              <th className="py-2 text-left font-medium">Rate</th>
                              <th className="py-2 text-left font-medium">Amount</th>
                              <th className="py-2 text-left font-medium">Comm %</th>
                              <th className="py-2 text-left font-medium">Commission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rec.items.map((item: any, i: number) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                <td className="py-2 text-gray-700">{item.variantId?.designNo || item.designNo || "N/A"}</td>
                                <td className="py-2 text-gray-600">{item.qty}</td>
                                <td className="py-2 text-gray-600">{currency(item.saleRate ?? item.rate)}</td>
                                <td className="py-2 text-gray-600">{currency(item.amount)}</td>
                                <td className="py-2 text-gray-600">{item.commissionPercent}%</td>
                                <td className="py-2 font-semibold text-green-600">{currency(item.commissionAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    }
                  >
                    <td className="px-3 py-2 text-sm text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-medium">{rec.invoiceId?.invoiceNumber}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {hasItems ? `${rec.items.length} Item(s)` : (rec.variantId?.designNo || rec.designNo || "N/A")}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-medium">{currency(totalAmount)}</td>
                    <td className="px-3 py-2 text-sm text-green-600 font-bold">{currency(totalCommission)}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{rec.date}</td>
                  </CollapsibleRowTable>
                );
              })}

              {!records.length && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="mt-4 flex justify-end">
        <PaginationWrapper
          count={pagination.totalPages}
          page={pagination.page}
          onChange={(_, newPage) => handlePageChange(newPage)}
          from={(pagination.page - 1) * pagination.limit + 1}
          to={Math.min(pagination.page * pagination.limit, pagination.total)}
          total={pagination.total}
        />
      </div>
    </div>
  );
};

export default StaffDailyCommissionHistory;
