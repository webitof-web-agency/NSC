import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { useEffect, useState, type FC } from "react";
import axios, { AxiosError } from "axios";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import Modal from "@components/admin/Modal";
import DateInput from "@components/admin/DateInput";
import SubmitButton from "@components/admin/SubmitButton";
import type { OptionType } from "@models/common";
import type { PendingPurchase } from "@models/purchase";
import SmartDropdown from "@components/admin/SmartDropdown";

interface PaymentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}
interface PaymentFormData {
    id?: string;
    purchaseId: string;
    supplierBillNumber?: string;
    supplierId: string;
    referenceNumber: string;
    chequeNumber: string;
    paymentDate: Date | null;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    paymentMode: string | null;
}

interface PurchaseOption extends OptionType {
    supplierName?: string;
    supplierBillNumber?: string;
    purchaseDate?: string;
    subLabel?: string;
}

interface SupplierOption extends OptionType {
    supplierId: string;
}
const initialFormData: PaymentFormData = {
    purchaseId: '',
    supplierBillNumber: '',
    supplierId: '',
    referenceNumber: '',
    chequeNumber: '',
    paymentDate: new Date(),
    amount: 0,
    paidAmount: 0,
    dueAmount: 0,
    paymentMode: null,
}
const PaymentFormModal: FC<PaymentFormModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [formData, setFormData] = useState<PaymentFormData>(initialFormData);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseSupplierSearchKeyword, setPurchaseSupplierSearchKeyword] = useState('');
    const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
    const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
    const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
    const [supplierSearchKeyword, setSupplierSearchKeyword] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOption | null>(null);
    const [paymentModeOptions, setPaymentModeOptions] = useState<OptionType[]>([]);
    const [paymentModeSearchKeyword, setPaymentModeSearchKeyword] = useState('');
    const selectedPaymentMode = paymentModeOptions.find((paymentMode) => paymentMode.id === formData.paymentMode) || null;
    const isChequePayment = (selectedPaymentMode?.name || '').trim().toLowerCase() === 'cheque';

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData);
            setErrors({});
            setSelectedPurchase(null);
            setSelectedSupplier(null);
            setPurchaseSupplierSearchKeyword('');
            setSupplierSearchKeyword('');
        }
        fetchPaymentModes();
    }, [isOpen]);

    const formatPurchaseDate = (value?: string | Date | null) => {
        if (!value) return 'No Date';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'No Date';
        return date.toLocaleDateString('en-IN');
    };

    const fetchPaymentModes = async () => {
        try {
            const response = await axios.get(Constants.GET_ALL_PAYMENT_MODES_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPaymentModeOptions(response.data.data);
        } catch (error) {
            console.error('Error fetching payment modes:', error);
        }
    }

    useEffect(() => {
        const fetchPendingPurchases = async () => {
            try {
                const response = await axios.get(Constants.GET_ALL_PENDING_PURCHASES_URL, {
                    params: { search: purchaseSupplierSearchKeyword.trim() },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                let data = response.data.data;
                if (data) {
                    let formattedOptions = data.map((purchase: PendingPurchase) => {
                        const supplierName = purchase.vendor?.name || 'Unknown Supplier';
                        const purchaseDate = formatPurchaseDate(purchase.purchaseDate);
                        return {
                            id: purchase.id,
                            name: purchase.purchaseId,
                            supplierName,
                            supplierBillNumber: purchase.supplier_bill_number || '',
                            purchaseDate,
                            subLabel: `${supplierName} | ${purchase.purchaseId} | ${purchase.supplier_bill_number || 'No Bill No'} | ${purchaseDate}`,
                        }
                    });
                    setPurchaseOptions(formattedOptions);
                    setPurchases(data);

                    const uniqueSuppliers = new Map<string, SupplierOption>();
                    data.forEach((purchase: PendingPurchase) => {
                        const supplierId = purchase.vendor?.id || '';
                        if (!supplierId || uniqueSuppliers.has(supplierId)) return;
                        uniqueSuppliers.set(supplierId, {
                            id: supplierId,
                            supplierId,
                            name: purchase.vendor?.name || 'Unknown Supplier',
                        });
                    });
                    setSupplierOptions(Array.from(uniqueSuppliers.values()));
                } else {
                    setPurchases([]);
                    setPurchaseOptions([]);
                    setSupplierOptions([]);
                }
            } catch (error) {
                toast.error('Failed to fetch pending purchases.');
            }
        }
        fetchPendingPurchases();
    }, [purchaseSupplierSearchKeyword, token]);

    const filteredSupplierItems = supplierSearchKeyword.trim()
        ? supplierOptions.filter((supplier) =>
            (supplier.name || '').toLowerCase().includes(supplierSearchKeyword.trim().toLowerCase())
        )
        : supplierOptions;

    const pendingPurchaseItems = selectedSupplier
        ? purchaseOptions.filter((purchase) => purchase.id && purchases.find((pendingPurchase) =>
            pendingPurchase.id === purchase.id &&
            pendingPurchase.vendor?.id === selectedSupplier.supplierId
        ))
            .map((purchase) => ({
                ...purchase,
                name: `${purchase.supplierBillNumber || 'No Bill No'} | ${purchase.name || 'No Purchase ID'} | ${purchase.purchaseDate || 'No Date'}`,
                subLabel: '',
            }))
        : [];

    const handleSupplierSelect = (option: SupplierOption | null) => {
        setSelectedSupplier(option);
        setSupplierSearchKeyword(option?.name || '');
        setSelectedPurchase(null);
        setPurchaseSupplierSearchKeyword('');
        setFormData((prev) => ({
            ...prev,
            purchaseId: '',
            supplierId: option?.supplierId || '',
            supplierBillNumber: '',
            referenceNumber: '',
            chequeNumber: '',
            amount: 0,
            paidAmount: 0,
            dueAmount: 0,
        }));
    };

    const handlePurchaseSelect = (option: PurchaseOption | null) => {
        if (option) {
            let selectedPurchase = purchases.find(p => p.id === option.id);
            let newFormData = { ...formData };
            if (selectedPurchase?.payment) {
                newFormData.amount = selectedPurchase?.payment?.dueAmount || 0;
            } else {
                newFormData.amount = selectedPurchase?.totalAmount || 0;
            }
            newFormData.supplierId = selectedPurchase?.vendor?.id || '';
            newFormData.supplierBillNumber = selectedPurchase?.supplier_bill_number || '';
            newFormData.purchaseId = option.id;
            newFormData.referenceNumber = selectedPurchase?.referenceNo || '';
            setSelectedPurchase(option);
            setFormData(prev => ({ ...prev, ...newFormData }));
        } else {
            setSelectedPurchase(null);
            setFormData(prev => ({
                ...prev,
                purchaseId: '',
                supplierId: '',
                supplierBillNumber: '',
                referenceNumber: '',
                chequeNumber: '',
                amount: 0,
                paidAmount: 0,
                dueAmount: 0,
            }));
        }
    }

    const handlePaymentModeSelect = (item: OptionType) => {
        if (item) {
            handleFormChange('paymentMode', item.id);
        } else {
            handleFormChange('paymentMode', null);
        }
    }

    const handleFormChange = (field: keyof PaymentFormData, value: any) => {
        let newFormData = { ...formData, [field]: value };

        if (field === 'purchaseId') {
            const selectedPurchase = purchases.find(p => p.id === value);
            if (selectedPurchase?.payment) {
                newFormData.amount = selectedPurchase?.payment?.dueAmount || 0;
            } else {
                newFormData.amount = selectedPurchase?.totalAmount || 0;
            }
            newFormData.supplierId = selectedPurchase?.vendor.id || '';
            newFormData.supplierBillNumber = selectedPurchase?.supplier_bill_number || '';
            newFormData.referenceNumber = selectedPurchase?.referenceNo || '';
        }

        if (field === 'paymentMode') {
            const chosenMode = paymentModeOptions.find((paymentMode) => paymentMode.id === value);
            const chequeMode = (chosenMode?.name || '').trim().toLowerCase() === 'cheque';
            if (!chequeMode) {
                newFormData.chequeNumber = '';
            }
        }

        if (field === 'paidAmount') {
            if (Number(value) > newFormData.amount) {
                setErrors(prev => ({ ...prev, paidAmount: 'Paid amount cannot exceed total amount.' }));
            } else if (Number(value) < 1) {
                setErrors(prev => ({ ...prev, paidAmount: 'Paid amount must be greater than 0.' }));
            } else {
                const newErrors = { ...errors };
                delete newErrors.paidAmount;
                setErrors(newErrors);
            }
            let dueAmount = newFormData.amount - Number(value);
            newFormData.dueAmount = dueAmount;
        }
        setFormData(newFormData);
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.purchaseId) newErrors.purchaseId = 'Purchase ID is required.';
        if (!formData.paymentDate) newErrors.paymentDate = 'Payment date is required.';
        if (formData.paidAmount <= 0) newErrors.paidAmount = 'Paid amount must be greater than 0.';
        if (formData.paidAmount > formData.amount) newErrors.paidAmount = 'Paid amount cannot exceed total amount.';
        if (formData.paymentMode === null) newErrors.paymentMode = 'Payment mode is required.';
        if (isChequePayment && !formData.chequeNumber.trim()) newErrors.chequeNumber = 'Cheque number is required for cheque payments.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        const apiData = new FormData();

        apiData.append('purchaseId', formData.purchaseId);
        apiData.append('supplierId', formData.supplierId);
        apiData.append('dueAmount', String(formData.amount - formData.paidAmount));
        apiData.append('referenceNumber', formData.referenceNumber);
        apiData.append('chequeNumber', formData.chequeNumber);
        if (formData.paymentDate instanceof Date) {
            const year = formData.paymentDate.getFullYear();
            const month = String(formData.paymentDate.getMonth() + 1).padStart(2, "0");
            const day = String(formData.paymentDate.getDate()).padStart(2, "0");

            apiData.append("paymentDate", `${year}-${month}-${day}`);
        }

        apiData.append('amount', String(formData.amount));
        apiData.append('paidAmount', String(formData.paidAmount));
        apiData.append('paymentMode', formData.paymentMode || '');

        try {
            setIsSubmitting(true);
            await axios.post(Constants.CREATE_SUPPLIER_PAYMENT_URL, apiData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Payment created successfully');
            onConfirm();
        } catch (error: any | AxiosError) {
            const errorResponse = error as AxiosError<{ errors: { [key: string]: string } }>;
            if (errorResponse.response?.data?.errors) {
                setErrors(errorResponse.response.data.errors);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={'Add New Payment'} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Supplier <span className="text-red-500">*</span></label>
                        <SmartDropdown
                            items={filteredSupplierItems}
                            value={supplierSearchKeyword}
                            onChange={setSupplierSearchKeyword}
                            onSelect={(item) => handleSupplierSelect(item as SupplierOption)}
                            placeholder="Type supplier name..."
                            selectedItem={selectedSupplier}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Supplier Bill No <span className="text-red-500">*</span></label>
                        <SmartDropdown
                            items={pendingPurchaseItems}
                            value={purchaseSupplierSearchKeyword}
                            onChange={setPurchaseSupplierSearchKeyword}
                            onSelect={(item) => handlePurchaseSelect(item as PurchaseOption)}
                            placeholder={selectedSupplier ? "Select purchase..." : "Select supplier first"}
                            selectedItem={selectedPurchase}
                            disabled={!selectedSupplier}
                        />
                        {errors.purchaseId && <span className="text-red-500 text-xs">{errors.purchaseId}</span>}
                    </div>

                    {/* Payment Date */}
                    <div>
                        <DateInput
                            label="Payment Date"
                            value={formData.paymentDate}
                            onChange={(newDate) => handleFormChange('paymentDate', newDate)}
                            isRequired
                        />
                        {errors.paymentDate && <span className="text-red-500 text-xs">{errors.paymentDate}</span>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Supplier Bill No</label>
                        <input
                            type="text"
                            value={formData.supplierBillNumber || ''}
                            readOnly
                            placeholder="Auto fetched"
                            className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full read-only:bg-gray-100 text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                    </div>

                    {/* Reference Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Reference Number</label>
                        <input type="text" value={formData.referenceNumber} onChange={(e) => handleFormChange('referenceNumber', e.target.value)} className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600" />
                    </div>

                    {/* Total Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Total Amount</label>
                        <input type="number" value={formData.amount} readOnly className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full read-only:bg-gray-100 text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600" />
                        {errors.amount && <span className="text-red-500 text-xs">{errors.amount}</span>}
                    </div>

                    {/* Paid Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Paid Amount <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.paidAmount} onChange={(e) => handleFormChange('paidAmount', e.target.value)} className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600" />
                        {errors.paidAmount && <span className="text-red-500 text-xs">{errors.paidAmount}</span>}
                    </div>

                    {/* Due Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Due Amount <span className="text-red-500">*</span></label>
                        <input type="number" value={formData.dueAmount} onChange={(e) => handleFormChange('dueAmount', e.target.value)} readOnly className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600" />
                        {errors.dueAmount && <span className="text-red-500 text-xs">{errors.dueAmount}</span>}
                    </div>
                    {/* Payment Mode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 ">Payment Mode <em className="text-red-500">*</em></label>
                        <SmartDropdown
                            items={paymentModeOptions}
                            value={paymentModeSearchKeyword}
                            placeholder="Search or Select Payment Mode"
                            onChange={(keyword) => setPaymentModeSearchKeyword(keyword)}
                            onSelect={(item) => handlePaymentModeSelect(item as OptionType)}
                            selectedItem={selectedPaymentMode}
                            serverside={false}
                        />
                        {errors.paymentMode && <p className="text-red-500 text-sm">{errors.paymentMode}</p>}
                    </div>

                    {isChequePayment && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 ">Cheque Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.chequeNumber}
                                onChange={(e) => handleFormChange('chequeNumber', e.target.value)}
                                className="mt-1 border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                placeholder="Enter cheque number"
                            />
                            {errors.chequeNumber && <span className="text-red-500 text-xs">{errors.chequeNumber}</span>}
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center px-4 pb-4 pt-4 gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700  hover:bg-gray-50  cursor-pointer">Cancel</button>
                    <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode="create" />
                </div>
            </form>
        </Modal>
    );
};

export default PaymentFormModal;
