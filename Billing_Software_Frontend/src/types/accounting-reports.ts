export interface IncomeReportShape {
    id: string;
    invoiceNumber: string;
    customer: {
        name: string;
        email: string;
        phone?: string | null;
        image?: string | null;
    }
    paidDate: string;
    amount: number;
    paymentMode: {
        id: string;
        name: string;
    }
    cashAmount?: number;
    cardAmount?: number;
    upiAmount?: number;
    creditAmount?: number;
    referenceNo: string | null;
    createdAt: string;
}

export interface ExpenseReportShape {
    Id: string;
    paymentId: string;
    supplier: {
        name: string;
        email: string;
        image?: string | null;
    }
    paidDate: string;
    amount: number;
    paymentMode: {
        id: string;
        name: string;
    }
    referenceNo: string | null;
    createdAt: string;
}

export interface ProfitLossRecordShape {
    period: string;
    periodKey: string;
    grossSales: number;
    salesReturn: number;
    netSales: number;
    grossCogs: number;
    salesReturnCogs: number;
    netCogs: number;
    grossProfit: number;
    purchaseExpenses: number;
    operatingExpenses: number;
    brokerCommission: number;
    staffCommission: number;
    totalExpenses: number;
    netProfitLoss: number;
    status: "PROFIT" | "LOSS";
}

export interface ProfitLossPaymentModeShape {
    mode: string;
    label: string;
    netSales: number;
    salesSharePercentage: number;
    grossProfit: number;
    allocatedExpenses: number;
    netProfitLoss: number;
    status: "PROFIT" | "LOSS";
}

export interface ProfitLossSummaryShape {
    grossSales: number;
    salesReturn: number;
    netSales: number;
    grossCogs: number;
    salesReturnCogs: number;
    netCogs: number;
    grossProfit: number;
    purchaseExpenses: number;
    operatingExpenses: number;
    brokerCommission: number;
    staffCommission: number;
    totalExpenses: number;
    netProfitLoss: number;
    status: "PROFIT" | "LOSS";
    paymentModeBreakdown?: ProfitLossPaymentModeShape[];
}
