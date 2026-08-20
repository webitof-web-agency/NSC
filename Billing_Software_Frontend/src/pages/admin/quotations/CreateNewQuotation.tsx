import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { PlusCircle, Mail, FileSearch } from 'lucide-react';
import DateInput from '@components/admin/DateInput';
import axios from 'axios';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { useDebounce } from '@hooks/useDebounce';
import Modal from '@components/admin/Modal';
import { numberToWords } from '@utils/converters';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import FullPageLoader from '@components/admin/FullPageLoader';
import CustomerCard from '@components/admin/CustomerCard';
import type { Product, ProductItem } from '@models/product';
import type { OptionType, SelectedAdmin } from '@models/common';
import type { Customer } from '@models/customer';
import CreateProductForm from '@components/admin/CreateProductForm';
import CreateCustomerForm from '@components/admin/CreateCustomerForm';
import SmartDropdown from '@components/admin/SmartDropdown';
import InvoiceTableRow from "@components/admin/InvoiceTableRow";
import ProductDetailsModal from "@components/admin/ProductDetailsModal";
import InvoiceFormLayout, { type SummaryRow } from '@components/admin/InvoiceFormLayout';
import type { QuotationPreference } from '@models/modulesettings/quotation';
import { formatVariantDisplay, getBrandName } from '@utils/formatVariantDisplay';
import AiDocumentScanModal from '@components/admin/AiDocumentScanModal';

interface CreateNewQuotationProps {
    mode?: 'create' | 'edit';
    quotationId?: string;
}

interface QuotationFormData {
    id?: string;
    userId: string;
    salesPerson: string | null;
    billFrom: string;
    billTo: string;
    quotationDate: Date | null;
    expiryDate: Date | null;
    status: string;
    items: ProductItem[];
    notes: string;
    termsAndCondition: string;
    subTotal: number | null;
    totalTax: number | null;
    totalDiscount: number | null;
    grandTotal: number | null;
    taxType: 'GST' | 'Non-GST';
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

const CreateNewQuotation: React.FC<CreateNewQuotationProps> = ({ mode = 'create', quotationId }) => {
    const formatWholeAmountDisplay = (value: number | string | null | undefined) =>
        Number(value || 0).toFixed(2);

    const navigate = useNavigate();
    const isEditMode = mode === 'edit';
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [adminUsers, setAdminUsers] = useState<OptionType[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerDropdownItems, setCustomerDropdownItems] = useState<OptionType[]>([]);
    const [customerSearchInput, setCustomerSearchInput] = useState<string>('');
    const debouncedSearchTermCustomer = useDebounce(customerSearchInput, 500);

    const [selectedAdmin, setSelectedAdmin] = useState<OptionType | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [companyDetails, setCompanyDetails] = useState<SelectedAdmin | null>(null);
    const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
    const [productList, setProductList] = useState<Product[]>([]);
    const [variantList, setVariantList] = useState<any[]>([]);
    const [quickAddSearch, setQuickAddSearch] = useState('');
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(-1);
    const quickAddRef = useRef<HTMLDivElement>(null);
    const quickAddListRef = useRef<HTMLUListElement>(null);
    const quickAddInputRef = useRef<HTMLInputElement>(null);
    const [quickAddProducts, setQuickAddProducts] = useState<Product[]>([]);
    const debouncedQuickAddSearch = useDebounce(quickAddSearch, 400);
    const [quotationFormData, setQuotationFormData] = useState<QuotationFormData>({
        userId: user?.id || '',
        salesPerson: '',
        billFrom: '',
        billTo: '',
        quotationDate: new Date(),
        expiryDate: null,
        status: '',
        items: [],
        notes: '',
        termsAndCondition: '',
        subTotal: null,
        totalTax: null,
        totalDiscount: null,
        grandTotal: null,
        taxType: 'GST'
    });

    // Edit Modal State
    const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
    const [pendingDetailsItem, setPendingDetailsItem] = useState<{ type: 'quick-add' | 'edit'; item: any; product?: any; variant?: any } | null>(null);
    const [taxes, setTaxes] = useState<taxGroup[]>([]);

    // Extra Information State
    const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'termsAndCondition'>('notes');
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isFetching, setIsFetching] = useState(false);
    const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [showAiQuotationScanModal, setShowAiQuotationScanModal] = useState(false);
    const [adminSearchInput, setAdminSearchInput] = useState<string>('');
    const [moduleSettings, setModuleSettings] = useState<QuotationPreference | null>(null);
    const [salesPersons, setSalesPersons] = useState<OptionType[]>([]);
    const [salesPersonSearchInput, setSalesPersonSearchInput] = useState<string>('');
    const debouncedSearchTermSalesPerson = useDebounce(salesPersonSearchInput, 500);
    const [fetchingSalesPersons, setFetchingSalesPersons] = useState(false);
    const [extraDiscount, setExtraDiscount] = useState<number>(0);
    const [extraDiscountType, setExtraDiscountType] = useState<"Fixed" | "Percentage">("Fixed");
    const taxTypeOptions = [
        { id: 'GST', name: 'GST' },
        { id: 'Non-GST', name: 'Non-GST' }
    ];
    useEffect(() => {
        const fetchDropDownData = async () => {
            try {
                setIsFetching(true);
                await fetchModuleSettings();
                await fetchAdminUsers();
                await fetchTaxes();
            } catch (error) {
                toast.error('Failed to fetch drop-down data.');
            } finally {
                setIsFetching(false);
            }
        }

        fetchDropDownData();
    }, []);

