export interface BankAccountCreatedResponse {
    id: string;
    accountHoldername: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    IFSCCode: string;
    status: string;
}

export interface BankAccount {
    id: string;
    userId: string;
    accountHoldername: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    IFSCCode: string;
    status: boolean;
    accountType: string;
    openingBalance: number;
    currentBalance: number;
    asOnDate: string;
    createdAt: string;
}

export interface BankAccountFormData {
    id?: string;
    userId?: string;
    accountHoldername: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    IFSCCode: string;
    status?: boolean;
    accountType: string;
    openingBalance: number;
}
