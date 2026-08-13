import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Calendar, FileText } from 'lucide-react';
import SmartDropdown from '@components/admin/SmartDropdown';
import { DateRangePicker } from '@components/admin/DateRangePicker';
import { format } from 'date-fns';

interface AttendanceReportData {
    month: string;
    year: string;
    staffId: string;
    amountPerDay: number;
    attendances: any[];
    statistics: {
        totalDays: number;
        present: number;
        totalWorkingHours: string;
        averageWorkingHours: string;
    };
}

interface Staff {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    amountPerDay?: number;
}

const AttendanceReportPage: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [selectedStaffName, setSelectedStaffName] = useState('');
    const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(),
    });
    const [reportData, setReportData] = useState<AttendanceReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [staffSearchInput, setStaffSearchInput] = useState('');

    useEffect(() => {
        fetchStaffList();
    }, []);

    const fetchStaffList = async () => {
        try {
            const response = await axios.get(Constants.FETCH_STAFF_FOR_LIST_STAFF_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = response.data.data || [];
            setStaffList(data);
            // Don't auto-select any staff member
        } catch (error: any) {
            toast.error('Failed to fetch staff list');
        }
    };

    const fetchReport = async () => {
        if (!selectedStaffId) {
            toast.error('Please select a staff member');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.get(`${Constants.GET_ATTENDANCE_REPORT_URL}/${selectedStaffId}`, {
                params: {
                    startDate: dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : undefined,
                    endDate: dateRange.endDate ? format(dateRange.endDate, 'yyyy-MM-dd') : undefined,
                },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                setReportData(response.data.data);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch attendance report');
        } finally {
            setLoading(false);
        }
    };

    const getPayableDays = (stats?: AttendanceReportData["statistics"]) => {
        if (!stats) return 0;
        const present = stats.present || 0;
        const late = stats.late || 0;
        const halfDay = stats.halfDay || 0;
        return present + late + halfDay * 0.5;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'ABSENT':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'HALF_DAY':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'LATE':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'ON_LEAVE':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Format hours to "X hours : Y minutes"
    const formatWorkingHours = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h} hours : ${m} minutes`;
    };

    // Convert staff list to SmartDropdown format
    const staffDropdownOptions = staffList
        .filter((staff) => {
            const fullName = staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
            return fullName.toLowerCase().includes(staffSearchInput.toLowerCase());
        })
        .map((staff) => ({
            id: staff._id || staff.id,
            name: staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
        }));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-6 flex">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Staff Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</label>
                        <SmartDropdown
                            items={staffDropdownOptions}
                            value={staffSearchInput}
                            onSelect={(item) => {
                                if (item) {
                                    setSelectedStaffId(String(item.id));
                                    setSelectedStaffName(item.name);
                                    setStaffSearchInput('');
                                }
                            }}
                            onChange={setStaffSearchInput}
                            selectedItem={selectedStaffId ? { id: selectedStaffId, name: selectedStaffName } : null}
                            placeholder="Select Staff"
                            serverside={false}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                        <DateRangePicker
                            value={dateRange}
                            onChange={setDateRange}
                        />
                    </div>

                    {/* Generate Button */}
                    <div className="flex items-end">
                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-400 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
                        >
                            <Calendar size={18} />
                            {loading ? 'Loading...' : 'Generate Report'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            {reportData && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
                            <div className="text-gray-600 text-sm mb-1">Total Days</div>
                            <div className="text-2xl font-bold text-gray-900">{reportData.statistics.totalDays}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center shadow-sm">
                            <div className="text-green-700 text-sm mb-1">Present</div>
                            <div className="text-2xl font-bold text-green-700">{reportData.statistics.present}</div>
                        </div>
                        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
                            <div className="text-gray-600 text-sm mb-1">Amount/Day</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {(systemSettings?.currency?.symbol || "₹") + Number(reportData.amountPerDay || 0).toFixed(2)}
                            </div>
                        </div>
                        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
                            <div className="text-gray-600 text-sm mb-1">Payable Days</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {getPayableDays(reportData.statistics).toFixed(2)}
                            </div>
                        </div>
                        <div className="bg-white border border-gray-300 rounded-lg p-4 text-center shadow-sm">
                            <div className="text-gray-600 text-sm mb-1">Base Salary</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {(systemSettings?.currency?.symbol || "₹") +
                                    (getPayableDays(reportData.statistics) * Number(reportData.amountPerDay || 0)).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Records */}
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                            <FileText size={20} className="text-gray-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Detailed Attendance Records</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Check In
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Check Out
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hours
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Notes
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reportData.attendances.map((record: any) => (
                                        <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(record.checkInTime).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {record.checkOutTime
                                                    ? new Date(record.checkOutTime).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {record.workingHours ? formatWorkingHours(record.workingHours) : '0 hours : 0 minutes'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(record.status)}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{record.notes || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Empty State */}
            {!loading && !reportData && (
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-12">
                    <div className="text-center">
                        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Report Generated</h3>
                        <p className="text-gray-600">Select staff and date range above, then click "Generate Report"</p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-12">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                        <p className="text-gray-600">Loading report...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceReportPage;
