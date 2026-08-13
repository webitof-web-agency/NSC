export interface ProductFormData {
    item_type: 'Product' | 'Service';
    name: string;
    code: string;
    hsn_code: string;
    category: string;
    brand: string;
    unit: string;
    selling_price: string | number;
    purchase_price: string | number;
    discount_type: 'Fixed' | 'Percentage' | string;
    discount_value: number;
    tax: string;
    barcode: string;
    alert_quantity: string | number;
    description: string;
    enable_inventory: boolean;
    stock: number;
}

export interface Product {
    variant: any;         // new for Purchase Debit Note "handleNewProductCreated"
    id: string;
    item_type: string;
    name: string;
    code: string;
    hsn_code: string;
    barcode: string; // ← Add this
    unit: { id: string; name: string; } | null;
    prices: { selling: number; purchase: number; };
    discount: { type: 'Fixed' | 'Percentage'; value: number; } | null;
    tax: { group_id: string; group_name: string; total_rate: number; _id?: string; id?: string } | null;
    quantity: number;
    rate: number;
    amount: number;
    brand: { _id: string; brand_name: string };
    purchase_price?: number;
    selling_price?: number;
}

export interface ProductItem {
    rowId?: any;
    id: string;
    product_id?: string;        // ← NEW (Actual product ID)
    product_code?: string;

    // 🔥 VARIANT (optional)
    variantId?: string;
    variantDesignNo?: string;
    variantColor?: string;
    variantSize?: string;
    variantName?: string;
    variantBarcode?: string;
    variantMrp?: number;
    variantSalePrice?: number;
    productBrandName?: string;

    name: string;
    hsn_code?: string;
    unit?: string;
    qty: number;
    rate: number;
    discount?: number;
    tax: number;
    amount: number;
    tax_group_id?: string | null; // ✅ Allow null to prevent MongoDB ObjectId validation errors
    discount_type?: 'Fixed' | 'Percentage' | string;
    discount_value?: number;
    // Add these two for staff selection
    staffId?: string | null;
    staffName?: string | null;
    isCreatedFromModalProduct?: boolean;
}
