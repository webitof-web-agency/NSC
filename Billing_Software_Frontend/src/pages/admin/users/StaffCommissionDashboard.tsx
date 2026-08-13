import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { CardItem } from "@components/admin/dashboard/CardItem";
import { DashboardCard } from "@components/admin/dashboard/DashboardCard";
import dashboardBg from '@assets/images/dashboard-img.svg';
import MultiLineAreaChart from "@components/admin/MultiLineAreaChart";
import { BadgeDollarSign, BarChart2, User } from "lucide-react";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import CollapsibleRowTable from "@components/admin/CollapsibleRowTable";

const StaffCommissionDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);

  const { format } = useCurrencyFormatter(true);

  const [isLoading, setIsLoading] = useState(true);

  const [dashboard, setDashboard] = useState({
    staff: { name: "", email: "", phone: "", image: "" },
    todayCommission: 0,
    monthlyCommission: 0,
    totalEarned: 0,
    recentRecords: []
  });

  const [dailyChart, setDailyChart] = useState<any[]>([]);
  const [monthlyChart, setMonthlyChart] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    loadDailyChart();
    loadMonthlyChart();
  }, [id]);

  const loadDashboard = async () => {
    try {
      const res = await axios.get(
        Constants.FETCH_STAFF_COMMISSION_DASHBOARD_URL.replace(":id", id!),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboard(res.data.data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDailyChart = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";

    try {
      const res = await axios.get(
        Constants.FETCH_STAFF_DAILY_CHART_DATA_URL.replace(":id", id!),
        {
          params: { from: monthStart, to: today },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setDailyChart(res.data.data);
    } catch (err) { }
  };

  const loadMonthlyChart = async () => {
    const year = new Date().getFullYear();

    try {
      const res = await axios.get(
        Constants.FETCH_STAFF_MONTHLY_CHART_DATA_URL.replace(":id", id!),
        {
          params: { year },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setMonthlyChart(res.data.data);
    } catch (err) { }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderSpinner />
      </div>
    );
  }

  const staff = dashboard.staff;

  return (
    <div className="px-4 py-4 bg-gray-50 min-h-screen rounded-md">
      {/* HEADER */}
      <h1 className="text-2xl font-bold text-gray-950">Staff Commission Dashboard</h1>

      {/* PROFILE CARD */}
      <div className="mt-4 p-4 bg-primary text-white rounded-xl shadow flex justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{staff.name}</h2>
            <p>{staff.email} | {staff.phone}</p>
          </div>
        </div>
        <img src={dashboardBg} className='w-25' alt="Dashboard" />
      </div>

      {/* COMMISSION STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <DashboardCard title="Today's Commission" icon={<BadgeDollarSign className="w-6 h-6" />}>
          <CardItem
            icon={<BadgeDollarSign className="w-5 h-5 text-primary" />}
            label="Today"
            value={format(dashboard.todayCommission)}
            color="purple"
          />
        </DashboardCard>

        <DashboardCard title="Monthly Commission" icon={<BarChart2 className="w-6 h-6" />}>
          <CardItem
            icon={<BadgeDollarSign className="w-5 h-5 text-green-600" />}
            label="Month"
            value={format(dashboard.monthlyCommission)}
            color="green"
          />
        </DashboardCard>

        <DashboardCard title="Total Earned" icon={<User className="w-6 h-6" />}>
          <CardItem
            icon={<BadgeDollarSign className="w-5 h-5 text-blue-600" />}
            label="Total"
            value={format(dashboard.totalEarned)}
            color="blue"
          />
        </DashboardCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Daily Commission Trend</h2>
          <MultiLineAreaChart
            data={[dailyChart.map((d) => d.total)]}
            categories={dailyChart.map((d) => d._id)}
            seriesNames={["Daily Commission"]}
            color={["#4F46E5"]}
          />
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Monthly Commission Trend</h2>
          <MultiLineAreaChart
            data={[monthlyChart.map((m) => m.total)]}
            categories={monthlyChart.map((m) => m._id)}
            seriesNames={["Monthly Commission"]}
            color={["#22C55E"]}
          />
        </div>
      </div>

      {/* RECENT COMMISSIONS */}
      <div className="mt-6 bg-white p-4 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-3">Recent Commissions</h2>

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
              {dashboard.recentRecords.map((record: any, index: number) => {
                const hasItems = record.items && record.items.length > 0;
                const totalAmount = hasItems
                  ? record.items.reduce((sum: number, item: any) => sum + (item.amount || (item.qty * item.rate)), 0)
                  : (record.qty * record.rate);
                const totalCommission = record.totalCommissionAmount || record.commissionAmount || 0;

                return (
                  <CollapsibleRowTable
                    key={record._id}
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
                            {record.items.map((item: any, i: number) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                <td className="py-2 text-gray-700">{item.variantId?.designNo || item.designNo || "N/A"}</td>
                                <td className="py-2 text-gray-600">{item.qty}</td>
                                <td className="py-2 text-gray-600">{format(item.saleRate ?? item.rate)}</td>
                                <td className="py-2 text-gray-600">{format(item.amount)}</td>
                                <td className="py-2 text-gray-600">{item.commissionPercent}%</td>
                                <td className="py-2 font-semibold text-green-600">{format(item.commissionAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    }
                  >
                    <td className="px-3 py-2 text-sm text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-medium">{record.invoiceId?.invoiceNumber}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {hasItems ? `${record.items.length} Item(s)` : (record.variantId?.designNo || record.designNo || "N/A")}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-medium">{format(totalAmount)}</td>
                    <td className="px-3 py-2 text-sm text-green-600 font-bold">{format(totalCommission)}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{record.date}</td>
                  </CollapsibleRowTable>
                );
              })}

              {!dashboard.recentRecords.length && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => navigate(`/admin/staff/${id}/daily-commission`)}
            className="px-4 py-2 text-sm font-medium cursor-pointer bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Daily History
          </button>

          <button
            onClick={() => navigate(`/admin/staff/${id}/monthly-commission`)}
            className="px-4 py-2 text-sm font-medium cursor-pointer bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Monthly Summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffCommissionDashboard;
