export interface InventoryReportShape {
    _id: string;
    type: string;
    name: string;
    sku: string;
    sellingPrice: number;
    purchasePrice: number;
    alertQuantity: number;
    thumbnail: string;
    unit: string;
    categoryName: string;
    stock: number;

    // ✅ VARIANT DETAILS (NEW)
    variant?: {
        designNo?: string | null;
        color?: string | null;
        size?: string | null;
    };
}

export interface LowStockReportShape {
    _id: string;
    type: string;
    name: string;
    sku: string;
    sellingPrice: number;
    purchasePrice: number;
    alertQuantity: number;
    thumbnail: string;
    unit: string;
    categoryName: string;
    stock: number;

    // ✅ VARIANT DETAILS (NEW)
    variant?: {
        designNo?: string | null;
        color?: string | null;
        size?: string | null;
    };
}

export interface OutOfStockReportShape {
    _id: string;
    type: string;
    name: string;
    sku: string;
    sellingPrice: number;
    purchasePrice: number;
    alertQuantity: number;
    thumbnail: string;
    unit: string;
    categoryName: string;
    stock: number;

    // ✅ VARIANT DETAILS (NEW)
    variant?: {
        designNo?: string | null;
        color?: string | null;
        size?: string | null;
    };
}
