import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { PlusCircle, Phone, MapPin, Receipt, CreditCard } from 'lucide-react';
import DateInput from '@components/admin/DateInput';
import axios from 'axios';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import { useDebounce } from '@hooks/useDebounce';
import Modal from '@components/admin/Modal';
import ProductDetailsModal from '@components/admin/ProductDetailsModal';
import { numberToWords } from '@utils/converters';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '@pages/admin/purchases/PaymentModal';
import FullPageLoader from '@components/admin/FullPageLoader';
import CreateSupplierForm from './CreateSupplierForm';
import SubmitButton from '@components/admin/SubmitButton';
import type { OptionType, SelectedSupplier } from '@models/common';
import type { Product, ProductItem } from '@models/product';
import SmartDropdown from '@components/admin/SmartDropdown';
import CreateBankAccountModal from '../invoices/CreateBankAccountModal';
import type { BankAccountCreatedResponse } from '@models/bank-account';
import PurchaseInvoiceTableRow from '@components/admin/PurchaseInvoiceTableRow';
import ProductItemsSummaryFooter from '@components/admin/ProductItemsSummaryFooter';
import { CreateProductWithVariantsModal } from './CreatePurchase';
import { formatVariantDisplay, getBrandName } from '@utils/formatVariantDisplay';

interface DebitNoteFormData {
    overall_discount?: number;
    purchaseId?: string;
    userId: string;
    billFrom: string;
    billTo: string;
    referenceNo: string;
    debitNoteDate: Date | null;
    status: string;
    items: ProductItem[];
    replacementItems: ProductItem[];
    notes: string;
    termsAndCondition: string;
    paymentMode?: string;   // ObjectId
    checkNumber?: string;
    bank?: string | null;
    paidAmount?: number;
}

interface taxGroup {
    _id: string;
    tax_name: string;
    total_tax_rate: number;
    tax_rates: {
        _id: string;
        tax_name: string;
        tax_rate: number;
    }[];
}

interface IPaymentMode {
    id: string;
    name: string;
    slug: string;
}

interface PurchaseOption extends OptionType {
    supplierId?: string;
    supplierName?: string;
    supplierBillNumber?: string;
    purchaseDate?: string;
    subLabel?: string;
}

interface QuickAddVariant {
    _id?: string;
    id?: string;
    productId?: string | QuickAddProduct;
    designNo?: string;
    color?: string;
    size?: string;
    purchase_price?: number;
    purchasePrice?: number;
    barcode?: string;
    mrp?: number;
    sale_price?: number;
}

type QuickAddProduct = Product & {
    _id?: string;
    unit?: { name?: string; unit_name?: string } | null;
    tax?: { group_id?: string; id?: string; _id?: string } | null;
};

type ItemSection = 'items' | 'replacementItems';

type CreateDebitNoteProps = {
    editId?: string;
};

