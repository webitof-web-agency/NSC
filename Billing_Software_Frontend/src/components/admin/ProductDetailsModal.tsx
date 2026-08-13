import React, { useState, useEffect } from 'react';
import Modal from '@components/admin/Modal';
import type { ProductItem } from '@models/product';

interface ProductDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (qty: number, rate: number, discount: number) => void;
    item: ProductItem | any | null;
    title?: string;
    currencySymbol?: string;
    children?: React.ReactNode;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ isOpen, onClose, onSave, item, title, currencySymbol = '₹', children }) => {
    const [qty, setQty] = useState<number | string>('');
    const [rate, setRate] = useState<number | string>('');
    const [discount, setDiscount] = useState<number | string>('');

    useEffect(() => {
        if (isOpen && item) {
            setQty('');
            const initialRate = item.rate !== undefined && item.rate !== null ? Number(item.rate) : NaN;
            setRate(!isNaN(initialRate) ? initialRate.toFixed(2) : '');

            // Try to extract discount from the various possible fields
            const existingDiscount = item.discount_value !== undefined
                ? item.discount_value
                : (item.discount !== undefined ? item.discount : '');

            const parsedExistingDiscount = Number(existingDiscount);
            setDiscount(parsedExistingDiscount === 0 || isNaN(parsedExistingDiscount) ? '' : parsedExistingDiscount.toFixed(2));
        } else {
            setQty('');
            setRate('');
            setDiscount('');
        }
    }, [isOpen, item]);

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.includes('.')) {
            const parts = val.split('.');
            if (parts[1].length > 2) return;
        }
        setRate(val);
    };

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.includes('.')) {
            const parts = val.split('.');
            if (parts[1].length > 2) return;
        }
        setDiscount(val);
    };

    const handleSave = () => {
        const parsedQty = qty === '' ? Number(item?.qty || 1) : Number(qty);
        const parsedRate = Number(rate);
        const parsedDiscount = Number(discount);

        const finalQty = Number.isFinite(parsedQty) ? Math.max(1, parsedQty) : 1;
        const finalRate = Number.isFinite(parsedRate) ? Math.max(0, Number(parsedRate.toFixed(2))) : 0;
        const finalDiscount = Number.isFinite(parsedDiscount) ? Math.max(0, Number(parsedDiscount.toFixed(2))) : 0;

        onSave(finalQty, finalRate, finalDiscount);
        onClose();
    };

    if (!isOpen) return null;

    const displayTitle = title || (item ? `Detail - ${item.product?.name || item.name || item.product_code || item.product?.code || item.product_id || 'Product'}` : 'Details');
    const currentQty = qty === '' ? Number(item?.qty || 1) : Number(qty);
    const computedAmount = Math.max(0, (currentQty || 0) * (Number(rate) || 0) - (Number(discount) || 0));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={displayTitle} size="sm">
            <div className="space-y-4">
                {item && (item.name || item.product?.name) && (
                    <div className="text-sm font-medium text-gray-500 mb-2 whitespace-normal break-words" title={(() => {
                        const baseName = item.name || item.product?.name;
                        const size = item.variant?.size || item.variantSize || item.size;
                        return size && !baseName.includes(size) ? `${baseName}, ${size}` : baseName;
                    })()}>
                        Product: {(() => {
                            const baseName = item.name || item.product?.name;
                            const size = item.variant?.size || item.variantSize || item.size;
                            return size && !baseName.includes(size) ? `${baseName}, ${size}` : baseName;
                        })()}
                    </div>
                )}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Quantity</label>
                        {item && item.qty !== undefined && (
                            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                Previous: {item.qty}
                            </span>
                        )}
                    </div>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder={item?.qty?.toString() || '1'}
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rate}
                        onChange={handleRateChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount ({currencySymbol})</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={handleDiscountChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                </div>
                <div className="pt-2">
                    <p className="text-lg font-semibold text-gray-950">
                        New Amount: {currencySymbol}{computedAmount.toFixed(2)}
                    </p>
                </div>

                {children}

                <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-2 rounded-md bg-purple-600 text-sm text-white hover:bg-purple-700"
                    >
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ProductDetailsModal;
