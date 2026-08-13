import React, { useEffect, useState, useMemo } from 'react';
import { PlusCircle, Eye, EyeOff } from 'lucide-react';
import DateInput from '@components/admin/DateInput';
import axios from 'axios';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import { useDebounce } from '@hooks/useDebounce';
import Modal from '@components/admin/Modal';
import { numberToWords } from '@utils/converters';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import CustomerCard from '@components/admin/CustomerCard';
import AdminCard from '@components/admin/AdminCard';
import FullPageLoader from '@components/admin/FullPageLoader';
import SubmitButton from '@components/admin/SubmitButton';
import type { OptionType, SelectedAdmin } from '@models/common';
import type { Customer } from '@models/customer';
import type { Product, ProductItem } from '@models/product';
import CreateProductForm from '@components/admin/CreateProductForm';
import CreateCustomerForm from '@components/admin/CreateCustomerForm';
import SmartDropdown from '@components/admin/SmartDropdown';
import InvoiceTableRow from '@components/admin/InvoiceTableRow';
import ProductItemsSummaryFooter from '@components/admin/ProductItemsSummaryFooter';

interface InvoiceFormData {
    invoiceId: string;
    challanDate: Date | null;
    status: string;
    billFrom: string;
    billTo: string;
    items: ProductItem[];
    notes: string;
    termsAndCondition: string;
    subTotal: number | null;
    totalTax: number | null;
    totalDiscount: number | null;
    grandTotal: number | null;
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

const NewDeliveryChallan: React.FC = () => {
    const navigate = useNavigate();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [adminUsers, setAdminUsers] = useState<OptionType[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearchInput, setCustomerSearchInput] = useState<string>('');
    const debouncedSearchTermCustomer = useDebounce(customerSearchInput, 500);
    const [invoiceOptions, setInvoiceOptions] = useState<OptionType[]>([]);
    const [invoiceSearchInput, setInvoiceSearchInput] = useState<string>('');
    const debouncedSearchTermInvoice = useDebounce(invoiceSearchInput, 500);
    const [selectedAdmin, setSelectedAdmin] = useState<OptionType | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [companyDetails, setCompanyDetails] = useState<SelectedAdmin | null>(null);
    const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
    const [invoiceFormData, setInvoiceFormData] = useState<InvoiceFormData>({
        invoiceId: '',
        challanDate: new Date(),
        status: 'PENDING',
        billFrom: '',
        billTo: '',
        items: [],
        notes: '',
        termsAndCondition: '',
        subTotal: null,
        totalTax: null,
        totalDiscount: null,
        grandTotal: null
    });

    const invoiceStatuses = [
        { id: 'PENDING', name: 'Pending' },
        { id: 'DELIVERED', name: 'Delivered' },
        { id: 'CANCELLED', name: 'Cancelled' }
    ]

    // Edit Modal State
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
    const [taxes, setTaxes] = useState<taxGroup[]>([]);

    // Extra Information State
    const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'termsAndCondition'>('notes');
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [adminSearchInput, setAdminSearchInput] = useState<string>('');
    const [showExtraInfo, setShowExtraInfo] = useState(true);
    const [selectedStaffId] = useState<string | null>(null);
    const [selectedStaffName] = useState<string | null>(null);
    useEffect(() => {
        fetchAdminUsers();
        fetchTaxes();
    }, []);

    const handleInvoiceChange = async (option: OptionType) => {
        try {
            setIsFetching(true);
            const response = await axios.get(`${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${option.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const invoice_data = response.data.data;
            if (invoice_data) {
                setInvoiceFormData((prev) => ({
                    ...prev,
                    invoiceId: invoice_data.id,
                    billFrom: invoice_data.billFrom.id,
                    billTo: invoice_data.billTo.id,
                    items: invoice_data.items,
                    notes: invoice_data.notes,
                    termsAndCondition: invoice_data.termsAndCondition,
                    subTotal: invoice_data.taxableAmount,
                    totalTax: invoice_data.vat,
                    totalDiscount: invoice_data.totalDiscount,
                    grandTotal: invoice_data.TotalAmount
                }));
                if (invoice_data.billFrom) {
                    let _admin = { id: invoice_data.billFrom.id, name: invoice_data.billFrom.name };
                    handleAdminChange(_admin);
                }
                if (invoice_data.billTo) {
                    let _customer = {
                        id: invoice_data.billTo.id,
                        name: invoice_data.billTo.name,
                        email: invoice_data.billTo.email,
                        phone: invoice_data.billTo.phone,
                        image: invoice_data.billTo.image
                    };
                    handleCustomerChange(_customer as any);
                }
            }
        } catch (error) {

        } finally {
            setIsFetching(false);
        }
    }

    useEffect(() => {
        const fetchInvoicesQuery = async () => {
            try {
                const response = await axios.post(
                    Constants.SEARCH_INVOICES_FOR_DELIVERY_CHALLAN_URL,
                    { search: debouncedSearchTermInvoice || "" },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                const data = response.data.data;
                if (data) {
                    const formattedOptions = data.map((invoice: any) => ({
                        id: invoice.id,
                        name: invoice.invoiceNumber
                    }));
                    setInvoiceOptions(formattedOptions || []);
                } else {
                    setInvoiceOptions([]);
                }

            } catch (error) {
                console.error("Error fetching invoices:", error);
            }
        };

        fetchInvoicesQuery();
    }, [debouncedSearchTermInvoice, token]);


    const fetchTaxes = async () => {
        if (!token) return;
        try {
            const response = await axios.get(Constants.FETCH_TAX_GROUP_LIST_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const payload = response.data?.data;
            const taxGroups = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];
            setTaxes(taxGroups);
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
            setInvoiceFormData(prev => ({ ...prev, billFrom: user.id }));
            setCompanyDetails(response.data.data);
        } catch (error) {
            setCompanyDetails(null);
            setSelectedAdmin(null);
            setInvoiceFormData(prev => ({ ...prev, billFrom: '' }));
        } finally {
            setIsFetching(false);
        }
    };

    const handleCustomerChange = async (user: Customer) => {
        if (user) {
            setSelectedCustomer(user);
            setInvoiceFormData(prev => ({ ...prev, billTo: user.id }));
            setCustomerDetails(user);
        } else {
            setSelectedCustomer(null);
            setInvoiceFormData(prev => ({ ...prev, billTo: '' }));
        }
    };

    // --- ITEM & FORM HANDLERS ---
    const handleFormChange = (field: keyof InvoiceFormData, value: any) => {
        setInvoiceFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleRemoveItem = (itemToRemove: ProductItem) => {
        handleFormChange('items', invoiceFormData.items.filter(item => item.id !== itemToRemove.id));
    };

    const handleEditItem = (itemToEdit: ProductItem) => {
        setEditingItem({ ...itemToEdit });
        setIsEditProductModalOpen(true);
    };

    const handleEditingItemChange = (field: keyof ProductItem, value: string | number) => {
        setEditingItem(prev => {
            if (!prev) return null;

            const fieldsToNumber = ['qty', 'rate', 'discount_value'];

            const newValue = fieldsToNumber.includes(field as string)
                ? Number(value) || 0
                : value;

            const updatedItem = { ...prev, [field]: newValue };

            const { qty, rate, discount_value, discount_type, tax_group_id } = updatedItem;

            const subtotal = qty * rate;

            const discountAmount = discount_type === 'Percentage'
                ? (subtotal * (discount_value || 0)) / 100
                : (discount_value || 0);

            const discountedSubtotal = subtotal - discountAmount;

            const selectedTaxGroup = taxes.find(t => String(t._id) === String(tax_group_id));
            const taxRate = selectedTaxGroup?.total_tax_rate || 0;
            const taxPerUnit = (rate * taxRate) / 100;

            const totalTax = taxPerUnit * qty;

            const newAmount = discountedSubtotal + totalTax;

            return {
                ...updatedItem,
                discount: discountAmount,
                discount_type: discount_type || 'Fixed',
                tax: totalTax,
                amount: newAmount
            };
        });
    };


    const handleUpdateItem = () => {
        if (!editingItem) return;
        const updatedItems = invoiceFormData.items.map(item =>
            item.id === editingItem.id ? editingItem : item
        );
        handleFormChange('items', updatedItems);
        setIsEditProductModalOpen(false);
        setEditingItem(null);
    };

    // --- DYNAMIC CALCULATIONS ---
    const { subTotal, totalTax, totalDiscount, grandTotal } = useMemo(() => {
        const totals = invoiceFormData.items.reduce((acc, item) => {
            acc.subTotal += item.rate * item.qty;
            acc.totalDiscount += item.discount;
            acc.totalTax += item.tax;
            return acc;
        }, { subTotal: 0, totalTax: 0, totalDiscount: 0 });
        let grand_total = totals.subTotal - totals.totalDiscount + totals.totalTax;
        const grandTotalInteger = Math.round(grand_total);
        setInvoiceFormData(prev => ({ ...prev, subTotal: totals.subTotal, totalTax: totals.totalTax, totalDiscount: totals.totalDiscount, grandTotal: grandTotalInteger }));
        return { ...totals, grandTotal: grandTotalInteger };
    }, [invoiceFormData.items]);

    const totalInWords = useMemo(() => {
        if (grandTotal <= 0) return 'Zero';
        const grandTotalInteger = Math.round(grandTotal);
        return numberToWords(grandTotalInteger);
    }, [grandTotal]);

    const fetchAdminUsers = async () => {
        if (adminUsers.length > 0 && selectedAdmin) return;
        if (user?.id) {
            const defaultAdmin = {
                id: user.id,
                name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || user.email || "Admin"
            };
            setAdminUsers([defaultAdmin]);
            if (!selectedAdmin || selectedAdmin.id !== defaultAdmin.id) {
                setSelectedAdmin(defaultAdmin);
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
                const formattedUsers = list.map((user: any) => ({ id: user.id, name: `${user.firstName} ${user.lastName}` }));
                setAdminUsers(formattedUsers);
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
                    setCustomers(response.data.data.customers);
                } else {
                    setCustomers([]);
                }
            } catch (error) {
                console.error('Error fetching customers:', error);
            }
        }
        fetchCustomersByQuery();
    }, [debouncedSearchTermCustomer, token]);

    const handleInLineItemChange = (product: ProductItem, rowId: string) => {
        //do calculations
        const { qty, rate, discount_value, discount_type, tax_group_id } = product;
        const subtotal = qty * rate;

        const discountAmount = discount_type === 'Percentage'
            ? (subtotal * (discount_value || 0)) / 100
            : (discount_value || 0);

        const discountedSubtotal = subtotal - discountAmount;

        const selectedTaxGroup = taxes.find(t => String(t._id) === String(tax_group_id));
        const taxRate = selectedTaxGroup?.total_tax_rate || 0;
        const taxPerUnit = (rate * taxRate) / 100;

        const totalTax = taxPerUnit * qty;

        const newAmount = discountedSubtotal + totalTax;
        const updatedProduct = { ...product, discount: discountAmount, tax: totalTax, amount: newAmount };
        setInvoiceFormData((prev) => ({
            ...prev,
            items: prev.items.map(item => item.id === rowId ? updatedProduct : item)
        }));
    }

    const handleInvoiceSelect = (invoice: OptionType) => {
        const _invoiceId = invoice?.id || '';
        setInvoiceFormData((prevState) => ({
            ...prevState,
            invoiceId: _invoiceId
        }));

        if (_invoiceId) {
            handleInvoiceChange(invoice);
        }
    }
    const handleNewProductCreated = (product: Product) => {
        const discount_type = product.discount?.type;
        const discount_value = product.discount?.value;
        const subtotal = product.prices?.selling ?? 0;
        const rate = product.prices?.selling ?? 0;
        const discountAmount = discount_type === 'Percentage'
            ? (subtotal * (discount_value || 0)) / 100
            : (discount_value || 0);
        const taxRate = product.tax?.total_rate ?? 0;
        const taxPerUnit = (rate * taxRate) / 100;

        const totalTax = taxPerUnit * 1;
        const discountedSubtotal = subtotal - discountAmount;
        const newAmount = discountedSubtotal + totalTax;

        let updated = false;
        setInvoiceFormData((prev) => ({
            ...prev,
            items: prev.items.map(item => {
                if (!updated && item.name === "") {
                    updated = true;
                    return {
                        ...item,
                        id: product.id,
                        name: product.name,
                        unit: product.unit?.name ?? '',
                        qty: 1,
                        rate: product.prices?.selling ?? 0,
                        amount: newAmount,
                        discount: discountAmount,
                        tax: totalTax,
                        tax_group_id: product.tax?.group_id,
                        discount_type: product.discount?.type,
                        discount_value: product.discount?.value,
                    }
                }
                return item;
            })
        }));
        setIsProductModalOpen(false);
    }
    const handleNewRow = () => {
        const newId = crypto.randomUUID();
        setInvoiceFormData((prev) => ({
            ...prev,
            items: [...prev.items, {
                id: newId,
                product_id: '',
                name: '',
                hsn_code: '',
                unit: '',
                qty: 1,
                rate: 0,
                discount: 0,
                tax: 0,
                tax_group_id: null,
                discount_type: 'Fixed',
                discount_value: 0,
                amount: 0,
                staffId: selectedStaffId || null,
                staffName: selectedStaffName || ''
            }]
        }));
    }
    const validateChallanData = () => {
        const newErrors: { [key: string]: string } = {};
        //order date required
        if (!invoiceFormData.challanDate) newErrors.challanDate = 'Delivery date is required.';
        //status required
        if (!invoiceFormData.status.trim()) newErrors.status = 'Status is required.';

        //billFrom required
        if (!invoiceFormData.billFrom.trim()) newErrors.billFrom = 'Bill from is required.';
        //billTo required
        if (!invoiceFormData.billTo.trim()) newErrors.billTo = 'Bill to is required.';
        //atleast 1 item required
        const hasItemPopulated = invoiceFormData.items.some(item => item.name.trim() !== '');
        if (!hasItemPopulated) newErrors.items = 'At least one item is required.';
        setFormErrors(newErrors);
        return newErrors;
    }
    const saveDeliveryChallan = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors = validateChallanData();
        console.log('errors', errors);
        if (Object.keys(errors).length > 0) {
            const firstErrorField = Object.keys(errors)[0];
            const firstErrorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLInputElement | null;
            firstErrorElement?.focus();
            return;
        }

        const formData = new FormData();

        for (const [key, value] of Object.entries(invoiceFormData)) {
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, "0");
                const day = String(value.getDate()).padStart(2, "0");

                formData.append(key, `${year}-${month}-${day}`);
            } else if (Array.isArray(value) && key === 'items') {
                value.forEach((item, index) => {
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

        try {
            setIsSaving(true);
            await axios.post(`${Constants.CREATE_DELIVERY_CHALLAN_URL}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            toast.success('Delivery Challan created successfully.');
            navigate('/admin/delivery-challans');
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

    return (
        <div className="md:p-4 bg-white-50 min-h-screen border border-gray-200 rounded">
            <form onSubmit={saveDeliveryChallan}>
                <div className="max-w-7xl mx-auto space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-2xl font-bold text-gray-950 ">New Delivery Challan</h1>
                        <img src={systemSettings?.company.siteLogo} alt="" className='w-32 h-auto' />
                    </div>
                    {/* Top Section: PO Details & Logo */}
                    <div className="w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                            <div className='w-full flex flex-col justify-end'>
                                <label htmlFor="" className="block text-sm font-medium text-gray-700 ">Invoice </label>
                                <SmartDropdown
                                    items={invoiceOptions}
                                    placeholder='Search and select invoice'
                                    value={invoiceSearchInput}
                                    onChange={(keyword) => setInvoiceSearchInput(keyword)}
                                    onSelect={(option) => handleInvoiceSelect(option as OptionType)}
                                    selectedItem={invoiceOptions.find(option => option.id === invoiceFormData.invoiceId) || null}
                                />
                                {invoiceFormData.invoiceId && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/admin/delivery-challans/exchange/${invoiceFormData.invoiceId}`)}
                                        className="mt-2 text-xs font-semibold text-primary hover:underline self-start"
                                    >
                                        Exchange items for this invoice
                                    </button>
                                )}
                                {formErrors?.invoiceId && <span className="text-red-500 text-sm">{formErrors.invoiceId}</span>}
                            </div>
                            <div className="w-full">
                                <DateInput
                                    label="Delivery Date"
                                    value={invoiceFormData.challanDate}
                                    onChange={(newDate) => handleFormChange('challanDate', newDate)}
                                    isRequired
                                />
                                {formErrors?.challanDate && <span className="text-red-500 text-sm">{formErrors.challanDate}</span>}
                            </div>
                            <div className="w-full">
                                <label className="block text-sm font-medium text-gray-700 ">
                                    Status <em className='text-red-500'>*</em>
                                </label>
                                <SearchableDropdown
                                    placeholder="Select Status"
                                    options={invoiceStatuses}
                                    value={
                                        invoiceStatuses.find(
                                            (option) => option.id === invoiceFormData.status
                                        ) || null
                                    }
                                    onChange={(_, value) => { handleFormChange('status', value?.id || null) }}
                                />
                                {formErrors?.status && <span className="text-red-500 text-sm">{formErrors.status}</span>}
                            </div>
                        </div>
                    </div>
                    {/* Billing Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white  p-4 rounded-lg border border-gray-200 ">
                            <h3 className="font-bold text-gray-950 ">Bill From <span className='text-red-500'>*</span></h3>
                            <div className="mt-4">
                                <SmartDropdown
                                    items={adminUsers}
                                    value={adminSearchInput}
                                    onChange={setAdminSearchInput}
                                    onSelect={(item) => handleAdminChange(item as OptionType)}
                                    selectedItem={selectedAdmin}
                                    placeholder="Type to search..."
                                    serverside={false}
                                />
                                {!selectedAdmin && formErrors?.billFrom && <span className="text-red-500 text-sm">{formErrors.billFrom}</span>}
                                {!selectedAdmin && <p className="mt-2 text-xs text-gray-500  p-2 bg-gray-50  rounded-md font-semibold">
                                    Select admin to view company details.
                                </p>}
                                {/* spacer */}
                                <div className="h-4"></div>
                                {selectedAdmin && companyDetails && (
                                    <AdminCard
                                        logoUrl={companyDetails.siteLogo}
                                        companyName={companyDetails.companyName}
                                        city={companyDetails.city?.name}
                                        state={companyDetails.state?.name}
                                        address={companyDetails.address}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="bg-white  p-4 rounded-lg border border-gray-200 ">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-gray-950 ">Bill To <span className='text-red-500'>*</span></h3>
                            </div>
                            <div className="mt-4">
                                <SmartDropdown
                                    items={customers}
                                    value={customerSearchInput}
                                    onChange={setCustomerSearchInput}
                                    onSelect={(selectedCustomer) => handleCustomerChange(selectedCustomer as Customer)}
                                    onAddNew={() => setIsCustomerModalOpen(true)}
                                    selectedItem={customers.find((customer) => customer.id === selectedCustomer?.id) || null}
                                    addNewLabel='New Customer'
                                    placeholder='Type to search customer'
                                />
                                {!selectedCustomer && formErrors?.billTo && <span className="text-red-500 text-sm">{formErrors.billTo}</span>}
                                {!selectedCustomer && <p className="mt-2 text-xs text-gray-500  p-2 bg-gray-50  rounded-md font-semibold">
                                    Select customer to view customer details
                                </p>}
                                {/* spacer */}
                                <div className="h-4"></div>
                                {selectedCustomer && customerDetails && (
                                    <CustomerCard
                                        name={customerDetails.name}
                                        phone={customerDetails.phone}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Invoice Items */}

                <div className="bg-white  rounded-lg border border-gray-200 ">
                    <div className="p-4">
                        {formErrors?.items && <span className="text-red-500 text-sm">{formErrors.items}</span>}
                        <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0 overflow-x-auto">
                            <colgroup>
                                <col className="w-[4rem]" />
                                <col className="w-[27%]" />
                                <col className="w-[12%]" />
                                <col className="w-[9%]" />
                                <col className="w-[9%]" />
                                <col className="w-[9%]" />
                                <col className="w-[9%]" />
                                <col className="w-[7%]" />
                                <col className="w-[12%]" />
                                <col className="w-[6rem]" />
                            </colgroup>
                            <thead className="bg-gray-950 text-white">
                                <tr>
                                    <th className="p-3 text-left text-sm font-semibold rounded-tl-md w-12">S.No.</th>
                                    <th className="p-3 text-left text-sm font-semibold">Product / Service</th>
                                    <th className="p-3 text-left text-sm font-semibold">Color / Size</th>
                                    <th className="p-3 text-left text-sm font-semibold">Quantity</th>
                                    <th className="p-3 text-left text-sm font-semibold">Rate</th>
                                    <th className="p-3 text-left text-sm font-semibold">Discount</th>
                                    <th className="p-3 text-left text-sm font-semibold">Tax</th>
                                    <th className="p-3 text-left text-sm font-semibold">Staff</th>
                                    <th className="p-3 text-left text-sm font-semibold">Amount</th>
                                    <th className="p-3 text-left text-sm font-semibold rounded-tr-md">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceFormData.items.map((item, index) => (
                                    <InvoiceTableRow
                                        key={item.id}
                                        index={index}
                                        item={item}
                                        currencySymbol={systemSettings?.currency.symbol ?? '$'}
                                        onInLineItemChange={(updatedItem) => handleInLineItemChange(updatedItem, item.id)}
                                        onEditItem={handleEditItem}
                                        onDeleteItem={handleRemoveItem}
                                        availableItems={invoiceFormData.items}
                                        addNewProduct={handleNewProductClick}
                                        selectedStaffId={selectedStaffId}
                                        selectedStaffName={selectedStaffName}
                                    />
                                ))}
                                {invoiceFormData.items.length === 0 && (
                                    <tr className="bg-white  text-gray-950 ">
                                        <td className="p-3 font-medium text-center" colSpan={10}>
                                            No Items Selected
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <ProductItemsSummaryFooter
                            items={invoiceFormData.items}
                            columns={["serial", "label", "colorSize", "quantity", "rate", "discount", "tax", "staff", "amount", "action"]}
                            currencySymbol={systemSettings?.currency.symbol ?? '$'}
                            colClassNames={["w-[4rem]", "w-[27%]", "w-[12%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[7%]", "w-[12%]", "w-[6rem]"]}
                        />
                        {/* Add New Product */}
                        <div className="p-4 flex">
                            <button type='button' onClick={() => handleNewRow()} className="flex items-center text-sm text-primary  font-semibold">
                                <PlusCircle className="h-4 w-4 mr-1" />
                                Add New Row
                            </button>
                        </div>
                    </div>
                </div>
                <Modal isOpen={isEditProductModalOpen} onClose={() => setIsEditProductModalOpen(false)} title={`Edit: ${editingItem?.name}`}>
                    {editingItem && (
                        <div className="p-4 space-y-4">
                            <div>
                                <label htmlFor="edit-qty" className="block text-sm font-medium text-gray-700 ">Quantity</label>
                                <input
                                    type="number"
                                    id="edit-qty"
                                    min="1"
                                    step="1"
                                    value={editingItem.qty}
                                    onChange={(e) => handleEditingItemChange('qty', e.target.value)}
                                    className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-rate" className="block text-sm font-medium text-gray-700 ">Rate ({systemSettings?.currency.symbol})</label>
                                <input
                                    type="number"
                                    id="edit-rate"
                                    min="0"
                                    value={editingItem.rate}
                                    onChange={(e) => handleEditingItemChange('rate', e.target.value)}
                                    className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>
                            {/* Discount Type */}
                            <div>
                                <label htmlFor="edit-discount-type" className="block text-sm font-medium text-gray-700 ">Discount Type</label>
                                <select
                                    id="edit-discount-type"
                                    className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    value={editingItem.discount_type}
                                    onChange={(e) => handleEditingItemChange('discount_type', e.target.value)}
                                >
                                    <option value="Fixed">Fixed</option>
                                    <option value="Percentage">Percentage</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="edit-discount" className="block text-sm font-medium text-gray-700 ">Discount Amount ({systemSettings?.currency.symbol})</label>
                                <input
                                    type="number"
                                    id="edit-discount"
                                    min="0"
                                    value={editingItem.discount_value || 0}
                                    onChange={(e) => handleEditingItemChange('discount_value', e.target.value)}
                                    className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-tax-select" className="block text-sm font-medium text-gray-700 ">Apply Tax Group</label>
                                <select
                                    id="edit-tax-select"
                                    data-tax-group={editingItem.tax_group_id}
                                    className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    value={editingItem.tax_group_id || ''}
                                    onChange={(e) => {
                                        const selectedTaxGroup = taxes.find(t => t._id === e.target.value);
                                        if (selectedTaxGroup) {
                                            const newTaxAmount = (editingItem.rate * selectedTaxGroup.total_tax_rate) / 100;
                                            handleEditingItemChange('tax', newTaxAmount);
                                            handleEditingItemChange('tax_group_id', String(selectedTaxGroup._id));
                                        } else {
                                            handleEditingItemChange('tax', 0);
                                            handleEditingItemChange('tax_group_id', '');
                                        }
                                    }}
                                >
                                    <option value="">None</option>
                                    {taxes.map(taxGroup => (
                                        <option key={taxGroup._id} value={taxGroup._id}>
                                            {taxGroup.tax_name} ({taxGroup.total_tax_rate}%)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2">
                                <p className="text-lg font-semibold text-gray-950 ">
                                    New Amount: {systemSettings?.currency.symbol}{editingItem.amount.toFixed(2)}
                                </p>
                            </div>

                            <div className="flex justify-end gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditProductModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50   "
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdateItem}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-gray-950"
                                >
                                    Update Item
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    {/* Left: Extra Information */}
                    <div className="bg-white p-2 rounded-lg border border-gray-200">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-gray-950">
                                    Extra Information
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowExtraInfo(!showExtraInfo)}
                                    className="text-gray-600 hover:text-primary transition-colors p-1"
                                    title={showExtraInfo ? "Hide section" : "Show section"}
                                >
                                    {showExtraInfo ? <Eye size={20} /> : <EyeOff size={20} />}
                                </button>
                            </div>
                            {showExtraInfo && (
                                <>
                                    <div className="flex items-center gap-2 mb-4">
                                        <button type='button' onClick={() => setActiveInfoTab('notes')} className={`px-4 py-2 text-sm cursor-pointer font-medium rounded-md ${activeInfoTab === 'notes' ? 'bg-primary text-white' : 'bg-gray-200  text-gray-700 '}`}>Add Notes</button>
                                        <button type='button' onClick={() => setActiveInfoTab('termsAndCondition')} className={`px-4 py-2 text-sm cursor-pointer font-medium rounded-md ${activeInfoTab === 'termsAndCondition' ? 'bg-primary text-white' : 'bg-gray-200  text-gray-700 '}`}>Add Terms & Conditions</button>
                                    </div>

                                    {activeInfoTab === 'notes' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 ">Additional Notes</label>
                                            <textarea value={invoiceFormData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} rows={4} placeholder="Enter Notes" className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                                        </div>
                                    )}
                                    {activeInfoTab === 'termsAndCondition' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 ">Terms & Conditions</label>
                                            <textarea value={invoiceFormData.termsAndCondition} onChange={(e) => handleFormChange('termsAndCondition', e.target.value)} rows={4} placeholder="Enter Terms & Conditions" className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"></textarea>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Payment Summary */}
                    <div className="bg-white p-2 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600 "><span>Amount</span><span>{systemSettings?.currency.symbol}{subTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm text-gray-600 "><span>Tax</span><span>{systemSettings?.currency.symbol}{totalTax.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm text-gray-600 "><span>Discount</span><span>- {systemSettings?.currency.symbol}{totalDiscount.toFixed(2)}</span></div>
                        <hr className="border-gray-200 " />
                        <div className="flex justify-between font-bold text-gray-950 "><span>Total <small className='text-xs text-gray-500 font-medium'>(Rounded)</small></span><span>{systemSettings?.currency.symbol}{grandTotal.toFixed(2)}</span></div>
                        <p className="text-sm text-gray-500  capitalize">{totalInWords}</p>
                    </div>
                </div>
                <div className="flex justify-end mt-4 gap-3">
                    <button type='button' onClick={() => navigate('/admin/delivery-challans')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50    cursor-pointer">Cancel</button>
                    <SubmitButton isDisabled={isSaving} isLoading={isSaving} mode='create' />
                </div>

            </form>

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
                    setIsCustomerModalOpen(false);
                }}
            />

            {isFetching && <FullPageLoader />}
        </div>
    );
};

export default NewDeliveryChallan;
