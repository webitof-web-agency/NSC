import DateInput from "@components/admin/DateInput";
import Modal from "@components/admin/Modal";
import SmartDropdown from "@components/admin/SmartDropdown";
import SubmitButton from "@components/admin/SubmitButton";
import Constants from "@constants/api";
import { useDebounce } from "@hooks/useDebounce";
import type { OptionType } from "@models/common";
import type { ExpenseFormData, ExpenseListShape } from "@models/expense";
import type { RootState } from "@store/index";
import axios, { AxiosError } from "axios";
import { forEach } from "lodash";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editItem?: ExpenseListShape
}

const initialFormData = {
    referenceNo: '',
    amount: 0,
    expenseDate: new Date(),
    expenseCategoryId: '',
    sourceType: '',
    bankId: null,
    paymentMode: '',
    paymentStatus: '',
    description: '',
    attachment: null,
    attachmentUrl: null
}

const ExpenseFormModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, editItem }) => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [paymentModeOptions, setPaymentModeOptions] = useState<OptionType[]>([]);
    const [sourceSearchKeyword, setSourceSearchKeyword] = useState('');
    const [bankSearchKeyword, setBankSearchKeyword] = useState('');
    const debouncedSearchTermBankAccount = useDebounce(bankSearchKeyword, 500);
    const [bankAccountOptions, setBankAccountOptions] = useState<OptionType[]>([]);
    const [paymentStatusSearchKeyword, setPaymentStatusSearchKeyword] = useState('');
    const [paymentModeSearchKeyword, setPaymentModeSearchKeyword] = useState('');
    const [categoryOptions, setCategoryOptions] = useState<OptionType[]>([]);
    const [categorySearchKeyword, setCategorySearchKeyword] = useState('');
    const debouncedCategorySearchKeyword = useDebounce(categorySearchKeyword, 500);
    const paymentStatusOptions: OptionType[] = [
        { id: 'PENDING', name: 'Pending' },
        { id: 'PAID', name: 'Paid' },
        { id: 'CANCELLED', name: 'Cancelled' },
    ];
    const paymentSourceSoptions: OptionType[] = [
        { id: 'BANK', name: 'Bank Transfer' },
    ];
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        if (editItem) {
            const editItemData: ExpenseFormData = {
                amount: editItem.amount,
                expenseDate: new Date(editItem.expenseDate),
                expenseCategoryId: editItem.expenseCategory.id,
                sourceType: editItem.sourceType,
                bankId: editItem.bank?.id || null,
                paymentMode: editItem?.paymentMode?.id || null,
                paymentStatus: editItem.paymentStatus,
                description: editItem.description || '',
                attachment: null,
                attachmentUrl: editItem.attachment
            }

            setFormData(editItemData);
        }
        fetchAllPaymentModes();
    }, [editItem]);

    useEffect(() => {
        const fetchExpenseCategories = async () => {
            try {
                const response = await axios.get(Constants.FETCH_EXPENSE_CATEGORIES_WITH_SEARCH_URL, {
                    params: { search: categorySearchKeyword },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.data.length > 0) {
                    const formattedCategories = response.data.data.map((item: any) => {
                        return {
                            id: item.id,
                            name: item.title
                        }
                    });
                    setCategoryOptions(formattedCategories);
                } else {
                    setCategoryOptions([]);
                }
            } catch (error) {
                console.error("Error fetching expense categories:", error);
            }
        }
        fetchExpenseCategories();
    }, [debouncedCategorySearchKeyword]);

    useEffect(() => {
        const fetchBankAccounts = async () => {
            try {
                const response = await axios.get(Constants.FETCH_BANK_ACCOUNTS_WITH_SEARCH_URL, {
                    params: { search: debouncedSearchTermBankAccount },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.data.length > 0) {
                    const formattedBankAccounts = response.data.data.map((item: any) => {
                        let accountNumber = item.accountNumber ?? "";
                        let name = item.accountHoldername ?? "";
                        let bankName = item.bankName ?? "";
                        let formattedBankName = `[${accountNumber}] ${name} - ${bankName}`;
                        return {
                            id: item.id,
                            name: formattedBankName
                        }
                    });
                    setBankAccountOptions(formattedBankAccounts);
                } else {
                    setBankAccountOptions([]);
                }
            } catch (error) {
                console.error("Error fetching bank accounts:", error);
            }
        }
        fetchBankAccounts();
    }, [debouncedSearchTermBankAccount]);

    const fetchAllPaymentModes = async () => {
        try {
            const response = await axios.get(Constants.GET_ALL_PAYMENT_MODES_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data.data) {
                setPaymentModeOptions(response.data.data);
            }
        } catch (error) {

        }
    }

    const handleFormChange = (field: keyof ExpenseFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }

    const handleCategorySelect = (item: OptionType) => {
        if (item) {
            handleFormChange('expenseCategoryId', item.id);
        } else {
            handleFormChange('expenseCategoryId', '');
        }
    }
    const handlePaymentSourceSelect = (item: OptionType) => {
        if (item) {
            handleFormChange('sourceType', item.id);
        } else {
            handleFormChange('sourceType', '');
        }
    }

    const handleBankAccountSelect = (item: OptionType) => {
        if (item) {
            handleFormChange('bankId', item.id);
        } else {
            handleFormChange('bankId', '');
        }
    }

    const handlePaymentStatusSelect = (item: OptionType) => {
        if (item) {
            handleFormChange('paymentStatus', item.id);
        } else {
            handleFormChange('paymentStatus', '');
        }
    }
    const handlePaymentModeSelect = (item: OptionType) => {
        if (item) {
            handleFormChange('paymentMode', item.id);
        } else {
            handleFormChange('paymentMode', '');
        }
    }
    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};
        if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0.';
        if (formData.amount > 100000) newErrors.amount = 'Amount cannot exceed 100,000.';
        if (formData.expenseCategoryId === '') newErrors.expenseCategoryId = 'Category is required.';
        if (formData.expenseDate === null) newErrors.expenseDate = 'Expense date is required.';
        if (formData.sourceType === '') newErrors.sourceType = 'Payment source is required.';
        if (formData.sourceType === 'BANK' && formData.bankId === '') newErrors.bankId = 'Bank account is required.';
        if (formData.sourceType === 'BANK' && formData.paymentMode === '') newErrors.paymentMode = 'Payment mode is required.';
        if (formData.paymentStatus === '') newErrors.paymentStatus = 'Payment status is required.';
        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            setIsSubmitting(true);
            const payload = new FormData();
            forEach(formData, (value, key) => {
                if (value !== null && value !== undefined) {
                    if (key === 'attachment' && value instanceof File) {
                        payload.append(key, value);
                    } else if (key === 'expenseDate' && value instanceof Date) {
                        payload.append(key, value.toISOString());
                    } else {
                        payload.append(key, String(value));
                    }
                }
            });

            if (editItem) {
                await axios.put(`${Constants.UPDATE_EXPENSE_URL}/${editItem.id}`, payload, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                toast.success('Expense updated successfully');
                onSuccess();
            } else {
                await axios.post(Constants.CREATE_NEW_EXPENSE_URL, payload, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                toast.success('Expense created successfully');
                onSuccess();
            }
        } catch (error) {
            const errorResponse = error as AxiosError<{ errors: { [key: string]: string } }>;
            if (errorResponse.response?.data?.errors) {
                console.log(errorResponse.response.data.errors);
                setFormErrors(errorResponse.response.data.errors);
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={editItem ? 'Update Expense' : 'Create New Expense'} size="3xl">
                <form onSubmit={handleSubmit}>
                    {/* Expense Date */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <DateInput
                                label="Expense Date"
                                value={formData.expenseDate || null}
                                onChange={(date) => handleFormChange('expenseDate', date)}
                                isRequired
                            />
                            {formErrors.expenseDate && <p className="text-red-500 text-sm">{formErrors.expenseDate}</p>}
                        </div>
                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 ">Amount <em className="text-red-500">*</em></label>
                            <input type="number" value={formData.amount} onChange={e => handleFormChange('amount', e.target.value)} className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600" />
                            {formErrors.amount && <p className="text-red-500 text-sm">{formErrors.amount}</p>}
                        </div>
                        {/* Category */}
                        <div>
                            <label htmlFor="expenseCategoryId" className="block text-sm font-medium text-gray-700">Category <em className="text-red-500">*</em></label>
                            <SmartDropdown
                                items={categoryOptions}
                                value={categorySearchKeyword}
                                placeholder="Search or Select Category"
                                onChange={(keyword) => setCategorySearchKeyword(keyword)}
                                onSelect={(item) => handleCategorySelect(item as OptionType)}
                                selectedItem={categoryOptions.find(category => category.id === formData.expenseCategoryId) || null}
                            />
                            {formErrors.expenseCategoryId && <p className="text-red-500 text-sm">{formErrors.expenseCategoryId}</p>}
                        </div>
                        {/* Payment Source */}
                        <div>
                            <label htmlFor="sourceType" className="block text-sm font-medium text-gray-700">Payment Source <em className="text-red-500">*</em></label>
                            <SmartDropdown
                                items={paymentSourceSoptions}
                                value={sourceSearchKeyword}
                                placeholder="Search or Select Payment Source"
                                onChange={(keyword) => setSourceSearchKeyword(keyword)}
                                onSelect={(item) => handlePaymentSourceSelect(item as OptionType)}
                                selectedItem={paymentSourceSoptions.find(source => source.id === formData.sourceType) || null}
                                serverside={false}
                            />
                            {formErrors.sourceType && <p className="text-red-500 text-sm">{formErrors.sourceType}</p>}
                        </div>
                        {/* Bank account */}
                        <div className={`${formData.sourceType === 'BANK' ? '' : 'hidden'}`}>
                            <label htmlFor="bankId" className="block text-sm font-medium text-gray-700">Debit From <em className="text-red-500">*</em></label>
                            <SmartDropdown
                                items={bankAccountOptions}
                                value={bankSearchKeyword}
                                placeholder="Search or Select Bank Account"
                                onChange={(keyword) => setBankSearchKeyword(keyword)}
                                onSelect={(item) => handleBankAccountSelect(item as OptionType)}
                                selectedItem={bankAccountOptions.find(bank => bank.id === formData.bankId) || null}
                            />
                            {formErrors.bankId && <p className="text-red-500 text-sm">{formErrors.bankId}</p>}
                        </div>
                        {/* Payment Mode */}
                        <div className={`${formData.sourceType === 'BANK' ? '' : 'hidden'}`}>
                            <label className="block text-sm font-medium text-gray-700 ">Payment Mode <em className="text-red-500">*</em></label>
                            <SmartDropdown
                                items={paymentModeOptions}
                                value={paymentModeSearchKeyword}
                                placeholder="Search or Select Payment Mode"
                                onChange={(keyword) => setPaymentModeSearchKeyword(keyword)}
                                onSelect={(item) => handlePaymentModeSelect(item as OptionType)}
                                selectedItem={paymentModeOptions.find(paymentMode => paymentMode.id === formData.paymentMode) || null}
                                serverside={false}
                            />
                            {formErrors.paymentMode && <p className="text-red-500 text-sm">{formErrors.paymentMode}</p>}
                        </div>
                        {/* Payment Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 ">Payment Status <em className="text-red-500">*</em></label>
                            <SmartDropdown
                                placeholder="Search or Select Payment Status"
                                items={paymentStatusOptions}
                                value={paymentStatusSearchKeyword}
                                onChange={(keyword) => setPaymentStatusSearchKeyword(keyword)}
                                onSelect={(item) => handlePaymentStatusSelect(item as OptionType)}
                                selectedItem={paymentStatusOptions.find(status => status.id === formData.paymentStatus) || null}
                                serverside={false}
                            />
                            {formErrors.paymentStatus && <p className="text-red-500 text-sm">{formErrors.paymentStatus}</p>}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="grid mt-4">
                        <label className="block text-sm font-medium text-gray-700 ">Description</label>
                        <textarea
                            className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            placeholder="Description"
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                        />
                    </div>

                    {/* Attachment / show selected file name */}
                    <div className="grid mt-4">
                        <label className="block text-sm font-medium text-gray-700 ">Attachment</label>
                        <input
                            type="file"
                            className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            onChange={(e) => handleFormChange('attachment', e.target.files?.[0] || null)}
                        />
                        <small className="text-gray-500 text-sm mt-1 font-semibold">{editItem && editItem.attachment && `leave empty if you don't want to change the attachment`}</small>
                    </div>

                    <div className="flex justify-end mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md shadow cursor-pointer mr-2">Cancel</button>
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode={editItem ? 'edit' : 'create'} />
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ExpenseFormModal;
