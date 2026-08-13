import type React from "react";
import { useState, useEffect } from "react";
import Modal from "@components/admin/Modal";
import SearchableDropdown from "@components/admin/SearchableDropdown";
import DateInput from "@components/admin/DateInput";

// Props for the modal component
interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    totalAmount: number;
    paymentModes: IPaymentMode[];
    allowNoPayment?: boolean;
    defaultPaymentType?: 'full' | 'partial' | 'none';
}

interface IPaymentMode {
    id: string;
    name: string;
    slug: string;
}

// Data structure for the payment form
interface PaymentModalData {
    userId: string;
    billFrom: string;
    billTo: string;
    referenceNo: string;
    purchaseDate: Date | null;
    items: productItem[];
    notes: string;
    termsAndCondition: string;
    paymentMode: string;
    paymentModeSlug: string;
    checkNumber?: string;
    bank?: string | null;
    sign_type: 'digitalSignature' | 'eSignature';
    signatureId: string | null;
    signatureName: string;
    esignDataUrl: string | null;
    subTotal: number | null;
    totalTax: number | null;
    totalDiscount: number | null;
    grandTotal: number | null;
    sp_referenceNumber?: string;
    sp_paymentDate?: Date | null;
    sp_paymentMode?: string;
    sp_amount?: number;
    sp_paid_amount?: number;
    sp_due_amount?: number;
    status?: string;
    paymentType?: 'full' | 'partial' | 'none';
}

