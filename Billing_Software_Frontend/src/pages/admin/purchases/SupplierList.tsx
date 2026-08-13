import { useEffect, useState, type FC } from 'react';
import Modal from '@components/admin/Modal';
import { CirclePlusIcon, Edit, ExternalLink, Image, Trash2Icon, Upload, Download } from 'lucide-react';
import Constants from '@constants/api';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Table from '@components/admin/Table';
import TableRow from '@components/admin/TableRow';
import CustomCheckbox from '@components/admin/CustomCheckbox';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PaginationWrapper from '@components/admin/PaginationWrapper';
import DeleteConfirmationModal from '@components/admin/DeleteConfirmationModal';
import type { PermissionAction } from '@models/permissions';
import { hasPermission } from '@utils/hasPermission';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import useDateFormatter from '@hooks/useDateFormatter';
import { DateRangePicker } from '@components/admin/DateRangePicker';
import SubmitButton from '@components/admin/SubmitButton';
import SupplierProfileCard from '@components/SupplierProfileImage';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import { useDebounce } from '@hooks/useDebounce';
import { useDebouncedSearchParam } from '@hooks/useDebouncedSearchParam';
import OptionSelectionModal from '@components/admin/OptionSelectionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AccountDetail {
    accountHolderName: string;
    bankName: string;
    branchName?: string;
    accountType: 'savings' | 'current';
    accountNumber: string;
    ifscCode: string;
}

interface SupplierFormData {
    id?: string;

    company_name: string;
    email: string;
    phone_number: string;

    company_address?: string;
    country?: string;
    city?: string;
    state?: string;
    pin_code?: string;

    pan_no?: string;
    gst_no?: string;

    account_details: AccountDetail[];

    profileImage?: File | null;
    profile_image_preview_url?: string;
    profile_image_removed?: boolean;
}

interface Supplier {
    id: string;

    company_name: string;
    email: string;
    phone_number: string;

    profileImage: string;
    createdAt: string;
    country?: string;
}

