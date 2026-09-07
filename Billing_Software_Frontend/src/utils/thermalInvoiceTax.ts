const MIN_INVOICE_GST_RATE = 5;
const GST_SLABS = [5, 12, 18, 28];

export interface ThermalTaxLineInput {
    qty: number;
    rate: number;
    discount: number;
    taxAmount: number;
    configuredTaxRate?: number;
    isInclusive: boolean;
}

export interface ThermalTaxLineSummary {
    saleAmount: number;
    taxableAmount: number;
    taxAmount: number;
    taxRate: number;
}

export const calculateThermalTaxLine = ({
    qty,
    rate,
    discount,
    taxAmount,
    configuredTaxRate = 0,
    isInclusive,
}: ThermalTaxLineInput): ThermalTaxLineSummary => {
    const saleAmount = Math.max(Number(qty || 0) * Number(rate || 0), 0);
    const normalizedDiscount = Math.max(Number(discount || 0), 0);
    const normalizedTaxAmount = Math.max(Number(taxAmount || 0), 0);
    const amountAfterDiscount = Math.max(saleAmount - normalizedDiscount, 0);
    const taxableAmount = isInclusive
        ? Math.max(amountAfterDiscount - normalizedTaxAmount, 0)
        : amountAfterDiscount;

    let taxRate = Number(configuredTaxRate || 0);
    if (taxRate <= 0 && taxableAmount > 0 && normalizedTaxAmount > 0) {
        const derivedRate = Number(((normalizedTaxAmount / taxableAmount) * 100).toFixed(2));
        taxRate = GST_SLABS.reduce((best, slab) => {
            const currentDistance = Math.abs(derivedRate - best);
            const slabDistance = Math.abs(derivedRate - slab);
            return slabDistance < currentDistance ? slab : best;
        }, GST_SLABS[0]);

        if (!Number.isFinite(taxRate) || taxRate <= 0) {
            taxRate = derivedRate;
        }
    }

    // GST on printed invoices must never show below the standard 5% slab.
    if (taxRate < MIN_INVOICE_GST_RATE) {
        taxRate = MIN_INVOICE_GST_RATE;
    }

    return {
        saleAmount,
        taxableAmount,
        taxAmount: normalizedTaxAmount,
        taxRate,
    };
};
