import React from "react";
import type { Customer } from "@models/customer";
import type { SelectedAdmin } from "@models/common";
import type { ProductItem } from "@models/product";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import useDateFormatter from "@hooks/useDateFormatter";
import { calculateThermalTaxLine } from "@utils/thermalInvoiceTax";

interface InvoiceFormData {
    invoiceNumber?: string;
    invoiceDate: Date | null;
    items: ProductItem[];
    exchangeOriginalItems?: ProductItem[];
    exchangeOldTotal?: number | null;
    exchangeNewTotal?: number | null;
    subTotal: number | null;
    totalTax: number | null;
    totalDiscount: number | null;
    grandTotal: number | null;
    totalPaid?: number | null;
    status?: string | null;
    payment_method?: string | null;
    paymentMethod?: string | null;
    isCreditInvoice?: boolean;
    taxType?: string | null;
    gstType?: string | null;
    customerGstin?: string | null;
    ewayBillNumber?: string | null;
    shippingAddress?: {
        name?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    } | null;
    notes: string;
    termsAndCondition: string;
}

interface PrintableInvoiceProps {
    invoiceFormData: InvoiceFormData;
    companyDetails: SelectedAdmin | null;
    customerDetails: Customer | null;
    phonepeQRCode?: string | null;
    upiQRCode?: string | null;
}

