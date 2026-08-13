import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface ProductVariant {
    _id: string;
    productId: string;
    designNo: string;
    color: string;
    size: string;
    purchase_price: number;
    sale_price: number;
    mrp: number;
    min_sale_price: number;
    barcode: string;
}

interface Product {
    _id: string;
    name: string;
    code: string;
    hsn_code?: string;
    unit?: { name: string };
    tax?: { group_id: string };
}

interface InvoiceContextType {
    addVariantToInvoice?: (variant: ProductVariant, product: Product) => void;
    registerAddVariantHandler: (handler: (variant: ProductVariant, product: Product) => void) => void;
    unregisterAddVariantHandler: () => void;
}

const InvoiceContext = createContext<InvoiceContextType>({
    registerAddVariantHandler: () => { },
    unregisterAddVariantHandler: () => { },
});

export const useInvoiceContext = () => {
    return useContext(InvoiceContext);
};

interface InvoiceProviderProps {
    children: ReactNode;
}

export const InvoiceProvider: React.FC<InvoiceProviderProps> = ({ children }) => {
    const [addVariantHandler, setAddVariantHandler] = useState<((variant: ProductVariant, product: Product) => void) | undefined>();

    const registerAddVariantHandler = (handler: (variant: ProductVariant, product: Product) => void) => {
        setAddVariantHandler(() => handler);
    };

    const unregisterAddVariantHandler = () => {
        setAddVariantHandler(undefined);
    };

    return (
        <InvoiceContext.Provider value={{
            addVariantToInvoice: addVariantHandler,
            registerAddVariantHandler,
            unregisterAddVariantHandler
        }}>
            {children}
        </InvoiceContext.Provider>
    );
};
