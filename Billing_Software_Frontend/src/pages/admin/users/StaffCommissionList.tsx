import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import SupplierProfileCard from "@components/SupplierProfileImage";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Staff {
  id: string;
  staff: string;
  phone: string;
  role: string;
  amountPerDay: number;
  todayCommission: number;
  monthlyCommission: number;
  totalEarned: number;
  createdAt: string;
  profileImage: string;
}

const StaffCommissionList = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") || "";
  const limit = Number(searchParams.get("limit") || 10);
  const page = Number(searchParams.get("page") || 1);
  const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });

  const { token } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
  const formatCommission = (amount: number) =>
    `${systemSettings?.currency.symbol || "₹"}${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const navigate = useNavigate();

  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchStaffCommissionList();
  }, [search, limit, page]);

  const fetchStaffCommissionList = async () => {
    try {
      setIsLoading(true);

      const res = await axios.get(Constants.FETCH_STAFF_COMMISSION_FOR_LIST_STAFF_URL, {
        params: { search, limit, page },
        headers: { Authorization: `Bearer ${token}` },
      });

      const apiData = res.data?.data;

      setStaffs(apiData?.users ?? []);
      setPagination(apiData?.pagination ?? pagination);

    } catch (err) {
      toast.error("Failed to fetch staff commission list");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (keyword: string) => {
    setSearchInput(keyword);
  };

  const handleLimitChange = (newLimit: number) => {
    setSearchParams({ search, limit: String(newLimit), page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ search, limit: String(limit), page: String(newPage) });
  };

  const tableHeaders = [
    "#",
    "Staff",
    "Phone",
    "Role",
    "Amount/Day",
    "Today's Commission",
    "Monthly Commission",
    "Total Earned",
    "Actions",
  ];

  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-950">Staff Commissions</h1>
      </div>

      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search Staff..."
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        />

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

      <Table headers={tableHeaders}>
        {!isLoading &&
          staffs.map((staff, index) => (
            <TableRow
              key={staff.id}
              index={index + 1}
              row={staff}
              columns={[
                <SupplierProfileCard     // new coponent Similar to ProfileCard but works different
                  imageUrl={staff.profileImage}
                  name={staff.staff}
                  email=""
                />,
                staff.phone || "—",
                staff.role,
                `${systemSettings?.currency.symbol}${Number(staff.amountPerDay || 0).toFixed(2)}`,
                formatCommission(staff.todayCommission),
                formatCommission(staff.monthlyCommission),
                formatCommission(staff.totalEarned),
              ]}
              actions={[
                {
                  label: "View",
                  onClick: () => navigate(`/admin/staff/${staff.id}/commission-dashboard`),
                  icon: <></>,
                },
              ]}
            />
          ))}

        {!isLoading && staffs.length === 0 && (
          <tr>
            <td colSpan={9} className="text-center py-4 text-gray-950 font-semibold">
              No Staff Found
            </td>
          </tr>
        )}

        {isLoading && (
          <tr>
            <td colSpan={9} className="text-center py-4">
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
    </div>
  );
};

export default StaffCommissionList;
