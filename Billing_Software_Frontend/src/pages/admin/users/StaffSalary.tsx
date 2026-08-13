import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import Modal from "@components/admin/Modal";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import SearchableDropdown from "@components/admin/SearchableDropdown";
import DateInput from "@components/admin/DateInput";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AttendanceSummary {
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  payableDays: number;
}

interface SalarySummaryRow {
  id: string;
  staff: string;
  phone: string | null;
  amountPerDay: number;
  attendance: AttendanceSummary;
  baseSalary: number;
  commission: number;
  totalSalary: number;
  paidToDate: number;
  balanceDue: number;
  month: string;
}

interface SalaryRecord {
  _id: string;
  paymentDate: string;
  paymentType: "ADVANCE" | "FULL";
  paymentMethod: "CASH" | "UPI" | "BANK" | "CHEQUE";
  paidAmount: number;
  paidBefore: number;
  balanceAfter: number;
  notes: string;
}

const StaffSalary = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector(
    (state: RootState) => state.systemSettings
  );

  const search = searchParams.get("search") || "";
  const limit = Number(searchParams.get("limit") || 10);
  const page = Number(searchParams.get("page") || 1);
  const monthParam = searchParams.get("month");
  const fromDateParam = searchParams.get("fromDate");
  const toDateParam = searchParams.get("toDate");
  const defaultMonthDate = new Date();
  const month = monthParam || format(defaultMonthDate, "yyyy-MM");
  const [searchInput, setSearchInput] = useDebouncedSearchParam({
    search,
    limit,
    setSearchParams,
    extraParams: {
      month,
      fromDate: fromDateParam || "",
      toDate: toDateParam || "",
    },
  });
  const [dateRange, setDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: fromDateParam ? new Date(fromDateParam) : null,
    endDate: toDateParam ? new Date(toDateParam) : null,
  });

  const [rows, setRows] = useState<SalarySummaryRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] =
    useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] =
    useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<SalarySummaryRow | null>(
    null
  );
  const [history, setHistory] = useState<SalaryRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  const [paymentType, setPaymentType] = useState<"ADVANCE" | "FULL">("ADVANCE");
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "UPI" | "BANK" | "CHEQUE"
  >("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "DUE" | "PAID">(
    "ALL"
  );

  const currencySymbol = systemSettings?.currency?.symbol || "₹";

  useEffect(() => {
    fetchSummary();
  }, [search, limit, page, month, fromDateParam, toDateParam]);

  useEffect(() => {
    setDateRange({
      startDate: fromDateParam ? new Date(fromDateParam) : null,
      endDate: toDateParam ? new Date(toDateParam) : null,
    });
  }, [fromDateParam, toDateParam]);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(Constants.FETCH_STAFF_SALARY_SUMMARY_URL, {
        params: {
          search,
          limit,
          page,
          month,
          fromDate: fromDateParam || undefined,
          toDate: toDateParam || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const apiData = res.data?.data;
      setRows(apiData?.users || []);
      setPagination(apiData?.pagination || pagination);
    } catch (err) {
      toast.error("Failed to fetch staff salary summary");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async (staffId: string) => {
    try {
      setIsHistoryLoading(true);
      const res = await axios.get(Constants.FETCH_STAFF_SALARY_RECORDS_URL, {
        params: {
          staffId,
          month,
          fromDate: fromDateParam || undefined,
          toDate: toDateParam || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to fetch salary records");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openPaymentModal = (row: SalarySummaryRow) => {
    setSelectedRow(row);
    setPaymentType("ADVANCE");
    setPaymentMethod("CASH");
    setPaidAmount(0);
    setNotes("");
    setPaymentDate(null);
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = async (row: SalarySummaryRow) => {
    setSelectedRow(row);
    setIsHistoryModalOpen(true);
    await fetchHistory(row.id);
  };

  const handleSearch = (keyword: string) => {
    setSearchInput(keyword);
  };

  const handleLimitChange = (newLimit: number) => {
    setSearchParams({
      search,
      limit: String(newLimit),
      page: "1",
      month,
      fromDate: fromDateParam || "",
      toDate: toDateParam || "",
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({
      search,
      limit: String(limit),
      page: String(newPage),
      month,
      fromDate: fromDateParam || "",
      toDate: toDateParam || "",
    });
  };

  const handleDateRangeChange = (range: { startDate: Date | null; endDate: Date | null }) => {
    setDateRange(range);
    const fromValue = range.startDate ? format(range.startDate, "yyyy-MM-dd") : "";
    const toValue = range.endDate ? format(range.endDate, "yyyy-MM-dd") : "";
    setSearchParams({
      search,
      limit: String(limit),
      page: "1",
      month,
      fromDate: fromValue,
      toDate: toValue,
    });
  };

  const handlePaymentTypeChange = (value: "ADVANCE" | "FULL") => {
    setPaymentType(value);
    if (value === "FULL" && selectedRow) {
      setPaidAmount(selectedRow.balanceDue);
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedRow) return;
    try {
      await axios.post(
        Constants.CREATE_STAFF_SALARY_RECORD_URL,
        {
          staffId: selectedRow.id,
          month,
          paymentType,
          paymentMethod,
          paidAmount,
          notes,
          paymentDate: paymentDate ? paymentDate.toISOString() : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Salary record saved successfully");
      setIsPaymentModalOpen(false);
      fetchSummary();
      if (isHistoryModalOpen) {
        fetchHistory(selectedRow.id);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to save salary record"
      );
    }
  };

  const tableHeaders = [
    "#",
    "Staff",
    "Amount/Day",
    "Payable Days",
    "Base Salary",
    "Commission",
    "Total Salary",
    "Paid",
    "Balance",
    "Actions",
  ];

  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  const paymentMethodOptions = useMemo(
    () => [
      { id: "CASH", name: "Cash" },
      { id: "UPI", name: "UPI" },
      { id: "BANK", name: "Bank" },
      { id: "CHEQUE", name: "Cheque" },
    ],
    []
  );

  const paymentTypeOptions = useMemo(
    () => [
      { id: "ADVANCE", name: "Advance" },
      { id: "FULL", name: "Full Payment" },
    ],
    []
  );

  const balanceFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All" },
      { value: "DUE", label: "Balance Due" },
      { value: "PAID", label: "Paid" },
    ],
    []
  );

  const filteredRows = useMemo(() => {
    if (balanceFilter === "DUE") {
      return rows.filter((r) => r.balanceDue > 0);
    }
    if (balanceFilter === "PAID") {
      return rows.filter((r) => r.balanceDue <= 0);
    }
    return rows;
  }, [rows, balanceFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.baseSalary += r.baseSalary || 0;
        acc.commission += r.commission || 0;
        acc.totalSalary += r.totalSalary || 0;
        acc.paid += r.paidToDate || 0;
        acc.balance += r.balanceDue || 0;
        return acc;
      },
      { baseSalary: 0, commission: 0, totalSalary: 0, paid: 0, balance: 0 }
    );
  }, [filteredRows]);

  const handleExport = async () => {
    try {
      const params: any = {
        search,
        month,
        fromDate: fromDateParam || undefined,
        toDate: toDateParam || undefined,
      };
      if (balanceFilter !== "ALL") {
        params.balance = balanceFilter;
      }

      const response = await axios.get(Constants.EXPORT_STAFF_SALARY_URL, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileSuffix =
        fromDateParam || toDateParam
          ? `${fromDateParam || "from"}_to_${toDateParam || "to"}`
          : month;
      link.download = `Staff_Salary_${fileSuffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to export staff salary");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-950">Staff Salary</h1>
      </div>

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-3 items-end w-full md:w-auto">
          <input
            type="text"
            placeholder="Search Staff..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          />
          <div className="w-full md:w-72">
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </div>
          <div className="w-full md:w-48">
            <CustomSelectDropdown
              value={balanceFilter}
              onChange={(value) => setBalanceFilter(value as "ALL" | "DUE" | "PAID")}
              options={balanceFilterOptions}
              placeholder="Filter"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
          >
            <Download size={14} />
            Export Excel
          </button>
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="border border-gray-300 px-3 py-2 rounded-md bg-white text-gray-950"
          >
            {[10, 25, 50].map((num) => (
              <option key={num} value={num}>
                {num} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
          <div className="text-gray-600 text-sm mb-1">Base Salary</div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}
            {totals.baseSalary.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
          <div className="text-gray-600 text-sm mb-1">Commission</div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}
            {totals.commission.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
          <div className="text-gray-600 text-sm mb-1">Total Salary</div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}
            {totals.totalSalary.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
          <div className="text-gray-600 text-sm mb-1">Paid</div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}
            {totals.paid.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
          <div className="text-gray-600 text-sm mb-1">Balance</div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}
            {totals.balance.toFixed(2)}
          </div>
        </div>
      </div>

      <Table headers={tableHeaders}>
        {!isLoading &&
          filteredRows.map((row, index) => (
            <TableRow
              key={row.id}
              index={index + 1}
              row={row}
              columns={[
                row.staff,
                `${currencySymbol}${row.amountPerDay.toFixed(2)}`,
                row.attendance.payableDays.toFixed(2),
                `${currencySymbol}${row.baseSalary.toFixed(2)}`,
                `${currencySymbol}${row.commission.toFixed(2)}`,
                `${currencySymbol}${row.totalSalary.toFixed(2)}`,
                `${currencySymbol}${row.paidToDate.toFixed(2)}`,
                `${currencySymbol}${row.balanceDue.toFixed(2)}`,
              ]}
              actions={[
                {
                  label: "Record",
                  onClick: () => openPaymentModal(row),
                  icon: <></>,
                },
                {
                  label: "History",
                  onClick: () => openHistoryModal(row),
                  icon: <></>,
                },
              ]}
            />
          ))}

        {!isLoading && filteredRows.length === 0 && (
          <tr>
            <td colSpan={10} className="text-center py-4 text-gray-950 font-semibold">
              No Staff Found
            </td>
          </tr>
        )}

        {isLoading && (
          <tr>
            <td colSpan={10} className="text-center py-4">
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

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Staff Salary"
      >
        {selectedRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Staff
                </label>
                <input
                  value={selectedRow.staff}
                  disabled
                  className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Month
                </label>
                <input
                  value={month}
                  disabled
                  className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Total Salary
                </label>
                <input
                  value={`${currencySymbol}${selectedRow.totalSalary.toFixed(2)}`}
                  disabled
                  className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Balance Due
                </label>
                <input
                  value={`${currencySymbol}${selectedRow.balanceDue.toFixed(2)}`}
                  disabled
                  className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Payment Type
                </label>
                <SearchableDropdown
                  placeholder="Select payment type"
                  options={paymentTypeOptions}
                  value={paymentTypeOptions.find((o) => o.id === paymentType) || null}
                  onChange={(_, value) =>
                    handlePaymentTypeChange(
                      (value?.id as "ADVANCE" | "FULL") || "ADVANCE"
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <SearchableDropdown
                  placeholder="Select payment method"
                  options={paymentMethodOptions}
                  value={
                    paymentMethodOptions.find((o) => o.id === paymentMethod) || null
                  }
                  onChange={(_, value) =>
                    setPaymentMethod(
                      (value?.id as "CASH" | "UPI" | "BANK" | "CHEQUE") || "CASH"
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {paymentType === "ADVANCE" ? "Advance Amount" : "Paid Amount"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950"
                />
              </div>
              <DateInput
                label="Payment Date"
                value={paymentDate}
                onChange={setPaymentDate}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-gray-950"
                onClick={handleCreatePayment}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Salary Records"
      >
        {selectedRow && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              {selectedRow.staff} • {month}
            </div>
            <Table
              headers={[
                "#",
                "Date",
                "Type",
                "Method",
                "Paid",
                "Balance After",
                "Notes",
              ]}
            >
              {!isHistoryLoading &&
                history.map((record, index) => (
                  <TableRow
                    key={record._id}
                    index={index + 1}
                    row={record}
                    columns={[
                      new Date(record.paymentDate).toLocaleDateString(),
                      record.paymentType,
                      record.paymentMethod,
                      `${currencySymbol}${record.paidAmount.toFixed(2)}`,
                      `${currencySymbol}${record.balanceAfter.toFixed(2)}`,
                      record.notes || "—",
                    ]}
                  />
                ))}

              {!isHistoryLoading && history.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gray-950 font-semibold">
                    No Records Found
                  </td>
                </tr>
              )}

              {isHistoryLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <LoaderSpinner />
                  </td>
                </tr>
              )}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StaffSalary;
