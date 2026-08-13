import Constants from '@constants/api';
import useDateFormatter from '@hooks/useDateFormatter';
import type { RootState } from '@store/index';
import axios from 'axios';
import { Calendar, Clock, Users, FileText, ShoppingCart, Truck, Receipt, LayoutGrid, ArrowRight, User, Package, BarChart2, BadgeDollarSign, CreditCard, AlertCircle, CheckCircle2, LogOut, RefreshCcw, HelpCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { modeConfig } from '@components/admin/PaymentModeBadge';
import { CardItem } from '@components/admin/dashboard/CardItem';
import { DashboardCard } from '@components/admin/dashboard/DashboardCard';
import Table from '@components/admin/Table';
import type { CustomersShape, PirchartShape, PurchaseStats, RecentInvoices, RecentPayments, RecentPurchase, SaleStats, SuppliersShape } from '@models/dashboard';
import TableRow from '@components/admin/TableRow';
import InvoiceStatusBadge from '@components/admin/InvoiceStatusBadge';
import StatusBadge from '@components/admin/StatusBadge';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import PaymentModeBadge from '@components/admin/PaymentModeBadge';
import { useNavigate } from 'react-router-dom';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import ProfileCard from '@components/admin/ProfileImage';
import InvoicePaymentSummary from '@components/admin/InvoicePaymentSummary';
import { formatLocalDateTime } from '@utils/converters';
import { toast } from 'react-toastify';
import MultiLineAreaChart from '@components/admin/MultiLineAreaChart';

import SupplierProfileCard from '@components/SupplierProfileImage';
import type { IncomeReportShape } from '@types/accounting-reports';
import type { PurchaseReportShape } from '@types/transaction-reports';
interface DashboardData {
    totalInvoiceCount: number;
    totalProductCount: number;
    totalCustomerCount: number;
    totalSupplierCount: number;
    lastFiveCustomers: CustomersShape[];
    lastFiveSuppliers: SuppliersShape[];
    lastSevenInvoices: RecentInvoices[];      // lastFiveInvoices if want
    lastFivePayments: RecentPayments[];
    lastFivePurchases: RecentPurchase[];
    sales: SaleStats;
    purchases: PurchaseStats;
    graph1: PirchartShape[];
    graph2: GraphItem[];
    paymentModeSummary: Record<string, number>;
}
interface DashboardDataResponse {
    data: DashboardData
}
interface GraphItem {
    month: string;
    purchases: number;
    sales: number;
}

interface Staff {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: string;
    roleName?: string;
}

interface Attendance {
    _id: string;
    attendanceId: string;
    staffId: Staff;
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    status: string;
    workingHours: number;
    notes?: string;
}

interface TodayAttendanceData {
    date: string;
    checkedIn: Attendance[];
    checkedOut: Attendance[];
    notMarked: Staff[];
    summary: {
        totalStaff: number;
        present: number;
        checkedIn: number;
        checkedOut: number;
        notMarked: number;
    };
}

interface DashboardIncomeReportResponse {
    success: boolean;
    data: {
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
    };
    records: IncomeReportShape[];
}

interface DashboardPurchaseReportResponse {
    success: boolean;
    data: {
        totalPurchases: {
            count: number;
            totalAmount: number;
        };
        completedOrders: {
            count: number;
            totalAmount: number;
        };
        pendingOrders: {
            count: number;
            totalAmount: number;
        };
        cancelledOrders: {
            count: number;
            totalAmount: number;
        };
    };
    records: PurchaseReportShape[];
}

const DashboardPage: React.FC = () => {

    const { user, token } = useSelector((state: RootState) => state.auth);
    const [time, setTime] = useState<Date>(new Date());
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { formatDate } = useDateFormatter();
    const { format } = useCurrencyFormatter();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceData, setAttendanceData] = useState<TodayAttendanceData | null>(null);
    const [todayIncomeSummary, setTodayIncomeSummary] = useState<DashboardIncomeReportResponse['data'] | null>(null);
    const [todayIncomeRecords, setTodayIncomeRecords] = useState<IncomeReportShape[]>([]);
    const [todayIncomeLoading, setTodayIncomeLoading] = useState(false);
    const [todayPurchaseSummary, setTodayPurchaseSummary] = useState<DashboardPurchaseReportResponse['data'] | null>(null);
    const [todayPurchaseRecords, setTodayPurchaseRecords] = useState<PurchaseReportShape[]>([]);
    const [todayPurchaseLoading, setTodayPurchaseLoading] = useState(false);
    const [markingCheckIn, setMarkingCheckIn] = useState<string | null>(null);
    const [markingCheckOut, setMarkingCheckOut] = useState<string | null>(null);
    const [dashboardData, setDashboardData] = useState<DashboardData>({
        totalInvoiceCount: 0,
        totalProductCount: 0,
        totalCustomerCount: 0,
        totalSupplierCount: 0,
        lastFiveCustomers: [],
        lastFiveSuppliers: [],
        lastSevenInvoices: [],
        lastFivePayments: [],
        lastFivePurchases: [],
        sales: {
            totalSalesAmount: 0,
            totalDueAmount: 0,
            receivedAmount: 0,
            quotationCount: 0
        },
        purchases: {
            totalPurchasesAmount: 0,
            totalPaidPurchases: 0,
            totalDuePurchases: 0,
            debitNoteCount: 0
        },
        graph1: [],
        graph2: [],
        paymentModeSummary: {}
    });
    let pieChartData: any = [];
    if (dashboardData.graph1.length > 0) {
        pieChartData = dashboardData.graph1.map((item) => ({
            id: item.name,
            value: item.totalQty,
            label: item.name
                .split(" ")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(" "),
        }));
    }

    let purchaseAndSaleChartData: any = [];
    if (dashboardData.graph2.length > 0) {
        //2 data set purchase and sale
        purchaseAndSaleChartData[0] = dashboardData.graph2.map((item) => item.purchases);
        purchaseAndSaleChartData[1] = dashboardData.graph2.map((item) => item.sales);
    }
    useEffect(() => {
        // Set up an interval to update the time every minute
        const timer = setInterval(() => setTime(new Date()), 60000);

        // Cleanup function to clear the interval when the component unmounts
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchDashboardData();
        fetchTodayAttendance();
        fetchTodayIncomeReport();
        fetchTodayPurchaseReport();
    }, []);

    const getGreeting = (): string => {
        const hour = new Date().getHours();

        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };
    const fetchDashboardData = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get<DashboardDataResponse>(Constants.GET_DASHBOARD_DATA_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data) {
                setDashboardData(prev => ({ ...prev, ...response.data.data }));
            }
        } catch (error) {

        } finally {
            setIsLoading(false);
        }
    }

    const fetchTodayAttendance = async () => {
        try {
            setAttendanceLoading(true);
            const response = await axios.get(Constants.GET_TODAY_ATTENDANCE_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                setAttendanceData(response.data.data);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch today attendance');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const fetchTodayIncomeReport = async () => {
        try {
            setTodayIncomeLoading(true);
            const today = new Date();
            const response = await axios.get<DashboardIncomeReportResponse>(
                Constants.GET_INCOME_REPORT_URL,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        startDate: formatLocalDateTime(today, 'start', true),
                        endDate: formatLocalDateTime(today, 'end', true),
                        page: 1,
                        limit: 100,
                    },
                }
            );

            if (response.data?.success) {
                setTodayIncomeSummary(response.data.data);
                setTodayIncomeRecords(response.data.records || []);
            }
        } catch (error) {
            console.error("Failed to fetch today's income summary:", error);
        } finally {
            setTodayIncomeLoading(false);
        }
    };

    const fetchTodayPurchaseReport = async () => {
        try {
            setTodayPurchaseLoading(true);
            const today = new Date();
            const response = await axios.get<DashboardPurchaseReportResponse>(
                Constants.GET_PURCHASE_REPORT_URL,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        startDate: formatLocalDateTime(today, 'start', true),
                        endDate: formatLocalDateTime(today, 'end', true),
                        page: 1,
                        limit: 10,
                    },
                }
            );

            if (response.data?.success) {
                setTodayPurchaseSummary(response.data.data);
                setTodayPurchaseRecords(response.data.records || []);
            }
        } catch (error) {
            console.error("Failed to fetch today's purchase summary:", error);
        } finally {
            setTodayPurchaseLoading(false);
        }
    };

    const handleQuickCheckIn = async (staff: Staff) => {
        try {
            setMarkingCheckIn(staff._id);
            const payload = {
                staffId: staff._id,
                date: new Date().toISOString().split('T')[0],
                checkInTime: new Date().toISOString(),
                status: 'PRESENT',
                notes: '',
            };
            const response = await axios.post(Constants.CREATE_ATTENDANCE_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                toast.success(`Check-in marked for ${staff.firstName} ${staff.lastName}`);
                fetchTodayAttendance();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to mark attendance');
        } finally {
            setMarkingCheckIn(null);
        }
    };

    const handleQuickCheckOut = async (attendance: Attendance) => {
        try {
            setMarkingCheckOut(attendance._id);
            const response = await axios.patch(
                `${Constants.CHECKOUT_ATTENDANCE_URL}/${attendance._id}`,
                { checkOutTime: new Date().toISOString(), notes: '' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success) {
                toast.success(`Check-out marked for ${attendance.staffId.firstName} ${attendance.staffId.lastName}`);
                fetchTodayAttendance();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to mark check-out');
        } finally {
            setMarkingCheckOut(null);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formattedTime: string = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    if (isLoading) {
        return (
            <div className='p-4 md:p-6 bg-gray-50 min-h-full font-sans flex items-center justify-center'>
                <LoaderSpinner />
            </div>
        );
    }
    return (
        <div className="px-4 py-2 bg-gray-50 min-h-full font-sans border border-gray-200 rounded-md">
            <h1 className="text-xl md:text-2xl font-bold text-gray-600">Dashboard</h1>


            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <DashboardCard title="Overview" icon={<LayoutGrid className="w-4 h-4" />}>
                    <CardItem icon={<FileText className="w-4 h-4 text-primary" />} label="Invoices" value={dashboardData.totalInvoiceCount || 0} color="purple" onClick={() => navigate("/admin/invoices")} />
                    <CardItem icon={<User className="w-4 h-4 text-green-600" />} label="Customers" value={dashboardData.totalCustomerCount || 0} color="green" onClick={() => navigate("/admin/customers")} />
                    <CardItem icon={<Package className="w-4 h-4 text-yellow-600" />} label="Products" value={dashboardData.totalProductCount || 0} color="yellow" onClick={() => navigate("/admin/products")} />
                    <CardItem icon={<Truck className="w-4 h-4 text-blue-600" />} label="Suppliers" value={dashboardData.totalSupplierCount || 0} color="blue" onClick={() => navigate("/admin/suppliers")} />
                </DashboardCard>

                <DashboardCard title="Sales Statistics" icon={<BarChart2 className="w-4 h-4" />}>
                    <CardItem icon={<BadgeDollarSign className="w-4 h-4 text-primary" />} label="Total Sales" value={format(dashboardData.sales.totalSalesAmount || 0)} color="purple" onClick={() => navigate("/admin/reports/sales")} />
                    <CardItem icon={<CreditCard className="w-4 h-4 text-green-600" />} label="Paid Amount" value={format(dashboardData.sales.receivedAmount || 0)} color="green" onClick={() => navigate("/admin/reports/income")} />
                    <CardItem icon={<AlertCircle className="w-4 h-4 text-red-600" />} label="Amount Due" value={format(dashboardData.sales.totalDueAmount || 0)} color="red" onClick={() => navigate("/admin/invoices")} />
                </DashboardCard>


                {user?.user_type === 1 || systemSettings?.permissions?.some(p => p.moduleSlug === 'purchases' && p.view) ? (
                    <DashboardCard title="Purchase Statistics" icon={<ShoppingCart className="w-4 h-4" />}>
                        <CardItem icon={<FileText className="w-4 h-4 text-primary" />} label="Total Purchases" value={format(dashboardData.purchases.totalPurchasesAmount || 0)} color="purple" onClick={() => navigate("/admin/purchases")} />
                        <CardItem icon={<CreditCard className="w-4 h-4 text-green-600" />} label="Paid Amount" value={format(dashboardData.purchases.totalPaidPurchases || 0)} color="green" onClick={() => navigate("/admin/supplier-payments")} />
                        <CardItem icon={<AlertCircle className="w-4 h-4 text-red-600" />} label="Amount Due" value={format(dashboardData.purchases.totalDuePurchases || 0)} color="red" onClick={() => navigate("/admin/supplier-payments")} />
                        <CardItem icon={<FileText className="w-4 h-4 text-blue-600" />} label="Debit Notes" value={dashboardData.purchases.debitNoteCount} color="blue" onClick={() => navigate("/admin/debit-notes")} />
                    </DashboardCard>
                ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <DashboardCard title="Today's Payment by Mode" icon={<CreditCard className="w-4 h-4" />}>
                    {Object.entries(dashboardData.paymentModeSummary).filter(([_, val]) => val > 0).map(([mode, amount]) => {
                        return (
                            <div key={mode} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
                                <PaymentModeBadge mode={mode} />
                                <span className="font-semibold text-gray-700">{format(amount)}</span>
                            </div>
                        );
                    })}
                    {Object.keys(dashboardData.paymentModeSummary).length === 0 || Object.values(dashboardData.paymentModeSummary).every(v => v === 0) ? (
                         <div className="col-span-2 text-sm text-gray-500 py-2">No payments received today.</div>
                    ) : null}
                </DashboardCard>

                <div className="md:col-span-2 bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center">
                    <h2 className='text-lg font-semibold text-gray-600 mb-2'>
                        Sales by Month
                    </h2>
                    <div className="flex-1 min-h-[250px]">
                        <MultiLineAreaChart
                            data={purchaseAndSaleChartData}
                            seriesNames={["Purchase", "Sales"]}
                            categories={dashboardData.graph2.map((item) => item.month)}
                            color={["#60A5FA", "#34D399"]}
                        />
                    </div>
                </div>
            </div>


            {/* Chart */}
            {/* Sales chart by month */}

            {/* Top product sales */}

            {(user?.user_type === 1 || systemSettings?.permissions?.some(p => p.moduleSlug === 'accounting-reports' && p.view)) && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700">Today&apos;s Income Report Summary</h3>
                            <p className="text-sm text-gray-500">
                                Current day income snapshot from today&apos;s invoice payments.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/reports/income')}
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark"
                        >
                            View full report
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {todayIncomeLoading ? (
                        <div className="py-8 flex justify-center">
                            <LoaderSpinner />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Today&apos;s Product Sales</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayIncomeSummary?.product_sales.currentMonthAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                                            <BadgeDollarSign className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Today&apos;s Total Income</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayIncomeSummary?.total_income.currentMonthAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                            <CreditCard className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                                        <h2 className="text-sm font-semibold text-gray-800">
                                            Today&apos;s Income Transactions
                                        </h2>
                                        <span className="text-xs text-gray-400">{todayIncomeRecords.length} record(s)</span>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <Table
                                            headers={[
                                                "#",
                                                "Invoice No",
                                                "Customer",
                                                "Amount",
                                                "Paid Date",
                                                "Payment Mode",
                                                "Created On",
                                            ]}
                                        >
                                            {todayIncomeRecords.map((item, index) => (
                                                <TableRow
                                                    key={item.id}
                                                    index={index + 1}
                                                    row={item}
                                                    columns={[
                                                        item.invoiceNumber,
                                                        <ProfileCard phone={item.customer?.phone || "N/A"} />,
                                                        format(item.amount || 0),
                                                        formatDate(item.paidDate, systemSettings?.dateFormat?.format || 'd-m-Y'),
                                                        <InvoicePaymentSummary
                                                            mode={item.paymentMode?.name || ''}
                                                            amount={Number(item.amount || 0)}
                                                            cashAmount={item.cashAmount}
                                                            cardAmount={item.cardAmount}
                                                            upiAmount={item.upiAmount}
                                                            creditAmount={item.creditAmount}
                                                        />,
                                                        formatDate(item.createdAt, systemSettings?.dateFormat?.format || 'd-m-Y'),
                                                    ]}
                                                />
                                            ))}

                                            {todayIncomeRecords.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                                                        No income records available for today.
                                                    </td>
                                                </tr>
                                            )}
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Quick Attendance (Admin Only) */}
            {user?.user_type === 1 && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold text-gray-700">Quick Staff Attendance</h3>
                        </div>
                        <button
                            type="button"
                            onClick={fetchTodayAttendance}
                            className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                        >
                            <RefreshCcw className="w-3 h-3" />
                            Refresh
                        </button>
                    </div>

                    {attendanceLoading ? (
                        <div className="py-6 text-center text-gray-500">Loading attendance...</div>
                    ) : attendanceData ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="border border-gray-200 rounded-lg">
                                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">Not Marked (Check-In)</span>
                                    <span className="text-xs text-gray-500">{attendanceData.notMarked.length}</span>
                                </div>
                                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                    {attendanceData.notMarked.length === 0 ? (
                                        <div className="p-3 text-xs text-gray-500">All staff marked today.</div>
                                    ) : (
                                        attendanceData.notMarked.map((staff) => (
                                            <div key={staff._id} className="p-3 flex items-center justify-between">
                                                <div className="text-sm text-gray-700">
                                                    {staff.firstName} {staff.lastName}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickCheckIn(staff)}
                                                    disabled={markingCheckIn === staff._id}
                                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary text-white disabled:opacity-60"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {markingCheckIn === staff._id ? 'Checking in...' : 'Check In'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg">
                                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">Checked In (Check-Out)</span>
                                    <span className="text-xs text-gray-500">{attendanceData.checkedIn.length}</span>
                                </div>
                                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                    {attendanceData.checkedIn.length === 0 ? (
                                        <div className="p-3 text-xs text-gray-500">No active check-ins.</div>
                                    ) : (
                                        attendanceData.checkedIn.map((attendance) => (
                                            <div key={attendance._id} className="p-3 flex items-center justify-between">
                                                <div className="text-sm text-gray-700">
                                                    {attendance.staffId.firstName} {attendance.staffId.lastName}
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        {formatTime(attendance.checkInTime)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickCheckOut(attendance)}
                                                    disabled={markingCheckOut === attendance._id}
                                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                                                >
                                                    <LogOut className="w-3 h-3" />
                                                    {markingCheckOut === attendance._id ? 'Saving...' : 'Check Out'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-center text-gray-500">Attendance data not available.</div>
                    )}
                </div>
            )}

            {(user?.user_type === 1 || systemSettings?.permissions?.some(p => p.moduleSlug === 'purchases' && p.view)) && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700">Today&apos;s Purchase Report Summary</h3>
                            <p className="text-sm text-gray-500">
                                Current day purchase snapshot from today&apos;s purchase report.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/reports/purchase')}
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark"
                        >
                            View full report
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {todayPurchaseLoading ? (
                        <div className="py-8 flex justify-center">
                            <LoaderSpinner />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Today&apos;s Total Purchases</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayPurchaseSummary?.totalPurchases.totalAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                                            <ShoppingCart className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Completed Orders</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayPurchaseSummary?.completedOrders.totalAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Pending Orders</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayPurchaseSummary?.pendingOrders.totalAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
                                            <AlertCircle className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Returned Orders</p>
                                            <p className="mt-1 text-2xl font-semibold text-gray-800">
                                                {format(todayPurchaseSummary?.cancelledOrders.totalAmount || 0)}
                                            </p>
                                        </div>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                                            <Receipt className="w-5 h-5" />
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                                    <h2 className="text-sm font-semibold text-gray-800">
                                        Today&apos;s Purchase Transactions
                                    </h2>
                                    <span className="text-xs text-gray-400">{todayPurchaseRecords.length} record(s)</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table
                                        headers={[
                                            "#",
                                            "Supplier",
                                            "Supplier Bill No",
                                            "Total Amount",
                                            "Paid Amount",
                                            "Balance",
                                            "Status",
                                            "Created On",
                                        ]}
                                    >
                                        {todayPurchaseRecords.map((item, index) => (
                                            <TableRow
                                                key={`${item.purchaseId}-${index}`}
                                                index={index + 1}
                                                row={item}
                                                columns={[
                                                    <SupplierProfileCard
                                                        imageUrl={item.vendor?.image}
                                                        name={item.vendor?.name || "N/A"}
                                                    />,
                                                    item.supplierBillNumber || "-",
                                                    format(item.totalAmount || 0),
                                                    format(item.paidAmount || 0),
                                                    format(item.balance || 0),
                                                    <StatusBadge status={item.status} />,
                                                    formatDate(item.purchaseDate || item.createdAt, systemSettings?.dateFormat?.format || 'd-m-Y'),
                                                ]}
                                            />
                                        ))}

                                        {todayPurchaseRecords.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                                                    No purchase records available for today.
                                                </td>
                                            </tr>
                                        )}
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="invoices rounded-xl bg-white p-3 border border-gray-200 mt-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-600 flex items-center gap-3">
                        <span className="p-2 rounded-full bg-blue-100 border border-blue-200 shadow-sm flex items-center justify-center transition-all duration-300 hover:shadow-md">
                            <Receipt className="w-4 h-4 text-blue-600" />
                        </span>
                        Recent Invoices
                    </h4>
                    <button
                        onClick={() => navigate("/admin/invoices")}
                        className="text-sm text-blue-600 hover:text-white hover:bg-blue-600 px-3 py-1 rounded-md flex items-center gap-1 transition-all duration-300">
                        View all <ArrowRight className="w-4 h-4" />
                    </button>
                </div>


                {/* Table */}
                <Table headers={["#", "Invoice No", "Customer", "Amount", "Status", "Created On",]}>
                    {dashboardData.lastSevenInvoices &&
                        dashboardData.lastSevenInvoices.map((invoice, index) => (
                            <TableRow
                                key={invoice._id}
                                index={index + 1}
                                row={invoice}
                                columns={[
                                    invoice.invoiceNumber,
                                    <ProfileCard
                                        phone={invoice.customer.phone}
                                    />,
                                    format(invoice.totalAmount),
                                    <InvoiceStatusBadge status={invoice.status} />,
                                    formatDate(
                                        invoice.createdAt,
                                        systemSettings?.dateFormat.format || "d-m-Y"
                                    ),
                                ]}
                            />
                        ))}

                    {/* Empty State */}
                    {!dashboardData.lastSevenInvoices?.length && (
                        <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500 font-medium">
                                <Receipt className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                No invoices found
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

            {/* Customers & Invoice Payments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Customers */}
                <div className="customers bg-white p-3 rounded-xl border border-gray-200">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-600 flex items-center gap-3">
                            <span className="p-2 rounded-full bg-third border border-fourth shadow-sm flex items-center justify-center transition-all duration-300 hover:shadow-md">
                                <Users className="w-4 h-4 text-primary" />
                            </span>
                            Recent Customers
                        </h4>
                        <button
                            onClick={() => navigate("/admin/customers")}
                            className="text-sm text-primary hover:text-white hover:bg-primary px-3 py-1 rounded-md flex items-center gap-1 transition-all duration-300">
                            View all <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>


                    {/* Table */}
                    <Table headers={["#", "Phone", "Created On"]}>
                        {dashboardData.lastFiveCustomers && dashboardData.lastFiveCustomers.map((customer, index) => (
                            <TableRow
                                key={customer._id}
                                row={customer}
                                index={index + 1}
                                columns={[
                                    customer.phone,
                                    formatDate(customer.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                                ]}
                            />
                        ))}
                        {!dashboardData.lastFiveCustomers.length && (
                            <tr>
                                <td colSpan={6} className="text-center py-6 text-gray-500 font-medium">
                                    <Users className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                    No customers found
                                </td>
                            </tr>
                        )}
                    </Table>
                </div>

                {/* Recent Invoice Payments */}
                <div className="recent-transactions bg-white p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-600 flex items-center gap-3">
                            <span className="p-2 rounded-full bg-third border border-fourth shadow-sm flex items-center justify-center transition-all duration-300 hover:shadow-md">
                                <Receipt className="w-4 h-4 text-primary" />
                            </span>
                            Recent Invoice Payments
                        </h4>
                    </div>


                    {/* Table */}
                    <Table headers={["#", "Invoice No", "Amount", "Payment Method"]}>
                        {dashboardData.lastFivePayments && dashboardData.lastFivePayments.map((payment, index) => (
                            <TableRow
                                key={payment._id}
                                row={payment}
                                index={index + 1}
                                columns={[
                                    payment.invoice?.invoiceNumber || 'N/A',
                                    // Show breakdown for MIXED payments
                                    payment.payment_method === 'MIXED'
                                        ? [
                                            Number(payment.cashAmount || 0) > 0 ? `Cash: ${format(payment.cashAmount || 0)}` : null,
                                            Number(payment.cardAmount || 0) > 0 ? `Card: ${format(payment.cardAmount || 0)}` : null,
                                            Number(payment.upiAmount || 0) > 0 ? `UPI: ${format(payment.upiAmount || 0)}` : null,
                                        ].filter(Boolean).join(' | ')
                                        : payment.payment_method === 'CREDIT'
                                            ? `${Number(payment.creditAmount || 0) > 0
                                                ? `Credit: ${format(payment.creditAmount || 0)}${Number(payment.amount || 0) > 0 ? ` | Paid: ${format(payment.amount || 0)}` : ''}`
                                                : `Paid: ${format(payment.amount || 0)}`
                                            }`
                                            : format(payment.amount || 0),
                                    <PaymentModeBadge mode={payment.payment_method} />  // becausse of changes in invoicePayment model schema
                                ]}
                            />
                        ))}
                        {!dashboardData.lastFivePayments.length && (
                            <tr>
                                <td colSpan={6} className="text-center py-6 text-gray-500 font-medium">
                                    <Receipt className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                    No payments found
                                </td>
                            </tr>
                        )}
                    </Table>
                </div>

            </div>

            {/* Supplierrs & Recent Purchases */}
            {user?.user_type === 1 || systemSettings?.permissions?.some(p => p.moduleSlug === 'suppliers' && p.view) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

                    {/* Suppliers */}
                    <div className="suppliers bg-white p-3 rounded-xl border border-gray-200">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-600 flex items-center gap-3">
                                <span className="p-2 rounded-full bg-green-100 border border-green-200 shadow-sm flex items-center justify-center transition-all duration-300 hover:shadow-md">
                                    <Truck className="w-4 h-4 text-green-600" />
                                </span>
                                Recent Suppliers
                            </h4>
                            <button
                                onClick={() => navigate("/admin/suppliers")}
                                className="text-sm text-green-600 hover:text-white hover:bg-green-600 px-3 py-1 rounded-md flex items-center gap-1 transition-all duration-300">
                                View all <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>


                        {/* Table */}
                        <Table headers={["#", "Name", "Phone", "Created On"]}>
                            {dashboardData.lastFiveSuppliers && dashboardData.lastFiveSuppliers.map((supplier, index) => (
                                <TableRow
                                    key={supplier._id}
                                    row={supplier}
                                    index={index + 1}
                                    columns={[
                                        <SupplierProfileCard
                                            imageUrl={supplier.profileImageUrl}
                                            name={supplier.name}
                                        />,
                                        supplier.phone,
                                        formatDate(supplier.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                                    ]}
                                />
                            ))}
                            {!dashboardData.lastFiveSuppliers.length && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-gray-500 font-medium">
                                        <Truck className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                        No suppliers found
                                    </td>
                                </tr>
                            )}
                        </Table>
                    </div>

                    {/* Purchases */}
                    <div className="purchases bg-white p-4 rounded-xl border border-gray-200 ">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-600 flex items-center gap-3">
                                <span className="p-2 rounded-full bg-green-100 border border-green-300 flex items-center justify-center transition-all duration-300 hover:shadow-md">
                                    <ShoppingCart className="w-4 h-4 text-green-600" />
                                </span>
                                Recent Purchases
                            </h4>
                            <button
                                onClick={() => navigate("/admin/purchases")}
                                className="text-sm text-green-600 hover:text-white hover:bg-green-600 px-3 py-1 rounded-md flex items-center gap-1 transition-all duration-300">
                                View all <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>


                        {/* Table */}
                        <Table headers={["#", "Purchase No", "Supplier", "Amount"]}>
                            {dashboardData.lastFivePurchases && dashboardData.lastFivePurchases.map((purchase, index) => (
                                <TableRow
                                    key={purchase._id}
                                    row={purchase}
                                    index={index + 1}
                                    columns={[
                                        purchase.purchaseId,
                                        <SupplierProfileCard
                                            imageUrl={purchase.vendor?.profileImage ?? ""}
                                            name={purchase.vendor?.name ?? ""}
                                        />,
                                        format(purchase.totalAmount)
                                    ]}
                                />
                            ))}
                            {!dashboardData.lastFivePurchases.length && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-gray-500 font-medium">
                                        <ShoppingCart className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                        No purchases found
                                    </td>
                                </tr>
                            )}
                        </Table>
                    </div>
                </div>
            ) : null}


        </div>
    );
};

export default DashboardPage;