interface productItem {
    id: string;
    name: string;
    unit: string;
    qty: number;
    rate: number;
    discount: number;
    tax: number;
    amount: number;
    tax_group_id?: string;
    discount_type?: 'Fixed' | 'Percentage';
    discount_value?: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    totalAmount,
    paymentModes,
    allowNoPayment = false,
    defaultPaymentType = 'partial'
}) => {
    // Initial state for the form, updated to include all fields
    const [data, setData] = useState<PaymentModalData>({
        sp_referenceNumber: '',
        checkNumber: '',
        sp_paymentDate: new Date(),
        sp_paymentMode: '',
        sp_amount: totalAmount || 0,
        sp_paid_amount: 0,
        sp_due_amount: 0,
    } as PaymentModalData);
    const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'none'>(
        allowNoPayment ? defaultPaymentType : 'partial'
    );

    const [paymentFormErrors, setPaymentFormErrors] = useState<{ [key: string]: string }>({});
    const totalAmountValue = Number(totalAmount) || 0;
    const paidAmountValue = Number(data.sp_paid_amount) || 0;
    const dueAmountValue = Math.max(totalAmountValue - paidAmountValue, 0);
    const selectedPaymentMode = paymentModes.find(option => option.id === data.sp_paymentMode) || null;
    const isChequePayment = (selectedPaymentMode?.name || '').trim().toLowerCase() === 'cheque';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'sp_paid_amount') {
            const numericPaid = value === '' ? 0 : Number(value);
            setData(prevData => ({
                ...prevData,
                sp_paid_amount: Number.isFinite(numericPaid) ? numericPaid : 0,
                sp_due_amount: Math.max(totalAmountValue - (Number.isFinite(numericPaid) ? numericPaid : 0), 0),
            }));
        } else {
            setData(prevData => ({
                ...prevData,
                [name]: value,
            }));
        }
    };

    const validatePaymentForm = () => {
        const errors: { [key: string]: string } = {};

        if (allowNoPayment && paymentType === 'none') {
            setPaymentFormErrors({});
            return true;
        }
        if (!Number.isFinite(totalAmountValue)) {
            errors.sp_amount = 'Amount is required.';
        }
        if (paidAmountValue > totalAmountValue) {
            errors.sp_paid_amount = 'Paid Amount cannot be greater than Total Amount.';
        } else if (paidAmountValue < 0) {
            errors.sp_paid_amount = 'Paid Amount cannot be less than 0.';
        }
        if (paidAmountValue > 0) {
            if (!data.sp_paymentDate) {
                errors.sp_paymentDate = 'Payment Date is required.';
            }
            if (!data.sp_paymentMode) {
                errors.sp_paymentMode = 'Payment Mode is required.';
            }
            if (isChequePayment && !String(data.checkNumber || '').trim()) {
                errors.checkNumber = 'Cheque Number is required.';
            }
        }
        setPaymentFormErrors(errors);
        return Object.keys(errors).length === 0;
    }
    // Handler for form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePaymentForm()) return;
        const computedStatus =
            paidAmountValue === totalAmountValue
                ? 'paid'
                : paidAmountValue === 0
                    ? 'pending'
                    : 'partially_paid';
        const payload: PaymentModalData = {
            ...data,
            sp_amount: totalAmountValue,
            sp_paid_amount: paidAmountValue,
            sp_due_amount: dueAmountValue,
            status: computedStatus,
            paymentType: allowNoPayment ? paymentType : undefined,
        };
        onConfirm(payload);
    };

    // Reset form when the modal is closed
    useEffect(() => {
        if (!isOpen) {
            setData({
                sp_referenceNumber: '',
                checkNumber: '',
                sp_paymentDate: null,
                sp_paymentMode: '',
                sp_amount: totalAmount || 0,
                sp_paid_amount: 0,
                sp_due_amount: totalAmount || 0,
            } as PaymentModalData);
            setPaymentType(allowNoPayment ? defaultPaymentType : 'partial');
            setPaymentFormErrors({});
        }
    }, [isOpen, totalAmount, allowNoPayment, defaultPaymentType]);

    useEffect(() => {
        if (paymentType === 'full') {
            setData(prev => ({
                ...prev,
                sp_amount: totalAmount || 0,
                sp_paid_amount: totalAmount || 0,
                sp_due_amount: 0,
            }));
        }

        if (paymentType === 'none') {
            setData(prev => ({
                ...prev,
                sp_amount: totalAmount || 0,
                sp_paid_amount: 0,
                sp_due_amount: totalAmount || 0,
                sp_paymentMode: '',
                checkNumber: '',
                sp_paymentDate: null,
            }));
        }
    }, [paymentType, totalAmount]);

    useEffect(() => {
        setData(prev => ({
            ...prev,
            sp_amount: totalAmount || 0,
            sp_due_amount: Math.max((totalAmount || 0) - (prev.sp_paid_amount || 0), 0),
        }));
    }, [totalAmount]);


    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Payment">
            <form onSubmit={handleSubmit} className="p-1">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allowNoPayment && (
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 pb-1">Payment Type</label>
                            <div className="flex flex-wrap gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="payment_type"
                                        value="full"
                                        checked={paymentType === 'full'}
                                        onChange={() => setPaymentType('full')}
                                        className="h-4 w-4 text-primary cursor-pointer"
                                    />
                                    Full Payment
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="payment_type"
                                        value="partial"
                                        checked={paymentType === 'partial'}
                                        onChange={() => setPaymentType('partial')}
                                        className="h-4 w-4 text-primary cursor-pointer"
                                    />
                                    Partial Payment
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="payment_type"
                                        value="none"
                                        checked={paymentType === 'none'}
                                        onChange={() => setPaymentType('none')}
                                        className="h-4 w-4 text-primary cursor-pointer"
                                    />
                                    No Payment
                                </label>
                            </div>
                        </div>
                    )}
                    {/* Reference Number */}
                    <div>
                        <label htmlFor="sp_referenceNumber" className="block text-sm font-medium text-gray-700  pb-1">Reference Number</label>
                        <input type="text" id="sp_referenceNumber" name="sp_referenceNumber" value={data.sp_referenceNumber} onChange={handleChange}
                            disabled={paymentType === 'none'}
                            className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 disabled:bg-gray-50" />
                        {paymentFormErrors.sp_referenceNumber && <span className="text-red-500 text-sm">{paymentFormErrors.sp_referenceNumber}</span>}
                    </div>

                    {/* Payment Date */}
                    <div>
                        <DateInput
                            label="Payment Date"
                            value={data.sp_paymentDate || null}
                            onChange={(newDate) => setData(prevData => ({ ...prevData, sp_paymentDate: newDate || null }))}
                            isRequired={paymentType !== 'none'}
                            isDisabled={paymentType === 'none'}
                        />
                        {paymentFormErrors.sp_paymentDate && <span className="text-red-500 text-sm">{paymentFormErrors.sp_paymentDate}</span>}
                    </div>

                    {/* Payment Mode */}
                    <div>
                        <SearchableDropdown
                            label="Payment Mode"
                            options={paymentModes}
                            value={paymentModes.find(option => option.id === data.sp_paymentMode) || null}
                            onChange={(_, selectedOption) =>
                                setData(prevData => ({
                                    ...prevData,
                                    sp_paymentMode: selectedOption?.id || '',
                                    checkNumber:
                                        ((selectedOption?.name || '').trim().toLowerCase() === 'cheque')
                                            ? prevData.checkNumber || ''
                                            : '',
                                }))
                            }
                            placeholder="Select Payment Mode"
                            required={paymentType !== 'none'}
                            disabled={paymentType === 'none'}
                        />

                        {paymentFormErrors.sp_paymentMode && <span className="text-red-500 text-sm">{paymentFormErrors.sp_paymentMode}</span>}
                    </div>

                    {isChequePayment && paymentType !== 'none' && (
                        <div>
                            <label htmlFor="checkNumber" className="block text-sm font-medium text-gray-700 pb-1">Cheque Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                id="checkNumber"
                                name="checkNumber"
                                value={data.checkNumber || ''}
                                onChange={handleChange}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                            {paymentFormErrors.checkNumber && <span className="text-red-500 text-sm">{paymentFormErrors.checkNumber}</span>}
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label htmlFor="sp_amount" className="block text-sm font-medium text-gray-700  pb-1">Total Purchase Amount <span className="text-red-500">*</span></label>
                        <input type="number" id="sp_amount" name="sp_amount" value={totalAmountValue} onChange={handleChange} readOnly
                            className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600" />
                        {paymentFormErrors.sp_amount && <span className="text-red-500 text-sm">{paymentFormErrors.sp_amount}</span>}
                    </div>

                    {/* Paid Amount */}
                    <div>
                        <label htmlFor="sp_paid_amount" className="block text-sm font-medium text-gray-700  pb-1">Paid Amount <span className="text-red-500">*</span></label>
                        <input
                            type="number"
                            id="sp_paid_amount"
                            name="sp_paid_amount"
                            min={0}
                            max={totalAmountValue}
                            step="0.01"
                            value={data.sp_paid_amount ?? 0}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 disabled:bg-gray-50"
                            readOnly={paymentType === 'full'}
                            disabled={paymentType === 'none'}
                        />
                        {paymentFormErrors.sp_paid_amount && <span className="text-red-500 text-sm">{paymentFormErrors.sp_paid_amount}</span>}
                    </div>

                    {/* Due Amount */}
                    <div>
                        <label htmlFor="sp_due_amount" className="block text-sm font-medium text-gray-700  pb-1">Due Amount <span className="text-red-500">*</span></label>
                        <input type="number" id="sp_due_amount" name="sp_due_amount" value={dueAmountValue}
                            className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            readOnly
                            disabled={paymentType === 'none'} />
                        {paymentFormErrors.sp_due_amount && <span className="text-red-500 text-sm">{paymentFormErrors.sp_due_amount}</span>}
                    </div>

                </div>

                <div className="flex justify-between items-center px-6 pb-6 pt-4">
                    <button type="button" onClick={() => { onClose(), setPaymentFormErrors({}) }}
                        className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700  hover:bg-gray-50  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={
                            paidAmountValue < 0 ||
                            paidAmountValue > totalAmountValue ||
                            (paidAmountValue > 0 && (!data.sp_paymentDate || !data.sp_paymentMode))
                        }
                        className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 cursor-pointer">
                        Create
                    </button>
                </div>

            </form>
        </Modal>
    );
};

export default PaymentModal;
