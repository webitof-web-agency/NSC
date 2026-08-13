import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import { toast } from "react-toastify";
import MonthInput from "@components/admin/MonthInput";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const StaffMonthlyCommissionSummary = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();


  const initialMonth = searchParams.get("months") || "";

  const limit = Number(searchParams.get("limit") || 12);
  const page = Number(searchParams.get("page") || 1);

  const { token } = useSelector((state: RootState) => state.auth);
  const { format: currency } = useCurrencyFormatter(true);

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>({ name: "" });

  // Convert "YYYY-MM" → Date object
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(
    initialMonth ? new Date(initialMonth + "-01") : null
  );

  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
  });

  // Fetch whenever URL changes
  useEffect(() => {
    fetchMonthlySummary();
  }, [searchParams]);

  const fetchMonthlySummary = async () => {
    try {
      setIsLoading(true);

      const res = await axios.get(
        Constants.FETCH_STAFF_MONTHLY_COMMISSION_SUMMARY_FOR_LIST_STAFF_URL.replace(
          ":id",
          id!
        ),
        {
          params: {
            months: searchParams.get("months") || undefined,
            page,
            limit,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const apiData = res.data?.data;

      setRecords(apiData?.summary ?? []);
      setStaff(apiData?.staff ?? {});
      setPagination(apiData?.pagination ?? pagination);
    } catch (err) {
      toast.error("Failed to load monthly commission summary");
    } finally {
      setIsLoading(false);
    }
  };

  // MONTH SELECTION (auto-search)
  const handleMonthChange = (date: Date | null) => {
    setSelectedMonth(date);

    const params = new URLSearchParams(searchParams);

    if (date) {
      const monthStr = format(date, "yyyy-MM");
      params.set("months", monthStr);
    } else {
      params.delete("months");
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  // Pagination
  const handleLimitChange = (newLimit: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", String(newLimit));
    params.set("page", "1");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  if (isLoading) return <LoaderSpinner />;

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
              Monthly Commission Summary – {staff.name}
            </h1>
            <p className="text-gray-500 text-sm">Aggregated by Month</p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* MONTH PICKER ONLY */}
        <div className="w-full md:w-60">
          <MonthInput
            label="Select Month"
            value={selectedMonth}
            onChange={handleMonthChange}
          />
        </div>

        {/* LIMIT DROPDOWN */}
        <select
          value={limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="border border-gray-300 px-3 py-2 rounded-md bg-white w-full md:w-auto"
        >
          {[12, 24, 50].map((num) => (
            <option key={num} value={num}>
              {num} / page
            </option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <Table headers={["#", "Month", "Commission", "Invoices"]}>
        {records.map((rec, index) => (
          <TableRow
            key={rec.month}
            index={index + 1}
            row={rec}
            columns={[
              rec.month,
              currency(rec.commission),
              rec.records.length,
            ]}
          />
        ))}

        {!records.length && (
          <tr>
            <td colSpan={4} className="text-center py-6">
              No records found.
            </td>
          </tr>
        )}
      </Table>

      {/* PAGINATION */}
      <PaginationWrapper
        count={pagination.totalPages}
        page={page}
        onChange={(_, newPage) => handlePageChange(newPage)}
        from={0}
        to={0}
        total={0}
      />
    </div>
  );
};

export default StaffMonthlyCommissionSummary;