const CreateDebitNote: React.FC<CreateDebitNoteProps> = ({ editId }) => {
    const navigate = useNavigate();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const isEditMode = Boolean(editId);
    const [adminUsers, setAdminUsers] = useState<OptionType[]>([]);
    const [suppliers, setSuppliers] = useState<OptionType[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<OptionType | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<OptionType | null>(null);
    const [supplierDetails, setSupplierDetails] = useState<SelectedSupplier | null>(null);
    const [paymentModes, setPaymentModes] = useState<IPaymentMode[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOption[]>([]);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [debitNoteFormData, setDebitNoteFormData] = useState<DebitNoteFormData>({
        overall_discount: 0,
        purchaseId: '',
        userId: user?.id || '',
        billFrom: '',
        billTo: '',
        referenceNo: '',
        debitNoteDate: null,
        status: 'return',  // default
        items: [],
        replacementItems: [],
        notes: '',
        termsAndCondition: '',
        paymentMode: '',
        // paymentModeSlug: '',
        checkNumber: '',
        bank: null,
        // sign_type: 'digitalSignature',
        // signatureId: null,
        // signatureName: '',
        // esignDataUrl: null,
        // subTotal: null,
        // totalTax: null,
        // totalDiscount: null,
        // grandTotal: null,
        // sp_referenceNumber: '',
        // sp_paymentDate: null,
        // sp_paymentMode: '',
        // sp_amount: 0,
        // sp_paid_amount: 0,
        // sp_due_amount: 0,
    });

    const effectiveDebitNoteStatus = debitNoteFormData.replacementItems.length > 0 ? 'replaced' : 'return';
    const selectedStatusLabel = effectiveDebitNoteStatus === 'replaced' ? 'Replaced' : 'Return';


    // Edit Modal State
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
    const [editingItemSection, setEditingItemSection] = useState<ItemSection>('items');
    const [taxes, setTaxes] = useState<taxGroup[]>([]);
    const effectiveGstMode: "Inclusive" | "Exclusive" = "Exclusive";

    // Extra Information State
    const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'termsAndCondition' | 'bank'>('notes');
    const [bankAccounts, setBankAccounts] = useState<OptionType[]>([]);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [selectedSupplierRawMeta, setSelectedSupplierRawMeta] = useState<Record<string, any> | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
    const [editingModalProductId, setEditingModalProductId] = useState<string | null>(null);
    const [bankAccountSearchInput, setBankAccountSearchInput] = useState<string>('');
    const debouncedSearchTermBankAccount = useDebounce(bankAccountSearchInput, 500);
    const [isCreateBankAccountModalOpen, setIsCreateBankAccountModalOpen] = useState(false);
    const [supplierSearchInput, setSupplierSearchInput] = useState<string>('');
    const debouncedSupplierSearchTerm = useDebounce(supplierSearchInput, 500);
    const [supplierMetaByUserId, setSupplierMetaByUserId] = useState<Record<string, any>>({});
    const [purchaseSupplierSearchInput, setPurchaseSupplierSearchInput] = useState<string>('');
    const debouncedPurchaseSupplierSearchTerm = useDebounce(purchaseSupplierSearchInput, 400);
    const [quickAddSearch, setQuickAddSearch] = useState('');
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(-1);
    const [isQuickAddQuantityModalOpen, setIsQuickAddQuantityModalOpen] = useState(false);
    const [pendingQuickAddEntry, setPendingQuickAddEntry] = useState<{ product: QuickAddProduct; variant: QuickAddVariant } | null>(null);
    const [quickAddVariants, setQuickAddVariants] = useState<QuickAddVariant[]>([]);
    const debouncedQuickAddSearch = useDebounce(quickAddSearch, 400);
    const quickAddRef = useRef<HTMLDivElement>(null);
    const quickAddListRef = useRef<HTMLUListElement>(null);
    const quickAddInputRef = useRef<HTMLInputElement>(null);
    const skipNextPurchaseFetchRef = useRef(false);
    const editPurchaseOptionRef = useRef<PurchaseOption | null>(null);
    useEffect(() => {
        fetchPaymentModes();
        fetchTaxes();
    }, []);

    useEffect(() => {
        fetchPurchases(debouncedPurchaseSupplierSearchTerm);
    }, [debouncedPurchaseSupplierSearchTerm, isEditMode, debitNoteFormData.purchaseId]);

    useEffect(() => {
        fetchAdminUsers();
    }, [user?.id]);

    useEffect(() => {
        if (!debitNoteFormData.purchaseId) return;
        if (skipNextPurchaseFetchRef.current) {
            skipNextPurchaseFetchRef.current = false;
            return;
        }
        fetchPurchase();
    }, [debitNoteFormData.purchaseId]);

    const formatPurchaseDate = (value?: string | Date | null) => {
        if (!value) return 'No Date';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'No Date';
        return date.toLocaleDateString('en-IN');
    };

    const selectedPurchaseOption = useMemo(
        () => purchases.find((order) => order.id === debitNoteFormData.purchaseId) ?? null,
        [purchases, debitNoteFormData.purchaseId]
    );
    const combinedDisplayItems = useMemo(
        () => ([
            ...debitNoteFormData.replacementItems.map(item => ({ ...item, __section: 'replacementItems' as ItemSection })),
            ...debitNoteFormData.items.map(item => ({ ...item, __section: 'items' as ItemSection })),
        ]),
        [debitNoteFormData.items, debitNoteFormData.replacementItems]
    );

    useEffect(() => {
        const fetchDebitNoteForEdit = async () => {
            if (!editId) return;

            try {
                setIsFetching(true);
                const response = await axios.get(`${Constants.FETCH_FOR_DEBIT_NOTE_LIST_URL}/${editId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = response.data?.data;
                if (!data) return;

                if (data.bank) {
                    setBankAccounts((prev) => {
                        const exists = prev.find(bank => bank.id === data.bank.id);
                        if (exists) return prev;
                        return [...prev, { id: data.bank.id, name: data.bank.bankName }];
                    });
                }

                if (data.billFrom) {
                    const adminOption = { id: data.billFrom.id, name: data.billFrom.name };
                    setSelectedAdmin(adminOption);
                }

                if (data.billTo) {
                    const supplierOption = { id: data.billTo.id, name: data.billTo.name };
                    setSelectedSupplier(supplierOption);
                    setSupplierDetails({
                        id: data.billTo.id,
                        firstName: data.billTo.name || 'Supplier',
                        lastName: '',
                        email: data.billTo.email || '',
                        phone: data.billTo.phone || '',
                        user_type: 2,
                        profileImage: '',
                        dateOfBirth: '',
                        address: data.billTo.address || '',
                        country: null,
                        state: null,
                        city: null,
                        postalCode: ''
                    });
                    setSelectedSupplierRawMeta({
                        company_name: data.billTo.name || '',
                        phone_number: data.billTo.phone || '',
                        company_address: data.billTo.address || ''
                    });
                }

                if (data.purchase?.id) {
                    const purchaseOption: PurchaseOption = {
                        id: data.purchase.id,
                        name: data.purchase.purchaseId || '',
                        supplierId: data.billTo?.id || data.vendor?.id || '',
                        supplierName: data.billTo?.name || data.vendor?.name || 'Unknown Supplier',
                        supplierBillNumber: data.purchase.supplierBillNumber || '',
                        purchaseDate: formatPurchaseDate(data.purchase.purchaseDate || data.debitNoteDateRaw),
                        subLabel: `${data.billTo?.name || data.vendor?.name || 'Unknown Supplier'} | ${data.purchase.purchaseId || ''} | ${data.purchase.supplierBillNumber || 'No Bill No'} | ${formatPurchaseDate(data.purchase.purchaseDate || data.debitNoteDateRaw)}`
                    };

                    editPurchaseOptionRef.current = purchaseOption;
                    setPurchases((prev) => {
                        const withoutCurrent = prev.filter((item) => item.id !== purchaseOption.id);
                        return [purchaseOption, ...withoutCurrent];
                    });
                }

                skipNextPurchaseFetchRef.current = true;
                setDebitNoteFormData((prev) => ({
                    ...prev,
                    purchaseId: data.purchase?.id || '',
                    userId: user?.id || '',
                    billFrom: data.billFrom?.id || '',
                    billTo: data.billTo?.id || data.vendor?.id || '',
                    referenceNo: data.referenceNo || '',
                    debitNoteDate: data.debitNoteDateRaw ? new Date(data.debitNoteDateRaw) : null,
                    items: withUniqueRowIds(data.items || []),
                    replacementItems: withUniqueRowIds(data.replacementItems || []),
                    notes: data.notes || '',
                    termsAndCondition: data.termsAndCondition || '',
                    paymentMode: data.paymentMode?.id || '',
                    checkNumber: data.checkNumber || '',
                    bank: data.bank?.id || null,
                    paidAmount: Number(data.paidAmount) || 0,
                }));
            } catch (error) {
                console.error('Error fetching debit note:', error);
                toast.error('Failed to fetch debit note details.');
            } finally {
                setIsFetching(false);
            }
        };

        fetchDebitNoteForEdit();
    }, [editId, token, user?.id]);

    const withUniqueRowIds = (items: any[] = []) =>
        (Array.isArray(items) ? items : []).map((item) => ({
            ...item,
            product_id: item.product_id || item.productId || item.id || '',
            id: crypto.randomUUID(),
        }));

    const fetchPurchase = async () => {
        try {
            setIsFetching(true);
            const response = await axios.get(`${Constants.GET_PURCHASE_DETAILS_URL}/${debitNoteFormData.purchaseId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = response.data.data;

            if (data) {
                if (data.billTo) {
                    const supplierOption = { id: data.billTo.id, name: data.billTo.name };
                    setSelectedSupplier(supplierOption);
                    setDebitNoteFormData(prev => ({ ...prev, billTo: data.billTo?.id || '' }));
                    const [firstName, ...rest] = (data.billTo.name || '').split(' ');
                    setSupplierDetails({
                        id: data.billTo.id,
                        firstName: firstName || data.billTo.companyName || '',
                        lastName: rest.join(' '),
                        email: data.billTo.email || '',
                        phone: data.billTo.phone || '',
                        user_type: 2,
                        profileImage: data.billTo.profileImage || '',
                        dateOfBirth: '',
                        address: data.billTo.address || '',
                        country: null,
                        state: null,
                        city: null,
                        postalCode: ''
                    });
                    // Populate raw meta so the inline details panel renders
                    setSelectedSupplierRawMeta({
                        company_name: data.billTo.companyName || data.billTo.name || '',
                        phone_number: data.billTo.phone || '',
                        gst_no: data.billTo.gst_no || data.billTo.gstNo || '',
                        pan_no: data.billTo.pan_no || data.billTo.panNo || '',
                        company_address: data.billTo.address || data.billTo.company_address || '',
                        city: data.billTo.city?.name || data.billTo.city || '',
                        state: data.billTo.state?.name || data.billTo.state || '',
                        pin_code: data.billTo.pin_code || data.billTo.pinCode || ''
                    });
                }

                if (data.billFrom) {
                    let _admin = { id: data.billFrom.id, name: data.billFrom.name };
                    handleAdminChange(_admin);
                }

                if (data.bank) {
                    setBankAccounts((prev) => {
                        const exists = prev.find(bank => bank.id === data.bank.id);
                        if (exists) return prev;
                        return [...prev, { id: data.bank.id, name: data.bank.bankName }];
                    });
                }

                setDebitNoteFormData(prev => ({
                    ...prev,
                    _id: data.id,
                    userId: user?.id || '',
                    billFrom: data.billFrom?.id || '',
                    billTo: data.billTo?.id || '',
                    referenceNo: data.referenceNo || '',
                    debitNoteDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
                    // status: data.status || '',
                    items: withUniqueRowIds(data.items || []),
                    replacementItems: [],
                    paidAmount: Number(data.paidAmount) || 0,
                    overall_discount: Number(data.overall_discount) || 0,
                    notes: data.notes || '',
                    termsAndCondition: data.termsAndCondition || '',
                    bank: data.bank?.id || null,
                }));

            }
        } catch (error) {
            console.error('Error fetching purchase:', error);
        } finally {
            setIsFetching(false);
        }
    }


    const fetchPurchases = async (searchTerm = '') => {
        try {
            const response = await axios.get(Constants.FETCH_ALL_PURCHASE_FOR_DEBIT_NOTE_URL, {
                params: { search: searchTerm },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = response.data.data;


            if (!Array.isArray(data)) {
                setPurchases([]);
                return;
            }

            // ✅ FILTER OUT PURCHASES THAT ALREADY HAVE DEBIT NOTES
            const filteredPurchases = data.filter((order: any) => {
                return (
                    (isEditMode && order.id === debitNoteFormData.purchaseId) ||
                    (
                        order.status !== 'return' &&
                        order.status !== 'replaced' &&
                        !order.debitNoteId
                    )
                );
            });

            const formattedPurchases = filteredPurchases.map((order: any) => {
                const supplierName = order.vendor?.name || 'Unknown Supplier';
                const purchaseDate = formatPurchaseDate(order.purchaseDate);

                return {
                    id: order.id,
                    name: order.purchaseId,
                    supplierId: order.vendor?.id || '',
                    supplierName,
                    supplierBillNumber: order.supplier_bill_number || '',
                    purchaseDate,
                    subLabel: `${supplierName} | ${order.purchaseId} | ${order.supplier_bill_number || 'No Bill No'} | ${purchaseDate}`
                };
            });

            if (isEditMode && editPurchaseOptionRef.current) {
                const currentOption = editPurchaseOptionRef.current;
                const exists = formattedPurchases.some((item) => item.id === currentOption.id);
                setPurchases(exists ? formattedPurchases : [currentOption, ...formattedPurchases]);
                return;
            }

            setPurchases(formattedPurchases);
        } catch (error) {
            console.error('Error fetching purchases:', error);
            setPurchases([]);
        }
    }

    const fetchPaymentModes = async () => {
        try {
            const response = await axios.get(Constants.GET_ALL_PAYMENT_MODES_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPaymentModes(response.data.data);
        } catch (error) {
            console.error('Error fetching payment modes:', error);
        }
    }
    const fetchTaxes = async () => {
        if (!token) return;
        try {
            const response = await axios.get(Constants.FETCH_TAX_GROUPS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setTaxes(response.data.data);
        } catch (error) {
            console.error('Error fetching taxes:', error);
            setTaxes([]);
        }
    };

    useEffect(() => {
        const fetchBankAccounts = async () => {
            try {
                const response = await axios.get(Constants.FETCH_BANK_ACCOUNTS_WITH_SEARCH_URL, {
                    params: { search: debouncedSearchTermBankAccount },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.data.length > 0) {
                    const formattedBankAccounts = response.data.data.map((item: any) => {
                        return {
                            id: item.id,
                            name: item.bankName
                        }
                    });

                    setBankAccounts(formattedBankAccounts);
                } else {
                    setBankAccounts([]);
                }
            } catch (error) {
                console.error("Error fetching bank accounts:", error);
            }
        }
        fetchBankAccounts();
    }, [debouncedSearchTermBankAccount]);


    const handleAdminChange = async (user: OptionType) => {
        setSelectedAdmin(user);
        setDebitNoteFormData(prev => ({ ...prev, billFrom: user.id }));
    };

    const handleSupplierChange = async (user: OptionType | null) => {
        if (!user) {
            setSelectedSupplier(null);
            setSupplierDetails(null);
            setSelectedSupplierRawMeta(null);
            setSupplierSearchInput('');
            setPurchaseSupplierSearchInput('');
            setDebitNoteFormData(prev => ({
                ...prev,
                billTo: '',
                purchaseId: '',
            }));
            return;
        }

        setSelectedSupplier(user);
        setDebitNoteFormData(prev => ({ ...prev, billTo: user.id }));
        const meta = supplierMetaByUserId[user.id];
        setSelectedSupplierRawMeta(meta || null);
        if (meta) {
            setSupplierDetails({
                id: user.id,
                firstName: meta.company_name || meta.email || meta.phone_number || 'Supplier',
                lastName: '',
                email: meta.email || '',
                phone: meta.phone_number || '',
                user_type: 2,
                profileImage: meta.profileImage || '',
                dateOfBirth: '',
                address: '',
                country: null,
                state: null,
                city: null,
                postalCode: ''
            });
        } else {
            setSupplierDetails(null);
        }
    };

    const handlePurchaseSelection = (purchase: PurchaseOption | null) => {
        handleFormChange('purchaseId', purchase?.id ?? '');
    };

    const purchaseSupplierSearchItems = useMemo(
        () =>
            Array.from(
                new Map(
                    purchases
                        .filter((purchase) => purchase.supplierId)
                        .map((purchase) => [
                            String(purchase.supplierId),
                            {
                                id: String(purchase.supplierId),
                                name: purchase.supplierName || 'Unknown Supplier',
                            }
                        ])
                ).values()
            ),
        [purchases]
    );

    const filteredPurchaseOptions = useMemo(
        () =>
            (!selectedSupplier?.id
                ? []
                : purchases.filter((purchase) =>
                    String(purchase.supplierId || '') === String(selectedSupplier.id)
                ))
                .map((purchase) => ({
                    ...purchase,
                    name: `${purchase.supplierBillNumber || 'No Bill No'} | ${purchase.name || 'No Purchase ID'} | ${purchase.purchaseDate || 'No Date'}`,
                })),
        [purchases, selectedSupplier]
    );

    const handleTopSupplierSelection = async (supplier: OptionType | null) => {
        if (!supplier) {
            await handleSupplierChange(null);
            return;
        }

        setPurchaseSupplierSearchInput(supplier.name || '');
        setSupplierSearchInput(supplier.name || '');
        if (selectedSupplier?.id !== supplier.id) {
            handleFormChange('purchaseId', '');
        }
        await handleSupplierChange(supplier);
    };

    // --- ITEM & FORM HANDLERS ---
    const handleFormChange = (field: keyof DebitNoteFormData, value: any) => {
        setDebitNoteFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleRemoveItem = (itemToRemove: ProductItem, section: ItemSection = 'items') => {
        handleFormChange(section, debitNoteFormData[section].filter(item => item.id !== itemToRemove.id));
    };

    const handleEditItem = (itemToEdit: ProductItem, section: ItemSection = 'items') => {
        setEditingItem({ ...itemToEdit });
        setEditingItemSection(section);
        setIsEditProductModalOpen(true);
    };

    const handleEditingItemChange = (field: keyof ProductItem, value: string | number) => {
        setEditingItem(prev => {
            if (!prev) return null;

            const fieldsToNumber = ['qty', 'rate'];   // old "'qty', 'rate', 'discount_value'"

            const newValue = fieldsToNumber.includes(field as string)
                ? Number(value) || 0
                : value;

            const updatedItem = { ...prev, [field]: newValue };

            return recalculateItem(updatedItem, 'GST', effectiveGstMode, taxes);
        });
    };


    const recalculateItem = useCallback(
        (item: ProductItem, taxType: string, gstType: string, taxList: taxGroup[]) => {
            const qty = Number(item.qty) || 0;
            const rate = Number(item.rate) || 0;
            const discountValue = Number((item as any).discount_value) || Number(item.discount) || 0;
            const taxGroupId = item.tax_group_id;

            let taxRate = 0;
            if (taxType === "GST") {
                const selectedTaxGroup = taxList.find((t) => String(t._id) === String(taxGroupId));
                taxRate = selectedTaxGroup?.total_tax_rate || 0;
            }

            const gross = qty * rate;
            const discountAmount = Math.min(Math.max(0, discountValue), gross);

            let calculatedTax = 0;
            let finalAmount = 0;

            if (taxType === "GST" && gstType === "Inclusive") {
                const netInclusive = gross - discountAmount;
                const divisor = 1 + taxRate / 100;
                const baseAmount = divisor > 0 ? netInclusive / divisor : netInclusive;
                calculatedTax = netInclusive - baseAmount;
                finalAmount = netInclusive;
            } else {
                const netBase = gross - discountAmount;
                calculatedTax = taxType === "GST" ? netBase * (taxRate / 100) : 0;
                finalAmount = netBase + calculatedTax;
            }

            return {
                ...item,
                discount: discountAmount,
                tax: calculatedTax,
                amount: finalAmount
            };
        },
        []
    );


    const totalAmount = useMemo(() => {
        return debitNoteFormData.items.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );
    }, [debitNoteFormData.items]);

    const replacementAmount = useMemo(() => {
        return debitNoteFormData.replacementItems.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );
    }, [debitNoteFormData.replacementItems]);


    const netAdjustment = useMemo(() => {
        return Number((totalAmount - replacementAmount).toFixed(2));
    }, [totalAmount, replacementAmount]);

    const adjustmentType = useMemo(() => {
        if (netAdjustment > 0) return 'supplier_credit';
        if (netAdjustment < 0) return 'supplier_payable';
        return 'even_exchange';
    }, [netAdjustment]);

    const totalInWords = useMemo(() => {
        if (Math.abs(netAdjustment) <= 0) return 'Zero';
        return numberToWords(Math.round(Math.abs(netAdjustment)));
    }, [netAdjustment]);

    const overallDiscount = useMemo(() => {
        return Number(debitNoteFormData.overall_discount) || 0;
    }, [debitNoteFormData.overall_discount]);


    const fetchAdminUsers = async () => {
        if (!user?.id) return;
        if (adminUsers.length > 0 && selectedAdmin) return;
        if (user?.id) {
            const defaultAdmin = {
                id: user.id,
                name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || user.email || 'Admin'
            };
            setAdminUsers([defaultAdmin]);
            if (!selectedAdmin || selectedAdmin.id !== defaultAdmin.id) {
                setSelectedAdmin(defaultAdmin);
                handleAdminChange(defaultAdmin);
            }
            return;
        }
    };

    useEffect(() => {
        const fetchSuppliersByQuery = async () => {
            try {
                const response = await axios.get(Constants.GET_SUPPLIERS_URL, {
                    params: { search: debouncedSupplierSearchTerm, limit: 20, page: 1 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const supplierData = response.data.data?.suppliers ?? [];
                if (supplierData.length > 0) {
                    const formattedSuppliers = supplierData
                        .filter((supplier: any) => supplier.userId)
                        .map((supplier: any) => ({
                            id: supplier.userId,
                            name: supplier.company_name || supplier.email || supplier.phone_number || 'Supplier'
                        }));
                    setSuppliers(formattedSuppliers);
                    const metaMap: Record<string, any> = {};
                    supplierData.forEach((supplier: any) => {
                        if (supplier.userId) {
                            metaMap[supplier.userId] = supplier;
                        }
                    });
                    setSupplierMetaByUserId(metaMap);
                } else {
                    setSuppliers([]);
                    setSupplierMetaByUserId({});
                }
            } catch (error) {
                console.error('Error fetching suppliers:', error);
            }
        }
        fetchSuppliersByQuery();
    }, [debouncedSupplierSearchTerm, token]);


    const handleInLineItemChange = (updatedItem: ProductItem, rowId: string, section: ItemSection = 'items') => {
        const recalculatedItem = recalculateItem(updatedItem, 'GST', effectiveGstMode, taxes);

        setDebitNoteFormData(prev => ({
            ...prev,
            [section]: prev[section].map(item =>
                item.id === rowId
                    ? recalculatedItem
                    : item
            )
        }));
    };

    const closeProductModal = useCallback(() => {
        setIsProductModalOpen(false);
        setProductModalMode('create');
        setEditingModalProductId(null);
    }, []);

    const syncReplacementItemsWithUpdatedProduct = useCallback((items: ProductItem[], updatedProduct: any, latestVariants: any[] = []) => {
        const normalizedProductId = String(updatedProduct?.id || updatedProduct?._id || '');
        if (!normalizedProductId) return items;

        const productBrandName = getBrandName(updatedProduct?.brand || updatedProduct?.productBrandName || updatedProduct?.brand_name) || '';
        const productHsn = updatedProduct?.hsn_code || '';
        const productUnitName = updatedProduct?.unit?.name || updatedProduct?.unit?.unit_name || '';
        const productTaxGroupId = updatedProduct?.tax?.group_id || updatedProduct?.tax?.id || updatedProduct?.tax?._id || null;

        const syncedItems = items.map((row) => {
            if (String(row.product_id || '') !== normalizedProductId) return row;
            const matchedVariant = latestVariants.find((variant: any) => String(variant._id || variant.id) === String((row as any).variantId || ''));
            const updatedRow = {
                ...row,
                hsn_code: productHsn,
                unit: productUnitName,
                tax_group_id: productTaxGroupId,
                productBrandName,
                isCreatedFromModalProduct: true,
            } as ProductItem & any;

            if (matchedVariant) {
                updatedRow.name =
                    formatVariantDisplay({
                        brandName: productBrandName,
                        designNo: matchedVariant.designNo,
                        size: matchedVariant.size,
                    }) || matchedVariant.designNo || updatedProduct?.name || row.name || '';
                updatedRow.variantName = `${matchedVariant.color || ''} - ${matchedVariant.size || ''}`.trim();
                updatedRow.variantDesignNo = matchedVariant.designNo;
                updatedRow.variantColor = matchedVariant.color;
                updatedRow.variantSize = matchedVariant.size;
                updatedRow.variantBarcode = matchedVariant.barcode;
                updatedRow.variantMrp = matchedVariant.mrp;
                updatedRow.variantSalePrice = matchedVariant.sale_price;
                if (typeof matchedVariant.purchase_price === 'number') {
                    updatedRow.rate = matchedVariant.purchase_price;
                }
            }

            return recalculateItem(updatedRow, 'GST', effectiveGstMode, taxes);
        });

        const existingVariantIds = new Set(
            syncedItems
                .filter((row) => String(row.product_id || '') === normalizedProductId)
                .map((row: any) => String(row.variantId || ''))
                .filter(Boolean)
        );

        const appendedItems = latestVariants
            .filter((variant: any) => {
                const variantId = String(variant._id || variant.id || '');
                return variantId && !existingVariantIds.has(variantId);
            })
            .map((variant: any) => {
                const rate = Number(variant.purchase_price) || 0;
                const baseRow = {
                    id: crypto.randomUUID(),
                    product_id: normalizedProductId,
                    name:
                        formatVariantDisplay({
                            brandName: productBrandName,
                            designNo: variant.designNo,
                            size: variant.size,
                        }) || variant.designNo || updatedProduct?.name || '',
                    hsn_code: productHsn,
                    unit: productUnitName,
                    qty: 1,
                    rate,
                    discount: 0,
                    tax: 0,
                    tax_group_id: productTaxGroupId,
                    productBrandName,
                    variantId: variant._id || variant.id,
                    variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
                    variantDesignNo: variant.designNo,
                    variantColor: variant.color,
                    variantSize: variant.size,
                    variantBarcode: variant.barcode,
                    variantMrp: variant.mrp,
                    variantSalePrice: variant.sale_price,
                    isCreatedFromModalProduct: true,
                } as ProductItem & any;

                return recalculateItem(baseRow, 'GST', effectiveGstMode, taxes);
            });

        return appendedItems.length ? [...syncedItems, ...appendedItems] : syncedItems;
    }, [effectiveGstMode, recalculateItem, taxes]);

    const handleOpenCreatedProductEditor = useCallback((selectedItem: ProductItem & any) => {
        const productId = selectedItem?.product_id || selectedItem?.productId;
        if (!productId) {
            toast.error('Product not found for editing');
            return;
        }
        setEditingModalProductId(String(productId));
        setProductModalMode('edit');
        setIsProductModalOpen(true);
    }, []);

    const handleProductModalSaved = useCallback((product: any, variants: any[] = [], mode: 'create' | 'edit') => {
        if (!product) {
            closeProductModal();
            return;
        }

        if (mode === 'create') {
            handleProductCreatedFromModal(product, variants);
            closeProductModal();
            return;
        }

        setDebitNoteFormData((prev) => ({
            ...prev,
            replacementItems: syncReplacementItemsWithUpdatedProduct(prev.replacementItems, product, variants),
        }));
        toast.success('Replacement items updated with latest product details');
        closeProductModal();
    }, [closeProductModal, syncReplacementItemsWithUpdatedProduct]);

    const handleProductCreatedFromModal = (product: any, variants: any[] = []) => {
        if (!product || !variants.length) {
            closeProductModal();
            return;
        }

        const normalizedProductId = product.id || product._id;
        const productBrandName = product.brand?.brand_name || "";
        const productHsn = product.hsn_code || "";
        const productUnitName = product.unit?.name || product.unit?.unit_name || "";
        const productTaxGroupId = product.tax?.group_id || product.tax?.id || null;

        const replacementRows = variants.map((variant) => {
            const rate = variant.purchase_price ?? 0;
            const qty = 1;
            return {
                id: crypto.randomUUID(),
                product_id: normalizedProductId,
                name:
                    formatVariantDisplay({
                        brandName: getBrandName((product as any).brand),
                        designNo: variant.designNo,
                        size: variant.size,
                    }) ||
                    variant.designNo ||
                    product.name ||
                    "",
                hsn_code: productHsn,
                unit: productUnitName,
                qty,
                rate,
                discount: 0,
                tax: 0,
                tax_group_id: productTaxGroupId,
                amount: qty * rate,
                productBrandName,
                variantId: variant._id,
                variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
                variantDesignNo: variant.designNo,
                variantColor: variant.color,
                variantSize: variant.size,
                variantBarcode: variant.barcode,
                variantMrp: variant.mrp,
                variantSalePrice: variant.sale_price
            } as ProductItem;
        });

        setDebitNoteFormData((prev) => ({
            ...prev,
            replacementItems: [
                ...prev.replacementItems,
                ...replacementRows.map((item) => recalculateItem(item, 'GST', effectiveGstMode, taxes))
            ]
        }));
        closeProductModal();
    };

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (quickAddRef.current && !quickAddRef.current.contains(event.target as Node)) {
                setShowQuickAdd(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);


    useEffect(() => {
        const fetchQuickAddVariants = async () => {
            if (!token) return;

            try {
                const response = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                    params: { search: debouncedQuickAddSearch, limit: 10 },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const variants = response?.data?.data?.variants ?? response?.data?.data ?? [];
                setQuickAddVariants(Array.isArray(variants) ? variants : []);
            } catch (error) {
                console.error('Error fetching variants for debit note replacement:', error);
                setQuickAddVariants([]);
            }
        };

        fetchQuickAddVariants();
    }, [debouncedQuickAddSearch, token]);

    const quickAddItems = useMemo(() => {
        const term = debouncedQuickAddSearch.trim().toLowerCase();
        if (!term) return [] as Array<{ product: QuickAddProduct; variant: QuickAddVariant }>;

        const items: Array<{ product: QuickAddProduct; variant: QuickAddVariant }> = [];
        for (const variant of quickAddVariants) {
            const product =
                typeof variant.productId === 'object' && variant.productId !== null
                    ? variant.productId
                    : ({ id: String(variant.productId || ''), name: '', code: '' } as QuickAddProduct);
            const searchable = [
                variant.designNo,
                variant.color,
                variant.size,
                variant.barcode,
                product.name,
                product.code,
                product.brand?.brand_name,
            ].filter(Boolean).join(' ').toLowerCase();

            if (searchable.includes(term)) {
                items.push({ product, variant });
                if (items.length >= 25) break;
            }
        }

        return items;
    }, [debouncedQuickAddSearch, quickAddVariants]);

    const addStoredVariantToReplacement = useCallback((variant: QuickAddVariant, product: QuickAddProduct, requestedQty = 1, requestedRate?: number, requestedDiscount?: number) => {
        const variantId = variant._id || variant.id;
        const productId = product.id || product._id;

        if (!variantId || !productId) {
            toast.error('Selected product variant is invalid');
            return;
        }

        setDebitNoteFormData(prev => {
            const existingIndex = prev.replacementItems.findIndex(item => String(item.variantId) === String(variantId));

            if (existingIndex > -1) {
                const nextReplacementItems = [...prev.replacementItems];
                const existingRow = nextReplacementItems[existingIndex];
                nextReplacementItems[existingIndex] = recalculateItem(
                    { ...existingRow, qty: (Number(existingRow.qty) || 0) + requestedQty },
                    'GST',
                    effectiveGstMode,
                    taxes
                );

                const updatedReplacementItem = nextReplacementItems[existingIndex];
                const reorderedReplacementItems = nextReplacementItems.filter((_, idx) => idx !== existingIndex);
                return { ...prev, replacementItems: [updatedReplacementItem, ...reorderedReplacementItems] };
            }

            const rate = requestedRate !== undefined ? requestedRate : Number(variant.purchase_price ?? variant.purchasePrice ?? product.prices?.purchase ?? 0);
            const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
            const discountAmount = requestedDiscount !== undefined ? requestedDiscount : 0;
            const productUnit = product.unit;
            const productTax = product.tax;
            const newItem = {
                id: crypto.randomUUID(),
                product_id: productId,
                name:
                    formatVariantDisplay({
                        brandName: getBrandName((product as any).brand),
                        designNo: variant.designNo,
                        size: variant.size,
                    }) ||
                    variant.designNo ||
                    product.name ||
                    '',
                hsn_code: product.hsn_code || '',
                unit: productUnit?.name || productUnit?.unit_name || '',
                productBrandName: product.brand?.brand_name || '',
                qty,
                rate,
                discount_value: discountAmount,
                discount_type: "Fixed",
                tax: 0,
                tax_group_id: productTax?.group_id || productTax?.id || productTax?._id || null,
                amount: qty * rate,
                variantId,
                variantName: `${variant.color || ''} - ${variant.size || ''}`.trim(),
                variantDesignNo: variant.designNo,
                variantColor: variant.color,
                variantSize: variant.size,
                variantBarcode: variant.barcode,
                variantMrp: variant.mrp,
                variantSalePrice: variant.sale_price
            } as ProductItem;

            return {
                ...prev,
                replacementItems: [
                    recalculateItem(newItem, 'GST', effectiveGstMode, taxes),
                    ...prev.replacementItems,
                ],
            };
        });

        const productLabel = product.name || product.code || 'Product';
        toast.success(`Added ${productLabel} replacement item`);
    }, [effectiveGstMode, recalculateItem, taxes]);

    const handleOpenQuickAddQuantityModal = (entry: { product: QuickAddProduct; variant: QuickAddVariant }) => {
        const productName = formatVariantDisplay({
            brandName: getBrandName(entry.product?.brand),
            designNo: entry.variant?.designNo,
            size: entry.variant?.size,
        }) || entry.variant?.designNo || entry.product?.name;

        setPendingQuickAddEntry({ ...entry, name: productName } as any);
        setIsQuickAddQuantityModalOpen(true);
        setShowQuickAdd(false);
        setQuickAddActiveIndex(-1);
    };

    const selectQuickAddItem = (entry: { product: QuickAddProduct; variant: QuickAddVariant }) => {
        handleOpenQuickAddQuantityModal(entry);
    };

    useEffect(() => {
        if (quickAddActiveIndex > -1 && quickAddListRef.current) {
            const items = quickAddListRef.current.querySelectorAll('[data-quick-add-row="true"]');
            const activeItem = items[quickAddActiveIndex] as HTMLLIElement | undefined;
            if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [quickAddActiveIndex, showQuickAdd, quickAddItems.length]);

    const handleQuickAddKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const items = quickAddItems;
        if (!showQuickAdd || items.length === 0) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setQuickAddActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                event.preventDefault();
                setQuickAddActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                event.preventDefault();
                if (quickAddActiveIndex > -1) {
                    selectQuickAddItem(items[quickAddActiveIndex]);
                }
                break;
            case 'Escape':
                setShowQuickAdd(false);
                break;
        }
    };

    const validateDebitNoteData = () => {
        // Add your validation logic here
        const newErrors: { [key: string]: string } = {};
        //order date required
        if (!debitNoteFormData.debitNoteDate) newErrors.debitNoteDate = 'Order date is required.';
        //billFrom required
        if (!debitNoteFormData.billFrom.trim()) newErrors.billFrom = 'Bill from is required.';
        //billTo required
        if (!debitNoteFormData.billTo.trim()) newErrors.billTo = 'Bill to is required.';
        //atleast 1 item required
        const hasItemPopulated = debitNoteFormData.items.some(item => item.name.trim() !== '');
        if (!hasItemPopulated) newErrors.items = 'At least one return item is required.';

        setFormErrors(newErrors);
        return newErrors;
    }

    const saveDebitNote = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validateDebitNoteData();

        if (Object.keys(errors).length > 0) {
            const firstErrorField = Object.keys(errors)[0];
            const firstErrorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLInputElement | null;
            firstErrorElement?.focus();
            return;
        }

        const formData = new FormData();

        formData.append('status', effectiveDebitNoteStatus);

        for (const [key, value] of Object.entries(debitNoteFormData)) {
            if (key === 'status') continue;
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, "0");
                const day = String(value.getDate()).padStart(2, "0");

                formData.append(key, `${year}-${month}-${day}`);
            } else if (Array.isArray(value) && (key === 'items' || key === 'replacementItems')) {
                value.forEach((item, index) => {
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        if (itemValue !== undefined && itemValue !== null) {
                            formData.append(`${key}[${index}][${itemKey}]`, String(itemValue));
                        }
                    });
                });
            } else if (typeof value !== 'object' && value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        }


        try {
            setIsSubmitting(true);
            if (isEditMode) {
                await axios.put(`${Constants.UPDATE_DEBIT_NOTE_URL}/${editId}`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            } else {
                await axios.post(Constants.CREATE_DEBIT_NOTE_URL, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }

            toast.success(isEditMode ? 'Debit note updated successfully.' : 'Debit note created successfully.');
            navigate('/admin/debit-notes');
        } catch (error: any) {
            if (error.response?.status !== 200 && error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            } else {
                toast.error('An unexpected error occurred.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };


    const dataURLtoFile = async (input: string, filename: string): Promise<File | null> => {
        try {
            if (input.startsWith('data:')) {
                // Base64 Data URL case
                const arr = input.split(',');
                if (arr.length !== 2) return null;

                const mimeMatch = arr[0].match(/:(.*?);/);
                const mime = mimeMatch?.[1] || 'image/png';
                const bstr = atob(arr[1]);
                const u8arr = new Uint8Array(bstr.length);

                for (let i = 0; i < bstr.length; i++) {
                    u8arr[i] = bstr.charCodeAt(i);
                }

                return new File([u8arr], filename, { type: mime });
            } else if (input.startsWith('http') || input.startsWith('/')) {
                // Normal URL case (fetch the image)
                const response = await fetch(input);
                if (!response.ok) return null;

                const blob = await response.blob();
                const mime = blob.type || 'image/png';
                return new File([blob], filename, { type: mime });
            }

            return null;
        } catch {
            return null;
        }
    };


    const handlePaymentConfirm = (paymentModalData: DebitNoteFormData) => {
        //set with previous data
        setDebitNoteFormData(prev => ({ ...prev, ...paymentModalData }));
        setIsPaymentModalOpen(false);
    }
    const handleNewProductClick = () => {
        setProductModalMode('create');
        setEditingModalProductId(null);
        setIsProductModalOpen(true);
    }
    return (
        <div className="md:p-4 bg-white-50   min-h-screen border border-gray-200  rounded">
            <form onSubmit={saveDebitNote}>
                <div className="max-w-7xl mx-auto space-y-2">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-2xl font-bold text-gray-950 ">{isEditMode ? 'Edit Debit Note' : 'New Debit Note'}</h1>
                        <img src={systemSettings?.company.siteLogo} alt="" className='w-32' />
                    </div>
                    {/* Top Section: PO Details & Logo */}
                    <div className="w-fit">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full items-start">
                            <div className="w-full">
                                <label className="block text-sm font-medium text-gray-700">
                                    Supplier
                                </label>
                                <SmartDropdown
                                    items={purchaseSupplierSearchItems}
                                    value={purchaseSupplierSearchInput}
                                    onChange={setPurchaseSupplierSearchInput}
                                    onSelect={(item) => handleTopSupplierSelection(item as OptionType | null)}
                                    selectedItem={selectedSupplier}
                                    placeholder="Type supplier name..."
                                />
                            </div>
                            <div className="w-full">
                                <label htmlFor="ref-no" className="block text-sm font-medium text-gray-700 ">
                                    Purchase ID
                                </label>
                                <SearchableDropdown
                                    options={filteredPurchaseOptions}
                                    placeholder={selectedSupplier ? 'Select Purchase' : 'Select Supplier First'}
                                    value={filteredPurchaseOptions.find((order) => order.id === debitNoteFormData.purchaseId) ?? null}
                                    onChange={(_, value) => handlePurchaseSelection(value as PurchaseOption | null)}
                                    disabled={!selectedSupplier}
                                />
                            </div>
                            <div className="w-full">
                                <label className="block text-sm font-medium text-gray-700">
                                    Supplier Bill No
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={selectedPurchaseOption?.supplierBillNumber || ""}
                                    placeholder="Auto fetched"
                                    className="h-[42px] w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none"
                                />
                            </div>
                            <div className="w-full">
                                <DateInput
                                    label="Order Date"
                                    value={debitNoteFormData.debitNoteDate}
                                    onChange={(newDate) => handleFormChange('debitNoteDate', newDate)}
                                    isRequired
                                />
                                {formErrors?.debitNoteDate && <span className="text-red-500 text-sm">{formErrors.debitNoteDate}</span>}
                            </div>

                            <div className="w-full">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Debit Note Status <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className={`flex h-[42px] items-center rounded-md border px-4 text-sm font-medium ${effectiveDebitNoteStatus === 'replaced'
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 bg-gray-50 text-gray-800'
                                        }`}
                                >
                                    {selectedStatusLabel}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Status changes to Replaced automatically when replacement items are added.
                                </p>
                                {formErrors?.status && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.status}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Supplier Section – inline (Buyer is auto-selected silently) */}
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex flex-col md:flex-row gap-3 items-start relative z-30">
                            {/* Supplier Search – ~35% */}
                            <div className="w-full md:w-[35%] relative z-50">
                                <div className="flex justify-between items-center mb-0.5">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Supplier <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsSupplierModalOpen(true)}
                                        className="flex items-center text-xs text-primary font-semibold"
                                    >
                                        <PlusCircle className="h-3 w-3 mr-1" />
                                        New
                                    </button>
                                </div>
                                <SmartDropdown
                                    items={suppliers}
                                    value={supplierSearchInput}
                                    onChange={setSupplierSearchInput}
                                    onSelect={(item) => handleTopSupplierSelection(item as OptionType | null)}
                                    selectedItem={selectedSupplier}
                                    placeholder="Type to search supplier..."
                                    onAddNew={() => setIsSupplierModalOpen(true)}
                                    addNewLabel="New Supplier"
                                />
                                {!selectedSupplier && formErrors?.billTo && (
                                    <span className="text-red-500 text-xs mt-0.5 block">{formErrors.billTo}</span>
                                )}
                            </div>

                            {/* Supplier Details – ~65% */}
                            <div className="w-full md:w-[65%] flex items-center h-full pt-0 md:pt-5">
                                {selectedSupplier && selectedSupplierRawMeta ? (
                                    <div className="text-sm text-gray-700 leading-relaxed w-full">
                                        <p className="font-semibold text-gray-900 text-base leading-tight mb-1">
                                            {selectedSupplierRawMeta.company_name || supplierDetails?.firstName}
                                        </p>
                                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                                            {selectedSupplierRawMeta.phone_number && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3 text-blue-400" />
                                                    {selectedSupplierRawMeta.phone_number}
                                                </span>
                                            )}
                                            {selectedSupplierRawMeta.gst_no && (
                                                <span className="flex items-center gap-1">
                                                    <Receipt className="h-3 w-3 text-green-400" />
                                                    GST: <span className="font-medium text-gray-700">{selectedSupplierRawMeta.gst_no}</span>
                                                </span>
                                            )}
                                            {selectedSupplierRawMeta.pan_no && (
                                                <span className="flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3 text-primary" />
                                                    PAN: <span className="font-medium text-gray-700">{selectedSupplierRawMeta.pan_no}</span>
                                                </span>
                                            )}
                                            {(selectedSupplierRawMeta.company_address || selectedSupplierRawMeta.city || selectedSupplierRawMeta.state) && (
                                                <span className="flex items-center gap-1 max-w-sm truncate" title={[
                                                    selectedSupplierRawMeta.company_address,
                                                    selectedSupplierRawMeta.city,
                                                    selectedSupplierRawMeta.state,
                                                    selectedSupplierRawMeta.pin_code
                                                ].filter(Boolean).join(', ')}>
                                                    <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                                                    {[selectedSupplierRawMeta.company_address, selectedSupplierRawMeta.city, selectedSupplierRawMeta.state, selectedSupplierRawMeta.pin_code].filter(Boolean).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Select a supplier to view details</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Return / Replacement Items */}


                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-950">Items</h3>
                                    <p className="text-xs text-gray-500">Remove purchase rows for returned items. Add stored or new products for replacement items.</p>
                                </div>
                            </div>
                            {formErrors?.items && <span className="text-red-500 text-sm">{formErrors.items}</span>}
                            <div className="flex flex-wrap gap-6 items-center pb-4">
                                <div ref={quickAddRef} className="relative flex-1 min-w-[320px]">
                                    <input
                                        type="text"
                                        value={quickAddSearch}
                                        onChange={(event) => {
                                            setQuickAddSearch(event.target.value);
                                            setShowQuickAdd(true);
                                            setQuickAddActiveIndex(0);
                                        }}
                                        onFocus={() => setShowQuickAdd(true)}
                                        ref={quickAddInputRef}
                                        onKeyDown={handleQuickAddKeyDown}
                                        placeholder="Search by design no. or brand..."
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                                    />
                                    {showQuickAdd && quickAddSearch.trim() && (
                                        <ul ref={quickAddListRef} className="absolute top-full left-0 w-full bg-white border border-gray-200 z-50 max-h-56 overflow-auto rounded-md shadow-lg">
                                            {quickAddItems.length === 0 ? (
                                                <li className="p-3 text-center text-sm text-gray-500">No results</li>
                                            ) : (
                                                quickAddItems.map((entry, index) => {
                                                    const label = formatVariantDisplay({
                                                        brandName: getBrandName(entry.product?.brand),
                                                        designNo: entry.variant.designNo,
                                                        size: entry.variant.size,
                                                        includeSize: true,
                                                    });
                                                    return (
                                                        <li
                                                            data-quick-add-row="true"
                                                            key={`debit-note-quick-variant-${entry.product.id || entry.product._id}-${entry.variant._id || entry.variant.id}`}
                                                            className={`p-2 pl-6 cursor-pointer hover:bg-third ${index === quickAddActiveIndex ? "bg-third" : ""}`}
                                                            onMouseDown={(event) => {
                                                                event.preventDefault();
                                                                selectQuickAddItem(entry);
                                                            }}
                                                        >
                                                            <div className="text-sm text-gray-800">
                                                                {label || "Variant"} - {systemSettings?.currency.symbol ?? '$'}{entry.variant.purchase_price ?? entry.variant.purchasePrice ?? entry.product.prices?.purchase ?? 0}
                                                            </div>
                                                        </li>
                                                    );
                                                })
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <button
                                    type='button'
                                    onClick={handleNewProductClick}
                                    className="flex items-center text-sm text-primary font-semibold"
                                >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Add New Product
                                </button>
                            </div>
                            <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-[980px] w-full table-fixed border-separate border-spacing-0">
                                        <colgroup>
                                            <col className="w-[4rem]" />
                                            <col className="w-[30%]" />
                                            <col className="w-[14%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[12%]" />
                                            <col className="w-[6rem]" />
                                        </colgroup>
                                        <thead className="bg-gray-950 text-white sticky top-0 z-10">
                                            <tr>
                                                <th className="p-2 text-center text-sm font-semibold rounded-tl-md w-12">S.No.</th>
                                                <th className="p-2 text-left text-sm font-semibold">Product</th>
                                                <th className="p-2 text-left text-sm font-semibold">Color / Size</th>
                                                <th className="p-2 text-left text-sm font-semibold w-24">Quantity</th>
                                                <th className="p-2 text-left text-sm font-semibold w-28">Rate</th>
                                                <th className="p-2 text-left text-sm font-semibold w-24">Discount</th>
                                                <th className="p-2 text-left text-sm font-semibold w-24">Tax</th>
                                                <th className="p-2 text-left text-sm font-semibold w-32">Amount</th>
                                                <th className="p-2 text-center text-sm font-semibold rounded-tr-md w-24">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedDisplayItems.map((item, index) => (
                                                <PurchaseInvoiceTableRow
                                                    key={`${item.__section}-${item.id}`}
                                                    index={index}
                                                    item={item}
                                                    currencySymbol={systemSettings?.currency.symbol ?? '$'}
                                                    onInLineItemChange={(updatedItem) => handleInLineItemChange(updatedItem, item.id, item.__section)}
                                                    onEditItem={(selectedItem) => handleEditItem(selectedItem, item.__section)}
                                                    onDeleteItem={(selectedItem) => handleRemoveItem(selectedItem, item.__section)}
                                                    availableItems={combinedDisplayItems}
                                                    addNewProduct={handleNewProductClick}
                                                    onOpenProductEditor={item.__section === 'replacementItems' ? handleOpenCreatedProductEditor : undefined}
                                                />
                                            ))}
                                    {combinedDisplayItems.length === 0 && (
                                        <tr className="bg-white text-gray-950">
                                            <td className="p-3 font-medium text-center" colSpan={9}>
                                                No Items Selected
                                            </td>
                                        </tr>
                                    )}
                                </tbody></table></div></div>
                            <ProductItemsSummaryFooter
                                items={combinedDisplayItems}
                                columns={["serial", "label", "colorSize", "quantity", "rate", "discount", "tax", "amount", "action"]}
                                currencySymbol={systemSettings?.currency.symbol ?? '$'}
                                minWidthClassName="min-w-[980px]"
                                colClassNames={["w-[4rem]", "w-[30%]", "w-[14%]", "w-[10%]", "w-[10%]", "w-[10%]", "w-[10%]", "w-[12%]", "w-[6rem]"]}
                            />

                        </div>
                    </div>


                    {/* Other sections can go here */}

                </div>

                <ProductDetailsModal
                    isOpen={isQuickAddQuantityModalOpen || isEditProductModalOpen}
                    onClose={() => {
                        if (isQuickAddQuantityModalOpen) {
                            setIsQuickAddQuantityModalOpen(false);
                            setPendingQuickAddEntry(null);
                        } else {
                            setIsEditProductModalOpen(false);
                            setEditingItem(null);
                        }
                    }}
                    title={isEditProductModalOpen ? "Edit Item" : "Add Item"}
                    item={isEditProductModalOpen ? editingItem : (pendingQuickAddEntry ? {
                        ...pendingQuickAddEntry,
                        qty: 1,
                        rate: pendingQuickAddEntry.variant.purchase_price ?? pendingQuickAddEntry.product.prices?.purchase ?? '',
                        discount_value: 0
                    } : null)}
                    onSave={(qty, rate, discount) => {
                        if (isQuickAddQuantityModalOpen && pendingQuickAddEntry) {
                            addStoredVariantToReplacement(pendingQuickAddEntry.variant, pendingQuickAddEntry.product, qty, rate, discount);
                            setQuickAddSearch('');
                            setIsQuickAddQuantityModalOpen(false);
                            setPendingQuickAddEntry(null);
                            setQuickAddActiveIndex(-1);
                            window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
                        } else if (isEditProductModalOpen && editingItem) {
                            const updated = {
                                ...editingItem,
                                qty,
                                rate,
                                discount_value: discount,
                                discount: discount
                            };
                            const recalculatedItem = recalculateItem(updated, 'GST', effectiveGstMode, taxes);
                            const updatedItems = debitNoteFormData[editingItemSection].map(item =>
                                item.id === editingItem.id ? recalculatedItem : item
                            );
                            handleFormChange(editingItemSection, updatedItems);
                            setIsEditProductModalOpen(false);
                            setEditingItem(null);
                        }
                    }}
                    currencySymbol={systemSettings?.currency.symbol}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">

                    {/* Left Side: Tabs */}
                    <div>
                    </div>

                    {/* Right Side: Totals & Signature */}
                    <div className="bg-white  p-4 rounded-lg border border-gray-200  space-y-3">

                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Return Amount</span>
                            <span>{systemSettings?.currency.symbol}{totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Replacement Amount</span>
                            <span>{systemSettings?.currency.symbol}{replacementAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Overall Discount</span>
                            <span>{systemSettings?.currency.symbol}{overallDiscount.toFixed(2)}</span>
                        </div>

                        <hr className="border-gray-200" />

                        <div className="flex justify-between font-bold text-gray-950">
                            <span>
                                {adjustmentType === 'supplier_credit'
                                    ? 'Supplier Credit'
                                    : adjustmentType === 'supplier_payable'
                                        ? 'Additional Payable'
                                        : 'Even Exchange'}
                            </span>
                            <span>{systemSettings?.currency.symbol}{Math.abs(netAdjustment).toFixed(2)}</span>
                        </div>

                        <p className="text-sm text-gray-500 capitalize">{totalInWords}</p>


                    </div>
                </div>
                <div className="flex justify-end mt-4 gap-3">
                    <button type='button' onClick={() => navigate('/admin/debit-notes')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50    cursor-pointer">Cancel</button>
                    <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={isEditMode ? 'edit' : 'create'} />
                </div>

            </form>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirm={handlePaymentConfirm}
                totalAmount={totalAmount}
                paymentModes={paymentModes}
            />

            <CreateSupplierForm
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSuccess={(newSupplier: any) => {
                    let formattedNewSupplier = {
                        id: newSupplier.id,
                        name: newSupplier.supplier_name
                    }
                    setSuppliers([formattedNewSupplier, ...suppliers]);
                    setIsSupplierModalOpen(false);
                }}
            />

            <CreateProductWithVariantsModal
                isOpen={isProductModalOpen}
                token={token}
                mode={productModalMode}
                productId={editingModalProductId}
                onClose={closeProductModal}
                onSaved={handleProductModalSaved}
            />


            <CreateBankAccountModal
                isOpen={isCreateBankAccountModalOpen}
                onClose={() => setIsCreateBankAccountModalOpen(false)}
                onSuccess={(newBankAccount: BankAccountCreatedResponse) => {
                    const formattedBankAccount: OptionType = {
                        id: newBankAccount.id,
                        name: newBankAccount.bankName
                    };
                    setBankAccounts(prevBankAccounts => [formattedBankAccount, ...prevBankAccounts]);
                    setIsCreateBankAccountModalOpen(false);
                }}
            />
            {isFetching && <FullPageLoader />}
        </div>
    );
};

export default CreateDebitNote;
