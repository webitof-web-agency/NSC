import ConfirmationModal from "@components/admin/ConfirmationModal";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import InvoiceStatusBadge from "@components/admin/InvoiceStatusBadge";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import axios from "axios";
import { ArrowLeftRight, CirclePlusIcon, Edit, LucideEye, Trash2Icon, Upload, Printer, XCircle, Download, MessageCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import InvoicePaymentModal from "./InvoicePaymentModal";
import PaymentModal from "./PaymentModal";
import type { InvoicePaymentDetails } from "@models/invoice-payment";
import { hasPermission } from "@utils/hasPermission";
import type { PermissionAction } from "@models/permissions";
import useDateFormatter from "@hooks/useDateFormatter";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import ProfileCard from "@components/admin/ProfileImage";
import NoRecords from "@components/admin/NoRecords";
import ThermalInvoice58mm from "./ThermalInvoice58mm";
import { useReactToPrint } from "react-to-print";
import type { SelectedAdmin } from "@models/common";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import { DateRangePicker } from "@components/admin/DateRangePicker";
import InvoicePaymentSummary from "@components/admin/InvoicePaymentSummary";
import ProfessionalPrintDialog from "@components/admin/ProfessionalPrintDialog";
import { formatLocalDateTime } from "@utils/converters";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface Invoice {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    referenceNo: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    paymentTerms: string;
    taxableAmount: number;
    totalDiscount: number;
    vat: number;
    TotalAmount: number;
    totalPaid: number | null;
    payment_method: string;
    cashAmount?: number;
    cardAmount?: number;
    upiAmount?: number;
    billFrom: string;
    billTo: {
        id: string;
        name: string;
        email: string;
        phone: string;
        image: string | null;
        billingAddress?: {
            name: string;
            addressLine1: string;
            addressLine2: string;
            city: string;
            state: string;
            country: string;
            pincode: string;
        }
    };
    notes: string;
    sign_type: string;
    signature?: {
        id: string;
        name: string;

    };
    exchangePending?: boolean;
    isExchange?: boolean;
    exchangeOldTotal?: number;
    exchangeNewTotal?: number;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface InvoiceListProps {
    title?: string;
    showExchangeAction?: boolean;
    exchangeRouteBase?: string;
    showCreateActions?: boolean;
    showOnlyExchangeAction?: boolean;
    headerActions?: React.ReactNode;
    createPath?: string;
    createLabel?: string;
    fixedStatusFilter?: string | string[];
    hideStatusFilter?: boolean;
    excludeStatuses?: string[];
    customFilter?: (invoice: Invoice) => boolean;
    hideUploadButton?: boolean;
    hideNewExchangeButton?: boolean;
    exportStatusOverride?: string | string[];
}

const InvoiceList: React.FC<InvoiceListProps> = ({
    title = "Invoices",
    showExchangeAction = false,
    exchangeRouteBase = "/admin/invoices/edit-invoice",
    showCreateActions = true,
    showOnlyExchangeAction = false,
    headerActions,
    createPath = "/admin/invoices/create-invoice",
    createLabel = "New Invoice",
    fixedStatusFilter,
    hideStatusFilter = false,
    excludeStatuses = [],
    customFilter,
    hideUploadButton = false,
    hideNewExchangeButton = false,
    exportStatusOverride,
}) => {
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const { formatDate } = useDateFormatter();
    const { format } = useCurrencyFormatter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [itemToDelete, setItemToDelete] = useState<Invoice | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [itemForPayment, setItemForPayment] = useState<InvoicePaymentDetails | null>(null);
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
    const [isSelectingAll, setIsSelectingAll] = useState<boolean>(false);
    const [nextInvoiceNo, setNextInvoiceNo] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>(
        fixedStatusFilter
            ? (Array.isArray(fixedStatusFilter)
                ? fixedStatusFilter[0]
                : fixedStatusFilter
            ).toLowerCase()
            : 'all'
    );

    const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>(
        { startDate: null, endDate: null }
    );

    // Payment Modal State (The new one)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [invoiceDraft, setInvoiceDraft] = useState<FormData | null>(null);
    const [paymentModalGrandTotal, setPaymentModalGrandTotal] = useState<number>(0);
    const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<string | null>(null);

    // Confirmation Modal States
    const [showVerifyPaymentModal, setShowVerifyPaymentModal] = useState(false);
    const [invoiceToVerify, setInvoiceToVerify] = useState<Invoice | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const handleNewInvoiceClick = () => {
        if (!nextInvoiceNo) {
            toast.warning("Something went wrong. Please refresh the page.");
            return;
        }
        sessionStorage.setItem("nextInvoiceNo", nextInvoiceNo);
        navigate(createPath);
    }

    const handleSearch = (value: string) => {
        setSearchInput(value);
    }

    const allSelected = isAllSelected;
    const fetchAllInvoiceIds = async () => {
        const params: any = { search, limit: pagination.total || 0, page: 1 };

        if (fixedStatusFilter) {
            params.status = Array.isArray(fixedStatusFilter)
                ? fixedStatusFilter.map((s) => s.toUpperCase())
                : fixedStatusFilter.toUpperCase();
        } else if (statusFilter !== 'all') {
            params.status = statusFilter.toUpperCase();
        }

        if (dateRange.startDate) params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
        if (dateRange.endDate) params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);

        const response = await axios.get(Constants.GET_INVOICES_FOR_LIST_URL, {
            params,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let data = response.data.data;
        const list = Array.isArray(data?.invoices) ? data.invoices : [];
        let filtered = list;
        if (excludeStatuses.length > 0) {
            const excluded = new Set(excludeStatuses.map(s => s.toUpperCase()));
            filtered = filtered.filter((inv: any) => !excluded.has(String(inv.status).toUpperCase()));
        }
        if (customFilter) {
            filtered = filtered.filter((inv: any) => customFilter(inv));
        }
        return filtered.map((invoice: any) => invoice.id);
    };
    const handleToggleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedIds([]);
            setIsAllSelected(false);
            return;
        }
        const visibleIds = invoices.map(inv => inv.id);
        setSelectedIds(visibleIds);
        setIsAllSelected(true);
    };
    const handleRowSelect = (id: string, checked: boolean) => {
        if (isAllSelected) {
            setIsAllSelected(false);
        }
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };

    const handlePageLengthChange = (value: number) => {
        setSearchParams({
            search,
            limit: String(value),
            page: '1'
        });
    }

    const fetchInvoices = async () => {
        try {
            setIsLoading(true);
            const params: any = { search, limit, page };

            if (fixedStatusFilter) {
                params.status = Array.isArray(fixedStatusFilter)
                    ? fixedStatusFilter.map((s) => s.toUpperCase())
                    : fixedStatusFilter.toUpperCase();
            } else if (statusFilter !== 'all') {
                params.status = statusFilter.toUpperCase();
            }

            if (dateRange.startDate) params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
            if (dateRange.endDate) params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);

            const response = await axios.get(Constants.GET_INVOICES_FOR_LIST_URL, {
                params,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            let data = response.data.data;
            const list = Array.isArray(data?.invoices) ? data.invoices : [];
            let filtered = list;
            if (excludeStatuses.length > 0) {
                const excluded = new Set(excludeStatuses.map(s => s.toUpperCase()));
                filtered = filtered.filter((inv: any) => !excluded.has(String(inv.status).toUpperCase()));
            }
            if (customFilter) {
                filtered = filtered.filter((inv: any) => customFilter(inv));
            }
            setInvoices(filtered);

            if (data.pagination) {
                setPagination(data.pagination);
            }
            if (data.nextInvoiceNumber) {
                setNextInvoiceNo(data.nextInvoiceNumber);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchInvoices();
    }, [search, limit, page, token, statusFilter, fixedStatusFilter, dateRange]);

    const resetPageToFirst = () => {
        setSearchParams((prev) => {
            if ((prev.get('page') || '1') === '1') {
                return prev;
            }
            const next = new URLSearchParams(prev);
            next.set('page', '1');
            return next;
        });
    };

    const handleDateRangeChange = (range: { startDate: Date | null; endDate: Date | null }) => {
        setDateRange(range);
        resetPageToFirst();
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        resetPageToFirst();
    };

    const handlePageChange = (page: number) => {
        setSearchParams({
            search: search || '',
            limit: limit ? String(limit) : '10',
            page: String(page)
        });
    }


    // --- EXPORT INVOICES TO EXCEL ---
    const handleExportClick = async () => {
        try {
            // Build query params with current filters
            const params: any = {};

            if (search) params.search = search;
            if (exportStatusOverride) {
                params.status = Array.isArray(exportStatusOverride)
                    ? exportStatusOverride.map((s) => s.toUpperCase())
                    : exportStatusOverride.toUpperCase();
            } else if (fixedStatusFilter) {
                params.status = Array.isArray(fixedStatusFilter)
                    ? fixedStatusFilter.map((s) => s.toUpperCase())
                    : fixedStatusFilter.toUpperCase();
            } else if (statusFilter !== 'all') {
                params.status = statusFilter.toUpperCase();
            }

            if (dateRange.startDate) {
                params.startDate = formatLocalDateTime(dateRange.startDate, 'start', true);
            }
            if (dateRange.endDate) {
                params.endDate = formatLocalDateTime(dateRange.endDate, 'end', true);
            }
            if (selectedIds.length > 0) {
                params.ids = selectedIds.join(',');
            }

            // Make authenticated request with blob response
            const response = await axios.get(Constants.EXPORT_INVOICES_EXCEL_URL, {
                params,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                responseType: 'blob' // Important: Get response as blob for file download
            });

            // Create a blob URL and trigger download
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename with current date
            const today = new Date().toISOString().split('T')[0];
            link.download = `Invoices_Export_${today}.xlsx`;

            // Trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Invoices exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export invoices');
        }
    };


    // --- PRINT BILL LOGIC START ---
    const [printableInvoiceData, setPrintableInvoiceData] = useState<any>(null);
    const [printableCompanyDetails, setPrintableCompanyDetails] = useState<SelectedAdmin | null>(null);
    const [printableCustomerDetails, setPrintableCustomerDetails] = useState<any>(null);
    const [printableQRCode, setPrintableQRCode] = useState<string | null>(null);
    const [printableUpiQRCode, setPrintableUpiQRCode] = useState<string | null>(null);
    const [showProfessionalPrintDialog, setShowProfessionalPrintDialog] = useState(false);
    const [professionalPrintPreviewHtml, setProfessionalPrintPreviewHtml] = useState("");
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => {
            setPrintableInvoiceData(null);
            setPrintableCompanyDetails(null);
            setPrintableCustomerDetails(null);
            setPrintableQRCode(null);
            setPrintableUpiQRCode(null);
            setProfessionalPrintPreviewHtml("");
            setShowProfessionalPrintDialog(false);
        }
    });

    const handlePrintBill = async (
        item: Invoice,
        printOverrides?: {
            qrCode?: string;
            paymentMethod?: string;
            totalPaid?: number;
        }
    ) => {
        try {
            toast.info("Preparing Bill...", { autoClose: 1000 });

            // 1. Fetch Full Invoice Details
            const response = await axios.get(`${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const invoiceData = response.data?.data;

            if (!invoiceData) {
                toast.error("Failed to load invoice details");
                return;
            }
            if (
                invoiceData.status === "EXCHANGE" &&
                Array.isArray(invoiceData.exchangeOriginalItems)
            ) {
                invoiceData.exchangeOriginalItems = invoiceData.exchangeOriginalItems.map((item: any) => ({
                    ...item,
                    id: item.id || crypto.randomUUID()
                }));
            }

            // Convert string dates to Date objects for ThermalInvoice58mm
            if (invoiceData.invoiceDate && typeof invoiceData.invoiceDate === 'string') {
                invoiceData.invoiceDate = new Date(invoiceData.invoiceDate);
            }
            if (invoiceData.dueDate && typeof invoiceData.dueDate === 'string') {
                invoiceData.dueDate = new Date(invoiceData.dueDate);
            }

            // Map API field names to match ThermalInvoice58mm expectations
            invoiceData.subTotal = invoiceData.taxableAmount || 0;
            invoiceData.totalTax = invoiceData.vat || 0;
            invoiceData.grandTotal = invoiceData.TotalAmount || 0;
            invoiceData.totalDiscount = invoiceData.totalDiscount || 0;
            invoiceData.totalPaid =
                printOverrides?.totalPaid !== undefined
                    ? Number(printOverrides.totalPaid || 0)
                    : item.totalPaid || 0;
            if (printOverrides?.paymentMethod) {
                invoiceData.payment_method = printOverrides.paymentMethod;
                invoiceData.paymentMethod = printOverrides.paymentMethod;
            }
            invoiceData.isCreditInvoice =
                String(invoiceData.payment_method || invoiceData.paymentMethod || "").toUpperCase() === "CREDIT";
            const isExchangeInvoice =
                invoiceData.status === "EXCHANGE" ||
                invoiceData.isExchange === true ||
                invoiceData.exchangePending === true;
            if (isExchangeInvoice) {
                const exchangeOld =
                    invoiceData.exchangeOldTotal ??
                    invoiceData.oldTotal ??
                    null;
                const exchangeNew =
                    invoiceData.exchangeNewTotal ??
                    invoiceData.TotalAmount ??
                    null;
                if (exchangeOld !== null && exchangeOld !== undefined) {
                    invoiceData.exchangeOldTotal = Number(exchangeOld);
                }
                if (exchangeNew !== null && exchangeNew !== undefined) {
                    invoiceData.exchangeNewTotal = Number(exchangeNew);
                }
            }

            try {
                const paymentRes = await axios.get(
                    `${Constants.FETCH_INVOICE_PAYMENT_DETAILS_URL}/${item.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const fetchedTotalPaid = Number(paymentRes.data?.data?.payment?.totalPaid || 0);
                if (printOverrides?.totalPaid !== undefined) {
                    invoiceData.totalPaid = Number(printOverrides.totalPaid || 0);
                } else {
                    invoiceData.totalPaid = fetchedTotalPaid || invoiceData.totalPaid || 0;
                }
            } catch {
                // keep fallback
            }

            // 2. Fetch Company Details (Bill From)
            let companyData = null;
            if (invoiceData.billFrom?.id) {
                try {
                    const companyRes = await axios.get(`${Constants.FETCH_COMPANY_SETTINGS_URL}/${invoiceData.billFrom.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    companyData = companyRes.data.data;
                } catch (err) {
                    console.error("Failed to fetch company settings", err);
                }
            }

            // 3. Prepare Customer Details
            const customerData = invoiceData.billTo || null;

            // 4. Get QR Codes (PhonePe and UPI)
            // If overrideQRCode is passed (from PaymentModal), use it directly.
            // Otherwise, check if we need to fetch from invoice data.
            const overrideMethod = printOverrides?.paymentMethod;
            let phonepeQR =
                overrideMethod === "PHONEPE"
                    ? printOverrides?.qrCode || invoiceData.phonepeQRCode || null
                    : invoiceData.phonepeQRCode || null;
            let upiQR =
                overrideMethod === "UPI" || overrideMethod === "MIXED"
                    ? printOverrides?.qrCode || invoiceData.upiQRCode || null
                    : invoiceData.upiQRCode || null;

            // 5. Set State for Thermal Component
            setPrintableInvoiceData(invoiceData);
            setPrintableCompanyDetails(companyData);
            setPrintableCustomerDetails(customerData);
            setPrintableQRCode(phonepeQR);
            setPrintableUpiQRCode(upiQR);

        } catch (error) {
            console.error("Print Error:", error);
            toast.error("Failed to print bill");
        }
    };

    useEffect(() => {
        if (!printableInvoiceData) return;

        const timer = window.setTimeout(() => {
            const html = printRef.current?.innerHTML || "";
            setProfessionalPrintPreviewHtml(html);
            if (html) {
                setShowProfessionalPrintDialog(true);
            }
        }, 80);

        return () => window.clearTimeout(timer);
    }, [printableInvoiceData, printableCompanyDetails, printableCustomerDetails, printableQRCode, printableUpiQRCode]);

    const professionalPrintPreview = professionalPrintPreviewHtml ? (
        <div
            className="bg-white"
            dangerouslySetInnerHTML={{ __html: professionalPrintPreviewHtml }}
        />
    ) : null;

    const normalizeInvoiceStatus = (status?: string | null) =>
        String(status || "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");

    const isInvoiceFullySettled = (invoice: Pick<Invoice, "status">) => {
        const status = normalizeInvoiceStatus(invoice.status);
        return status === "PAID" || status === "EXCHANGE";
    };

    const resolveRemainingAmount = (
        invoiceData: any,
        paymentDetails?: { remaining?: unknown; totalPaid?: unknown } | null,
        listItem?: Invoice
    ) => {
        const total = Number(
            invoiceData?.TotalAmount ??
            invoiceData?.totalAmount ??
            listItem?.TotalAmount ??
            0
        );
        const paid = Number(
            paymentDetails?.totalPaid ??
            invoiceData?.totalPaid ??
            listItem?.totalPaid ??
            0
        );
        const fallbackRemaining = Math.max(total - paid, 0);
        const apiRemaining = Number(paymentDetails?.remaining);

        if (Number.isFinite(apiRemaining) && apiRemaining > 0) {
            return Number(apiRemaining.toFixed(2));
        }

        return Number(fallbackRemaining.toFixed(2));
    };

    // --- PRINT BILL LOGIC END ---

    // --- CANCEL INVOICE LOGIC START ---

    // --- PAY AND PRINT LOGIC (NEW) ---
    const handlePayAndPrint = async (item: Invoice) => {
        try {
            toast.info("Preparing Payment...", { autoClose: 1000 });
            // Fetch full details
            const response = await axios.get(`${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const invoiceData = response.data?.data;
            if (!invoiceData) { toast.error("Failed to load invoice"); return; }
            let paymentDetails = null;

            try {
                const paymentDetailsRes = await axios.get(
                    `${Constants.FETCH_INVOICE_PAYMENT_DETAILS_URL}/${item.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                paymentDetails = paymentDetailsRes.data?.data?.payment || null;
            } catch (paymentError) {
                console.error("Error fetching invoice remaining amount:", paymentError);
            }

            const remainingAmount = resolveRemainingAmount(invoiceData, paymentDetails, item);

            if (remainingAmount <= 0) {
                handlePrintBill(item);
                return;
            }

            const formData = new FormData();

            // Append simple fields
            ['invoiceNumber', 'referenceNo', 'status', 'notes', 'termsAndCondition', 'payment_method', 'taxType', 'gstType', 'roundOff', 'taxableAmount', 'totalDiscount', 'vat', 'TotalAmount'].forEach(key => {
                if (invoiceData[key] !== undefined && invoiceData[key] !== null) {
                    formData.append(key, String(invoiceData[key]));
                }
            });

            // Handle Dates
            if (invoiceData.invoiceDate) formData.append('invoiceDate', new Date(invoiceData.invoiceDate).toISOString());
            if (invoiceData.dueDate) formData.append('dueDate', new Date(invoiceData.dueDate).toISOString());

            // Handle IDs (billTo, billFrom, bank)
            // Note: In CreateInvoice, billTo/billFrom are IDs. Here we get objects.
            if (invoiceData.billTo?.id) formData.append('billTo', invoiceData.billTo.id);
            else if (invoiceData.billTo?._id) formData.append('billTo', invoiceData.billTo._id); // Just in case

            if (invoiceData.billFrom?.id) formData.append('billFrom', invoiceData.billFrom.id);
            else if (invoiceData.billFrom?._id) formData.append('billFrom', invoiceData.billFrom._id);

            if (invoiceData.bank?.id) formData.append('bank', invoiceData.bank.id);
            else if (invoiceData.bank?._id) formData.append('bank', invoiceData.bank._id);
            else if (invoiceData.bank && typeof invoiceData.bank === 'string') formData.append('bank', invoiceData.bank);

            // Handle Items (Explode Array to match CreateInvoice/Backend expectation)
            if (Array.isArray(invoiceData.items)) {
                invoiceData.items.forEach((item: any, index: number) => {
                    const getId = (val: any) => (typeof val === 'object' && val ? (val.id || val._id) : val);

                    // 1. Explicit Whitelist of Item Fields
                    const itemFields = [
                        'rowId', 'name', 'qty', 'rate', 'discount',
                        'discount_type', 'discount_value', 'tax',
                        'amount', 'unit', 'hsn_code'
                    ];

                    itemFields.forEach(k => {
                        if (item[k] !== undefined && item[k] !== null) {
                            formData.append(`items[${index}][${k}]`, String(item[k]));
                        }
                    });

                    // 2. Handle Reference Fields Explicitly (Extract IDs)
                    if (item.product_id) formData.append(`items[${index}][product_id]`, getId(item.product_id));
                    if (item.variantId) formData.append(`items[${index}][variantId]`, getId(item.variantId));
                    if (item.tax_group_id) formData.append(`items[${index}][tax_group_id]`, getId(item.tax_group_id));
                    if (item.staffId) formData.append(`items[${index}][staffId]`, getId(item.staffId));
                });
            }

            // Set State
            setInvoiceDraft(formData);
            setPaymentModalGrandTotal(remainingAmount);
            setPaymentModalInvoiceId(item.id);
            setShowPaymentModal(true);

        } catch (e) { console.error(e); toast.error("Error opening payment modal"); }
    };

    // --- VERIFY PAYMENT LOGIC (For UPI/PhonePe Manual Verification) ---
    const handleVerifyPayment = (item: Invoice) => {
        setInvoiceToVerify(item);
        setShowVerifyPaymentModal(true);
    };

    const confirmVerifyPayment = async () => {
        if (!invoiceToVerify) return;

        try {
            setIsVerifying(true);

            const paymentDetailsRes = await axios.get(
                `${Constants.FETCH_INVOICE_PAYMENT_DETAILS_URL}/${invoiceToVerify.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const paymentDetails = paymentDetailsRes.data?.data?.payment;
            const totalPaid = Number(paymentDetails?.totalPaid || 0);
            const remaining = Number(paymentDetails?.remaining || 0);
            const normalizedPaymentMethod = String(invoiceToVerify.payment_method || "").toUpperCase();
            const isManualVerificationPayment = ["UPI", "PHONEPE", "MIXED"].includes(normalizedPaymentMethod);

            if (remaining <= 0) {
                if (invoiceToVerify.status === "PENDING" && isManualVerificationPayment) {
                    const response = await axios.post(
                        Constants.CREATE_INVOICE_PAYMENT_URL,
                        {
                            invoiceId: invoiceToVerify.id,
                            payment_method: invoiceToVerify.payment_method,
                            amount: 0,
                            updateExistingPayment: true,
                            finalize: true,
                            notes: `Manual ${invoiceToVerify.payment_method} payment verification`
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    if (response.data.success) {
                        toast.success("Payment verified and invoice marked as PAID");
                    } else {
                        toast.error(response.data.message || "Failed to verify payment");
                        return;
                    }

                    setShowVerifyPaymentModal(false);
                    setInvoiceToVerify(null);
                    fetchInvoices();
                    return;
                }

                toast.success("Payment already fully recorded for this invoice.");
                setShowVerifyPaymentModal(false);
                setInvoiceToVerify(null);
                fetchInvoices();
                return;
            }

            const isExchangePending =
                (invoiceToVerify.isExchange === true ||
                    invoiceToVerify.exchangePending === true ||
                    invoiceToVerify.status === "EXCHANGE") &&
                ["UPI", "MIXED"].includes(invoiceToVerify.payment_method) &&
                remaining > 0;

            // ✅ Prepare payment data based on payment method
            const paymentData: any = {
                invoiceId: invoiceToVerify.id,
                payment_method: invoiceToVerify.payment_method,
                amount: remaining || invoiceToVerify.TotalAmount,
                finalize: true,
                notes: `Manual ${invoiceToVerify.payment_method} payment verification`
            };
            const shouldUpdateExistingPayment =
                !isExchangePending &&
                totalPaid > 0 &&
                remaining > 0;
            if (shouldUpdateExistingPayment) {
                paymentData.updateExistingPayment = true;
            }

            // ✅ For MIXED payment, include cash and UPI amounts
            if (invoiceToVerify.payment_method === 'MIXED') {
                let cashAmount = (invoiceToVerify as any).cashAmount;
                let cardAmount = (invoiceToVerify as any).cardAmount;
                let upiAmount = (invoiceToVerify as any).upiAmount;

                if (cashAmount === undefined || cardAmount === undefined || upiAmount === undefined) {
                    try {
                        const invoiceRes = await axios.get(
                            `${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${invoiceToVerify.id}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const invoiceData = invoiceRes.data?.data;
                        cashAmount = invoiceData?.cashAmount;
                        cardAmount = invoiceData?.cardAmount;
                        upiAmount = invoiceData?.upiAmount;
                    } catch {
                        // fallback to computed values below
                    }
                }

                const resolvedCash = Number(cashAmount || 0);
                const resolvedCard = Number(cardAmount || 0);
                const resolvedUpi =
                    upiAmount !== undefined && upiAmount !== null
                        ? Number(upiAmount)
                        : Math.max(Number((invoiceToVerify.TotalAmount || 0) - resolvedCash - resolvedCard), 0);

                paymentData.cashAmount = resolvedCash;
                paymentData.cardAmount = resolvedCard;
                paymentData.upiAmount = resolvedUpi;
                // For MIXED verification, record full split amount (cash/card + upi)
                paymentData.amount = Number((resolvedCash + resolvedCard + resolvedUpi).toFixed(2));
            }

            const response = isExchangePending
                ? await axios.post(
                    `${Constants.EXCHANGE_INVOICE_PAYMENT_URL}/${invoiceToVerify.id}/exchange-payment`,
                    { ...paymentData, finalize: true },
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                : await axios.post(
                    Constants.CREATE_INVOICE_PAYMENT_URL,
                    paymentData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

            if (response.data.success) {
                toast.success("Payment verified and invoice marked as PAID");
                setShowVerifyPaymentModal(false);
                setInvoiceToVerify(null);
                fetchInvoices(); // Refresh the list
            } else {
                toast.error(response.data.message || "Failed to verify payment");
            }
        } catch (error: any) {
            console.error("Verify Payment Error:", error);
            toast.error(error?.response?.data?.message || "Failed to verify payment");
        } finally {
            setIsVerifying(false);
        }
    };
    const handleCancelClick = (item: Invoice) => {
        setInvoiceToCancel(item);
        setShowCancelModal(true);
    };

    const confirmCancelInvoice = async () => {
        if (!invoiceToCancel) return;

        try {
            setIsCancelling(true);
            const response = await axios.put(
                `${Constants.CANCEL_INVOICE_URL}/${invoiceToCancel.id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                toast.success("Invoice cancelled successfully. Inventory restored.");
                setShowCancelModal(false);
                setInvoiceToCancel(null);
                fetchInvoices(); // Refresh the list
            } else {
                toast.error(response.data.message || "Failed to cancel invoice");
            }
        } catch (error: any) {
            console.error("Cancel Invoice Error:", error);
            toast.error(error?.response?.data?.message || "Failed to cancel invoice");
        } finally {
            setIsCancelling(false);
        }
    };
    // --- CANCEL INVOICE LOGIC END ---

    const restrictedActions = ['edit', 'delete'];
    const getTableActions = (item: Invoice) => {
        const actions = [
            {
                label: 'View',
                icon: <LucideEye size={14} />,
                onClick: () => handleViewClick(item),
            },
            {
                label: 'Verify Payment',
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
                onClick: () => handleVerifyPayment(item),
                hideWhen: item.status !== 'PENDING' || !['UPI', 'PHONEPE', 'MIXED'].includes(item.payment_method) ? ['PAID', 'UNPAID', 'PENDING', 'DRAFT', 'EXCHANGE', 'CANCELLED', 'PARTIALLY_PAID', 'OVERDUE'] : []
            },
            {
                label: 'WhatsApp',
                icon: <MessageCircle size={14} />,
                onClick: () => handleSendWhatsAppClick(item),
                hideWhen: ['CANCELLED']
            },
            ...( ((item.TotalAmount || 0) - (item.totalPaid || 0) > 0 && item.status !== 'CANCELLED') ? [{
                label: 'Payment Reminder',
                icon: <MessageCircle size={14} />,
                onClick: () => handleSendPaymentReminderClick(item),
            }] : []),
            {
                label: 'Print Bill',
                icon: <Printer size={14} />,
                onClick: () => {
                    if (isInvoiceFullySettled(item)) {
                        handlePrintBill(item);
                    } else {
                        handlePayAndPrint(item);
                    }
                },
                // Allow printing for PAID now!
                hideWhen: ['CANCELLED']
            },
            {
                label: 'Print Bill + WhatsApp',
                icon: <Printer size={14} />,
                onClick: () => {
                    handleSendWhatsAppClick(item);
                    if (isInvoiceFullySettled(item)) {
                        handlePrintBill(item);
                    } else {
                        handlePayAndPrint(item);
                    }
                },
                hideWhen: ['CANCELLED']
            },
            {
                label: 'Cancel',
                icon: <XCircle size={14} />,
                onClick: () => handleCancelClick(item),
                hideWhen: ['PAID', 'PARTIALLY_PAID', 'EXCHANGE', 'CANCELLED', 'OVERDUE', 'SENT', 'CANCELLED']
            },
            {
                label: 'Edit',
                icon: <Edit size={14} />,
                onClick: () => handleEditClick(item),
                hideWhen: ['EXCHANGE', 'CANCELLED']
            },
            ...(showExchangeAction ? [{
                label: 'Exchange',
                icon: <ArrowLeftRight size={14} />,
                onClick: () => handleExchangeClick(item),
                hideWhen: ['EXCHANGE', 'UNPAID', 'PENDING', 'CANCELLED']
            }] : []),
            {
                label: 'Delete',
                icon: <Trash2Icon size={14} />,
                onClick: () => handleDeleteClick(item),
                // hideWhen: ['PAID', 'PARTIALLY_PAID']
            }
        ];

        let filtered = actions.filter((action) => {
            const actionLabel = action.label.toLowerCase();

            //Hide if status matches
            if (action.hideWhen?.includes(item.status)) {
                return false;
            }

            //If restricted action, check permission
            if (restrictedActions.includes(actionLabel)) {
                const permissionAction: PermissionAction =
                    actionLabel === 'delete' ? 'delete' : 'edit';
                return hasPermission(permissions, 'invoices', permissionAction);
            }

            //Otherwise always allow
            return true;
        });

        if (showOnlyExchangeAction) {
            filtered = filtered.filter((action) => action.label.toLowerCase() === 'exchange');
        }

        return filtered;
    };


    const handleViewClick = (item: Invoice) => {
        navigate(`/admin/view-invoice/${item.id}`);
    }
    const handleEditClick = (item: Invoice) => {
        navigate(`/admin/invoices/edit-invoice/${item.id}`);
    }
    const handleExchangeClick = (item: Invoice) => {
        navigate(`${exchangeRouteBase}/${item.id}`);
    }
    const handleDeleteClick = (item: Invoice) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    }

    const handleSendWhatsAppClick = async (item: Invoice) => {
        try {
            await axios.post(Constants.WHATSAPP_SEND_MANUAL_URL, {
                documentType: item.status === 'EXCHANGE' || item.isExchange ? 'exchange' : 'invoice',
                documentId: item.id,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('WhatsApp send requested successfully');
        } catch (error: any) {
            console.error('Failed to send invoice on WhatsApp:', error);
            toast.error(error.response?.data?.message || 'Failed to send WhatsApp message');
        }
    }

    const handleSendPaymentReminderClick = async (item: Invoice) => {
        try {
            await axios.post(Constants.WHATSAPP_SEND_MANUAL_URL, {
                documentType: 'payment_reminder',
                documentId: item.id,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Payment Reminder requested successfully');
        } catch (error: any) {
            console.error('Failed to send payment reminder:', error);
            toast.error(error.response?.data?.message || 'Failed to send Payment Reminder');
        }
    }

    const handlePaymentClick = async (item: Invoice) => {
        try {
            const response = await axios.get(`${Constants.FETCH_INVOICE_PAYMENT_DETAILS_URL}/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.data) {
                setIsPaymentModalOpen(true);
                setItemForPayment(response.data.data);
            }
        } catch (error) {
            console.error('Failed to delete invoice:', error);
        }
    }
    const confirmDelete = async () => {
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_INVOICE_URL}/${itemToDelete?.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Invoice deleted successfully');
            setShowDeleteModal(false);
            await fetchInvoices();
        } catch (error) {
            console.error('Failed to delete invoice:', error);
        } finally {
            setIsDeleting(false);
        }
    }

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_INVOICE_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} invoice(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} invoice(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            await fetchInvoices();
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">{title}</h1>
                <div className="flex flex-wrap gap-2">
                    {headerActions ? headerActions : (showCreateActions && hasPermission(permissions, 'invoices', 'create') && (
                        <>
                            {hasPermission(permissions, 'invoices', 'delete') && (
                                <button
                                    onClick={() => setShowBulkDeleteModal(true)}
                                    disabled={selectedIds.length === 0}
                                    className={`px-3 py-2 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-red-100 hover:bg-red-200 text-red-600"
                                        }`}
                                >
                                    <Trash2Icon size={16} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                                </button>
                            )}
                            <button
                                onClick={handleExportClick}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-3 py-2 rounded-md shadow cursor-pointer flex items-center gap-2">
                                <Download size={16} /> Export Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                            </button>
                            {!hideUploadButton && (
                                <button
                                    onClick={() => navigate('/admin/invoices/bulk-import')}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md shadow cursor-pointer flex items-center gap-2">
                                    <Upload size={16} /> Upload Excel
                                </button>
                            )}
                            {!hideNewExchangeButton && (
                                <button
                                    onClick={() => navigate('/admin/invoices/exchange/new')}
                                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-2 rounded-md shadow cursor-pointer flex items-center gap-2">
                                    <ArrowLeftRight size={16} /> New Exchange
                                </button>
                            )}
                            <button
                                onClick={handleNewInvoiceClick}
                                className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                                <CirclePlusIcon size={14} /> {createLabel}
                            </button>
                        </>
                    ))}
                </div>
            </div>

            {/* Search Input & Filters */}
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by invoice number, phone..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-80 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-start sm:items-center">
                    {/* Date Range Picker */}
                    <div className="relative flex items-center gap-1">
                        <DateRangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
                        />
                        {(dateRange.startDate || dateRange.endDate) && (
                            <button
                                onClick={() => handleDateRangeChange({ startDate: null, endDate: null })}
                                title="Clear date filter"
                                className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* Status Filter Dropdown */}
                    {!hideStatusFilter && !fixedStatusFilter && (
                        <div className="w-full sm:w-auto">
                            <CustomSelectDropdown
                                value={statusFilter}
                                onChange={handleStatusFilterChange}
                                options={[
                                    { value: 'all', label: 'All Invoices' },
                                    { value: 'paid', label: 'Paid' },
                                    { value: 'unpaid', label: 'Unpaid' },
                                    { value: 'partially_paid', label: 'Partially Paid' },
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'exchange', label: 'Exchange' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                ]}
                                placeholder="Select Status"
                                className="min-w-[180px] w-full"
                            />
                        </div>
                    )}
                    {/* Page Length Dropdown */}
                    <select
                        value={limit}
                        onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                        className="border border-gray-300 px-4 py-2 rounded-md bg-white text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent cursor-pointer w-full sm:w-auto"
                    >
                        {[10, 25, 50].map((num) => (
                            <option className="text-gray-950" key={num} value={num}>{num} / page</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="w-full overflow-hidden [&_table]:table-fixed [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_th]:text-[10px] [&_td]:break-words [&_table]:w-full [&_th:first-child]:w-[40px] [&_th:nth-child(2)]:w-[40px]">
                <Table headers={[
                    "#",
                    <CustomCheckbox
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        disabled={invoices.length === 0}
                        name="select-all-invoices"
                    />,
                    "Invoice ID",
                    "Customer Phone",
                    "Amount",
                    "Paid",
                    "Payment Mode",
                    "Status",
                    "Created On",
                    "Updated On",
                    "Actions"
                ]}>
                    {!isLoading && invoices && invoices.map((invoice, index) => (
                        <TableRow
                            key={invoice.id}
                            index={(page - 1) * limit + index + 1}
                            row={invoice}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(invoice.id)}
                                    onChange={(checked) => handleRowSelect(invoice.id, checked)}
                                    name={`select-invoice-${invoice.id}`}
                                />,
                                <a href={`/admin/view-invoice/${invoice.id}`} className="text-indigo-600 cursor-pointer">{invoice.invoiceNumber}</a>,
                                <ProfileCard
                                    phone={invoice.billTo?.phone || "N/A"}
                                />,
                                <span className="font-semibold text-gray-600 ">{format(invoice.TotalAmount)}</span>,
                                <span className="font-semibold text-gray-600 ">{format(invoice.totalPaid as number) ?? "0"}</span>,
                                <InvoicePaymentSummary
                                    mode={invoice.payment_method}
                                    amount={Number(invoice.totalPaid || 0)}
                                    cashAmount={invoice.cashAmount}
                                    cardAmount={invoice.cardAmount}
                                    upiAmount={invoice.upiAmount}
                                    outstandingAmount={Math.max(Number(invoice.TotalAmount || 0) - Number(invoice.totalPaid || 0), 0)}
                                />,
                                <InvoiceStatusBadge status={invoice.status} />,
                                <span className="font-semibold text-gray-600 flex flex-col">
                                    <span>{formatDate(invoice.createdAt as string, systemSettings?.dateFormat.format || 'd-m-Y')}</span>
                                    <span className="text-xs text-gray-400 font-medium">{formatDate(invoice.createdAt as string, 'hh:mm A')}</span>
                                </span>,
                                <span className="font-semibold text-gray-600 flex flex-col">
                                    <span>{formatDate(invoice.updatedAt as string, systemSettings?.dateFormat.format || 'd-m-Y')}</span>
                                    <span className="text-xs text-gray-400 font-medium">{formatDate(invoice.updatedAt as string, 'hh:mm A')}</span>
                                </span>,
                            ]}
                            actions={getTableActions(invoice)}
                        />
                    ))}
                    {!isLoading && invoices.length === 0 && (
                        <NoRecords message="No records found" colSpan={11} />
                    )}

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950  font-semibold" colSpan={10}>
                                <LoaderSpinner />
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

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
            {/* Delete Invoice */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message="Are you sure you want to delete this invoice?"
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} invoice(s)?`}
            >
            </DeleteConfirmationModal>

            {/* Payment ModalComponent */}
            {
                itemForPayment && <InvoicePaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    invoiceItem={itemForPayment as InvoicePaymentDetails}
                    onSuccess={() => fetchInvoices()}
                />
            }

            {showPaymentModal && invoiceDraft && (
                <PaymentModal
                    open={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    invoiceDraft={invoiceDraft}
                    grandTotal={paymentModalGrandTotal}
                    isEdit={true}
                    invoiceId={paymentModalInvoiceId || undefined}
                    recordPaymentOnly
                    onSuccess={(data) => {
                        setShowPaymentModal(false);
                        fetchInvoices(); // Refresh status

                        if (data?.qrCode || data?.isMixedPending) { // Handle Mixed or standard QR
                            handlePrintBill(
                                { id: paymentModalInvoiceId } as Invoice,
                                {
                                    qrCode: data?.qrCode,
                                    paymentMethod: data?.paymentMethod,
                                    totalPaid: data?.totalPaid,
                                }
                            );
                        } else {
                            // Standard success (Cash/Credit)
                            handlePrintBill(
                                { id: paymentModalInvoiceId } as Invoice,
                                {
                                    paymentMethod: data?.paymentMethod,
                                    totalPaid: data?.totalPaid,
                                }
                            );
                        }
                    }}
                />
            )}

            <ProfessionalPrintDialog
                isOpen={showProfessionalPrintDialog}
                onClose={() => {
                    setShowProfessionalPrintDialog(false);
                    setPrintableInvoiceData(null);
                    setPrintableCompanyDetails(null);
                    setPrintableCustomerDetails(null);
                    setPrintableQRCode(null);
                    setPrintableUpiQRCode(null);
                }}
                onPrint={() => {
                    setShowProfessionalPrintDialog(false);
                    window.setTimeout(() => handlePrint(), 80);
                }}
                onWhatsApp={async () => {
                    if (printableInvoiceData) {
                        await handleSendWhatsAppClick(printableInvoiceData);
                        setShowProfessionalPrintDialog(false);
                    } else {
                        toast.error("Invoice data missing");
                    }
                }}
                onPrintAndWhatsApp={async () => {
                    if (printableInvoiceData) {
                        await handleSendWhatsAppClick(printableInvoiceData);
                        setShowProfessionalPrintDialog(false);
                        window.setTimeout(() => handlePrint(), 80);
                    } else {
                        toast.error("Invoice data missing");
                    }
                }}
                title="Print Thermal Bill"
                documentName={printableInvoiceData?.invoiceNumber || "Invoice Bill"}
                documentType="Thermal Bill"
                description="Review the thermal bill before sending it to print."
                preview={professionalPrintPreview}
                previewWrapperClassName="overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm p-4"
                footerNote="The final print layout will use the thermal bill template."
                printButtonLabel="Print Bill"
                showCopies={false}
                showPaperSize={false}
                showOrientation={false}
            />

            {/* Hidden Thermal Invoice for Printing */}
            <div className="hidden">
                {printableInvoiceData && (
                    <ThermalInvoice58mm
                        ref={printRef}
                        invoiceFormData={printableInvoiceData}
                        companyDetails={printableCompanyDetails}
                        customerDetails={printableCustomerDetails}
                        phonepeQRCode={printableQRCode}
                        upiQRCode={printableUpiQRCode}
                    />
                )}
            </div>

            <ConfirmationModal
                isOpen={showVerifyPaymentModal}
                onClose={() => {
                    setShowVerifyPaymentModal(false);
                    setInvoiceToVerify(null);
                }}
                onConfirm={confirmVerifyPayment}
                title="Verify Payment"
                type="success"
                confirmText="Verify & Mark as Paid"
                isLoading={isVerifying}
                message={
                    invoiceToVerify ? (
                        <div className="text-left space-y-2">
                            <p><strong>Invoice:</strong> #{invoiceToVerify.invoiceNumber}</p>
                            <p><strong>Payment Method:</strong> {invoiceToVerify.payment_method}</p>
                            <p><strong>Amount:</strong> {format(invoiceToVerify.TotalAmount)}</p>
                            <div className="mt-4 border-t pt-3">
                                <p className="font-semibold mb-2">This will:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Mark invoice as PAID</li>
                                    <li>Create payment record</li>
                                    <li>Update invoice status</li>
                                </ul>
                                <p className="mt-3 text-yellow-700 font-medium">⚠️ Make sure you have received the payment before confirming.</p>
                            </div>
                        </div>
                    ) : null
                }
            />

            <ConfirmationModal
                isOpen={showCancelModal}
                onClose={() => {
                    setShowCancelModal(false);
                    setInvoiceToCancel(null);
                }}
                onConfirm={confirmCancelInvoice}
                title="Cancel Invoice"
                type="danger"
                confirmText="Yes, Cancel Invoice"
                isLoading={isCancelling}
                message={
                    invoiceToCancel ? (
                        <div className="text-left space-y-2">
                            <p><strong>Invoice:</strong> #{invoiceToCancel.invoiceNumber}</p>
                            <p><strong>Customer:</strong> {invoiceToCancel.billTo?.phone}</p>
                            <p><strong>Amount:</strong> {format(invoiceToCancel.TotalAmount)}</p>
                            <div className="mt-4 border-t pt-3">
                                <p className="font-semibold mb-2">This will:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Update invoice status to CANCELLED</li>
                                    <li>Return items to inventory</li>
                                    <li>Create inventory history records</li>
                                </ul>
                                <p className="mt-3 text-red-700 font-medium">⚠️ This action cannot be undone.</p>
                            </div>
                        </div>
                    ) : null
                }
            />
        </div >
    );
};

export default InvoiceList;
