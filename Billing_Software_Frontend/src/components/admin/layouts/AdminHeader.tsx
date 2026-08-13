import { LogOut, User, Menu, UserCircle, FileText, ShoppingCart, UserPlus, Truck, Plus, ArrowLeftRight, Package, Bell, ListTodo, CheckCircle2, Pencil, Trash2, QrCode, X, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Constants from '@constants/api';
import type { AppNotification, NotificationListResponse } from '@models/notification';
import type { TodoTask, TodoTaskListResponse, TodoTaskSummary } from '@models/todo';
import type { RootState } from '../../../store';
import { logout } from '../../../store/auth/authSlice';
import { IoReceiptOutline } from 'react-icons/io5';
import Modal from '@components/admin/Modal';
import DateInput from '@components/admin/DateInput';
import CustomQrPrint from '@components/admin/CustomQrPrint';

interface HeaderProps {
    toggleSidebar: () => void;
}

type NotificationFilter = "all" | "purchase" | "quotation" | "credit_invoice";

const notificationFilters: { label: string; value: NotificationFilter }[] = [
    { label: "All", value: "all" },
    { label: "Purchase", value: "purchase" },
    { label: "Quotation", value: "quotation" },
    { label: "Credit Invoice", value: "credit_invoice" },
];

const AdminHeader = ({ toggleSidebar }: HeaderProps) => {
    const normalizeImageUrl = (url?: string | null) => {
        if (!url) return "";
        return url.replace(/([^:]\/)\/+/g, "$1");
    };

    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const [open, setOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    const [todoOpen, setTodoOpen] = useState(false);
    const [showTodoCreateModal, setShowTodoCreateModal] = useState(false);
    const [customBarcodeOpen, setCustomBarcodeOpen] = useState(false);
    const [showCustomBarcodePrint, setShowCustomBarcodePrint] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
    const [invoices, setInvoices] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [todoTasks, setTodoTasks] = useState<TodoTask[]>([]);
    const [todoSummary, setTodoSummary] = useState<TodoTaskSummary>({
        activeCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        createdTodayCount: 0,
        attentionCount: 0,
    });
    const [todoForm, setTodoForm] = useState<{
        title: string;
        description: string;
        createDate: Date;
        dueDate: Date | null;
    }>({
        title: "",
        description: "",
        createDate: new Date(),
        dueDate: new Date(new Date().setHours(23, 59, 59, 999)),
    });
    const [todoSubmitting, setTodoSubmitting] = useState(false);
    const [editingTodoTaskId, setEditingTodoTaskId] = useState<string | null>(null);
    const [customBarcodeForm, setCustomBarcodeForm] = useState({
        productName: "",
        brandName: "",
        variantSizes: [""],
        variantColor: "",
    });

    const notificationRef = useRef<HTMLDivElement>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);
    const todoRef = useRef<HTMLDivElement>(null);
    const customBarcodeRef = useRef<HTMLDivElement>(null);
    const quickCreateRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { user, token } = useSelector((state: RootState) => state.auth);
    const { data } = useSelector((state: RootState) => state.systemSettings);
    const softwareDownloadUrl = String(
        data?.company?.softwareDownloadUrl || (data as any)?.data?.company?.softwareDownloadUrl || ""
    ).trim();

    const allActions = [
        { label: "New Invoice", icon: <FileText size={18} />, onClick: () => navigate("/admin/invoices/create-invoice"), moduleSlug: "invoices" },
        { label: "New Purchase", icon: <ShoppingCart size={18} />, onClick: () => navigate("/admin/purchases/new"), moduleSlug: "purchases" },
        { label: "New Customer", icon: <UserPlus size={18} />, onClick: () => navigate("/admin/customers/new"), moduleSlug: "customers" },
        { label: "New Supplier", icon: <Truck size={18} />, onClick: () => navigate("/admin/suppliers"), moduleSlug: "suppliers" },
        { label: "New Product", icon: <Package size={18} />, onClick: () => navigate("/admin/products/new"), moduleSlug: "products" },
        { label: "New Expense", icon: <Package size={18} />, onClick: () => navigate("/admin/reports/monthly-expenses"), moduleSlug: "accounting-reports" },
    ];

    const actions = user?.user_type === 1 ? allActions : allActions.filter(action => {
        if (!action.moduleSlug || !data?.data) return action.moduleSlug !== 'purchases' && action.moduleSlug !== 'suppliers' && action.moduleSlug !== 'customers' && action.moduleSlug !== 'accounting-reports';
        return data.data.permissions?.some(p => p.moduleSlug === action.moduleSlug && p.view);
    });

    const canViewNotifications = user?.user_type === 1 || Boolean(
        data?.data?.permissions?.some(
            (permission) =>
                ['invoices', 'customers', 'quotations', 'purchases', 'suppliers'].includes(permission.moduleSlug) && permission.view
        )
    );

    const handleLogout = () => {
        dispatch(logout());
    };

    const handleSoftwareDownload = () => {
        setIsDropdownOpen(false);
        if (!softwareDownloadUrl) {
            alert("Software download URL is not set. Please add it in Company Settings.");
            return;
        }

        window.open(softwareDownloadUrl, "_blank", "noopener,noreferrer");
    };

    const fetchUnreadCount = async () => {
        if (!token || !canViewNotifications) return;

        try {
            const res = await axios.get(Constants.GET_NOTIFICATIONS_UNREAD_COUNT_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setUnreadCount(res.data?.data?.unreadCount || 0);
        } catch (err) {
            console.error("Failed to fetch notification count");
        }
    };

    const fetchNotifications = async () => {
        if (!token || !canViewNotifications) return;

        try {
            const res = await axios.get<NotificationListResponse>(Constants.GET_NOTIFICATIONS_URL, {
                params: notificationFilter === "all" ? undefined : { type: notificationFilter },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setNotifications(res.data?.data?.notifications || []);
            setUnreadCount(res.data?.data?.unreadCount || 0);
        } catch (err) {
            console.error("Failed to fetch notifications");
        }
    };

    const markNotificationRead = async (notificationId: string) => {
        if (!token) return;

        try {
            await axios.patch(
                `${Constants.MARK_NOTIFICATION_READ_URL}/${notificationId}/read`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setNotifications((prev) =>
                prev.map((item) =>
                    item._id === notificationId ? { ...item, isRead: true } : item
                )
            );
            setUnreadCount((prev) => Math.max(prev - 1, 0));
        } catch (err) {
            console.error("Failed to mark notification as read");
        }
    };

    const refreshNotificationState = async () => {
        await fetchUnreadCount();
        if (notificationOpen) {
            await fetchNotifications();
        }
    };

    const markAllNotificationsRead = async () => {
        if (!token) return;

        try {
            await axios.patch(
                Constants.MARK_ALL_NOTIFICATIONS_READ_URL,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all notifications as read");
        }
    };

    const fetchRecentInvoices = async () => {
        if (!token) return;

        try {
            const res = await axios.get(Constants.GET_DASHBOARD_DATA_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setInvoices(res.data?.data?.lastSevenInvoices || []);
        } catch (err) {
            console.error("Failed to fetch recent invoices");
        }
    };

    const fetchTodoSummary = async () => {
        if (!token) return;

        try {
            const res = await axios.get(Constants.GET_TODO_TASKS_SUMMARY_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setTodoSummary(res.data?.data || {
                activeCount: 0,
                overdueCount: 0,
                dueTodayCount: 0,
                createdTodayCount: 0,
                attentionCount: 0,
            });
        } catch (err) {
            console.error("Failed to fetch to-do summary");
        }
    };

    const fetchTodoTasks = async () => {
        if (!token) return;

        try {
            const res = await axios.get<TodoTaskListResponse>(Constants.GET_TODO_TASKS_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setTodoTasks(res.data?.data?.tasks || []);
            setTodoSummary(res.data?.data?.summary || {
                activeCount: 0,
                overdueCount: 0,
                dueTodayCount: 0,
                createdTodayCount: 0,
                attentionCount: 0,
            });
        } catch (err) {
            console.error("Failed to fetch to-do tasks");
        }
    };

    const resetTodoForm = () => {
        setTodoForm({
            title: "",
            description: "",
            createDate: new Date(),
            dueDate: new Date(),
        });
        setEditingTodoTaskId(null);
    };

    const resetCustomBarcodeForm = () => {
        setCustomBarcodeForm({
            productName: "",
            brandName: "",
            variantSizes: [""],
            variantColor: "",
        });
    };

    const openCreateTodoModal = () => {
        resetTodoForm();
        setTodoOpen(false);
        setShowTodoCreateModal(true);
    };

    const openEditTodoModal = (task: TodoTask) => {
        setEditingTodoTaskId(task._id);
        setTodoForm({
            title: task.title || "",
            description: task.description || "",
            createDate: new Date(task.createDate),
            dueDate: new Date(task.dueDate),
        });
        setTodoOpen(false);
        setShowTodoCreateModal(true);
    };

    const handleCustomBarcodePrint = () => {
        setCustomBarcodeOpen(false);
        setShowCustomBarcodePrint(true);
    };

    const saveTodoTask = async () => {
        if (!token || !todoForm.title.trim()) return;

        try {
            setTodoSubmitting(true);
            const payload = {
                title: todoForm.title.trim(),
                description: todoForm.description.trim(),
                createDate: todoForm.createDate,
                dueDate: todoForm.dueDate,
            };
            if (editingTodoTaskId) {
                await axios.put(
                    `${Constants.UPDATE_TODO_TASK_URL}/${editingTodoTaskId}`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
            } else {
                await axios.post(
                    Constants.CREATE_TODO_TASK_URL,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
            }

            resetTodoForm();
            setShowTodoCreateModal(false);
            await fetchTodoTasks();
        } catch (err: any) {
            alert(err?.response?.data?.message || `Failed to ${editingTodoTaskId ? "update" : "create"} to-do task`);
        } finally {
            setTodoSubmitting(false);
        }
    };

    const markTodoTaskDone = async (taskId: string) => {
        if (!token) return;

        try {
            await axios.patch(
                `${Constants.COMPLETE_TODO_TASK_URL}/${taskId}/complete`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            await fetchTodoTasks();
        } catch (err) {
            console.error("Failed to complete to-do task");
        }
    };

    const deleteTodoTask = async (taskId: string) => {
        if (!token) return;
        const confirmed = window.confirm("Delete this to-do task?");
        if (!confirmed) return;

        try {
            await axios.delete(
                `${Constants.DELETE_TODO_TASK_URL}/${taskId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            await fetchTodoTasks();
        } catch (err) {
            console.error("Failed to delete to-do task");
        }
    };

    useEffect(() => {
        if (notificationOpen) {
            fetchNotifications();
        }
    }, [notificationOpen]);

    useEffect(() => {
        if (invoiceOpen) {
            fetchRecentInvoices();
        }
    }, [invoiceOpen]);

    useEffect(() => {
        if (todoOpen) {
            fetchTodoTasks();
        }
    }, [todoOpen]);

    useEffect(() => {
        if (!canViewNotifications) return;

        refreshNotificationState();

        const intervalId = window.setInterval(() => {
            refreshNotificationState();
        }, 15000);

        const handleWindowFocus = () => {
            refreshNotificationState();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshNotificationState();
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [canViewNotifications, token, notificationOpen, notificationFilter]);

    useEffect(() => {
        if (!token) return;
        fetchTodoSummary();
        const intervalId = window.setInterval(fetchTodoSummary, 60000);
        return () => window.clearInterval(intervalId);
    }, [token]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
                setNotificationOpen(false);
            }
            if (todoRef.current && !todoRef.current.contains(e.target as Node)) {
                setTodoOpen(false);
            }
            if (invoiceRef.current && !invoiceRef.current.contains(e.target as Node)) {
                setInvoiceOpen(false);
            }
            if (customBarcodeRef.current && !customBarcodeRef.current.contains(e.target as Node)) {
                setCustomBarcodeOpen(false);
            }
            if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const getNotificationEntityLabel = (notification: AppNotification) => {
        if (notification.meta?.invoiceNumber) return notification.meta.invoiceNumber;
        if (notification.meta?.quotationId) return notification.meta.quotationId;
        if (notification.meta?.purchaseId) return notification.meta.purchaseId;
        if (notification.entityType === "quotation") return "Quotation";
        if (notification.entityType === "purchase") return "Purchase";
        return "Invoice";
    };

    const getTodoStatusLabel = (task: TodoTask) => {
        if (task.status === "completed") return "Completed";
        if (task.notificationStatus === "overdue") return "Overdue";
        if (task.notificationStatus === "due_today") return "Due Today";
        if (task.notificationStatus === "created_today") return "Created Today";
        return "Upcoming";
    };

    return (
        <header className="flex items-center justify-between px-4 py-1 bg-white shadow sticky top-0 z-40">
            <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleSidebar(); }} className="text-gray-500 focus:outline-none cursor-pointer mr-1">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={todoRef}>
                        <button
                            onClick={() => setTodoOpen(!todoOpen)}
                            className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition"
                            title="To-Do Tasks"
                        >
                            <ListTodo className="w-5 h-5 text-gray-700" />
                            {todoSummary.attentionCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                    {todoSummary.attentionCount > 99 ? "99+" : todoSummary.attentionCount}
                                </span>
                            )}
                        </button>

                        {todoOpen && (
                            <div className="z-[9999] bg-white shadow-2xl border border-gray-100 rounded-2xl overflow-hidden md:absolute md:left-0 md:mt-3 md:w-[420px] fixed inset-x-3 bottom-3 md:inset-auto">
                                {/* ── Header ── */}
                                <div className="bg-gradient-to-r from-[#A43275] to-[#c0428e] px-5 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                                <ListTodo className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">To-Do Tasks</h4>
                                                <p className="text-[11px] text-white/70">{todoTasks.length} task{todoTasks.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={openCreateTodoModal}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            New Task
                                        </button>
                                    </div>

                                    {/* Stat pills */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                            Active: {todoSummary.activeCount}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                                            Due Today: {todoSummary.dueTodayCount}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-300"></span>
                                            Overdue: {todoSummary.overdueCount}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Task list ── */}
                                <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                                    {todoTasks.length > 0 ? (
                                        todoTasks.map((task) => {
                                            const isCompleted = task.status === 'completed';
                                            const isOverdue = task.notificationStatus === 'overdue';
                                            const isDueToday = task.notificationStatus === 'due_today';
                                            const isHigh = task.priority === 'high';

                                            const barColor = isCompleted ? 'bg-emerald-400'
                                                : isOverdue ? 'bg-red-400'
                                                    : isDueToday ? 'bg-amber-400'
                                                        : isHigh ? 'bg-orange-400'
                                                            : 'bg-[#A43275]';

                                            const cardBg = isCompleted ? 'bg-gray-50 opacity-70'
                                                : isOverdue ? 'bg-red-50/60 hover:bg-red-50'
                                                    : isDueToday ? 'bg-amber-50/60 hover:bg-amber-50'
                                                        : 'bg-white hover:bg-[#fce6f4]/40';

                                            const statusLabel = getTodoStatusLabel(task);
                                            const statusChip = isCompleted ? 'bg-emerald-100 text-emerald-700'
                                                : isOverdue ? 'bg-red-100 text-red-700'
                                                    : isDueToday ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-[#fce6f4] text-[#A43275]';

                                            return (
                                                <div
                                                    key={task._id}
                                                    className={`group relative flex gap-3 rounded-xl border border-gray-100 p-3 transition-all duration-200 ${cardBg}`}
                                                >
                                                    {/* Left colour bar */}
                                                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${barColor}`} />

                                                    <div className="flex-1 pl-2 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className={`text-sm font-semibold leading-snug ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                                {task.title}
                                                            </span>
                                                            {/* Action buttons – visible on hover */}
                                                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {!isCompleted && (
                                                                    <button
                                                                        onClick={() => markTodoTaskDone(task._id)}
                                                                        title="Mark done"
                                                                        className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition"
                                                                    >
                                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => openEditTodoModal(task)}
                                                                    title="Edit task"
                                                                    className="w-6 h-6 rounded-md bg-[#fce6f4] hover:bg-[#fbb7ec] text-[#A43275] flex items-center justify-center transition"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTodoTask(task._id)}
                                                                    title="Delete task"
                                                                    className="w-6 h-6 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {task.description && (
                                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
                                                        )}

                                                        <div className="flex items-center justify-between mt-2">
                                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusChip}`}>
                                                                {isCompleted && <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />}
                                                                {statusLabel}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center">
                                            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#fce6f4] flex items-center justify-center mb-3">
                                                <ListTodo className="w-7 h-7 text-[#A43275]" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-700">No tasks yet</p>
                                            <p className="text-xs text-gray-400 mt-1">Click "New Task" to get started</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Footer ── */}
                                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                                    <p className="text-[11px] text-gray-400">Click on a card to see actions</p>
                                    <button
                                        onClick={openCreateTodoModal}
                                        className="text-xs font-semibold text-[#A43275] hover:underline"
                                    >
                                        + Add task
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="relative" ref={customBarcodeRef}>
                        <button
                            onClick={() => setCustomBarcodeOpen((prev) => !prev)}
                            className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition"
                            title="Custom QR Print"
                        >
                            <QrCode className="w-5 h-5 text-gray-700" />
                        </button>

                        {customBarcodeOpen && (
                            <div className="z-[9999] bg-white shadow-2xl border border-gray-100 rounded-2xl overflow-hidden md:absolute md:left-0 md:mt-3 md:w-[440px] fixed inset-x-3 bottom-3 md:inset-auto">
                                <div className="bg-gradient-to-r from-[#A43275] to-[#c0428e] px-5 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                                <QrCode className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">Custom QR Print</h4>
                                                <p className="text-[11px] text-white/70">Fill optional details and print them with a QR code</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={resetCustomBarcodeForm}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Item Name / Design Number</label>
                                        <input
                                            type="text"
                                            value={customBarcodeForm.productName}
                                            onChange={(e) => setCustomBarcodeForm((prev) => ({ ...prev, productName: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/30 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400"
                                            placeholder="Enter item name or design number"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Brand</label>
                                        <input
                                            type="text"
                                            value={customBarcodeForm.brandName}
                                            onChange={(e) => setCustomBarcodeForm((prev) => ({ ...prev, brandName: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/30 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400"
                                            placeholder="Enter brand"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Size</label>
                                                <button
                                                    onClick={() => setCustomBarcodeForm(prev => ({ ...prev, variantSizes: [...prev.variantSizes, ""] }))}
                                                    className="text-[10px] font-bold text-[#A43275] uppercase hover:underline"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {customBarcodeForm.variantSizes.map((size, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={size}
                                                            onChange={(e) => {
                                                                const newSizes = [...customBarcodeForm.variantSizes];
                                                                newSizes[index] = e.target.value;
                                                                setCustomBarcodeForm(prev => ({ ...prev, variantSizes: newSizes }));
                                                            }}
                                                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/30 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400"
                                                            placeholder="e.g. XL, 42"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const newSizes = customBarcodeForm.variantSizes.filter((_, i) => i !== index);
                                                                setCustomBarcodeForm(prev => ({ ...prev, variantSizes: newSizes }));
                                                            }}
                                                            className="text-gray-400 hover:text-red-500 transition shrink-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Color</label>
                                            <input
                                                type="text"
                                                value={customBarcodeForm.variantColor}
                                                onChange={(e) => setCustomBarcodeForm((prev) => ({ ...prev, variantColor: e.target.value }))}
                                                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/30 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400"
                                                placeholder="e.g. Red, Blue"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                                    <p className="text-[11px] text-gray-400">A QR code will be generated from the entered details</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setCustomBarcodeOpen(false); resetCustomBarcodeForm(); }}
                                            className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCustomBarcodePrint}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#A43275] text-white rounded-xl text-sm font-semibold hover:bg-[#8a2963] transition shadow-sm shadow-[#A43275]/30"
                                        >
                                            <QrCode className="w-3.5 h-3.5" />
                                            Print
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <div className='flex items-center justify-center w-34 h-10 rounded-full hover:bg-gray-100 transition'>
                    <button onClick={() => { navigate(`/admin/invoices/exchange/new`) }}>
                        <div className='flex items-center gap-1'>
                            <ArrowLeftRight className="w-5 h-5 text-gray-700" />
                            New Exchange
                        </div>
                    </button>
                </div>

                <div className='flex items-center justify-center w-30 h-10 rounded-full hover:bg-gray-100 transition'>
                    <button onClick={() => { navigate(`/admin/invoices/create-invoice`) }}>
                        <div className='flex items-center gap-1'>
                            <FileText className="w-5 h-5 text-gray-700" />
                            New Invoice
                        </div>
                    </button>
                </div>


                {canViewNotifications && (
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={() => setNotificationOpen(!notificationOpen)}
                            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
                        >
                            <Bell className="w-5 h-5 text-gray-700" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {notificationOpen && (
                            <div className="z-[9999] bg-white shadow-2xl border border-gray-100 rounded-2xl overflow-hidden md:absolute md:right-0 md:mt-3 md:w-[400px] fixed inset-x-3 bottom-3 md:inset-auto">
                                {/* ── Header ── */}
                                <div className="bg-gradient-to-r from-[#A43275] to-[#c0428e] px-5 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                                <Bell className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">Notifications</h4>
                                                <p className="text-[11px] text-white/70">{notifications.length} total</p>
                                            </div>
                                        </div>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllNotificationsRead}
                                                className="text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    {/* Stat pills */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-300"></span>
                                            Unread: {unreadCount}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                            Read: {notifications.filter(n => n.isRead).length}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex gap-1.5 overflow-x-auto">
                                        {notificationFilters.map((filter) => (
                                            <button
                                                key={filter.value}
                                                type="button"
                                                onClick={() => setNotificationFilter(filter.value)}
                                                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                                    notificationFilter === filter.value
                                                        ? "bg-white text-[#A43275]"
                                                        : "bg-white/15 text-white/90 hover:bg-white/25"
                                                }`}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── List ── */}
                                <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                                    {notifications.length > 0 ? (
                                        notifications.map((notification) => {
                                            const isHigh = notification.priority === 'high';
                                            const barColor = !notification.isRead
                                                ? (isHigh ? 'bg-red-400' : 'bg-amber-400')
                                                : 'bg-gray-200';
                                            const cardBg = !notification.isRead
                                                ? (isHigh ? 'bg-red-50/60 hover:bg-red-50' : 'bg-amber-50/50 hover:bg-amber-50')
                                                : 'bg-white hover:bg-[#fce6f4]/40';
                                            const priorityChip = isHigh
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-amber-100 text-amber-700';

                                            return (
                                                <button
                                                    key={notification._id}
                                                    onClick={async () => {
                                                        if (!notification.isRead) {
                                                            await markNotificationRead(notification._id);
                                                        }
                                                        navigate(notification.actionUrl || '/admin/invoices');
                                                        setNotificationOpen(false);
                                                    }}
                                                    className={`group relative w-full text-left rounded-xl border border-gray-100 p-3 transition-all duration-200 ${cardBg}`}
                                                >
                                                    {/* Left colour bar */}
                                                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${barColor}`} />
                                                    <div className="pl-2">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-sm font-semibold text-gray-800 group-hover:text-[#A43275] leading-snug">
                                                                {notification.title}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                {!notification.isRead && (
                                                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                                                )}
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityChip}`}>
                                                                    {notification.priority.toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {getNotificationEntityLabel(notification)}
                                                            {' • '}
                                                            {notification.entityType === 'purchase'
                                                                ? (notification.meta?.supplierBillNumber || 'N/A')
                                                                : (notification.meta?.customerPhone || 'N/A')}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="text-[10px] text-gray-400 mt-1.5">
                                                            {new Date(notification.updatedAt || notification.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center">
                                            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#fce6f4] flex items-center justify-center mb-3">
                                                <Bell className="w-7 h-7 text-[#A43275]" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                                            <p className="text-xs text-gray-400 mt-1">No important notifications</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Footer ── */}
                                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                                    <p className="text-[11px] text-gray-400 text-center">Click a notification to navigate to the source</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="relative" ref={invoiceRef}>
                    <button
                        onClick={() => setInvoiceOpen(!invoiceOpen)}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
                    >
                        <IoReceiptOutline className="w-5 h-5 text-gray-700" />
                    </button>

                    {invoiceOpen && (
                        <div className="z-[9999] bg-white shadow-2xl border border-gray-100 rounded-2xl overflow-hidden md:absolute md:right-0 md:mt-3 md:w-[360px] fixed inset-x-3 bottom-3 md:inset-auto">
                            {/* ── Header ── */}
                            <div className="bg-gradient-to-r from-[#A43275] to-[#c0428e] px-5 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                            <IoReceiptOutline className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white">Recent Invoices</h4>
                                            <p className="text-[11px] text-white/70">Last {invoices.length} invoices</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { navigate('/admin/invoices'); setInvoiceOpen(false); }}
                                        className="text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
                                    >
                                        View All
                                    </button>
                                </div>
                                {/* Stat pills */}
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                        Paid: {invoices.filter((inv: any) => inv.status === 'PAID').length}
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                                        Unpaid: {invoices.filter((inv: any) => inv.status === 'UNPAID').length}
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/90 bg-white/15 rounded-full px-2.5 py-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-300"></span>
                                        Partial: {invoices.filter((inv: any) => inv.status !== 'PAID' && inv.status !== 'UNPAID').length}
                                    </span>
                                </div>
                            </div>

                            {/* ── Invoice list ── */}
                            <div className="max-h-[340px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                                {invoices.length > 0 ? (
                                    invoices.map((invoice: any) => {
                                        const isPaid = invoice.status === 'PAID';
                                        const isUnpaid = invoice.status === 'UNPAID';
                                        const barColor = isPaid ? 'bg-emerald-400' : isUnpaid ? 'bg-amber-400' : 'bg-red-400';
                                        const statusChip = isPaid
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : isUnpaid
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-red-100 text-red-700';
                                        const cardHoverBg = isPaid
                                            ? 'hover:bg-emerald-50'
                                            : isUnpaid
                                                ? 'hover:bg-amber-50'
                                                : 'hover:bg-red-50';
                                        const numberHoverColor = isPaid
                                            ? 'group-hover:text-emerald-600'
                                            : isUnpaid
                                                ? 'group-hover:text-amber-600'
                                                : 'group-hover:text-red-600';

                                        return (
                                            <button
                                                key={invoice._id}
                                                onClick={() => {
                                                    navigate(`/admin/invoices/edit-invoice/${invoice._id}`);
                                                    setInvoiceOpen(false);
                                                }}
                                                className={`group relative w-full text-left rounded-xl border border-gray-100 p-3 bg-white ${cardHoverBg} transition-all duration-200`}
                                            >
                                                {/* Left colour bar */}
                                                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${barColor}`} />
                                                <div className="pl-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`text-sm font-bold text-gray-800 ${numberHoverColor}`}>
                                                            {invoice.invoiceNumber}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-900">
                                                            ₹{invoice.totalAmount?.toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <span className="text-xs text-gray-500 truncate max-w-[160px]">
                                                            {invoice.customer?.phone || 'N/A'}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusChip}`}>
                                                            {invoice.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                        {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="py-12 text-center">
                                        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#fce6f4] flex items-center justify-center mb-3">
                                            <IoReceiptOutline className="w-7 h-7 text-[#A43275]" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-700">No recent invoices</p>
                                        <p className="text-xs text-gray-400 mt-1">Recent invoices will appear here</p>
                                    </div>
                                )}
                            </div>

                            {/* ── Footer ── */}
                            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                                <p className="text-[11px] text-gray-400">Click an invoice to open it</p>
                                <button
                                    onClick={() => { navigate('/admin/invoices'); setInvoiceOpen(false); }}
                                    className="text-xs font-semibold text-[#A43275] hover:underline"
                                >
                                    View all →
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {softwareDownloadUrl && (
                    <div>
                        <a
                            href={softwareDownloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="hidden md:flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-gray-950 transition text-sm font-semibold shadow-sm"
                        >
                            Download Software
                        </a>
                    </div>
                )}

                <div className="relative" ref={quickCreateRef}>
                    <button
                        onClick={() => setOpen(!open)}
                        className="hidden md:flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full hover:bg-gray-950 transition"
                    >
                        <Plus size={24} />
                    </button>
                    {open && (
                        <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg border border-gray-100 z-50">
                            {actions.map((action) => (
                                <button
                                    key={action.label}
                                    onClick={() => {
                                        action.onClick();
                                        setOpen(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                                >
                                    {action.icon}
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center space-x-2 focus:outline-none  rounded-full p-1 cursor-pointer"
                        aria-expanded={isDropdownOpen}
                        aria-haspopup="true"
                    >
                        <div className={
                            user?.profileImageUrl ?
                                `w-10 h-10 border-2 border-primary text-white rounded-full flex items-center justify-center text-lg font-semibold`
                                : `w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 text-white rounded-full flex items-center justify-center text-lg font-semibold`
                        }>
                            {user?.profileImageUrl ? (
                                <img
                                    src={normalizeImageUrl(user.profileImageUrl)}
                                    alt="User"
                                    className="w-8 h-8 rounded-full"
                                />
                            )
                                :
                                <UserCircle className="w-6 h-6" />
                            }
                        </div>
                    </button>

                    {isDropdownOpen && (
                        <div
                            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 transform origin-top-right animate-fade-in-up z-999"
                            onMouseLeave={() => setIsDropdownOpen(false)}
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="user-menu-button"
                        >
                            <div className="px-4 py-3" role="none">
                                <p className="text-sm font-medium text-gray-950 truncate" role="none">
                                    {user?.firstName + " " + user?.lastName || "Guest User"}
                                </p>
                                <p className="text-sm text-gray-500 truncate" role="none">
                                    {user?.email || "guest@example.com"}
                                </p>
                            </div>
                            <div className="py-1" role="none">
                                <Link
                                    to="/admin/settings/profile"
                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#fce6f4] hover:text-pink-700 rounded-md mx-2 transition-colors duration-200"
                                    role="menuitem"
                                >
                                    <User className="w-4 h-4 mr-3 text-gray-400" />
                                    Profile
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleSoftwareDownload}
                                    className="flex items-center w-[calc(100%-1rem)] px-4 py-2 text-sm text-gray-700 hover:bg-[#fce6f4] hover:text-pink-700 rounded-md mx-2 transition-colors duration-200"
                                    role="menuitem"
                                >
                                    <Download className="w-4 h-4 mr-3 text-gray-400" />
                                    Download Software
                                </button>
                                <a href='#'
                                    onClick={handleLogout}
                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#fce6f4] hover:text-pink-700 rounded-md mx-2 transition-colors duration-200 cursor-pointer"
                                    role="menuitem"
                                >
                                    <LogOut className="w-4 h-4 mr-3 text-gray-400" />
                                    Logout
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCustomBarcodePrint && (
                <CustomQrPrint
                    productName={customBarcodeForm.productName.trim()}
                    brandName={customBarcodeForm.brandName.trim()}
                    variantSize={customBarcodeForm.variantSizes.map(s => s.trim()).filter(Boolean).join(", ")}
                    variantColor={customBarcodeForm.variantColor.trim()}
                    onClose={() => {
                        setShowCustomBarcodePrint(false);
                        resetCustomBarcodeForm();
                    }}
                />
            )}

            <Modal
                isOpen={showTodoCreateModal}
                onClose={() => {
                    setShowTodoCreateModal(false);
                    resetTodoForm();
                }}
                title={editingTodoTaskId ? "Edit To-Do Task" : "Create To-Do Task"}
                size="md"
            >
                <div className="space-y-5">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fce6f4] border border-[#fbb7ec]">
                        <div className="w-9 h-9 rounded-lg bg-[#A43275] flex items-center justify-center flex-shrink-0">
                            <ListTodo className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#A43275]">
                                {editingTodoTaskId ? 'Update existing task' : 'Add a new task to your list'}
                            </p>
                            <p className="text-xs text-[#A43275]/70 mt-0.5">Fill in the details below</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Task Title <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={todoForm.title}
                            onChange={(e) => setTodoForm((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/40 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400"
                            placeholder="What needs to be done?"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Description</label>
                        <textarea
                            value={todoForm.description}
                            onChange={(e) => setTodoForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#A43275]/40 focus:border-[#A43275] focus:bg-white transition placeholder-gray-400 resize-none min-h-[90px]"
                            placeholder="Optional details or notes…"
                        />
                    </div>

                    {/* Date grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <DateInput
                                label="Start Date"
                                value={todoForm.createDate}
                                onChange={(createDate) => {
                                    if (!createDate) return;
                                    setTodoForm((prev) => ({
                                        ...prev,
                                        createDate,
                                        dueDate: prev.dueDate && prev.dueDate < createDate ? createDate : prev.dueDate,
                                    }));
                                }}
                            />
                        </div>
                        <div>
                            <DateInput
                                label="Due Date"
                                value={todoForm.dueDate}
                                minDate={todoForm.createDate || undefined}
                                onChange={(dueDate) => setTodoForm((prev) => ({ ...prev, dueDate }))}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setShowTodoCreateModal(false);
                                resetTodoForm();
                            }}
                            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveTodoTask}
                            disabled={todoSubmitting || !todoForm.title.trim()}
                            className="px-5 py-2.5 bg-[#A43275] text-white rounded-xl text-sm font-semibold hover:bg-[#8a2963] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shadow-[#A43275]/30"
                        >
                            {todoSubmitting
                                ? (editingTodoTaskId ? 'Saving…' : 'Creating…')
                                : (editingTodoTaskId ? 'Save Changes' : '+ Create Task')}
                        </button>
                    </div>
                </div>
            </Modal>
        </header>
    );
};

export default AdminHeader;
