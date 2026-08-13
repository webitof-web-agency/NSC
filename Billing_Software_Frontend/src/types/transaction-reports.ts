export interface PurchaseReportShape {
    purchaseId: string;
    supplierBillNumber?: string;
    vendor: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
    };
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: string;
    purchaseDate: string;
    createdAt?: string;
}

export interface PurchaseReturnReportShape {
    debitNoteId: string;
    vendor: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
    };
    totalAmount: number;
    status: string;
    debitNoteDate: string;
}

export interface QuotationReportShape {
    quotationId: string;
    customer: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
    };
    totalAmount: number;
    status: string;
    quotationDate: string;
}

export interface SalesReportShape {
    invoiceId: string;
    invoiceNumber: string;
    customer: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
    };
    amount: number;
    paidAmount: number;
    remainingBalance: number;
    paymentMethod?: string;
    cashAmount?: number;
    cardAmount?: number;
    upiAmount?: number;
    status: string;
    invoiceDate: string;
}

export interface SalesReturnReportShape {
    creditNoteId: string;
    creditNoteNumber: string;
    customer: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
    };
    refundAmount: number;
    paymentMethod?: string;
    cashAmount?: number;
    cardAmount?: number;
    upiAmount?: number;
    status: string;
    creditNoteDate: string;
}