    useEffect(() => {
        const fetchQuotationDetails = async () => {
            if (!isEditMode || !quotationId) return;
            try {
                setIsLoadingQuotation(true);
                const response = await axios.get(`${Constants.FETCH_QUOTATION_DETAILS_URL}/${quotationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.data) {
                    const data = response.data.data;
                    const normalizedItems = Array.isArray(data.items)
                        ? data.items.map((item: any) => {
                            const productId = item.product_id || item.productId || item.product?.id;
                            const variantId = item.variantId || item.variant_id || item.variant?.id || item.variant?._id;
                            const variantName = item.variantName || item.variant_name || item.variant?.name || `${item.variant?.color || ""} - ${item.variant?.size || ""}`.trim();
                            return {
                                ...item,
                                product_id: productId,
                                variantId,
                                variantName,
                                unit: item.unit?.name ?? item.unit,
                            };
                        })
                        : [];
                    setQuotationFormData(prev => ({
                        ...prev,
                        id: data.id,
                        userId: user?.id || '',
                        salesPerson: data.salesPerson || '',
                        billFrom: data.billFrom?.id || '',
                        billTo: data.billTo?.id || '',
                        quotationDate: data.quotationDate ? new Date(data.quotationDate) : null,
                        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                        status: data.status || '',
                        items: normalizedItems,
                        notes: data.notes || '',
                        termsAndCondition: data.termsAndCondition || '',
                        taxType: data.taxType || 'GST'
                    }));

                    if (data.billTo) {
                        const customer = {
                            id: data.billTo.id,
                            name: data.billTo.name,
                            email: data.billTo.email,
                            phone: data.billTo.phone,
                            image: data.billTo.image
                        };
                        setSelectedCustomer(customer as any);
                        setCustomerDetails(customer as any);
                    }
                }
            } catch (error) {
                console.error('Error fetching quotation details:', error);
            } finally {
                setIsLoadingQuotation(false);
            }
        };

        fetchQuotationDetails();
    }, [isEditMode, quotationId, token, user?.id]);

    const fetchModuleSettings = async () => {
        try {
            const response = await axios.get(Constants.GET_GENERAL_SETTINGS_URL, {
                params: { groupSlug: 'quotation' },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            let settings: QuotationPreference = {
                quoteCustomerNotes: '',
                quoteTermsConditions: '',
                quoteSalesPersonRole: ''
            };

            let data = response.data.data;
            if (data) {
                data.forEach((setting: any) => {
                    const key = setting.key as keyof QuotationPreference;
                    settings[key] = setting.value;
                });
                if (!isEditMode) {
                    setQuotationFormData(prevState => ({
                        ...prevState,
                        termsAndCondition: settings.quoteTermsConditions,
                        notes: settings.quoteCustomerNotes
                    }));
                }
                setModuleSettings(settings);
            }
        } catch (error) {
            console.error('Error fetching module settings:', error);
        }
    }

    useEffect(() => {
        const fetchSalesPersons = async () => {
            const salesPersonRoleId = moduleSettings?.quoteSalesPersonRole || '';
            if (!salesPersonRoleId) return;
            try {
                setFetchingSalesPersons(true);
                const response = await axios.get(`${Constants.FETCH_USERS_BY_ROLE_WITH_SEARCH_URL}/${salesPersonRoleId}`, {
                    params: { search: debouncedSearchTermSalesPerson },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                let data = response.data.data;
                if (data) {
                    const formattedSalesPersons = data.map((user: any) => ({ id: user.id, name: `${user.firstName ?? ''} ${user.lastName ?? ''}` }));
                    setSalesPersons(formattedSalesPersons);
                }
            } catch (error) { }
            finally {
                setFetchingSalesPersons(false);
            }
        }
        fetchSalesPersons();
    }, [moduleSettings?.quoteSalesPersonRole, debouncedSearchTermSalesPerson]);

    const handleSalesPersonSelect = (option: OptionType) => {
        const salesPersonId = option ? option.id : '';
        setQuotationFormData(prevState => ({
            ...prevState,
            salesPerson: salesPersonId
        }));
    }
    const fetchTaxes = async () => {
        if (!token) return;
        try {
            const response = await axios.get(`${Constants.API_BASE_URL}/admin/tax-groups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = response.data?.data || [];
            const formatted = data.map((group: any) => ({
                ...group,
                total_tax_rate: group.total_tax_rate ?? group.total_tax_rate ?? 0,
                tax_rates: Array.isArray(group.tax_rate_ids)
                    ? group.tax_rate_ids.map((rate: any) => ({
                        _id: rate._id,
                        tax_name: rate.tax_name,
                        tax_rate: rate.tax_rate
                    }))
                    : (group.tax_rates || [])
            }));
            setTaxes(formatted);
        } catch (error) {
            console.error('Error fetching taxes:', error);
            setTaxes([]);
        }
    };

    const handleAdminChange = async (user: OptionType) => {
        setSelectedAdmin(user);
        try {
            setIsFetching(true);
            const response = await axios.get(`${Constants.FETCH_COMPANY_SETTINGS_URL}/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            //set billFrom to formData
            setQuotationFormData(prev => ({ ...prev, billFrom: user.id }));
            setCompanyDetails(response.data.data);
        } catch (error) {
            setCompanyDetails(null);
            setQuotationFormData(prev => ({ ...prev, billFrom: '' }));
            setSelectedAdmin(null);
        } finally {
            setIsFetching(false);
        }
    };

    const handleCustomerChange = async (user: Customer | null) => {
        if (user) {
            setSelectedCustomer(user);
            setQuotationFormData(prev => ({ ...prev, billTo: user.id }));
            setCustomerDetails(user);
        } else {
            setSelectedCustomer(null);
            setQuotationFormData(prev => ({ ...prev, billTo: '' }));
            setCustomerDetails(null);
        }
    };

    const sanitizeCustomerPhoneInput = (value: string) =>
        value.replace(/\D/g, '').slice(0, 10);

    const handleCustomerSearchChange = (value: string) => {
        setCustomerSearchInput(value);
        const normalizedValue = value.trim().toLowerCase();
        const selectedPhone = String(selectedCustomer?.phone || '').trim().toLowerCase();
        const selectedName = String(selectedCustomer?.name || '').trim().toLowerCase();
        if (selectedCustomer && normalizedValue !== selectedPhone && normalizedValue !== selectedName) {
            handleCustomerChange(null);
        }
    };

    const ensureBillToCustomer = async (
        source: QuotationFormData
    ): Promise<QuotationFormData | null> => {
        if (source.billTo) return source;

        const phone = sanitizeCustomerPhoneInput(customerSearchInput);
        if (!phone) return source;

        if (phone.length !== 10) {
            toast.error('Bill To phone number must be 10 digits.');
            return null;
        }

        const existingCustomer = customers.find(
            (customer) => sanitizeCustomerPhoneInput(customer.phone || '') === phone
        );
        if (existingCustomer) {
            await handleCustomerChange(existingCustomer);
            return { ...source, billTo: existingCustomer.id };
        }

        try {
            const response = await axios.post(
                Constants.CREATE_CUSTOMER_MINIMAL_URL,
                { phone },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newCustomer = response.data?.data;
            if (!newCustomer?.id) {
                toast.error('Failed to create customer from Bill To phone.');
                return null;
            }

            const createdCustomer = {
                ...newCustomer,
                phone: newCustomer.phone || phone,
            } as Customer;

            setCustomers((prev) => [createdCustomer, ...prev]);
            setCustomerDropdownItems((prev) => [
                {
                    id: createdCustomer.id,
                    name: createdCustomer.name || createdCustomer.phone || 'Customer',
                    subLabel: createdCustomer.phone,
                },
                ...prev,
            ]);
            setCustomerSearchInput(createdCustomer.phone || phone);
            await handleCustomerChange(createdCustomer);

            return { ...source, billTo: createdCustomer.id };
        } catch (error: any) {
            if (error.response?.status === 409) {
                try {
                    const lookupResponse = await axios.get(
                        Constants.GET_CUSTOMERS_WITH_SEARCH_URL,
                        {
                            params: { search: phone, limit: 10, page: 1 },
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    const matchedCustomer = lookupResponse.data?.data?.customers?.find(
                        (customer: Customer) =>
                            sanitizeCustomerPhoneInput(customer.phone || '') === phone
                    );
                    if (matchedCustomer?.id) {
                        setCustomers((prev) => [
                            matchedCustomer,
                            ...prev.filter((customer) => customer.id !== matchedCustomer.id),
                        ]);
                        setCustomerDropdownItems((prev) => [
                            {
                                id: matchedCustomer.id,
                                name: matchedCustomer.name || matchedCustomer.phone || 'Customer',
                                subLabel: matchedCustomer.phone,
                            },
                            ...prev.filter((customer) => customer.id !== matchedCustomer.id),
                        ]);
                        setCustomerSearchInput(matchedCustomer.phone || phone);
                        await handleCustomerChange(matchedCustomer);
                        return { ...source, billTo: matchedCustomer.id };
                    }
                } catch (lookupError) {
                    console.error('Customer lookup after duplicate failed:', lookupError);
                }
            }

            const message =
                error.response?.data?.errors?.phone ||
                error.response?.data?.message ||
                'Failed to create customer from Bill To phone.';
            toast.error(message);
            return null;
        }
    };

    // --- ITEM & FORM HANDLERS ---

    const parseAiDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const findTaxGroupIdByRate = (rate?: number) => {
        const numericRate = Number(rate || 0);
        const matchedTax = taxes.find((tax) => Number(tax.total_tax_rate || 0) === numericRate);
        return matchedTax?._id || null;
    };

    const isValidMongoId = (value?: string | null) => /^[a-f\d]{24}$/i.test(String(value || ""));

    const resolveProductIdFromVariant = (variantId?: string | null, fallbackProductId?: string | null) => {
        if (isValidMongoId(fallbackProductId)) {
            return String(fallbackProductId);
        }

        const normalizedVariantId = String(variantId || "");
        if (!normalizedVariantId) return "";

        const variantMatch = variantList.find(
            (variant: any) => String(variant?._id || variant?.id || "") === normalizedVariantId
        );

        const productId = typeof variantMatch?.productId === "object" && variantMatch?.productId !== null
            ? (variantMatch.productId.id || variantMatch.productId._id)
            : variantMatch?.productId;

        return isValidMongoId(productId) ? String(productId) : "";
    };

    const normalizeQuotationItemsForSubmission = (items: ProductItem[] = []) => {
        return items
            .filter((item) => item.name?.trim())
            .map((item) => {
                const resolvedVariantId = String((item as any).variantId || "");
                const resolvedProductId = resolveProductIdFromVariant(resolvedVariantId, String((item as any).product_id || ""));

                return {
                    ...item,
                    product_id: resolvedProductId,
                    variantId: resolvedVariantId,
                };
            })
            .filter((item: any) => isValidMongoId(item.product_id) && isValidMongoId(item.variantId));
    };

    const createAiQuotationItem = (sourceItem: any, matchedItem: any): ProductItem => {
        const product = matchedItem?.product;
        const variant = matchedItem?.variant;
        const qty = Math.max(Number(sourceItem?.quantity || 1), 1);
        const rate = Number(sourceItem?.rate || variant?.sale_price || 0);
        const baseItem: any = {
            id: crypto.randomUUID(),
            product_id: product?.id || matchedItem?.productId || '',
            name: product
                ? (formatVariantDisplay({
                    brandName: getBrandName(product.brand),
                    designNo: variant?.designNo || sourceItem?.designNumber || sourceItem?.description,
                    size: variant?.size || sourceItem?.size,
                }) || sourceItem?.description || product.name || '')
                : (sourceItem?.description || sourceItem?.designNumber || ''),
            hsn_code: sourceItem?.hsnCode || product?.hsn_code || '',
            unit: sourceItem?.unit || product?.unit?.name || '',
            qty,
            rate,
            discount: Number(sourceItem?.discount || 0),
            tax: 0,
            tax_group_id: (typeof product?.tax === 'object' && product?.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product?.tax) || findTaxGroupIdByRate(sourceItem?.taxRate),
            amount: Number(sourceItem?.amount || qty * rate || 0),
            variantId: variant?._id || matchedItem?.variantId || '',
            variantName: `${variant?.color || sourceItem?.color || ''} - ${variant?.size || sourceItem?.size || ''}`.trim(),
            variantDesignNo: variant?.designNo || sourceItem?.designNumber || '',
            variantColor: variant?.color || sourceItem?.color || '',
            variantSize: variant?.size || sourceItem?.size || '',
            variantBarcode: variant?.barcode || sourceItem?.barcode || '',
            variantMrp: Number(variant?.mrp || 0),
        };
        return recalculateItem(
            baseItem,
            quotationFormData.taxType,
            systemSettings?.company?.gstMode || 'Exclusive',
            taxes
        );
    };

    const applyAiQuotationExtraction = async (payload: any) => {
        const extracted = payload?.extracted || {};
        const matches = payload?.matches || {};

        if (matches?.customer?.id) {
            const customer = customers.find((item) => String(item.id) === String(matches.customer.id));
            if (customer) {
                await handleCustomerChange(customer);
                setCustomerSearchInput(customer.phone || '');
            }
        } else if (extracted.customerPhone) {
            setCustomerSearchInput(sanitizeCustomerPhoneInput(String(extracted.customerPhone)));
        }

        const nextItems = (extracted.items || [])
            .map((item: any, index: number) => ({ item, match: matches?.items?.[index] }))
            .filter((entry: any) => entry.match?.matched)
            .map((entry: any) => createAiQuotationItem(entry.item, entry.match));

        setQuotationFormData((prev) => ({
            ...prev,
            quotationDate: parseAiDate(extracted.invoiceDate || extracted.quotationDate) || prev.quotationDate,
            expiryDate: parseAiDate(extracted.expiryDate || extracted.dueDate) || prev.expiryDate,
            notes: extracted.notes || prev.notes,
            items: nextItems.length > 0 ? nextItems : prev.items,
        }));
    };

    const handleFormChange = (field: keyof QuotationFormData, value: any) => {
        setQuotationFormData(prev => ({ ...prev, [field]: value }));
    };

    const recalculateItem = (item: ProductItem, taxType: string, gstType: string, taxList: taxGroup[]) => {
        const qty = Number(item.qty) || 0;
        const rate = Number(item.rate) || 0;
        const discountValue = Number(item.discount_value) || 0;
        const discountType = item.discount_type || 'Fixed';
        const taxGroupId = item.tax_group_id || '';

        let discountAmount = 0;
        let taxRate = 0;

        if (taxType === 'GST') {
            const selectedTaxGroup = taxList.find((t) => String(t._id) === String(taxGroupId));
            taxRate = selectedTaxGroup?.total_tax_rate || 0;
        }

        let finalAmount = 0;
        let computedTax = 0;

        if (taxType === 'GST' && gstType === 'Inclusive') {
            const grossInclusive = rate * qty;
            const discountBase = discountType === 'Percentage'
                ? (grossInclusive * discountValue) / 100
                : discountValue;
            const safeDiscount = Math.min(discountBase, grossInclusive);
            const netInclusive = grossInclusive - safeDiscount;

            computedTax = taxType === 'GST' ? netInclusive - (netInclusive / (1 + (taxRate / 100))) : 0;
            finalAmount = netInclusive;
            discountAmount = safeDiscount;
        } else {
            const grossBase = rate * qty;
            const rawDiscount = discountType === 'Percentage'
                ? (grossBase * discountValue) / 100
                : discountValue;
            discountAmount = Math.min(rawDiscount, grossBase);

            const netBase = grossBase - discountAmount;
            computedTax = taxType === 'GST' ? (netBase * taxRate) / 100 : 0;
            finalAmount = netBase + computedTax;
        }

        return {
            ...item,
            discount: Number(discountAmount) || 0,
            tax: Number(computedTax) || 0,
            amount: Number(finalAmount) || 0
        };
    };

    const handleRemoveItem = (itemToRemove: ProductItem) => {
        handleFormChange('items', quotationFormData.items.filter(item => item.id !== itemToRemove.id));
    };

    const handleEditItem = (itemToEdit: ProductItem) => {
        setPendingDetailsItem({ type: 'edit', item: { ...itemToEdit } });
        setIsProductDetailsModalOpen(true);
    };

    const handleModalItemChange = (field: string, value: any) => {
        setPendingDetailsItem(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                item: {
                    ...prev.item,
                    [field]: value
                }
            };
        });
    };

    const handleSaveProductDetails = (qty: number, rate: number, discount: number) => {
        if (!pendingDetailsItem) return;

        if (pendingDetailsItem.type === 'edit') {
            const updated = {
                ...pendingDetailsItem.item,
                qty,
                rate,
                discount_value: discount,
                discount_type: 'Fixed',
            };
            handleInLineItemChange(updated as ProductItem, pendingDetailsItem.item.id);
        } else {
            addVariantToQuotation(pendingDetailsItem.variant, pendingDetailsItem.product, qty, rate, discount);
        }

        setQuickAddSearch('');
        setIsProductDetailsModalOpen(false);
        setPendingDetailsItem(null);
        setQuickAddActiveIndex(-1);
    };

    const handleCloseProductDetails = () => {
        setIsProductDetailsModalOpen(false);
        setPendingDetailsItem(null);
        window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
    };

    useEffect(() => {
        if (!quotationFormData.items.length) return;
        setQuotationFormData(prev => {
            const updatedItems = prev.items.map(item =>
                recalculateItem(item, prev.taxType, systemSettings?.company?.gstMode || 'Exclusive', taxes)
            );
            return {
                ...prev,
                items: updatedItems
            };
        });
    }, [quotationFormData.taxType, systemSettings?.company?.gstMode, taxes]);

    // --- SYNCHRONOUS TOTALS CALCULATION ---
    const isInclusiveCalc = quotationFormData.taxType === 'GST' && (systemSettings?.company?.gstMode || 'Exclusive') === 'Inclusive';
    let syncSubTotal = 0;
    let syncTotalTax = 0;
    let syncLineDiscount = 0;

    quotationFormData.items.forEach((item) => {
        syncSubTotal += (Number(item.qty) || 0) * (Number(item.rate) || 0);
        syncTotalTax += Number(item.tax) || 0;
        syncLineDiscount += Number(item.discount) || 0;
    });

    if (quotationFormData.taxType === 'Non-GST') {
        syncTotalTax = 0;
    }

    const syncDiscountBase = isInclusiveCalc ? syncSubTotal : syncSubTotal + syncTotalTax;
    const maxExtraDiscount = Math.max(syncDiscountBase, 0);
    const safeExtraValue = Math.max(Number(extraDiscount) || 0, 0);
    const syncExtraDiscount = extraDiscountType === "Percentage"
        ? Math.min((maxExtraDiscount * Math.min(safeExtraValue, 100)) / 100, maxExtraDiscount)
        : Math.min(safeExtraValue, maxExtraDiscount);
        
    const syncCombinedDiscount = syncLineDiscount + syncExtraDiscount;
    const syncGrandTotalExact = isInclusiveCalc
        ? syncSubTotal - syncCombinedDiscount
        : syncSubTotal + syncTotalTax - syncCombinedDiscount;

    const syncGrandTotal = Math.round(syncGrandTotalExact);
    const syncTotalInWords = syncGrandTotal > 0 ? numberToWords(syncGrandTotal) : 'Zero';

    useEffect(() => {
        setQuotationFormData((prev) => {
            if (
                prev.subTotal === Number(syncSubTotal.toFixed(2)) &&
                prev.totalTax === Number(syncTotalTax.toFixed(2)) &&
                prev.totalDiscount === Number(syncCombinedDiscount.toFixed(2)) &&
                prev.grandTotal === syncGrandTotal
            ) {
                return prev;
            }
            return {
                ...prev,
                subTotal: Number(syncSubTotal.toFixed(2)),
                totalTax: Number(syncTotalTax.toFixed(2)),
                totalDiscount: Number(syncCombinedDiscount.toFixed(2)),
                grandTotal: syncGrandTotal
            };
        });
    }, [syncSubTotal, syncTotalTax, syncCombinedDiscount, syncGrandTotal]);

    useEffect(() => {
        const isInclusive = quotationFormData.taxType === 'GST'
            && (systemSettings?.company?.gstMode || 'Exclusive') === 'Inclusive';
        const discountBase = isInclusive
            ? syncSubTotal
            : syncSubTotal + syncTotalTax;
        const maxExtraDiscount = Math.max(discountBase, 0);
        const safeExtraValue = Math.max(Number(extraDiscount) || 0, 0);
        const clamped = extraDiscountType === "Percentage"
            ? Math.min(safeExtraValue, 100)
            : Math.min(safeExtraValue, maxExtraDiscount);
        if (clamped !== extraDiscount) {
            setExtraDiscount(clamped);
        }
    }, [syncSubTotal, syncTotalTax, quotationFormData.taxType, systemSettings?.company?.gstMode, extraDiscount, extraDiscountType]);

    const fetchAdminUsers = async () => {
        if (adminUsers.length > 0 && selectedAdmin) return;
        if (isEditMode && quotationFormData.billFrom) {
            return;
        }
        if (user?.id) {
            const defaultAdmin = {
                id: user.id,
                name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || user.email || 'Admin'
            };
            setAdminUsers([defaultAdmin]);
            if (!selectedAdmin || selectedAdmin.id !== defaultAdmin.id) {
                setSelectedAdmin(defaultAdmin);
                setAdminSearchInput(defaultAdmin.name);
                handleAdminChange(defaultAdmin);
            }
            return;
        }
        try {
            const response = await axios.get(`${Constants.FETCH_USERS_URL}/1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const list = Array.isArray(response.data?.data) ? response.data.data : [];
            if (list.length > 0) {
                const formattedUsers = list.map((adminUser: any) => ({
                    id: adminUser.id,
                    name: `${adminUser.firstName ?? ''} ${adminUser.lastName ?? ''}`.trim()
                }));
                setAdminUsers(formattedUsers);
                const defaultAdmin = formattedUsers[0];
                setSelectedAdmin(defaultAdmin);
                setAdminSearchInput(defaultAdmin.name);
                handleAdminChange(defaultAdmin);
            } else {
                setAdminUsers([]);
            }
        } catch (error) {
            console.error('Error fetching admin users:', error);
        }
    };

    useEffect(() => {
        const fetchCustomersByQuery = async () => {
            try {
                const response = await axios.get(`${Constants.GET_CUSTOMERS_WITH_SEARCH_URL}`, {
                    params: { search: debouncedSearchTermCustomer, limit: 100, page: 1 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                let data = response.data.data;
                if (data.customers.length > 0) {
                    const fetchedCustomers = response.data.data.customers;
                    setCustomers(fetchedCustomers);
                    const formattedCustomers = fetchedCustomers.map((c: any) => ({
                        id: c.id,
                        name: c.name || c.phone || 'Customer',
                        subLabel: c.phone
                    }));
                    setCustomerDropdownItems(formattedCustomers);
                } else {
                    setCustomers([]);
                    setCustomerDropdownItems([]);
                }
            } catch (error) {
                console.error('Error fetching customers:', error);
            }
        }
        fetchCustomersByQuery();
    }, [debouncedSearchTermCustomer, token]);

    const handleInLineItemChange = (product: ProductItem, rowId: string) => {
        const updatedProduct = recalculateItem(
            product,
            quotationFormData.taxType,
            systemSettings?.company?.gstMode || 'Exclusive',
            taxes
        );
        setQuotationFormData((prev) => ({
            ...prev,
            items: prev.items.map(item => item.id === rowId ? updatedProduct : item)
        }));
    }

    const handleNewProductCreated = (product: Product) => {
        const discount_type = product.discount?.type;
        const discount_value = product.discount?.value;
        const rate = product.prices?.selling ?? 0;

        let updated = false;
        setQuotationFormData((prev) => ({
            ...prev,
            items: prev.items.map(item => {
                if (!updated && item.name === "") {
                    updated = true;
                    const baseItem = {
                        ...item,
                        id: product.id,
                        hsn_code: product.hsn_code ?? '',
                        name: product.name,
                        unit: product.unit?.name ?? '',
                        qty: 1,
                        rate,
                        tax_group_id: typeof product.tax === 'object' && product.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product.tax,
                        discount_type: product.discount?.type,
                        discount_value: product.discount?.value,
                    };
                    return recalculateItem(
                        baseItem as ProductItem,
                        quotationFormData.taxType,
                        systemSettings?.company?.gstMode || 'Exclusive',
                        taxes
                    );
                }
                return item;
            })
        }));
        setIsProductModalOpen(false);
    }
    const handleNewRow = () => {
        setQuotationFormData((prev) => ({
            ...prev,
            items: [...prev.items, {
                id: crypto.randomUUID(),
                product_id: '',
                variantId: '',
                variantName: '',
                name: '',
                hsn_code: '',
                unit: '',
                qty: 1,
                rate: 0,
                discount: 0,
                tax: 0,
                tax_group_id: null,
                discount_type: 'Percentage',
                discount_value: 0,
                amount: 0
            }]
        }));
    }

    // Add variant from ProductSidebar to quotation
    const addVariantToQuotation = (variant: any, product: any, requestedQty = 1, requestedRate?: number, requestedDiscount?: number) => {
        const existingIndex = quotationFormData.items.findIndex(
            item => item.variantId === variant._id
        );
        if (existingIndex > -1) {
            const existingRow = quotationFormData.items[existingIndex];
            const updatedQty = (Number(existingRow.qty) || 0) + requestedQty;
            const updatedItem = recalculateItem(
                { ...existingRow, qty: updatedQty } as ProductItem,
                quotationFormData.taxType,
                systemSettings?.company?.gstMode || 'Exclusive',
                taxes
            );
            setQuotationFormData(prev => ({
                ...prev,
                items: [
                    updatedItem,
                    ...prev.items.filter((_, idx) => idx !== existingIndex)
                ]
            }));
            toast.success('Quantity updated for existing variant');
            return;
        }

        const completeProduct = productList.find(p =>
            String(p.id) === String((product as any)._id) || String(p.id) === String(product.id)
        ) || product;

        const newId = crypto.randomUUID();

        const selectedTaxGroup = taxes.find(
            (t) => String(t._id) === String(completeProduct.tax?.group_id || '')
        );
        const taxRate = selectedTaxGroup?.total_tax_rate || 0;

        const rate = requestedRate !== undefined ? requestedRate : (variant.sale_price || 0);
        const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
        const discountValue = requestedDiscount !== undefined ? requestedDiscount : (variant.discount_value || 0);

        const subtotal = rate * qty;
        const discountAmount = discountValue;
        const totalTax = (subtotal - discountAmount) * (taxRate / 100);
        const amount = subtotal + totalTax - discountAmount;

        const newItem: ProductItem = {
            id: newId,
            product_id: completeProduct.id || completeProduct._id,
            name:
                formatVariantDisplay({
                    brandName: getBrandName(completeProduct.brand),
                    designNo: variant.designNo,
                    size: variant.size,
                }) ||
                variant.designNo ||
                completeProduct.name,
            hsn_code: completeProduct.hsn_code || '',
            unit: completeProduct.unit?.name || '',
            qty,
            rate,
            discount_type: 'Fixed',
            discount_value: discountValue,
            discount: discountAmount,
            tax_group_id: typeof completeProduct.tax === 'object' && completeProduct.tax !== null ? (completeProduct.tax._id || completeProduct.tax.group_id || completeProduct.tax.id || '') : (completeProduct.tax || ''),
            tax: totalTax,
            amount,
            variantId: variant._id,
            variantName: `${variant.color} - ${variant.size}`,
            variantColor: variant.color,
            variantSize: variant.size,
            variantDesignNo: variant.designNo,
            variantBarcode: variant.barcode,
            variantMrp: variant.mrp,
            productBrandName: completeProduct.brand?.brand_name
        };

        const calculatedItem = recalculateItem(
            newItem as ProductItem,
            quotationFormData.taxType,
            systemSettings?.company?.gstMode || 'Exclusive',
            taxes
        );

        setQuotationFormData(prev => ({
            ...prev,
            items: [calculatedItem, ...prev.items]
        }));

        const productLabel = completeProduct.name || completeProduct.code || completeProduct.id || "Product";
        toast.success(`Added ${productLabel}'s variant ${variant.color} ${variant.size} to quotation`);
    };

    const quickAddItems = useMemo(() => {
        const term = quickAddSearch.trim().toLowerCase();
        if (!term) return [] as Array<{ type: "variant"; product: Product; variant: any }>;
        const items: Array<{ type: "variant"; product: Product; variant: any }> = [];

        for (const v of variantList) {
            const searchable = `${v.designNo || ""} ${v.color || ""} ${v.size || ""} ${v.productId?.brand?.brand_name || ""}`.toLowerCase();
            if (!searchable.includes(term)) continue;

            const productId =
                typeof v.productId === "object" && v.productId !== null
                    ? (v.productId.id || v.productId._id)
                    : v.productId;
            const product =
                productList.find((p) => String(p.id) === String(productId)) ||
                ({
                    id: String(productId || ""),
                    item_type: typeof v.productId === "object" && v.productId !== null ? (v.productId.item_type || "Product") : "Product",
                    name: typeof v.productId === "object" && v.productId !== null ? (v.productId.name || "") : "",
                    code: typeof v.productId === "object" && v.productId !== null ? (v.productId.code || "") : "",
                    hsn_code: typeof v.productId === "object" && v.productId !== null ? (v.productId.hsn_code || "") : "",
                    barcode: typeof v.productId === "object" && v.productId !== null ? (v.productId.barcode || v.barcode || "") : (v.barcode || ""),
                    unit:
                        typeof v.productId === "object" && v.productId !== null && v.productId.unit
                            ? {
                                id: v.productId.unit.id || v.productId.unit._id || "",
                                name:
                                    v.productId.unit.short_name ||
                                    v.productId.unit.name ||
                                    v.productId.unit.unit_name ||
                                    "",
                            }
                            : null,
                    prices: {
                        selling: Number(v.sale_price || 0),
                        purchase: Number(v.purchase_price || 0),
                    },
                    discount: null,
                    tax:
                        typeof v.productId === "object" && v.productId !== null && v.productId.tax
                            ? {
                                group_id: v.productId.tax.group_id || v.productId.tax._id || "",
                                group_name: v.productId.tax.group_name || v.productId.tax.tax_name || "",
                                total_rate:
                                    Number(v.productId.tax.total_rate) ||
                                    Number(
                                        Array.isArray(v.productId.tax.tax_rate_ids)
                                            ? v.productId.tax.tax_rate_ids.reduce(
                                                (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                                                0
                                            )
                                            : 0
                                    ),
                            }
                            : null,
                    quantity: 0,
                    rate: Number(v.sale_price || 0),
                    amount: Number(v.sale_price || 0),
                    brand:
                        typeof v.productId === "object" && v.productId !== null
                            ? (v.productId.brand || { _id: "", brand_name: "" })
                            : { _id: "", brand_name: "" },
                } as Product);
            items.push({ type: "variant", product, variant: v });
            if (items.length >= 50) break;
        }

        return items;
    }, [quickAddSearch, variantList, productList]);

    const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const items = quickAddItems;
        if (!showQuickAdd || items.length === 0) return;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setQuickAddActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
                break;
            case "ArrowUp":
                e.preventDefault();
                setQuickAddActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
                break;
            case "Enter":
                e.preventDefault();
                if (quickAddActiveIndex > -1) {
                    const entry = items[quickAddActiveIndex];
                    if (entry.type === "variant") {
                        setPendingDetailsItem({
                            type: 'quick-add',
                            item: {
                product_code: entry.product.code,
                name: entry.variant.name || entry.product.name,
                                qty: 1,
                                rate: entry.variant.sale_price || 0,
                                discount: entry.variant.discount_value || 0
                            },
                            product: entry.product,
                            variant: entry.variant
                        });
                        setIsProductDetailsModalOpen(true);
                        setShowQuickAdd(false);
                    }
                }
                break;
            case "Escape":
                setShowQuickAdd(false);
                break;
        }
    };

    // Listen for variant click events from ProductSidebar
    useEffect(() => {
        const handleVariantAdd = (event: any) => {
            const { variant, product } = event.detail;
            addVariantToQuotation(variant, product);
        };

        window.addEventListener('addVariantToInvoice', handleVariantAdd);
        return () => window.removeEventListener('addVariantToInvoice', handleVariantAdd);
    }, [quotationFormData.items, productList, taxes]);

    useEffect(() => {
        const fetchProductsForQuotation = async () => {
            try {
                const res = await axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const products = res?.data?.data?.products ?? [];
                setProductList(products);
            } catch (err) {
                toast.error('Failed to load products');
                setProductList([]);
            }
        };

        fetchProductsForQuotation();
    }, [token]);

    const fetchAllVariants = useCallback(async () => {
        try {
            const res = await axios.get(Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params: { all: true }
            });
            const responseData = res.data.data;
            const variants = responseData?.variants || [];
            setVariantList(Array.isArray(variants) ? variants : []);
            return Array.isArray(variants) ? variants : [];
        } catch (err) {
            console.error('Variant list error:', err);
            setVariantList([]);
            return [];
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchAllVariants();
        }
    }, [token, fetchAllVariants]);

    useEffect(() => {
        const fetchQuickAddProducts = async () => {
            try {
                const res = await axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
                    params: { search: debouncedQuickAddSearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const products = res?.data?.data?.products ?? res?.data?.data ?? [];
                setQuickAddProducts(Array.isArray(products) ? products : []);
            } catch {
                setQuickAddProducts([]);
            }
        };
        if (token) {
            fetchQuickAddProducts();
        }
    }, [debouncedQuickAddSearch, token]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
                setShowQuickAdd(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (quickAddActiveIndex > -1 && quickAddListRef.current) {
            const items = quickAddListRef.current.querySelectorAll('[data-quick-add-row="true"]');
            const activeItem = items[quickAddActiveIndex] as HTMLLIElement | undefined;
            if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [quickAddActiveIndex, showQuickAdd, quickAddItems.length]);
    const validateQuotationData = (formState: QuotationFormData = quotationFormData) => {
        // Add your validation logic here
        const newErrors: { [key: string]: string } = {};
        //order date required
        if (!formState.quotationDate) newErrors.quotationDate = 'Quotation date is required.';
        //billFrom required
        if (!formState.billFrom.trim()) newErrors.billFrom = 'Bill from is required.';
        //billTo required
        if (!formState.billTo.trim()) newErrors.billTo = 'Bill to is required.';
        //atleast 1 item required
        const hasItemPopulated = formState.items.some(item => item.name.trim() !== '');
        if (!hasItemPopulated) newErrors.items = 'At least one item is required.';
        setFormErrors(newErrors);
        return newErrors;
    }
    const handleSaveAndSend = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        await saveQuotation('sent');
    }

    const handleUpdateQuotation = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        await saveQuotation();
    }

    const saveQuotation = async (status?: string) => {
        const preparedFormData = await ensureBillToCustomer(quotationFormData);
        if (!preparedFormData) return;

        const errors = validateQuotationData(preparedFormData);
        if (Object.keys(errors).length > 0) {
            const firstErrorField = Object.keys(errors)[0];
            const firstErrorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLInputElement | null;
            firstErrorElement?.focus();
            return;
        }

        const formData = new FormData();

        for (const [key, value] of Object.entries(preparedFormData)) {
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, "0");
                const day = String(value.getDate()).padStart(2, "0");

                formData.append(key, `${year}-${month}-${day}`);
            } else if (Array.isArray(value) && key === 'items') {
                normalizeQuotationItemsForSubmission(value as ProductItem[]).forEach((item, index) => {
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        if (itemValue !== undefined && itemValue !== null) {
                            formData.append(`items[${index}][${itemKey}]`, String(itemValue));
                        }
                    });
                });
            } else if (typeof value !== 'object' && value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        }
        if (!isEditMode && status) {
            formData.set('status', status);
        }
        try {
            setIsSaving(true);
            if (isEditMode && quotationId) {
                await axios.put(`${Constants.UPDATE_QUOTATION_URL}/${quotationId}`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            } else {
                await axios.post(Constants.CREATE_QUOTATION_URL, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }

            toast.success('Quotation saved successfully.');
            navigate('/admin/quotations');
        } catch (error: any) {
            if (error.response?.status !== 200 && error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            } else {
                toast.error('An unexpected error occurred.');
            }
        } finally {
            setIsSaving(false);
        }
    };


    const handleNewProductClick = () => {
        setIsProductModalOpen(true);
    }

    const TaxTypeSelector = () => (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 ">
                Tax Type <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
                <SmartDropdown
                    items={taxTypeOptions}
                    value={quotationFormData.taxType}
                    selectedItem={taxTypeOptions.find(o => o.id === quotationFormData.taxType) || null}
                    onSelect={(item) => {
                        if (item) {
                            handleFormChange('taxType', item.id);
                        }
                    }}
                    placeholder="Select Tax Type"
                    serverside={false}
                    onChange={() => { }}
                />
            </div>
        </div>
    );


    const gstMode = systemSettings?.company?.gstMode || 'Exclusive';
    const isInclusiveGst = quotationFormData.taxType === 'GST' && gstMode === 'Inclusive';
    const taxHeaderLabel =
        isInclusiveGst
            ? 'Inc. Tax'
            : 'Tax';
    const amountSummaryValue = isInclusiveCalc ? syncGrandTotal : syncSubTotal;

    const itemDiscountTotal = useMemo(() => {
        return quotationFormData.items.reduce((acc, item) => acc + (Number(item.discount) || 0), 0);
    }, [quotationFormData.items]);

    const handleExtraDiscountChange = (value: string) => {
        const numericValue = Number(value);
        const isInclusive = quotationFormData.taxType === 'GST'
            && (systemSettings?.company?.gstMode || 'Exclusive') === 'Inclusive';
        const discountBase = isInclusive
            ? (Number(quotationFormData.subTotal) || 0)
            : (Number(quotationFormData.subTotal) || 0) + (Number(quotationFormData.totalTax) || 0);
        const maxExtraDiscount = Math.max(discountBase, 0);
        const safeValue = Math.max(Number.isFinite(numericValue) ? numericValue : 0, 0);
        const clampedExtra = extraDiscountType === "Percentage"
            ? Math.min(safeValue, 100)
            : Math.min(safeValue, maxExtraDiscount);
        setExtraDiscount(clampedExtra);
    };

    const summaryRows: SummaryRow[] = [
        {
            label: 'Amount',
            value: `${systemSettings?.currency.symbol}${formatWholeAmountDisplay(amountSummaryValue)}`
        },
        {
            label: taxHeaderLabel,
            value: `${systemSettings?.currency.symbol}${formatWholeAmountDisplay(syncTotalTax)}`
        },
        {
            label: 'Discount',
            value: (
                <div className="flex items-center gap-2">
                    <select
                        value={extraDiscountType}
                        onChange={(e) =>
                            setExtraDiscountType(e.target.value as "Fixed" | "Percentage")
                        }
                        className="border border-gray-300 rounded-md px-2 py-1 text-left text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                        <option value="Fixed">Fixed</option>
                        <option value="Percentage">%</option>
                    </select>
                    <span className="text-gray-500">
                        - {extraDiscountType === "Fixed" ? systemSettings?.currency.symbol : "%"}
                    </span>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter discount"
                        className="w-24 border border-gray-300 rounded-md px-2 py-1 text-left text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        value={extraDiscount ? extraDiscount : ""}
                        onChange={(e) => handleExtraDiscountChange(e.target.value)}
                    />
                </div>
            )
        },
        {
            label: 'Item Discount',
            value: `${systemSettings?.currency.symbol}${formatWholeAmountDisplay(itemDiscountTotal)}`
        }
    ];

    const summaryFooter = (
        <>
            <hr className="border-gray-200 " />
            <div className="flex justify-between font-bold text-gray-950 ">
                <span>
                    Total <small className='text-xs text-gray-500 font-medium'>(Rounded)</small>
                </span>
                <span>{systemSettings?.currency.symbol}{formatWholeAmountDisplay(syncGrandTotal)}</span>
            </div>
        </>
    );

    const itemsFooter = (
        <div className="flex flex-wrap gap-6 items-center">
            <div ref={quickAddRef} className="relative flex-1 min-w-[320px]">
                <input
                    ref={quickAddInputRef}
                    type="text"
                    autoFocus
                    value={quickAddSearch}
                    onChange={(e) => {
                        setQuickAddSearch(e.target.value);
                        setShowQuickAdd(true);
                        setQuickAddActiveIndex(0);
                    }}
                    onFocus={() => setShowQuickAdd(true)}
                    onKeyDown={handleQuickAddKeyDown}
                    placeholder="Search by design no. or brand..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
                {showQuickAdd && (
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
                                        key={`quick-variant-${entry.product.id}-${entry.variant._id}`}
                                        className={`p-2 pl-6 cursor-pointer hover:bg-third ${index === quickAddActiveIndex ? "bg-third" : ""}`}
                                        onClick={() => {
                                            setPendingDetailsItem({
                                                type: 'quick-add',
                                                item: {
                product_code: entry.product.code,
                name: entry.variant.name || entry.product.name,
                                                    qty: 1,
                                                    rate: entry.variant.sale_price || 0,
                                                    discount: entry.variant.discount_value || 0
                                                },
                                                product: entry.product,
                                                variant: entry.variant
                                            });
                                            setIsProductDetailsModalOpen(true);
                                            setShowQuickAdd(false);
                                        }}
                                    >
                                        <div className="text-sm text-gray-800">
                                            {label || "Variant"} - {systemSettings?.currency.symbol || ""}{entry.variant.sale_price ?? 0}
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                )}
            </div>
        </div>
    );

    const extraInfoConfig = {
        title: 'Extra Information',
        tabs: [
            {
                id: 'notes',
                label: 'Add Notes',
                content: (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Additional Notes</label>
                        <textarea value={quotationFormData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} rows={4} placeholder="Enter Notes" className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                    </div>
                )
            },
            {
                id: 'termsAndCondition',
                label: 'Add Terms & Conditions',
                content: (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Terms & Conditions</label>
                        <textarea value={quotationFormData.termsAndCondition} onChange={(e) => handleFormChange('termsAndCondition', e.target.value)} rows={4} placeholder="Enter Terms & Conditions" className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                    </div>
                )
            }
        ],
        activeTabId: activeInfoTab,
        onTabChange: (id: string) => setActiveInfoTab(id as 'notes' | 'termsAndCondition')
    };

    const headerFields = [
        <div key="expiry" className="w-full">
            <DateInput
                label="Expiry Date"
                value={quotationFormData.expiryDate}
                onChange={(newDate) => handleFormChange('expiryDate', newDate)}
                minDate={new Date()}
            />
            {formErrors?.quotationDate && <span className="text-red-500 text-sm">{formErrors.quotationDate}</span>}
        </div>,
        <div key="sales" className="w-full">
            <label className="block text-sm font-medium text-gray-700 ">Sales Person</label>
            <SmartDropdown
                items={salesPersons}
                value={salesPersonSearchInput}
                onChange={(keyword) => setSalesPersonSearchInput(keyword)}
                onSelect={(staff) => handleSalesPersonSelect(staff as OptionType)}
                placeholder='Search and select'
                selectedItem={salesPersons.find(staff => staff.id === quotationFormData.salesPerson) || null}
                loading={fetchingSalesPersons}
            />
        </div>,
        <div key="billTo" className="w-full">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                    Bill To <span className="text-red-500">*</span>
                </label>
                <button
                    type='button'
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="flex items-center text-xs text-primary font-semibold cursor-pointer"
                >
                    <PlusCircle className="h-3 w-3 mr-0.5" />
                    New Customer
                </button>
            </div>
            <SmartDropdown
                items={customerDropdownItems}
                value={customerSearchInput}
                onChange={handleCustomerSearchChange}
                onSelect={(item) => {
                    const fullCustomer = customers.find(c => c.id === item?.id);
                    handleCustomerChange(fullCustomer || null);
                }}
                onAddNew={() => setIsCustomerModalOpen(true)}
                selectedItem={customerDropdownItems.find((customer) => customer.id === selectedCustomer?.id) || null}
                addNewLabel='New Customer'
                placeholder='Type to search customer'
                showItemDetails
            />
            {formErrors?.billTo && <span className="text-red-500 text-sm">{formErrors.billTo}</span>}
            {selectedCustomer && customerDetails && (
                <div className="mt-2">
                    <CustomerCard
                        name={customerDetails.name}
                        phone={customerDetails.phone}
                        email={customerDetails.email}
                        variant="detailed"
                        address={[
                            customerDetails.billingAddress?.addressLine1,
                            customerDetails.billingAddress?.addressLine2,
                            customerDetails.billingAddress?.city,
                            customerDetails.billingAddress?.state,
                            customerDetails.billingAddress?.pincode,
                        ].filter(Boolean).join(', ')}
                    />
                </div>
            )}
        </div>
    ];

    const titleActions = !isEditMode ? (
        <button
            type="button"
            onClick={() => setShowAiQuotationScanModal(true)}
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
        >
            <FileSearch className="h-4 w-4" />
            Scan Quotation
        </button>
    ) : null;

    const footerButtons = (
        <div className="flex justify-end mt-4 gap-3">
            <button type='button' onClick={() => navigate('/admin/quotations')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50    cursor-pointer">Cancel</button>
            {isEditMode ? (
                <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-950 focus:outline-none flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={isSaving}
                    onClick={handleUpdateQuotation}
                >
                    Update Quotation
                </button>
            ) : (
                <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-950 focus:outline-none flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={isSaving}
                    onClick={handleSaveAndSend}
                >
                    <Mail size={16} />
                    Save & Send
                </button>
            )}
        </div>
    );
    return (
        <>
            <InvoiceFormLayout
                title={isEditMode ? "Edit Quotation" : "New Quotation"}
                titleActions={titleActions}
                logoSrc={systemSettings?.company.siteLogo}
                onSubmit={() => { }}
                dateField={{
                    label: 'Quotation Date',
                    value: quotationFormData.quotationDate,
                    onChange: (newDate) => handleFormChange('quotationDate', newDate),
                    inputNode: (
                        <>
                            <DateInput
                                label="Quotation Date"
                                value={quotationFormData.quotationDate}
                                onChange={(newDate) => handleFormChange('quotationDate', newDate)}
                                minDate={new Date()}
                                isRequired
                            />
                            {formErrors?.quotationDate && <span className="text-red-500 text-sm">{formErrors.quotationDate}</span>}
                        </>
                    )
                }}
                taxTypeField={<TaxTypeSelector />}
                headerFields={headerFields}
                itemsError={formErrors?.items}
                items={quotationFormData.items}
                renderRow={(item, index) => (
                    <InvoiceTableRow
                        key={item.id}
                        index={index}
                        item={item}
                        currencySymbol={systemSettings?.currency.symbol ?? '$'}
                        onInLineItemChange={(updatedItem) => handleInLineItemChange(updatedItem, item.id)}
                        onEditItem={handleEditItem}
                        onDeleteItem={handleRemoveItem}
                        availableItems={quotationFormData.items}
                        addNewProduct={handleNewProductClick}
                        selectedStaffId={quotationFormData.salesPerson || null}
                        selectedStaffName={salesPersons.find(staff => staff.id === quotationFormData.salesPerson)?.name || null}
                    />
                )}
                showAddRow={false}
                showScanBarcode={false}
                itemsFooter={itemsFooter}
                extraInfo={extraInfoConfig}
                summaryRows={summaryRows}
                summaryFooter={summaryFooter}
                totalInWords={syncTotalInWords}
                footerButtons={footerButtons}
                taxHeaderLabel={taxHeaderLabel}
                currencySymbol={systemSettings?.currency.symbol ?? '$'}
            />


            <ProductDetailsModal
                title={pendingDetailsItem?.type === "edit" ? "Edit Item" : "Add Item"}
                isOpen={isProductDetailsModalOpen}
                onClose={handleCloseProductDetails}
                onSave={handleSaveProductDetails}
                item={pendingDetailsItem?.item || null}
                currencySymbol={systemSettings?.currency.symbol ?? '$'}
            />

            <CreateProductForm
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSuccess={(newProduct: Product) => handleNewProductCreated(newProduct)}
            />

            <CreateCustomerForm
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={(newCustomer: Customer) => {
                    setCustomers(prevCustomers => [newCustomer, ...prevCustomers]);
                    setCustomerDropdownItems(prev => [
                        { id: newCustomer.id, name: newCustomer.name || newCustomer.phone || 'Customer', subLabel: newCustomer.phone },
                        ...prev
                    ]);
                    handleCustomerChange(newCustomer);
                    setCustomerSearchInput(newCustomer.phone || '');
                    setIsCustomerModalOpen(false);
                }}
            />

            <AiDocumentScanModal
                isOpen={showAiQuotationScanModal}
                onClose={() => setShowAiQuotationScanModal(false)}
                type="quotation"
                onApply={applyAiQuotationExtraction}
            />

            {isFetching && <FullPageLoader />}
            {isLoadingQuotation && <FullPageLoader />}
        </>
    );

};

export default CreateNewQuotation;