interface SupplierPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
const SupplierList: FC = () => {
    const [showModal, setShowModal] = useState<boolean>(false);
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [itemToDelete, setItemToDelete] = useState<any>({});
    const [searchParams, setSearchParams] = useSearchParams();
    const [pagination, setPagination] = useState<SupplierPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isExtractingDetails, setIsExtractingDetails] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
    const [downloadingLedgerFor, setDownloadingLedgerFor] = useState<string | null>(null);
    const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
    const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
    const [ledgerDateRange, setLedgerDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
        startDate: null,
        endDate: null,
    });
    const [showLedgerFormatModal, setShowLedgerFormatModal] = useState<boolean>(false);
    const [ledgerDownloadFormat, setLedgerDownloadFormat] = useState<'excel' | 'pdf'>('excel');
    const { formatDate } = useDateFormatter();
    const { symbol, locale } = useCurrencyFormatter();
    const [stateOptions, setStateOptions] = useState<{ id: string; name: string }[]>([]);
    const [cityOptions, setCityOptions] = useState<{ id: string; name: string }[]>([]);
    const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<{ id: string; name: string } | null>(null);
    const [selectedState, setSelectedState] = useState<{ id: string; name: string } | null>(null);
    const [selectedCity, setSelectedCity] = useState<{ id: string; name: string } | null>(null);
    const [countryInput, setCountryInput] = useState<string>('');
    const [stateInput, setStateInput] = useState<string>('');
    const [cityInput, setCityInput] = useState<string>('');
    const debouncedCountrySearch = useDebounce(countryInput, 300);
    const debouncedStateSearch = useDebounce(stateInput, 300);
    const debouncedCitySearch = useDebounce(cityInput, 300);
    const [isStateLoading, setIsStateLoading] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const systemCountryId = systemSettings?.company?.country ? String((systemSettings?.company as any).country) : '';
    const countryId = selectedCountry?.id || systemCountryId;
    const [formData, setformData] = useState<SupplierFormData>({
        // supplier_name: '',
        // supplier_email: '',
        // supplier_phone: '',
        // balance: 0,
        // balance_type: 'credit',
        // profileImage: null,
        // profile_image_preview_url: '',
        // profile_image_removed: false

        company_name: '',
        email: '',
        phone_number: '',

        company_address: '',
        country: '',
        city: '',
        state: '',
        pin_code: '',

        pan_no: '',
        gst_no: '',

        account_details: [],

        profileImage: null,
        profile_image_preview_url: '',
        profile_image_removed: false,
    });
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const tableActions = [
        {
            label: 'Download Ledger',
            icon: <Download size={14} />,
            onClick: (item: any) => { openLedgerModal(item) }
        },
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: any) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: any) => { handleDeleteClick(item) }
        }
    ]

    const tableHeaders = ['#', 'Supplier', 'Phone', 'Created On', 'Action'];
    const restrictedActions = ["edit", "delete"];
    const allowedActions = tableActions.filter((action) => {
        const actionKey = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionKey)) {
            return true;
        }

        return hasPermission(permissions, "suppliers", actionKey);
    })
    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }


    const handleEditClick = async (item: any) => {
        try {
            setIsLoading(true);

            const res = await axios.get(
                `${Constants.GET_SUPPLIER_BY_ID_URL}/${item.id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const supplier = res.data.data;

            setformData({
                id: supplier.id,

                company_name: supplier.company_name,
                email: supplier.email,
                phone_number: supplier.phone_number,

                company_address: supplier.company_address || "",
                country: supplier.country || "",
                city: supplier.city || "",
                state: supplier.state || "",
                pin_code: supplier.pin_code || "",

                pan_no: supplier.pan_no || "",
                gst_no: supplier.gst_no || "",

                account_details: supplier.account_details || [],

                profileImage: null,
                profile_image_preview_url: supplier.profileImage,
                profile_image_removed: false,
            });
            setSelectedState(null);
            setSelectedCity(null);
            setSelectedCountry(null);
            setStateInput(supplier.state || '');
            setCityInput(supplier.city || '');
            setCountryInput('');

            if (supplier.country) {
                try {
                    const countryRes = await axios.get(`${Constants.FETCH_COUNTRY_URL}/${supplier.country}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const countryOption = { id: String(countryRes.data._id), name: countryRes.data.name };
                    setSelectedCountry(countryOption);
                    setformData(prev => ({ ...prev, country: countryOption.id }));
                    setCountryInput(countryOption.name);
                } catch {
                    try {
                        const searchRes = await axios.get(Constants.FETCH_COUNTRIES_URL, {
                            params: { search: supplier.country },
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const match = searchRes.data?.find((c: any) => c.name?.toLowerCase() === supplier.country?.toLowerCase());
                        if (match) {
                            const countryOption = { id: String(match._id), name: match.name };
                            setSelectedCountry(countryOption);
                            setformData(prev => ({ ...prev, country: countryOption.id }));
                            setCountryInput(countryOption.name);
                        } else {
                            setSelectedCountry({ id: supplier.country, name: supplier.country });
                            setCountryInput(supplier.country);
                        }
                    } catch {
                        setSelectedCountry({ id: supplier.country, name: supplier.country });
                        setCountryInput(supplier.country);
                    }
                }
            }

            setIsEditMode(true);
            setShowModal(true);
        } catch (err) {
            toast.error("Failed to load supplier details");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = (supplier: any) => {
        setItemToDelete(supplier);
        setShowDeleteModal(true);
    }

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_SUPPLIER_URL}/${itemToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Supplier deleted successfully');
            fetchSuppliers();
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete supplier:', error);
            toast.error('Failed to delete supplier.');
        } finally {
            setIsDeleting(false);
        }
    }

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_SUPPLIER_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} supplier(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} supplier(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchSuppliers(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleSearch = (keyword: string) => {
        setSearchInput(keyword);
    }

    const handleSearchGST = (gst_no?: string) => {
        if (!gst_no) {
            window.open("https://services.gst.gov.in/services/searchtp", "_blank");
            return;
        }

        navigator.clipboard.writeText(gst_no);
        toast.success("GST number copied to clipboard");
        window.open("https://services.gst.gov.in/services/searchtp", "_blank");
    };

    const handlePageLengthChange = (limit: number) => {
        setSearchParams({ search, limit: String(limit), page: '1' });
    }

    const handlePageChange = (page: number) => {
        setSearchParams({
            search: search || '',
            limit: limit ? String(limit) : '10',
            page: String(page)
        });
    }

    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? suppliers.map((supplier) => supplier.id) : []);
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

    const handleExportClick = async () => {
        try {
            const response = await axios.get(Constants.EXPORT_SUPPLIERS_EXCEL_URL, {
                params: selectedIds.length > 0 ? { ids: selectedIds.join(',') } : { search },
                responseType: 'blob',
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `Suppliers_Export_${today}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Suppliers exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export suppliers');
        }
    };

    const openLedgerModal = (item: Supplier) => {
        setLedgerSupplier(item);
        setLedgerDateRange({ startDate: null, endDate: null });
        setShowLedgerFormatModal(true);
    };

    const formatLedgerQueryDate = (date: Date | null, boundary: 'start' | 'end') => {
        if (!date) return undefined;
        const copy = new Date(date);
        if (boundary === 'start') {
            copy.setHours(0, 0, 0, 0);
        } else {
            copy.setHours(23, 59, 59, 999);
        }
        return copy.toISOString();
    };

    const buildLedgerBaseName = () => {
        if (!ledgerSupplier) return 'Supplier_Ledger';
        const today = new Date().toISOString().split('T')[0];
        const safeName = (ledgerSupplier.company_name || 'Supplier').replace(/\s+/g, '_');
        const hasRange = ledgerDateRange.startDate || ledgerDateRange.endDate;
        const startLabel = ledgerDateRange.startDate ? ledgerDateRange.startDate.toISOString().split('T')[0] : 'start';
        const endLabel = ledgerDateRange.endDate ? ledgerDateRange.endDate.toISOString().split('T')[0] : 'end';
        return hasRange
            ? `Supplier_Ledger_${safeName}_${startLabel}_to_${endLabel}`
            : `Supplier_Ledger_${safeName}_${today}`;
    };

    const getLedgerQueryParams = () => {
        const params: Record<string, string> = {};
        if (ledgerDateRange.startDate) {
            params.startDate = formatLedgerQueryDate(ledgerDateRange.startDate, 'start') as string;
        }
        if (ledgerDateRange.endDate) {
            params.endDate = formatLedgerQueryDate(ledgerDateRange.endDate, 'end') as string;
        }
        return params;
    };

    const handleDownloadLedgerExcel = async () => {
        if (!ledgerSupplier) return;
        try {
            setDownloadingLedgerFor(ledgerSupplier.id);
            const params = getLedgerQueryParams();
            const response = await axios.get(
                `${Constants.GET_SUPPLIER_LEDGER_URL}/${ledgerSupplier.id}/ledger`,
                {
                    params,
                    responseType: 'blob',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${buildLedgerBaseName()}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`Ledger downloaded for ${ledgerSupplier.company_name}`);
            setShowLedgerModal(false);
            setLedgerSupplier(null);
        } catch (error) {
            console.error('Supplier ledger download error:', error);
            toast.error('Failed to download supplier ledger');
        } finally {
            setDownloadingLedgerFor(null);
        }
    };

    const handleDownloadLedgerPdf = async () => {
        if (!ledgerSupplier) return;
        try {
            setDownloadingLedgerFor(ledgerSupplier.id);
            const params = { ...getLedgerQueryParams(), format: 'json' };
            const response = await axios.get(
                `${Constants.GET_SUPPLIER_LEDGER_URL}/${ledgerSupplier.id}/ledger`,
                {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const ledger = response.data?.data;
            const supplier = ledger?.supplier || {};
            const summary = ledger?.summary || {};
            const purchases = Array.isArray(ledger?.purchases) ? ledger.purchases : [];
            const payments = Array.isArray(ledger?.payments) ? ledger.payments : [];
            const debitNotes = Array.isArray(ledger?.debitNotes) ? ledger.debitNotes : [];

            const doc = new jsPDF('l', 'mm', 'a4');
            const pdfCurrencyPrefix = /^[\x20-\x7E]+$/.test(symbol) ? symbol : 'INR ';
            const currency = (value: number) =>
                `${pdfCurrencyPrefix}${new Intl.NumberFormat(locale || 'en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(Number(value || 0))}`;
            let currentY = 12;

            const addSectionTitle = (title: string) => {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 14, currentY);
                currentY += 5;
            };

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Supplier Ledger', 14, currentY);
            currentY += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Supplier: ${supplier.companyName || ledgerSupplier.company_name || '-'}`, 14, currentY);
            currentY += 5;
            doc.text(`${ledger?.meta?.periodLabel || 'Period: All Time'}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, currentY);
            currentY += 8;

            addSectionTitle('Summary');
            autoTable(doc, {
                startY: currentY,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Purchases', summary.totalPurchases ?? 0],
                    ['Total Purchase Amount', currency(summary.totalPurchaseAmount)],
                    ['Total Supplier Payments', currency(summary.totalSupplierPayments)],
                    ['Outstanding Purchase Balance', currency(summary.totalPurchaseBalance)],
                    ['Total Debit Return', currency(summary.totalDebitReturn)],
                    ['Total Debit Replacement', currency(summary.totalDebitReplacement)],
                    ['Total Net Adjustment', currency(summary.totalDebitNetAdjustment)],
                    ['Net Payable', currency(summary.netPayable)],
                ],
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold' },
                margin: { left: 14, right: 14 },
            });
            currentY = (doc as any).lastAutoTable.finalY + 8;

            addSectionTitle('Supplier Details');
            autoTable(doc, {
                startY: currentY,
                head: [['Field', 'Value', 'Field', 'Value']],
                body: [
                    ['Phone', supplier.phone || '-', 'Email', supplier.email || 'N/A'],
                    ['GST No', supplier.gstNo || 'N/A', 'PAN No', supplier.panNo || 'N/A'],
                    ['Address', supplier.address || 'N/A', 'City', supplier.city || 'N/A'],
                    ['State', supplier.state || 'N/A', 'Country', supplier.country || 'N/A'],
                    ['Pin Code', supplier.pinCode || 'N/A', 'Bank Accounts', Array.isArray(supplier.bankAccounts) ? supplier.bankAccounts.length : 0],
                ],
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold' },
                margin: { left: 14, right: 14 },
            });
            currentY = (doc as any).lastAutoTable.finalY + 8;

            addSectionTitle('Purchases');
            autoTable(doc, {
                startY: currentY,
                head: [[
                    'Purchase ID', 'Supplier Bill No', 'Purchase Date', 'Due Date', 'Status',
                    'Items', 'Total Amount', 'Paid Amount', 'Balance Amount', 'Payment Mode'
                ]],
                body: purchases.length
                    ? purchases.map((row: any) => [
                        row.purchaseId,
                        row.supplierBillNumber,
                        row.purchaseDate,
                        row.dueDate,
                        row.status,
                        row.itemsCount,
                        currency(row.totalAmount),
                        currency(row.paidAmount),
                        currency(row.balanceAmount),
                        row.paymentMode,
                    ])
                    : [['No purchases found for this supplier', '', '', '', '', '', '', '', '', '']],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold' },
                margin: { left: 14, right: 14 },
            });
            currentY = (doc as any).lastAutoTable.finalY + 8;

            addSectionTitle('Supplier Payments');
            autoTable(doc, {
                startY: currentY,
                head: [[
                    'Payment ID', 'Purchase ID', 'Supplier Bill No', 'Payment Date', 'Payment Mode',
                    'Source Type', 'Reference No', 'Cheque No', 'Paid Amount', 'Due Amount', 'Bank Name'
                ]],
                body: payments.length
                    ? payments.map((row: any) => [
                        row.paymentId,
                        row.purchaseId,
                        row.supplierBillNumber,
                        row.paymentDate,
                        row.paymentMode,
                        row.sourceType,
                        row.referenceNumber,
                        row.chequeNumber,
                        currency(row.paidAmount),
                        currency(row.dueAmount),
                        row.bankName,
                    ])
                    : [['No supplier payments found for this supplier', '', '', '', '', '', '', '', '', '', '']],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold' },
                margin: { left: 14, right: 14 },
            });
            currentY = (doc as any).lastAutoTable.finalY + 8;

            if (currentY > 170) {
                doc.addPage('a4', 'l');
                currentY = 14;
            }

            addSectionTitle('Debit Notes');
            autoTable(doc, {
                startY: currentY,
                head: [[
                    'Debit Note ID', 'Purchase ID', 'Supplier Bill No', 'Debit Note Date', 'Status',
                    'Adjustment Type', 'Returned Amount', 'Replacement Amount', 'Net Adjustment', 'Paid Amount', 'Balance Amount'
                ]],
                body: debitNotes.length
                    ? debitNotes.map((row: any) => [
                        row.debitNoteId,
                        row.purchaseId,
                        row.supplierBillNumber,
                        row.debitNoteDate,
                        row.status,
                        row.adjustmentType,
                        currency(row.totalAmount),
                        currency(row.replacementAmount),
                        currency(row.netAdjustment),
                        currency(row.paidAmount),
                        currency(row.balanceAmount),
                    ])
                    : [['No debit notes found for this supplier', '', '', '', '', '', '', '', '', '', '']],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: 'bold' },
                margin: { left: 14, right: 14 },
            });

            doc.save(`${buildLedgerBaseName()}.pdf`);
            toast.success(`Ledger downloaded for ${ledgerSupplier.company_name}`);
            setShowLedgerModal(false);
            setLedgerSupplier(null);
        } catch (error) {
            console.error('Supplier ledger PDF download error:', error);
            toast.error('Failed to download supplier ledger PDF');
        } finally {
            setDownloadingLedgerFor(null);
        }
    };

    const handleDownloadLedger = async () => {
        if (ledgerDownloadFormat === 'pdf') {
            await handleDownloadLedgerPdf();
            return;
        }
        await handleDownloadLedgerExcel();
    };

    useEffect(() => {
        fetchSuppliers(search, limit, page);
    }, [search, limit, page]);

    useEffect(() => {
        if (!showModal) return;
        if (!systemCountryId) return;
        const fetchCountry = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_COUNTRY_URL}/${systemCountryId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSelectedCountry({ id: String(response.data._id), name: response.data.name });
                setformData(prev => ({ ...prev, country: String(response.data._id) }));
            } catch {
                setSelectedCountry(null);
            }
        };
        fetchCountry();
    }, [showModal, systemCountryId]);

    useEffect(() => {
        if (!showModal) return;
        const fetchCountries = async () => {
            try {
                const response = await axios.get(Constants.FETCH_COUNTRIES_URL, {
                    params: { search: debouncedCountrySearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formatted = response.data.map((country: any) => ({
                    id: String(country._id),
                    name: country.name
                }));
                setCountryOptions(formatted);
            } catch (error) {
                setCountryOptions([]);
            }
        };
        fetchCountries();
    }, [debouncedCountrySearch, token, showModal]);

    useEffect(() => {
        if (!countryId || !showModal) {
            setStateOptions([]);
            return;
        }
        const fetchStates = async () => {
            try {
                setIsStateLoading(true);
                const response = await axios.get(`${Constants.FETCH_STATES_URL}/${countryId}`, {
                    params: { search: debouncedStateSearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formattedStates = response.data.map((state: any) => ({
                    id: String(state._id),
                    name: state.name
                }));
                setStateOptions(formattedStates);
            } catch (error) {
                setStateOptions([]);
            } finally {
                setIsStateLoading(false);
            }
        };
        fetchStates();
    }, [countryId, debouncedStateSearch, token, showModal]);

    useEffect(() => {
        if (!selectedState?.id || !showModal) {
            setCityOptions([]);
            return;
        }
        const fetchCities = async () => {
            try {
                setIsCityLoading(true);
                const response = await axios.get(`${Constants.FETCH_CITIES_URL}/${selectedState.id}`, {
                    params: { search: debouncedCitySearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formattedCities = response.data.map((city: any) => ({
                    id: String(city._id),
                    name: city.name
                }));
                setCityOptions(formattedCities);
            } catch (error) {
                setCityOptions([]);
            } finally {
                setIsCityLoading(false);
            }
        };
        fetchCities();
    }, [selectedState?.id, debouncedCitySearch, token, showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (formData.state && stateOptions.length > 0) {
            const match = stateOptions.find(option => option.name === formData.state);
            if (match) {
                setSelectedState(match);
            }
        }
    }, [formData.state, stateOptions, showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (formData.city && cityOptions.length > 0) {
            const match = cityOptions.find(option => option.name === formData.city);
            if (match) {
                setSelectedCity(match);
            }
        }
    }, [formData.city, cityOptions, showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (selectedCountry) {
            setCountryInput(selectedCountry.name);
        }
    }, [selectedCountry, showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (selectedState) {
            setStateInput(selectedState.name);
        }
    }, [selectedState, showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (selectedCity) {
            setCityInput(selectedCity.name);
        }
    }, [selectedCity, showModal]);

    const fetchSuppliers = async (search?: string, limit?: number, page?: number) => {

        try {
            setIsLoading(true);
            const response = await axios.get(Constants.GET_SUPPLIERS_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSuppliers(response.data.data.suppliers);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
            toast.error("Failed to fetch suppliers.");
        } finally {
            setIsLoading(false);
        }
    }

    const addAccount = () => {
        setformData(prev => ({
            ...prev,
            account_details: [
                ...prev.account_details,
                {
                    accountHolderName: '',
                    bankName: '',
                    branchName: '',
                    accountType: 'savings',
                    accountNumber: '',
                    ifscCode: '',
                },
            ],
        }));
    };

    const removeAccount = (index: number) => {
        setformData(prev => ({
            ...prev,
            account_details: prev.account_details.filter((_, i) => i !== index),
        }));
    };

    const handleAccountChange = (
        index: number,
        field: keyof AccountDetail,
        value: string
    ) => {
        const updated = [...formData.account_details];
        updated[index][field] = value as never;
        setformData({ ...formData, account_details: updated });
    };


    const validateSupplierForm = () => {
        const errors: { [key: string]: string } = {};

        if (!formData.company_name) {
            errors.company_name = 'Company name is required';
        }

        // Email is now optional - removed validation

        if (!formData.phone_number) {
            errors.phone_number = 'Phone number is required';
        } else if (formData.phone_number.trim().length !== 10) {
            errors.phone_number = 'Phone number must be 10 digits';
        }

        if (formData.pan_no && formData.pan_no.trim().length !== 10) {
            errors.pan_no = 'PAN number must be exactly 10 characters';
        }

        if (formData.gst_no && formData.gst_no.trim().length !== 15) {
            errors.gst_no = 'GST number must be exactly 15 characters';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateSupplierForm()) return;
        try {
            setIsSubmitting(true);
            const data = new FormData();

            data.append('company_name', formData.company_name);
            data.append('email', formData.email);
            data.append('phone_number', formData.phone_number);

            data.append('company_address', formData.company_address || '');
            data.append('country', formData.country || '');
            data.append('city', formData.city || '');
            data.append('state', formData.state || '');
            data.append('pin_code', formData.pin_code || '');

            data.append('pan_no', formData.pan_no || '');
            data.append('gst_no', formData.gst_no || '');

            data.append('account_details', JSON.stringify(formData.account_details));
            if (formData.profileImage instanceof File) {
                data.append('profileImage', formData.profileImage);
            }
            if (formData.profile_image_removed) {
                data.append('profile_image_removed', 'true');
            }
            if (isEditMode) {

                await axios.put(`${Constants.UPDATE_SUPPLIER_URL}/${formData.id}`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Supplier updated successfully');
            } else {
                await axios.post(Constants.CREATE_SUPPLIER_URL, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Supplier created successfully');
            }
            fetchSuppliers();
            setShowModal(false);
        } catch (error: any | AxiosError) {
            setFormErrors(error?.response?.data?.errors || {});
            toast.error('Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleImageDelete = () => {
        setformData({
            ...formData,
            profileImage: null,
            profile_image_preview_url: '',
            profile_image_removed: true
        })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setformData({
                ...formData,
                profileImage: file,
                profile_image_preview_url: URL.createObjectURL(file)
            })
        }
    }

    const handleSupplierDetailsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        try {
            setIsExtractingDetails(true);
            const payload = new FormData();
            payload.append('file', file);

            const response = await axios.post(Constants.AI_EXTRACT_SUPPLIER_DETAILS_URL, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            const extracted = response.data?.data?.extracted || {};
            const bankAccounts = Array.isArray(extracted.bankAccounts)
                ? extracted.bankAccounts
                    .filter((account: any) => account?.accountNumber || account?.bankName || account?.ifscCode)
                    .map((account: any) => ({
                        accountHolderName: account.accountHolderName || '',
                        bankName: account.bankName || '',
                        branchName: account.branchName || '',
                        accountType: account.accountType === 'current' ? 'current' : 'savings',
                        accountNumber: account.accountNumber || '',
                        ifscCode: account.ifscCode || '',
                    }))
                : [];

            setformData(prev => ({
                ...prev,
                company_name: extracted.supplierName || prev.company_name,
                email: extracted.supplierEmail || prev.email,
                phone_number: extracted.supplierPhone || prev.phone_number,
                company_address: extracted.supplierAddress || prev.company_address,
                city: extracted.city || prev.city,
                state: extracted.state || prev.state,
                pin_code: extracted.pinCode || prev.pin_code,
                pan_no: extracted.supplierPAN || prev.pan_no,
                gst_no: extracted.supplierGSTIN || prev.gst_no,
                account_details: bankAccounts.length ? bankAccounts : prev.account_details,
            }));

            if (extracted.country) setCountryInput(extracted.country);
            if (extracted.state) setStateInput(extracted.state);
            if (extracted.city) setCityInput(extracted.city);

            toast.success('Supplier details extracted. Please review before saving.');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Could not extract supplier details');
        } finally {
            setIsExtractingDetails(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'phone_number' || name === 'pin_code') {
            // allow only numbers
            const numericValue = value.replace(/[^0-9]/g, '');
            setformData({
                ...formData,
                [name]: name === 'phone_number' ? numericValue.slice(0, 10) : numericValue
            });
            return;
        }

        if (name === 'pan_no') {
            const upperValue = value.toUpperCase().slice(0, 10);
            setformData({
                ...formData,
                [name]: upperValue
            });
            return;
        }

        if (name === 'gst_no') {
            const upperValue = value.toUpperCase().slice(0, 15);
            setformData({
                ...formData,
                [name]: upperValue
            });
            return;
        }

        setformData({
            ...formData,
            [name]: value
        })
    }

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const handleStateSelect = (state: { id: string; name: string } | null) => {
        setSelectedState(state);
        setSelectedCity(null);
        setCityOptions([]);
        setStateInput(state?.name || '');
        setCityInput('');
        setformData(prev => ({
            ...prev,
            state: state?.name || '',
            city: ''
        }));
    };

    const handleCitySelect = (city: { id: string; name: string } | null) => {
        setSelectedCity(city);
        setCityInput(city?.name || '');
        setformData(prev => ({ ...prev, city: city?.name || '' }));
    };

    const handleCountrySelect = (country: { id: string; name: string } | null) => {
        setSelectedCountry(country);
        setSelectedState(null);
        setSelectedCity(null);
        setStateOptions([]);
        setCityOptions([]);
        setCountryInput(country?.name || '');
        setStateInput('');
        setCityInput('');
        setformData(prev => ({ ...prev, country: country?.id || '', state: '', city: '' }));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Supplier</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'suppliers', 'delete') && (
                        <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            disabled={selectedIds.length === 0}
                            className={`px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                                }`}
                        >
                            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                    )}
                    <button
                        onClick={handleExportClick}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        <Download size={14} /> Export Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                    </button>
                    <button
                        onClick={() => navigate('/admin/suppliers/bulk-import')}
                        className="border border-gray-100 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        <Upload size={14} /> Upload Excel
                    </button>
                    {hasPermission(permissions, 'suppliers', 'create') &&
                        <button
                            onClick={() => {
                                setShowModal(true);
                                setFormErrors({});
                                setformData({
                                    // supplier_name: '',
                                    // supplier_email: '',
                                    // supplier_phone: '',
                                    // balance: 0,
                                    // balance_type: 'credit',
                                    // profileImage: null,
                                    // profile_image_preview_url: ''

                                    company_name: '',
                                    email: '',
                                    phone_number: '',

                                    company_address: '',
                                    country: '',
                                    city: '',
                                    state: '',
                                    pin_code: '',

                                    pan_no: '',
                                    gst_no: '',

                                    account_details: [],

                                    profileImage: null,
                                    profile_image_preview_url: '',
                                    // profile_image_removed: false,
                                });
                                setIsEditMode(false);
                                setShowDeleteModal(false);
                            }}
                            className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                            <CirclePlusIcon size={14} /> New Supplier
                        </button>
                    }
                </div>
            </div>
            {/* Search Input & PageLength */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
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
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>
            <div className="w-full overflow-x-auto">
                <Table
                    headers={[
                        "#",
                        <CustomCheckbox
                            checked={allSelected}
                            onChange={handleToggleSelectAll}
                            disabled={suppliers.length === 0}
                            name="select-all-suppliers"
                        />,
                        "Supplier",
                        "Phone",
                        "Created On",
                        "Action",
                    ]}
                >
                    {!isLoading && suppliers && suppliers.map((supplier, index) => (
                        <TableRow
                            key={supplier.id}
                            index={index + 1}
                            row={supplier}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(supplier.id)}
                                    onChange={(checked) => handleRowSelect(supplier.id, checked)}
                                    name={`select-supplier-${supplier.id}`}
                                />,
                                <SupplierProfileCard

                                    name={supplier.company_name}
                                    imageUrl={supplier.profileImage}
                                />,
                                supplier.phone_number,
                                formatDate(supplier.createdAt, systemSettings?.dateFormat.format || 'd-m-Y'),
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        />
                    ))}
                    {!isLoading && suppliers.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center py-4 font-semibold">No Suppliers Found</td>
                        </tr>
                    )}

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950  font-semibold" colSpan={6}>
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
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditMode ? 'Update Supplier' : 'Create Supplier'}>
                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="flex items-start gap-4 mb-4">
                        {/* Image Preview or Default */}
                        <div className="relative w-20 h-20 border border-gray-300 rounded-md flex items-center justify-center overflow-hidden bg-white">
                            {formData.profile_image_preview_url ? (
                                <img
                                    src={formData.profile_image_preview_url}
                                    alt="Preview"
                                    className="w-full h-full object-cover rounded"
                                />
                            ) : (
                                <span className="text-xl text-gray-400"><Image /></span>
                            )}

                            {/* Delete Button on Preview */}
                            {formData.profile_image_preview_url && (
                                <button
                                    type="button"
                                    className="absolute top-[0px] right-[-1px] bg-white border border-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-500 hover:border-white transition duration-200"
                                    onClick={handleImageDelete}
                                    title="Remove Image"
                                >
                                    <Trash2Icon size={14} className="text-red-500 hover:text-white cursor-pointer" />
                                </button>
                            )}
                        </div>

                        {/* Upload Button and Note */}
                        <div>
                            <label htmlFor="imageUpload" className="mr-2">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="imageUpload"
                                />
                                <span className="inline-flex items-center bg-primary hover:bg-gray-950 text-white text-sm px-4 py-2 rounded-md transition duration-200 cursor-pointer">
                                    <Image size={16} className="mr-2" />
                                    Upload Image
                                </span>

                            </label>
                            <label htmlFor="supplierDetailsUpload">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, application/pdf"
                                    onChange={handleSupplierDetailsFileChange}
                                    className="hidden"
                                    id="supplierDetailsUpload"
                                    disabled={isExtractingDetails}
                                />
                                <span className={`inline-flex items-center text-sm px-4 py-2 rounded-md transition duration-200 cursor-pointer ${
                                    isExtractingDetails
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}>
                                    <Upload size={16} className="mr-2" />
                                    {isExtractingDetails ? 'Reading Details...' : 'Scan Supplier Details'}
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1">JPG or PNG format, not exceeding 5MB.</p>
                        </div>
                    </div>


                    {/* Name */}
                    <div>
                        <label className="block font-medium text-sm text-gray-700 ">
                            Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                            type="text"
                            placeholder="Enter Company Name"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full   text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                        />
                        {formErrors.company_name && <p className="text-red-500 text-xs mt-1">{formErrors.company_name}</p>}
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-700 ">
                                Email
                            </label>
                            <input
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                type="email"
                                placeholder="Enter Email Address"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                        </div>
                        <div>
                            <label className="block font-medium text-sm text-gray-700 ">
                                Phone Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleChange}
                                type="text"
                                inputMode='numeric'
                                maxLength={10}
                                placeholder="Enter Phone Number"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.phone_number && <p className="text-red-500 text-xs mt-1">{formErrors.phone_number}</p>}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block font-medium text-sm text-gray-700">
                            Company Address
                        </label>
                        <input
                            name="company_address"
                            value={formData.company_address}
                            onChange={handleChange}
                            type="text"
                            placeholder="Enter Company Address"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                />
            </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <SearchableDropdown
                                label="Country"
                                options={countryOptions}
                                value={selectedCountry}
                                inputValue={countryInput}
                                onInputChange={(_, value) => setCountryInput(value)}
                                onChange={(_, value) => handleCountrySelect(value)}
                            />
                        </div>

                        <div>
                            <SearchableDropdown
                                label="State"
                                options={stateOptions}
                                value={selectedState}
                                inputValue={stateInput}
                                onInputChange={(_, value) => setStateInput(value)}
                                onChange={(_, value) => handleStateSelect(value)}
                                disabled={!countryId}
                                loading={isStateLoading}
                            />
                        </div>

                        <div>
                            <SearchableDropdown
                                label="City"
                                options={cityOptions}
                                value={selectedCity}
                                inputValue={cityInput}
                                onInputChange={(_, value) => setCityInput(value)}
                                onChange={(_, value) => handleCitySelect(value)}
                                disabled={!selectedState?.id}
                                loading={isCityLoading}
                            />
                        </div>

                        <div>
                            <label className="block font-medium text-sm text-gray-700">Pin Code</label>
                            <input
                                name="pin_code"
                                value={formData.pin_code}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter Pin Code"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-700">
                                PAN Number
                            </label>
                            <input
                                name="pan_no"
                                value={formData.pan_no}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter PAN Number"
                                maxLength={10}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full uppercase text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.pan_no && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.pan_no}</p>
                            )}
                        </div>

                        <div>

                            <div className="flex items-center justify-between">
                                <label className="block font-medium text-sm text-gray-700">
                                    GST Number
                                </label>

                                <button
                                    type="button"
                                    onClick={() => handleSearchGST(formData.gst_no)}
                                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                    title="GST number will be copied automatically"
                                >
                                    <ExternalLink size={14} />
                                    Search Taxpayer
                                </button>
                            </div>

                            <input
                                name="gst_no"
                                value={formData.gst_no}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter GST Number"
                                maxLength={15}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full uppercase text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.gst_no && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.gst_no}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block font-medium text-sm text-gray-700">
                                Bank Account Details
                            </label>
                            <button
                                type="button"
                                onClick={addAccount}
                                className="text-sm text-primary hover:underline"
                            >
                                + Add Account
                            </button>
                        </div>

                        {formData.account_details.map((acc, index) => (
                            <div
                                key={index}
                                className="border border-gray-300 rounded-md p-4 mb-3 space-y-3 focus:ring-1 focus:ring-purple-600 focus:border-none"
                            >
                                <div className="flex gap-4">
                                    <input
                                        value={acc.accountHolderName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountHolderName", e.target.value)
                                        }
                                        placeholder="Account Holder Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />

                                    <input
                                        value={acc.bankName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "bankName", e.target.value)
                                        }
                                        placeholder="Bank Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <input
                                        value={acc.branchName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "branchName", e.target.value)
                                        }
                                        placeholder="Branch Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />

                                    <input
                                        value={acc.accountNumber}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountNumber", e.target.value)
                                        }
                                        placeholder="Account Number"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />
                                </div>

                                <div className="flex gap-4 items-center">
                                    <input
                                        value={acc.ifscCode}
                                        onChange={(e) =>
                                            handleAccountChange(index, "ifscCode", e.target.value)
                                        }
                                        placeholder="IFSC Code"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none uppercase"
                                    />

                                    <select
                                        value={acc.accountType}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountType", e.target.value)
                                        }
                                        className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    >
                                        <option value="savings">Savings</option>
                                        <option value="current">Current</option>
                                    </select>


                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeAccount(index)}
                                    className="text-red-500 text-sm hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end pt-4 gap-2">
                        <button
                            type="button"
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onClick={() => setShowModal(false)}
                        >
                            Cancel
                        </button>
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? 'edit' : 'create'} />
                    </div>
                </form>
            </Modal>

            <OptionSelectionModal
                isOpen={showLedgerFormatModal && !!ledgerSupplier}
                onClose={() => {
                    setShowLedgerFormatModal(false);
                    setLedgerSupplier(null);
                }}
                title={ledgerSupplier ? `Download Ledger - ${ledgerSupplier.company_name}` : 'Download Ledger'}
                description="Choose the format for the supplier ledger. You can then optionally apply a date range before download."
                options={[
                    {
                        value: 'excel',
                        label: 'Excel',
                        description: 'Download the supplier ledger as an Excel file.',
                        icon: <Download size={16} />,
                    },
                    {
                        value: 'pdf',
                        label: 'PDF',
                        description: 'Download the supplier ledger as a PDF file.',
                        icon: <ExternalLink size={16} />,
                    },
                ]}
                onSelect={(value) => {
                    setLedgerDownloadFormat(value as 'excel' | 'pdf');
                    setShowLedgerFormatModal(false);
                    setShowLedgerModal(true);
                }}
            />

            {showLedgerModal && ledgerSupplier && (
                <Modal
                    isOpen={showLedgerModal}
                    title={`Download ${ledgerDownloadFormat === 'pdf' ? 'PDF' : 'Excel'} Ledger - ${ledgerSupplier.company_name}`}
                    onClose={() => {
                        setShowLedgerModal(false);
                        setLedgerSupplier(null);
                    }}
                    size="md"
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date Range
                            </label>
                            <DateRangePicker
                                value={ledgerDateRange}
                                onChange={setLedgerDateRange}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Leave blank to download all-time supplier ledger.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowLedgerModal(false);
                                    setLedgerSupplier(null);
                                }}
                                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadLedger}
                                disabled={downloadingLedgerFor === ledgerSupplier.id}
                                className="px-4 py-2 rounded-md bg-primary text-white hover:bg-gray-950 disabled:opacity-60"
                            >
                                {downloadingLedgerFor === ledgerSupplier.id
                                    ? 'Downloading...'
                                    : `Download ${ledgerDownloadFormat === 'pdf' ? 'PDF' : 'Excel'}`}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message={`Are you sure you want to delete this supplier? ${itemToDelete?.company_name} will be permanently deleted.`}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} supplier(s)?`}
            >
            </DeleteConfirmationModal>
        </div >
    );
}

export default SupplierList;