const ThermalInvoice58mm = React.forwardRef<HTMLDivElement, PrintableInvoiceProps>(
    ({ invoiceFormData, companyDetails, customerDetails, phonepeQRCode, upiQRCode }, ref) => {
        const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
        const { formatDate } = useDateFormatter();
        const exchangeOldTotal = invoiceFormData.exchangeOldTotal ?? null;
        const exchangeNewTotal = invoiceFormData.exchangeNewTotal ?? null;
        const exchangeAmountDifference =
            exchangeOldTotal !== null && exchangeNewTotal !== null
                ? Number((exchangeNewTotal - exchangeOldTotal).toFixed(2))
                : null;
        const isRefund = exchangeAmountDifference !== null && exchangeAmountDifference < 0;
        const totalPaid = exchangeAmountDifference !== null
            ? Math.max(exchangeAmountDifference, 0)
            : (invoiceFormData.totalPaid ?? invoiceFormData.grandTotal ?? 0);
        const paymentMethod = String(
            invoiceFormData.payment_method || invoiceFormData.paymentMethod || ""
        ).toUpperCase();
        const isCreditInvoice =
            invoiceFormData.isCreditInvoice === true ||
            paymentMethod === "CREDIT";
        const totalPaidLabel = isRefund ? "Total Refunded" : isCreditInvoice ? "Balance" : "Total Paid";
        const totalPaidValue = isRefund
            ? Math.abs(exchangeAmountDifference || 0)
            : isCreditInvoice
                ? Math.max(
                    Number(invoiceFormData.grandTotal ?? 0) - Number(invoiceFormData.totalPaid ?? 0),
                    0
                )
                : totalPaid;
        const isInclusive =
            invoiceFormData.taxType === "GST" &&
            invoiceFormData.gstType === "Inclusive";
        const shippingAddress = invoiceFormData.shippingAddress || null;
        const hasShippingAddress = Boolean(
            shippingAddress &&
            Object.values(shippingAddress).some((value) => String(value || "").trim() !== "")
        );

        const exchangeOriginalItems = invoiceFormData.exchangeOriginalItems ?? [];
        const totalQuantity = (invoiceFormData.items || [])
            .filter((item) => !!item?.name && item.name.trim() !== "")
            .reduce((sum, item) => sum + Number(item.qty || 0), 0);

        let itemsWithMrpMRP = 0;
        let itemsWithMrpSale = 0;
        let hasNoMrpItems = false;

        const totalMRP = (invoiceFormData.items || [])
            .filter((item) => !!item?.name && item.name.trim() !== "")
            .reduce((sum, item) => {
                const qty = Number(item.qty || 0);
                const mrp = Number((item as any).variantMrp ?? (item as any).mrp ?? 0);
                const sale = Number(item.rate || 0) * qty;

                if (mrp > 0) {
                    itemsWithMrpMRP += mrp * qty;
                    itemsWithMrpSale += sale;
                } else {
                    hasNoMrpItems = true;
                }

                // If MRP is 0 or unavailable, use the sale price for this item so it doesn't negatively skew the gap
                return sum + (mrp > 0 ? mrp * qty : sale);
            }, 0);

        const totalSale = (invoiceFormData.items || [])
            .filter((item) => !!item?.name && item.name.trim() !== "")
            .reduce((sum, item) => sum + (Number(item.rate || 0) * Number(item.qty || 0)), 0);

        const gapPercentage = totalMRP > totalSale ? ((totalMRP - totalSale) / totalMRP) * 100 : 0;
        const isPartialCreditInvoice =
            isCreditInvoice &&
            Number(invoiceFormData.totalPaid ?? 0) > 0 &&
            totalPaidValue > 0;

        return (
            <div
                ref={ref}
                style={{ width: '70mm', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', lineHeight: 1.4, color: 'black' }}
            >
                {companyDetails?.siteLogo && (
                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                        <img
                            src={companyDetails.siteLogo}
                            alt="Company Site Logo"
                            style={{ maxWidth: '60mm', maxHeight: '30mm', margin: '0 auto', display: 'block' }}
                        />
                    </div>
                )}

                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600 }}>TAX INVOICE</p>
                    <p style={{ fontWeight: 'bold' }}>{companyDetails?.companyName}</p>
                    <p>{companyDetails?.address}</p>
                    <p>
                        {companyDetails?.city?.name}, {companyDetails?.state?.name},{" "}
                        {companyDetails?.pincode}
                    </p>
                    <p>GSTIN: {companyDetails?.gstin || "N/A"}</p>
                    <p>UDYAM: {companyDetails?.udyam || "N/A"}</p>
                    <p>CONTACT: {companyDetails?.phone}</p>
                    <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Invoice: {invoiceFormData.invoiceNumber}</span>
                    <span>
                        Date: {invoiceFormData.invoiceDate
                            ? formatDate(
                                invoiceFormData.invoiceDate,
                                systemSettings?.dateFormat.format ?? "DD-MM-YYYY"
                            )
                            : "N/A"}
                    </span>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />

                <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <p style={{ fontWeight: 600 }}>Bill To:</p>
                    <p>{customerDetails?.phone}</p>
                    {invoiceFormData.customerGstin && (
                        <p>Customer GSTIN: {invoiceFormData.customerGstin}</p>
                    )}
                    {invoiceFormData.ewayBillNumber && (
                        <p>EWay Bill: {invoiceFormData.ewayBillNumber}</p>
                    )}
                    {hasShippingAddress && (
                        <>
                            <p style={{ fontWeight: 600, marginTop: '4px' }}>Ship To:</p>
                            {shippingAddress?.name && <p>{shippingAddress.name}</p>}
                            {shippingAddress?.addressLine1 && <p>{shippingAddress.addressLine1}</p>}
                            {shippingAddress?.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                            <p>
                                {[shippingAddress?.city, shippingAddress?.state, shippingAddress?.country]
                                    .filter(Boolean)
                                    .join(", ")}
                                {shippingAddress?.pincode ? ` - ${shippingAddress.pincode}` : ""}
                            </p>
                        </>
                    )}
                    <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 70px 60px', gap: '8px', fontWeight: 600 }}>
                    <span>S.No</span>
                    <span>Particulars</span>
                    <span style={{ textAlign: 'center' }}>Qty × Rate</span>
                    <span style={{ textAlign: 'right' }}>Amount</span>
                </div>

                {invoiceFormData.items
                    .filter((item) => !!item?.name && item.name.trim() !== "")
                    .map((item: ProductItem, index: number) => {
                        const variantMrp = Number((item as any).variantMrp ?? (item as any).mrp ?? 0) || 0;
                        return (
                            <div key={item.id} style={{ marginLeft: '4px', marginBottom: '4px' }}>
                                <div style={{ fontWeight: 600 }}>
                                    {index + 1}. {item.name} (HSN: {item.hsn_code})
                                </div>
                                {item.variantName && (
                                    <div style={{ fontSize: '10px', marginLeft: '16px' }}>{item.variantName}</div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 70px 60px', gap: '8px', fontSize: '10px' }}>
                                    <span />
                                    <span>{variantMrp > 0 ? `MRP: ${variantMrp.toFixed(2)}` : ""}</span>
                                    <span style={{ textAlign: 'center' }}>
                                        {item.qty} × {Number(item.rate || 0).toFixed(2)}
                                    </span>
                                    <span style={{ textAlign: 'right' }}>
                                        {(Number(item.qty) * Number(item.rate || 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                {exchangeOriginalItems.length > 0 && (
                    <>
                        <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />
                        <div style={{ marginTop: '4px', marginBottom: '4px', fontWeight: 600 }}>Previous Items (Exchange)</div>
                        {exchangeOriginalItems
                            .filter((item) => !!item?.name && item.name.trim() !== "")
                            .map((item: ProductItem, index: number) => {
                                const variantMrp = Number((item as any).variantMrp ?? (item as any).mrp ?? 0) || 0;
                                return (
                                    <div key={item.id || `prev-${index}`} style={{ marginLeft: '4px', marginBottom: '4px' }}>
                                        <div style={{ fontWeight: 600 }}>
                                            {index + 1}. {item.name} (HSN: {item.hsn_code})
                                        </div>
                                        {item.variantName && (
                                            <div style={{ fontSize: '10px', marginLeft: '16px' }}>{item.variantName}</div>
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 70px 60px', gap: '8px', fontSize: '10px' }}>
                                            <span />
                                            <span>{variantMrp > 0 ? `MRP: ${variantMrp.toFixed(2)}` : ""}</span>
                                            <span style={{ textAlign: 'center' }}>
                                                {item.qty} × {Number(item.rate || 0).toFixed(2)}
                                            </span>
                                            <span style={{ textAlign: 'right' }}>
                                                {(Number(item.qty) * Number(item.rate || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                    </>
                )}

                <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />

                <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Total Qty :</span>
                        <span>{totalQuantity}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Sub Total :</span>
                        <span>{Number(invoiceFormData.subTotal ?? 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Discount :</span>
                        <span>-{Number(invoiceFormData.totalDiscount ?? 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{isInclusive ? "Inc. Tax" : "Tax"} :</span>
                        <span>{Number(invoiceFormData.totalTax ?? 0).toFixed(2)}</span>
                    </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />


                {exchangeOriginalItems.length > 0 && exchangeOldTotal !== null && exchangeNewTotal !== null && (
                    <>
                        <div style={{ marginTop: '4px', marginBottom: '4px', fontSize: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Old Total (Exchange):</span>
                                <span>{exchangeOldTotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>New Total (Exchange):</span>
                                <span>{exchangeNewTotal.toFixed(2)}</span>
                            </div>
                            {exchangeAmountDifference !== null && exchangeAmountDifference < 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Refund:</span>
                                    <span>{Math.abs(exchangeAmountDifference).toFixed(2)}</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Extra Payable:</span>
                                    <span>{Math.max((exchangeAmountDifference || 0), 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />
                    </>
                )}

                {isPartialCreditInvoice && (
                    <div style={{ textAlign: 'center', fontSize: '13px', marginTop: '4px', marginBottom: '4px', fontWeight: 'bold' }}>
                        Paid Amount : {Number(invoiceFormData.totalPaid ?? 0).toFixed(2)}
                    </div>
                )}

                <div style={{ textAlign: 'center', fontSize: '15px', marginTop: '4px', marginBottom: '4px', fontWeight: 900, textTransform: 'uppercase' }}>
                    {totalPaidLabel} : {totalPaidValue.toFixed(2)}
                </div>

                {totalMRP > 0 && totalMRP > totalSale && (
                    <>
                        <hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} />
                        <div style={{ marginTop: '4px', marginBottom: '4px', fontSize: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Total MRP:</span>
                                <span>{parseFloat(totalMRP.toFixed(2))}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Total Sale:</span>
                                <span>{parseFloat(totalSale.toFixed(2))}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                                <span>Total Savings:</span>
                                <span>{parseFloat(gapPercentage.toFixed(2))}%</span>
                            </div>
                        </div>
                        {/*<hr style={{ border: 0, borderTop: '1px solid black', margin: '4px 0' }} /> */}
                    </>
                )}

                <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderTop: '1px solid black', borderBottom: '1px solid black', borderColor: 'black', borderStyle: 'solid' }}>
                                <th style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'left' }}>HSN/SAC</th>
                                <th style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'center' }}>GST%</th>
                                <th style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>Amount</th>
                                <th style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>CGST</th>
                                <th style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>SGST</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const taxGroups = new Map();

                                const resolveConfiguredTaxRate = (item: any) => {
                                    const directRate = Number(item.taxRate ?? item.tax_rate ?? item.total_tax_rate ?? item.tax_group_rate ?? 0) || 0;
                                    if (directRate > 0) return directRate;

                                    const itemTax = item.tax;
                                    const derivedFromTaxAmount = Number(itemTax || 0) > 0 && Number(item.rate || 0) > 0
                                        ? Number(((Number(itemTax || 0) / Number(item.rate || 0)) * 100).toFixed(2))
                                        : 0;

                                    if (derivedFromTaxAmount > 0 && derivedFromTaxAmount <= 5.01) {
                                        return 5;
                                    }

                                    return derivedFromTaxAmount || 0;
                                };

                                invoiceFormData.items
                                    .filter((item: any) => !!item?.name && item.name.trim() !== "")
                                    .forEach((item: any) => {
                                        const hsnCode = item.hsn_code || "N/A";

                                        const {
                                            taxableAmount,
                                            taxAmount,
                                            taxRate,
                                        } = calculateThermalTaxLine({
                                            qty: Number(item.qty) || 0,
                                            rate: Number(item.rate) || 0,
                                            discount: Number(item.discount) || 0,
                                            taxAmount: Number(item.tax) || 0,
                                            configuredTaxRate: resolveConfiguredTaxRate(item),
                                            isInclusive,
                                        });

                                        const key = `${hsnCode}-${taxRate}`;

                                        if (!taxGroups.has(key)) {
                                            taxGroups.set(key, {
                                                hsn: hsnCode,
                                                taxRate: taxRate,
                                                taxableAmount: 0,
                                                taxAmount: 0
                                            });
                                        }

                                        const group = taxGroups.get(key);
                                        group.taxableAmount += taxableAmount;
                                        group.taxAmount += taxAmount;
                                    });

                                return Array.from(taxGroups.values()).map((group, index) => {
                                    const cgstAmount = (group.taxAmount / 2).toFixed(2);
                                    const sgstAmount = (group.taxAmount / 2).toFixed(2);

                                    return (
                                        <tr key={index} style={{ borderBottom: '1px solid black', borderColor: 'black', borderStyle: 'solid' }}>
                                            <td style={{ paddingTop: '2px', paddingBottom: '2px' }}>{group.hsn}</td>
                                            <td style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'center' }}>{Number((group.taxRate || 0).toFixed(2))}%</td>
                                            <td style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>{group.taxableAmount.toFixed(2)}</td>
                                            <td style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>{cgstAmount}</td>
                                            <td style={{ paddingTop: '2px', paddingBottom: '2px', textAlign: 'right' }}>{sgstAmount}</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                {invoiceFormData.termsAndCondition && (
                    <div style={{ textAlign: 'center', fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {invoiceFormData.termsAndCondition}
                    </div>
                )}

                {invoiceFormData.notes && (
                    <div style={{ textAlign: 'center', fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {invoiceFormData.notes}
                    </div>
                )}

                {phonepeQRCode && (
                    <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '11px' }}>Scan to Pay (UPI):</strong>
                        <img
                            src={phonepeQRCode}
                            alt="PhonePe QR"
                            style={{ width: '35mm', height: '35mm', marginTop: '8px', margin: '0 auto', display: 'block' }}
                        />
                    </div>
                )}

                {upiQRCode && (
                    <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '11px' }}>Scan to Pay (UPI):</strong>
                        <img
                            src={upiQRCode}
                            alt="UPI QR"
                            style={{ width: '35mm', height: '35mm', marginTop: '8px', margin: '0 auto', display: 'block' }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

ThermalInvoice58mm.displayName = "ThermalInvoice58mm";

export default ThermalInvoice58mm;
