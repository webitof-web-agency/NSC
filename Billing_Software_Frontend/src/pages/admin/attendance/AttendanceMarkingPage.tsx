import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Clock, CheckCircle, XCircle, Calendar, Search } from 'lucide-react';
import useDateFormatter from '@hooks/useDateFormatter';
import Modal from '@components/admin/Modal';
import AttendanceScheduleTimeSelector from '@components/admin/AttendanceScheduleTimeSelector';

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

const AttendanceMarkingPage: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [attendanceData, setAttendanceData] = useState<TodayAttendanceData | null>(null);
    const [loading, setLoading] = useState(false);
    const { formatDate } = useDateFormatter();
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states for check-in
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [selectedStaffForCheckIn, setSelectedStaffForCheckIn] = useState<Staff | null>(null);
    const [checkInNotes, setCheckInNotes] = useState('');

    // Modal states for check-out
    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
    const [selectedAttendanceForCheckOut, setSelectedAttendanceForCheckOut] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [checkOutNotes, setCheckOutNotes] = useState('');

    const [scheduleStart, setScheduleStart] = useState('');
    const [scheduleEnd, setScheduleEnd] = useState('');
    const [scheduleInitial, setScheduleInitial] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleSaving, setScheduleSaving] = useState(false);

    useEffect(() => {
        fetchTodayAttendance();
    }, []);

    useEffect(() => {
        if (token) {
            fetchScheduleSettings();
        }
    }, [token]);

    const fetchTodayAttendance = async () => {
        try {
            setLoading(true);
            const response = await axios.get(Constants.GET_TODAY_ATTENDANCE_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) {
                setAttendanceData(response.data.data);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch today attendance');
        } finally {
            setLoading(false);
        }
    };

    const fetchScheduleSettings = async () => {
        try {
            setScheduleLoading(true);
            const response = await axios.get(Constants.GET_GENERAL_SETTINGS_URL, {
                params: { groupSlug: 'attendance' },
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = response.data.data || [];
            const settings: Record<string, string> = {};
            data.forEach((setting: any) => {
                settings[setting.key] = setting.value;
            });

            const start = settings.attendanceScheduleStart || '';
            const end = settings.attendanceScheduleEnd || '';
            setScheduleStart(start);
            setScheduleEnd(end);
            setScheduleInitial({ start, end });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load schedule settings');
        } finally {
            setScheduleLoading(false);
        }
    };

    const handleScheduleSave = async () => {
        if (!scheduleStart || !scheduleEnd) {
            toast.error('Please select both schedule times.');
            return;
        }
        if (scheduleStart >= scheduleEnd) {
            toast.error('Schedule check-out time must be after check-in time.');
            return;
        }

        const payload = {
            settings: [
                {
                    key: 'attendanceScheduleStart',
                    value: scheduleStart,
                    groupSlug: 'attendance',
                },
                {
                    key: 'attendanceScheduleEnd',
                    value: scheduleEnd,
                    groupSlug: 'attendance',
                },
            ],
        };

        try {
            setScheduleSaving(true);
            await axios.post(Constants.UPDATE_GENERAL_SETTINGS_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setScheduleInitial({ start: scheduleStart, end: scheduleEnd });
            toast.success('Attendance schedule updated.');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update schedule');
        } finally {
            setScheduleSaving(false);
        }
    };

    const openCheckInModal = (staff: Staff) => {
        setSelectedStaffForCheckIn(staff);
        setCheckInNotes('');
        setIsCheckInModalOpen(true);
    };

    const handleCheckIn = async () => {
        if (!selectedStaffForCheckIn) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const payload = {
                staffId: selectedStaffForCheckIn._id,
                date: today,
                checkInTime: new Date().toISOString(),
                status: 'PRESENT',
                notes: checkInNotes,
            };

            const response = await axios.post(Constants.CREATE_ATTENDANCE_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                toast.success(`Check-in marked for ${selectedStaffForCheckIn.firstName} ${selectedStaffForCheckIn.lastName}`);
                fetchTodayAttendance();
                setIsCheckInModalOpen(false);
                setSelectedStaffForCheckIn(null);
                setCheckInNotes('');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to mark attendance');
        }
    };

    const openCheckOutModal = (attendanceId: string, staffName: string) => {
        setSelectedAttendanceForCheckOut({ id: attendanceId, name: staffName });
        setCheckOutNotes('');
        setIsCheckOutModalOpen(true);
    };

    const handleCheckOut = async () => {
        if (!selectedAttendanceForCheckOut) return;

        try {
            const checkOutTime = new Date().toISOString();
            const response = await axios.patch(
                `${Constants.CHECKOUT_ATTENDANCE_URL}/${selectedAttendanceForCheckOut.id}`,
                { checkOutTime, notes: checkOutNotes },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data.success) {
                toast.success(`Check-out marked for ${selectedAttendanceForCheckOut.name}`);
                fetchTodayAttendance();
                setIsCheckOutModalOpen(false);
                setSelectedAttendanceForCheckOut(null);
                setCheckOutNotes('');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to mark check-out');
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatWorkingHours = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    // Filter staff based on search query
    const filteredNotMarked = attendanceData?.notMarked.filter((staff) => {
        const fullName = `${staff.firstName} ${staff.lastName}`.toLowerCase();
        const email = staff.email.toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    }) || [];

    if (loading && !attendanceData) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold text-gray-950">Mark Attendance</h1>
                <div className="flex flex-wrap items-end gap-3">
                    <AttendanceScheduleTimeSelector
                        startTime={scheduleStart}
                        endTime={scheduleEnd}
                        onChange={({ startTime, endTime }) => {
                            setScheduleStart(startTime);
                            setScheduleEnd(endTime);
                        }}
                        onSave={handleScheduleSave}
                        isSaving={scheduleSaving}
                        isDisabled={scheduleLoading}
                        hasChanges={scheduleStart !== scheduleInitial.start || scheduleEnd !== scheduleInitial.end}
                    />
                </div>
            </div>

            {/* Summary Cards */}
            {attendanceData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-sm">
                        <div className="text-gray-600 font-normal text-sm mb-1">Total Staff</div>
                        <div className="text-3xl font-bold text-gray-900">{attendanceData.summary.totalStaff}</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-5 shadow-sm">
                        <div className="text-green-700 font-normal text-sm mb-1">Present</div>
                        <div className="text-3xl font-bold text-green-700">{attendanceData.summary.present}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 shadow-sm">
                        <div className="text-yellow-700 font-normal text-sm mb-1">Not Checked Out</div>
                        <div className="text-3xl font-bold text-yellow-700">{attendanceData.summary.checkedIn}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-5 shadow-sm">
                        <div className="text-red-700 font-normal text-sm mb-1">Not Marked</div>
                        <div className="text-3xl font-bold text-red-700">{attendanceData.summary.notMarked}</div>
                    </div>
                </div>
            )}

            {/* Staff Not Marked */}
            {attendanceData && attendanceData.notMarked.length > 0 && (
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Mark Attendance</h2>
                            {/* Search Field */}
                            <div className="relative w-64">
                                <input
                                    type="text"
                                    placeholder="Search staff..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                                />
                                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Staff
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredNotMarked.length > 0 ? (
                                    filteredNotMarked.map((staff) => (
                                        <tr key={staff._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {staff.firstName} {staff.lastName}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{staff.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{staff.roleName || 'Staff'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <button
                                                    onClick={() => openCheckInModal(staff)}
                                                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                                                >
                                                    <CheckCircle size={16} />
                                                    Check In
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            No staff found matching "{searchQuery}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Checked In Staff */}
            {attendanceData && attendanceData.checkedIn.length > 0 && (
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                        <Clock size={20} className="text-yellow-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Currently Checked In</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Staff
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check In Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {attendanceData.checkedIn.map((attendance) => (
                                    <tr key={attendance._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {attendance.staffId.firstName} {attendance.staffId.lastName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatTime(attendance.checkInTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                                                {attendance.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() =>
                                                    openCheckOutModal(
                                                        attendance._id,
                                                        `${attendance.staffId.firstName} ${attendance.staffId.lastName}`
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                                            >
                                                <XCircle size={16} />
                                                Check Out
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Checked Out Staff */}
            {attendanceData && attendanceData.checkedOut.length > 0 && (
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Completed Today</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Staff
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check In
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Check Out
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Hours Worked
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {attendanceData.checkedOut.map((attendance) => (
                                    <tr key={attendance._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {attendance.staffId.firstName} {attendance.staffId.lastName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatTime(attendance.checkInTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {attendance.checkOutTime && formatTime(attendance.checkOutTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-green-700">
                                                {formatWorkingHours(attendance.workingHours)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {attendanceData &&
                attendanceData.notMarked.length === 0 &&
                attendanceData.checkedIn.length === 0 &&
                attendanceData.checkedOut.length === 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-12">
                        <div className="text-center">
                            <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Done!</h3>
                            <p className="text-gray-600">All staff attendance has been marked for today.</p>
                        </div>
                    </div>
                )}

            <Modal
                isOpen={isCheckInModalOpen}
                onClose={() => {
                    setIsCheckInModalOpen(false);
                    setSelectedStaffForCheckIn(null);
                    setCheckInNotes('');
                }}
                title="Check In Confirmation"
            >
                <div className="space-y-4">
                    <p className="text-gray-700">
                        Mark check-in for{' '}
                        <span className="font-semibold">
                            {selectedStaffForCheckIn?.firstName} {selectedStaffForCheckIn?.lastName}
                        </span>
                        ?
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea
                            value={checkInNotes}
                            onChange={(e) => setCheckInNotes(e.target.value)}
                            placeholder="Add any notes about this check-in..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>

                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            onClick={() => {
                                setIsCheckInModalOpen(false);
                                setSelectedStaffForCheckIn(null);
                                setCheckInNotes('');
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCheckIn}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
                        >
                            Confirm Check In
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isCheckOutModalOpen}
                onClose={() => {
                    setIsCheckOutModalOpen(false);
                    setSelectedAttendanceForCheckOut(null);
                    setCheckOutNotes('');
                }}
                title="Check Out Confirmation"
            >
                <div className="space-y-4">
                    <p className="text-gray-700">
                        Mark check-out for <span className="font-semibold">{selectedAttendanceForCheckOut?.name}</span>?
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea
                            value={checkOutNotes}
                            onChange={(e) => setCheckOutNotes(e.target.value)}
                            placeholder="Add any notes about this check-out..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>

                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            onClick={() => {
                                setIsCheckOutModalOpen(false);
                                setSelectedAttendanceForCheckOut(null);
                                setCheckOutNotes('');
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCheckOut}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Confirm Check Out
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AttendanceMarkingPage;
