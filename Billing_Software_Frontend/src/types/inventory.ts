export interface InventoryData {
    _id: string;
    productId: string;
    variantId: string;     // new
    quantity: number;

    productDetails: {      // news
        _id: string;
        name: string;
        code: string;
        product_image: string;
        unit_name: string;
    };

    variantDetails: {
        _id: string;
        designNo: string;
        size: string;
        color: string;
        sale_price: number;
        purchase_price: number;
    };

    createdAt: string;
}

export interface InventoryHistoryData {
    inventoryId: string;
    productId: {
        _id: string;
        name: string;
        code: string;
        unitName: string;
    }
    variantDetails?: {
        _id: string;
        designNo: string;
        color: string;
        size: string;
    } | null;
    currentQuantity: number;
    history: InventoryHistory[];
}
export interface InventoryHistory {
    _id: string;
    unitId: string;
    unitName: string;
    quantity: number;
    notes: string;
    type: string;
    adjustment: number | null;
    referenceId: string | null;
    referenceType: string | null;
    createdBy?: {
        _id: string;
        email: string;
    }
    createdAt: string;
    updatedAt: string;
}

export interface Product {
    _id: string;
    item_type: string;
    name: string;
    code: string;
    selling_price: number;
    purchase_price: number;
    alert_quantity: number;
    product_image: string;
    unit_name: string;
    status: boolean;
}
