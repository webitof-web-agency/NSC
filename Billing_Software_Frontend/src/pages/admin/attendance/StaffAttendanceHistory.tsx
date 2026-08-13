import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Calendar } from 'lucide-react';

interface AttendanceSummary {
    totalDays: number;
    present: number;
    absent: number;
    halfDay: number;
    late: number;
    onLeave: number;
    totalWorkingHours: string;
    averageWorkingHours: string;
    amountPerDay?: number;
}

interface Attendance {
    _id: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    status: string;
    workingHours: number;
    notes?: string;
}

const StaffAttendanceHistory: React.FC = () => {
    const { staffId } = useParams<{ staffId?: string }>();
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const currencySymbol = systemSettings?.currency?.symbol || "₹";
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Set default date range (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (staffId && startDate && endDate) {
            fetchAttendanceHistory();
            fetchSummary();
        }
    }, [staffId, startDate, endDate]);

    const fetchAttendanceHistory = async () => {
        if (!staffId) return;

        try {
            setLoading(true);
            const response = await axios.get(`${Constants.GET_STAFF_ATTENDANCE_URL}/${staffId}`, {
                params: { startDate, endDate, limit: 100 },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                setAttendances(response.data.data || []);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch attendance history');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        if (!staffId) return;

        try {
            const response = await axios.get(`${Constants.GET_ATTENDANCE_SUMMARY_URL}/${staffId}`, {
                params: { startDate, endDate },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                setSummary(response.data.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch summary');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return 'bg-green-100 text-green-800';
            case 'ABSENT':
                return 'bg-red-100 text-red-800';
            case 'HALF_DAY':
                return 'bg-yellow-100 text-yellow-800';
            case 'LATE':
                return 'bg-orange-100 text-orange-800';
            case 'ON_LEAVE':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPayableDays = (data?: AttendanceSummary) => {
        if (!data) return 0;
        return (data.present || 0) + (data.late || 0) + (data.halfDay || 0) * 0.5;
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-950">Staff Attendance History</h1>

            {/* Date Range Filter */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                fetchAttendanceHistory();
                                fetchSummary();
                            }}
                            className="w-full bg-primary hover:bg-gray-950 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2"
                        >
                            <Calendar size={18} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Total Days</div>
                        <div className="text-2xl font-bold text-gray-900">{summary.totalDays}</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-600 text-sm">Present</div>
                        <div className="text-2xl font-bold text-green-700">{summary.present}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Total Hours</div>
                        <div className="text-2xl font-bold text-gray-900">{summary.totalWorkingHours}h</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Avg Hours/Day</div>
                        <div className="text-2xl font-bold text-gray-900">{summary.averageWorkingHours}h</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Amount/Day</div>
                        <div className="text-2xl font-bold text-gray-900">{currencySymbol}{summary.amountPerDay ? `${summary.amountPerDay.toFixed(2)}` : "0.00"}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Payable Days</div>
                        <div className="text-2xl font-bold text-gray-900">{getPayableDays(summary).toFixed(2)}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-gray-500 text-sm">Base Salary</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {currencySymbol}{(getPayableDays(summary) * Number(summary.amountPerDay || 0)).toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance Records</h2>
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : attendances.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No attendance records found for the selected period.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {attendances.map((record) => (
                                    <tr key={record._id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(record.checkInTime).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {record.checkOutTime
                                                ? new Date(record.checkOutTime).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {record.workingHours ? `${record.workingHours}h` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{record.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffAttendanceHistory;
