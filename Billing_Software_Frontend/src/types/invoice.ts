import type { ReactNode } from "react";

export interface Item {
    variantName: ReactNode;
    id: string;
    name: string;
    unit: string;
    qty: number;
    rate: number;
    discount: number;
    tax: number;
    tax_group_id: string;
    discount_type: string | 'Fixed' | 'Percentage';
    discount_value: number | null;
    amount: number;
}

export interface InvoiceData {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    referenceNo: string;
    status: string;
    payment_method: string;
    taxableAmount: number;
    totalDiscount: number;
    vat: number;
    TotalAmount: number;
    exchangeOldTotal?: number;
    exchangeNewTotal?: number;
    items: Item[];
    exchangeOriginalItems?: Item[];
    billFrom: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        address: string | null;
        image: string | null;
    },
    billTo: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        billingAddress: {
            name: string;
            addressLine1: string;
            addressLine2: string;
            city: string;
            state: string;
            country: string;
            pincode: string;
        }
        image: string | null;
    },
    customerGstin?: string;
    ewayBillNumber?: string;
    shippingAddress?: {
        name: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        state: string;
        country: string;
        pincode: string;
    } | null;
    bank?: {
        id: string;
        accountHoldername: string;
        bankName: string;
        branchName: string;
        accountNumber: string;
        IFSCCode: string;
    },
    notes: string;
    termsAndCondition: string;
    isRecurring: boolean;
    recurring: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    recurringDuration: number | null;
    sign_type: 'digitalSignature' | 'eSignature';
    signature: {
        id: string;
        name: string;
        image: string | null;
    },
    createdAt: string;
    updatedAt: string;
}
