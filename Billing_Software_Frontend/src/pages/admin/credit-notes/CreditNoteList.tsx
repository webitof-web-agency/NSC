import ConfirmationModal from "@components/admin/ConfirmationModal";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import InvoiceStatusBadge from "@components/admin/InvoiceStatusBadge";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import NoRecords from "@components/admin/NoRecords";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import ProfileCard from "@components/admin/ProfileImage";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import ThermalInvoice58mm from "../invoices/ThermalInvoice58mm";
import PaymentModal from "../invoices/PaymentModal";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import { useDebounce } from "@hooks/useDebounce";
import useDateFormatter from "@hooks/useDateFormatter";
import type { PermissionAction } from "@models/permissions";
import type { SelectedAdmin } from "@models/common";
import type { RootState } from "@store/index";
import { hasPermission } from "@utils/hasPermission";
import axios from "axios";
import { CirclePlusIcon, Edit, Trash2Icon, LucideEye, XCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

interface Invoice {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    referenceNo: string;
    name: string;
    status: string;
    createdAt: string;
    paymentTerms: string;
    taxableAmount: number;
    totalDiscount: number;
    vat: number;
    TotalAmount: number;
    totalPaid: number | null;
    payment_method: string;
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
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const CreditNoteList: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [itemToDelete, setItemToDelete] = useState<Invoice | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const { formatDate } = useDateFormatter();
    const { format } = useCurrencyFormatter();

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [invoiceDraft, setInvoiceDraft] = useState<FormData | null>(null);
    const [paymentModalGrandTotal, setPaymentModalGrandTotal] = useState<number>(0);
    const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<string | null>(null);
    // --- PRINT BILL LOGIC START ---
    const [printableInvoiceData, setPrintableInvoiceData] = useState<any>(null);
    const [printableCompanyDetails, setPrintableCompanyDetails] = useState<SelectedAdmin | null>(null);
    const [printableCustomerDetails, setPrintableCustomerDetails] = useState<any>(null);
    const [printableQRCode, setPrintableQRCode] = useState<string | null>(null);
    const [printableUpiQRCode, setPrintableUpiQRCode] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => {
            setPrintableInvoiceData(null);
            setPrintableCompanyDetails(null);
            setPrintableCustomerDetails(null);
            setPrintableQRCode(null);
            setPrintableUpiQRCode(null);
        }
    });
    // --- PRINT BILL LOGIC END ---
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useState<string>(search);
    const debouncedSearchInput = useDebounce(searchInput, 500);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const handleNewCreditNoteClick = () => {
        navigate("/admin/credit-notes/new");
    }

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (debouncedSearchInput === search) return;
        setSearchParams({
            search: debouncedSearchInput,
            limit: String(limit),
            page: '1'
        });
    }, [debouncedSearchInput, search, limit, setSearchParams]);

    const handleSearch = (value: string) => {
        setSearchInput(value);
    }

    const handlePageLengthChange = (value: number) => {
        setSearchParams({
            search,
            limit: String(value),
            page: String(page)
        });
    }

    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? invoices.map((invoice) => invoice.id) : []);
        setIsAllSelected(checked);
    };
    const handleRowSelect = (id: string, checked: boolean) => {
        if (isAllSelected) {
            setIsAllSelected(false);
        }
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };

    const fetchInvoices = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_INVOICES_FOR_LIST_URL, {
                params: { search, limit, page, status: "UNPAID", payment_method: "CREDIT" },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            let data = response.data.data;
            const list = Array.isArray(data?.invoices) ? data.invoices : [];
            const filtered = list.filter((inv: any) =>
                String(inv.status).toUpperCase() === "UNPAID" &&
                String(inv.payment_method || "").toUpperCase() === "CREDIT"
            );
            setInvoices(filtered);

            if (data.pagination) {
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching credit notes:", error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchInvoices();
    }, [search, limit, page, token]);

    const handlePageChange = (page: number) => {
        setSearchParams({
            search: search || '',
            limit: limit ? String(limit) : '10',
            page: String(page)
        });
    }

    const tableActions = [
        {
            label: 'View',
            icon: <LucideEye size={14} />,
            onClick: (item: Invoice) => { handleViewClick(item) }
        },
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: Invoice) => { handleEditClick(item) }
        },
        {
            label: 'Print',
            icon: <LucideEye size={14} />,
            onClick: (item: Invoice) => { handlePayAndPrint(item) }
        },
        {
            label: 'Cancel',
            icon: <XCircle size={14} />,
            onClick: (item: Invoice) => { handleCancelClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: Invoice) => { handleDeleteClick(item) }
        }
    ];

    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionLabel = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionLabel)) {
            return true;
        }
        return hasPermission(permissions, 'credit-notes', actionLabel);
    });

    const handleViewClick = (item: Invoice) => {
        navigate(`/admin/view-invoice/${item.id}`);
    }
    const handleEditClick = (item: Invoice) => {
        navigate(`/admin/credit-notes/edit/${item.id}`);
    }
    const handleDeleteClick = (item: Invoice) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    }

    const handlePrintBill = async (item: Invoice) => {
        try {
            toast.info("Preparing Bill...", { autoClose: 1000 });

            const response = await axios.get(`${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const invoiceData = response.data?.data;

            if (!invoiceData) {
                toast.error("Failed to load invoice details");
                return;
            }

            if (invoiceData.invoiceDate && typeof invoiceData.invoiceDate === 'string') {
                invoiceData.invoiceDate = new Date(invoiceData.invoiceDate);
            }
            if (invoiceData.dueDate && typeof invoiceData.dueDate === 'string') {
                invoiceData.dueDate = new Date(invoiceData.dueDate);
            }

            invoiceData.subTotal = invoiceData.taxableAmount || 0;
            invoiceData.totalTax = invoiceData.vat || 0;
            invoiceData.grandTotal = invoiceData.TotalAmount || 0;
            invoiceData.totalDiscount = invoiceData.totalDiscount || 0;
            invoiceData.isCreditInvoice = true;
            invoiceData.payment_method = invoiceData.payment_method || "CREDIT";
            invoiceData.paymentMethod = invoiceData.paymentMethod || "CREDIT";

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

            const customerData = invoiceData.billTo || null;
            const phonepeQR = invoiceData.phonepeQRCode || null;
            const upiQR = invoiceData.upiQRCode || null;

            setPrintableInvoiceData(invoiceData);
            setPrintableCompanyDetails(companyData);
            setPrintableCustomerDetails(customerData);
            setPrintableQRCode(phonepeQR);
            setPrintableUpiQRCode(upiQR);

            setTimeout(() => {
                handlePrint();
            }, 500);
        } catch (error) {
            console.error("Print Error:", error);
            toast.error("Failed to print bill");
        }
    };

    const handlePrintClick = (item: Invoice) => {
        handlePrintBill(item);
    }

    const handlePayAndPrint = async (item: Invoice) => {
        try {
            toast.info("Preparing Payment...", { autoClose: 1000 });
            const response = await axios.get(`${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const invoiceData = response.data?.data;
            if (!invoiceData) { toast.error("Failed to load invoice"); return; }

            const formData = new FormData();
            ['invoiceNumber', 'referenceNo', 'status', 'notes', 'termsAndCondition', 'payment_method', 'taxType', 'gstType', 'roundOff', 'taxableAmount', 'totalDiscount', 'vat', 'TotalAmount'].forEach(key => {
                if (invoiceData[key] !== undefined && invoiceData[key] !== null) {
                    formData.append(key, String(invoiceData[key]));
                }
            });

            if (invoiceData.invoiceDate) formData.append('invoiceDate', new Date(invoiceData.invoiceDate).toISOString());
            if (invoiceData.dueDate) formData.append('dueDate', new Date(invoiceData.dueDate).toISOString());

            if (invoiceData.billTo?.id) formData.append('billTo', invoiceData.billTo.id);
            else if (invoiceData.billTo?._id) formData.append('billTo', invoiceData.billTo._id);

            if (invoiceData.billFrom?.id) formData.append('billFrom', invoiceData.billFrom.id);
            else if (invoiceData.billFrom?._id) formData.append('billFrom', invoiceData.billFrom._id);

            if (invoiceData.bank?.id) formData.append('bank', invoiceData.bank.id);
            else if (invoiceData.bank?._id) formData.append('bank', invoiceData.bank._id);
            else if (invoiceData.bank && typeof invoiceData.bank === 'string') formData.append('bank', invoiceData.bank);

            if (Array.isArray(invoiceData.items)) {
                invoiceData.items.forEach((it: any, index: number) => {
                    const getId = (val: any) => (typeof val === 'object' && val ? (val.id || val._id) : val);
                    const itemFields = [
                        'rowId', 'name', 'qty', 'rate', 'discount',
                        'discount_type', 'discount_value', 'tax',
                        'amount', 'unit', 'hsn_code'
                    ];
                    itemFields.forEach(k => {
                        if (it[k] !== undefined && it[k] !== null) {
                            formData.append(`items[${index}][${k}]`, String(it[k]));
                        }
                    });
                    if (it.product_id) formData.append(`items[${index}][product_id]`, getId(it.product_id));
                    if (it.variantId) formData.append(`items[${index}][variantId]`, getId(it.variantId));
                    if (it.tax_group_id) formData.append(`items[${index}][tax_group_id]`, getId(it.tax_group_id));
                    if (it.staffId) formData.append(`items[${index}][staffId]`, getId(it.staffId));
                });
            }

            setInvoiceDraft(formData);
            setPaymentModalGrandTotal(invoiceData.TotalAmount || 0);
            setPaymentModalInvoiceId(item.id);
            setShowPaymentModal(true);
        } catch (e) {
            console.error(e);
            toast.error("Error opening payment modal");
        }
    };

    const handleCancelClick = (item: Invoice) => {
        setInvoiceToCancel(item);
        setShowCancelModal(true);
    }

    const confirmCancel = async () => {
        try {
            if (!invoiceToCancel?.id) return;
            await axios.put(`${Constants.CANCEL_INVOICE_URL}/${invoiceToCancel.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Invoice cancelled successfully');
            setShowCancelModal(false);
            setInvoiceToCancel(null);
            await fetchInvoices();
        } catch (error) {
            console.error('Failed to cancel invoice:', error);
            toast.error('Failed to cancel invoice');
        }
    }

    const confirmDelete = async () => {
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_CREDIT_NOTE_URL}/${itemToDelete?.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Invoice deleted successfully');
            setShowDeleteModal(false);
            await fetchInvoices();
        } catch (error) {
            console.error('Failed to delete credit note:', error);
        } finally {
            setIsDeleting(false);
        }
    }

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_CREDIT_NOTE_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} credit note(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} credit note(s).`);
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
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-950 ">Credit Invoices</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'credit-notes', 'delete') && (
                        <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            disabled={selectedIds.length === 0}
                            className={`px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                                }`}
                        >
                            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                    )}
                    {hasPermission(permissions, 'credit-notes', 'create') && (
                        <button
                            onClick={handleNewCreditNoteClick}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <CirclePlusIcon size={14} /> New Credit Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Search Input & PageLength */}
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>
            <Table
                headers={[
                    "#",
                    <CustomCheckbox
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        disabled={invoices.length === 0}
                        name="select-all-credit-notes"
                    />,
                    "Invoice ID",
                    "Customer",
                    "Amount",
                    "Created On",
                    "Status",
                    ...(allowedActions.length > 0 ? ["Actions"] : [])
                ]}
            >
                {!isLoading && invoices && invoices.map((invoice, index) => (
                    <TableRow
                        key={invoice.id}
                        index={(page - 1) * limit + index + 1} // Correct index for pagination
                        row={invoice}
                        columns={[
                            <CustomCheckbox
                                checked={selectedIds.includes(invoice.id)}
                                onChange={(checked) => handleRowSelect(invoice.id, checked)}
                                name={`select-credit-note-${invoice.id}`}
                            />,
                            <span className="text-indigo-600">{invoice.invoiceNumber}</span>,
                            <ProfileCard
                                phone={invoice.billTo?.phone || "N/A"}
                            />,
                            <span className="font-semibold text-gray-950 ">{format(invoice.TotalAmount)}</span>,
                            <span className="font-semibold text-gray-950 ">{formatDate(invoice.createdAt, systemSettings?.dateFormat.format || 'd-m-Y')}</span>,
                            <InvoiceStatusBadge status={invoice.status} />
                        ]}
                        actions={allowedActions.length > 0 ? allowedActions : undefined}
                    />
                ))}
                {!isLoading && invoices && invoices.length === 0 && (
                    <NoRecords colSpan={allowedActions.length > 0 ? 8 : 7} message="No credit invoices found" />
                )}

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-1 text-gray-950  font-semibold" colSpan={allowedActions.length > 0 ? 8 : 7}>
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
            {showPaymentModal && invoiceDraft && (
                <PaymentModal
                    open={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    invoiceDraft={invoiceDraft}
                    grandTotal={paymentModalGrandTotal}
                    isEdit={true}
                    invoiceId={paymentModalInvoiceId || undefined}
                    onSuccess={(data) => {
                        setShowPaymentModal(false);
                        fetchInvoices();
                        if (data?.qrCode || data?.isMixedPending) {
                            handlePrintBill({ id: paymentModalInvoiceId } as Invoice);
                        } else {
                            handlePrintBill({ id: paymentModalInvoiceId } as Invoice);
                        }
                    }}
                />
            )}
            {/* Delete Invoice */}
                        <ConfirmationModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={confirmCancel}
                title="Cancel Invoice"
                message="Are you sure you want to cancel this invoice?"
            />

<DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message="Are you sure you want to delete this credit invoice?"
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} credit invoice(s)?`}
            >
            </DeleteConfirmationModal>

            {printableInvoiceData && (
                <div className="hidden">
                    <ThermalInvoice58mm
                        ref={printRef}
                        invoiceFormData={printableInvoiceData}
                        companyDetails={printableCompanyDetails}
                        customerDetails={printableCustomerDetails}
                        phonepeQRCode={printableQRCode}
                        upiQRCode={printableUpiQRCode}
                    />
                </div>
            )}
</div>
    );
};

export default CreditNoteList;
