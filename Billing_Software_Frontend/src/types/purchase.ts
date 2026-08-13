import type { ReactNode } from 'react';

// MAIN PURCHASE SHAPE
export interface PurchaseShape {
  id: string;
  purchaseId: string;

  purchaseDate: string;
  purchaseBillDate?: string | null;
  dueDate?: string | null;
  referenceNo?: string | null;
  supplier_bill_number?: string | null;
  supplierName?: string | null;

  status: 'new' | 'paid' | 'pending' | 'cancelled';

  paymentMode?: string | null;

  // ITEM TOTAL ONLY
  totalAmount: number;
  totalDiscount?: number;
  overall_discount?: number;
  totalTax?: number;
  taxType?: 'GST' | 'Non-GST';
  gstType?: 'Inclusive' | 'Exclusive' | null;
  taxSummaryMode?: 'IGST' | 'CGST_SGST';
  taxSummaryStates?: {
    companyState?: string;
    supplierState?: string;
  };

  // PAYMENT INFO
  paidAmount: number;
  balanceAmount: number;

  // ITEMS
  items: Item[];

  // BILL FROM (ADMIN / COMPANY USER)
  billFrom: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string | null;
    profileImage?: string | null;
  };

  //  BILL TO (SUPPLIER)
  //  - Comes from Supplier + User
  billTo: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    profileImage?: string | null;

    companyName?: string | null;
    companyAddress?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;

    gstNo?: string | null;
    panNo?: string | null;

    accounts?: BankAccount[];
  };

  // BROKER DETAILS
  broker?: {
    name: string;
    phone: string;
    commissionType: 'fixed' | 'percentage';
    commissionValue: number;
    commissionAmount: number;
  };

  // EXPENSES
  expenses?: {
    garageCharges?: number;
    loadingCharges?: number;
    unloadingCharges?: number;
    transportCharges?: number;
    otherCharges?: number;
    expenseNotes?: string | null;
    totalExpenses: number;
  };

  // FINAL PAYABLE
  finalAmount: number;

  // NOTES
  notes?: string | null;
  termsAndCondition?: string | null;

  // BANK DETAILS (SELECTED BANK)
  bank?: BankAccount | null;

  // SIGNATURE (OPTIONAL)
  sign_type?: 'digitalSignature' | 'eSignature';
  signature?: {
    name: string;
    image: string;
  } | null;

  createdAt: string;
  updatedAt?: string;
}

// ITEM
export interface Item {
  id: string;

  // PRODUCT INFO
  name: string;
  product?: {
    id: string;
    name: string;
  };

  // VARIANT INFO
  variantId?: string;
  variantName?: ReactNode;
  variantDesignNo?: string;
  variantColor?: string;
  variantSize?: string;

  hsn_code?: string;
  unit: string;

  qty: number;
  rate: number;

  // OPTIONAL (LEGACY / FUTURE)
  discount?: number;
  tax?: number;
  tax_group_id?: string | null;
  discount_type?: 'Fixed' | 'Percentage';
  discount_value?: number | null;

  amount: number;
}


// BANK ACCOUNT
export interface BankAccount {
  bankName: string;
  name?: string;
  accountNumber: string;
  accountHolderName?: string;
  ifscCode: string;
  branchName?: string;
  accountType?: string;
}

// PENDING PURCHASE (LISTING)
export interface PendingPurchase {
  id: string;
  purchaseId: string;
  referenceNo?: string | null;
  supplier_bill_number?: string | null;
  purchaseDate: string;
  status: string;

  totalAmount: number;

  vendor: {
    id: string;
    name?: string;
  };

  payment: {
    amount: number;
    paidAmount: number;
    dueAmount: number;
    paymentDate?: string | null;
  };
}
