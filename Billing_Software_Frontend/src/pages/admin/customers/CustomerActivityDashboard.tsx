import { useEffect, useMemo, useState } from "react";
import Table from "@components/admin/Table";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import { Download, Users, Activity, Clock, Moon, AlertTriangle, Search } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { format } from "date-fns";
import LoaderSpinner from "@components/admin/LoaderSpinner";

const CustomerActivityDashboard = () => {
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null,
  });
  const [profileStatus, setProfileStatus] = useState("all");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [visitSearch, setVisitSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    active3Months: 0,
    dormant3To6: 0,
    dormant6To12: 0,
    dormant12Plus: 0,
  });
  const [visits, setVisits] = useState({
    one: 0,
    two: 0,
    three: 0,
    four: 0,
    fivePlus: 0,
    tenPlus: 0,
  });
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const { token } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
  const currencySymbol = systemSettings?.currency?.symbol || "₹";

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Profiles" },
      { value: "active", label: "Active" },
      { value: "dormant", label: "Dormant" },
    ],
    []
  );

  const insightCards = [
    { label: "Total Customers", value: summary.totalCustomers, icon: <Users size={18} className="text-blue-600" />, bg: "bg-blue-50" },
    { label: "Active (3 Months)", value: summary.active3Months, icon: <Activity size={18} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "Dormant (3-6 Months)", value: summary.dormant3To6, icon: <Clock size={18} className="text-amber-600" />, bg: "bg-amber-50" },
    { label: "Dormant (6-12 Months)", value: summary.dormant6To12, icon: <Moon size={18} className="text-orange-600" />, bg: "bg-orange-50" },
    { label: "Dormant (12+ Months)", value: summary.dormant12Plus, icon: <AlertTriangle size={18} className="text-rose-600" />, bg: "bg-rose-50" },
  ];

  const visitSegments = [
    { label: "1 Time", value: visits.one, color: "bg-blue-600" },
    { label: "2 Times", value: visits.two, color: "bg-sky-500" },
    { label: "3 Times", value: visits.three, color: "bg-emerald-500" },
    { label: "4 Times", value: visits.four, color: "bg-amber-500" },
    { label: "5+ Times", value: visits.fivePlus, color: "bg-red-500" },
    { label: "10+ Times", value: visits.tenPlus, color: "bg-purple-600" },
  ];

  const totalVisits = visitSegments.reduce((sum, s) => sum + s.value, 0);

  const toYmd = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : "");

  const fetchSummary = async () => {
    try {
      const res = await axios.get(Constants.CUSTOMER_ACTIVITY_SUMMARY_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data?.data;
      setSummary(data?.summary || summary);
      setVisits(data?.visits || visits);
    } catch {
      toast.error("Failed to load customer activity summary");
    }
  };

  const fetchList = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(Constants.CUSTOMER_ACTIVITY_LIST_URL, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: phoneSearch,
          profileStatus,
          fromDate: toYmd(dateRange.startDate) || undefined,
          toDate: toYmd(dateRange.endDate) || undefined,
          page,
          limit
        }
      });
      const data = res.data?.data;
      setRows(data?.customers || []);
      setPagination(data?.pagination || pagination);
    } catch {
      toast.error("Failed to load customer activity list");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (visitSearch) {
        const v = Number(visitSearch);
        if (!Number.isNaN(v) && Number(row.visits || 0) !== v) return false;
      }
      return true;
    });
  }, [rows, visitSearch]);

  const handleExport = async () => {
    try {
      const response = await axios.get(Constants.CUSTOMER_ACTIVITY_EXPORT_URL, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: phoneSearch,
          profileStatus,
          fromDate: toYmd(dateRange.startDate) || undefined,
          toDate: toYmd(dateRange.endDate) || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Customer_Activity_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export customer activity");
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchSummary();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchList();
  }, [token, phoneSearch, profileStatus, dateRange, page, limit]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Customer Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Track customer visits and billing momentum.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
          >
            <Download size={16} /> Export Excel
          </button>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
          >
            {[10, 25, 50, 100].map((num) => (
              <option key={num} value={num}>{num} / page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Insights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {insightCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg} flex-shrink-0`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-xl font-bold text-gray-900 leading-tight">{card.value.toLocaleString()}</h4>
              <p className="text-xs font-medium text-gray-500 truncate">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Visits Breakdown Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Visit Frequency Breakdown</h3>
            <p className="text-sm text-gray-500">Distribution of customers by number of visits.</p>
          </div>
          <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 whitespace-nowrap">
            {totalVisits.toLocaleString()} Total Visits
          </div>
        </div>

        {totalVisits > 0 ? (
          <div className="w-full flex rounded-full overflow-hidden h-4 sm:h-5 border border-gray-100 bg-gray-100 mb-4">
            {visitSegments.map((segment) => (
              <div
                key={segment.label}
                className={`${segment.color} flex items-center justify-center transition-all duration-500`}
                style={{ width: `${(segment.value / totalVisits) * 100}%` }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            ))}
          </div>
        ) : (
          <div className="w-full h-4 sm:h-5 bg-gray-100 rounded-full mb-4 flex items-center justify-center text-xs text-gray-400">
            No visitor data available
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
          {visitSegments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${segment.color}`} />
              <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                {segment.label} <span className="text-gray-400 font-normal">({segment.value.toLocaleString()})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mt-6">

        {/* Filters Top Bar */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 pb-1.5">Search Phone</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Enter phone number..."
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-950"
                />
              </div>
            </div>

            <div className="col-span-1 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 pb-1.5">No of Visits</label>
              <input
                type="number"
                placeholder="Exact visits"
                value={visitSearch}
                onChange={(e) => setVisitSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-950"
              />
            </div>

            <div className="col-span-1 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 pb-1.5">Status Filter</label>
              <CustomSelectDropdown
                value={profileStatus}
                onChange={setProfileStatus}
                options={statusOptions}
                placeholder="All Profiles"
              />
            </div>

            <div className="col-span-1 lg:col-span-2 relative z-50">
              <label className="block text-sm font-medium text-gray-700 pb-1.5">Date Range</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          </div>
        </div>


        {/* Entry count */}
        <div className="px-5 py-3 border-b border-gray-200 bg-white">
          <div className="text-sm text-gray-500 font-medium">
            Showing {filteredRows.length > 0 ? ((page - 1) * limit + 1) : 0} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
          </div>
        </div>


        <div className="w-full overflow-x-auto">
          <Table
            headers={[
              "#",
              "Profile Status",
              "Phone Number",
              "Visits",
              "Lifetime Value",
              "Last Bill Value",
              "Last Bill Date",
              "Max Bill Amt.",
            ]}
          >
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center py-10">
                  <div className="flex justify-center items-center h-full w-full">
                    <LoaderSpinner />
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-500 font-medium">
                  No customer activity records found.
                </td>
              </tr>
            )}

            {!isLoading && filteredRows.length > 0 && filteredRows.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-700">{(page - 1) * limit + index + 1}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${row.profileStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {row.profileStatus || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">
                    {row.visits}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                  {currencySymbol}{Number(row.lifetimeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {currencySymbol}{Number(row.lastBillValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.lastBillDate ? format(new Date(row.lastBillDate), 'dd MMM, yyyy') : "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                  {currencySymbol}{Number(row.maxBillAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Pagination Wrapper */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-gray-200 flex justify-end items-center bg-gray-50/30">
            <PaginationWrapper
              count={pagination.totalPages}
              page={page}
              from={(pagination.page - 1) * pagination.limit + 1}
              to={Math.min(pagination.page * pagination.limit, pagination.total)}
              total={pagination.total}
              onChange={(_, newPage) => setPage(newPage)}
              paginationVariant="outlined"
              paginationShape="rounded"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerActivityDashboard;
