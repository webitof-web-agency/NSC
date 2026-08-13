import React from "react";
import type { Customer } from "@models/customer";
import type { SelectedAdmin } from "@models/common";
import type { ProductItem } from "@models/product";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import useDateFormatter from "@hooks/useDateFormatter";

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
                className="w-[70mm] p-2 font-mono text-[11px] leading-[1.4] text-black"
            >
                {companyDetails?.siteLogo && (
                    <div className="text-center mb-1">
                        <img
                            src={companyDetails.siteLogo}
                            alt="Company Site Logo"
                            className="max-w-[60mm] max-h-[30mm] mx-auto"
                        />
                    </div>
                )}

                <div className="text-center">
                    <p className="font-semibold">TAX INVOICE</p>
                    <p className="font-bold">{companyDetails?.companyName}</p>
                    <p>{companyDetails?.address}</p>
                    <p>
                        {companyDetails?.city?.name}, {companyDetails?.state?.name},{" "}
                        {companyDetails?.pincode}
                    </p>
                    <p>GSTIN: {companyDetails?.gstin || "N/A"}</p>
                    <p>UDYAM: {companyDetails?.udyam || "N/A"}</p>
                    <p>CONTACT: {companyDetails?.phone}</p>
                    <hr className="my-1 border-black border-solid" />
                </div>

                <div className="flex items-center justify-between">
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
                <hr className="my-1 border-black border-solid" />

                <div className="my-1">
                    <p className="font-semibold">Bill To:</p>
                    <p>{customerDetails?.phone}</p>
                    {invoiceFormData.customerGstin && (
                        <p>Customer GSTIN: {invoiceFormData.customerGstin}</p>
                    )}
                    {invoiceFormData.ewayBillNumber && (
                        <p>EWay Bill: {invoiceFormData.ewayBillNumber}</p>
                    )}
                    {hasShippingAddress && (
                        <>
                            <p className="font-semibold mt-1">Ship To:</p>
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
                    <hr className="my-1 border-black border-solid" />
                </div>

                <div className="grid grid-cols-[28px_1fr_70px_60px] gap-2 font-semibold">
                    <span>S.No</span>
                    <span>Particulars</span>
                    <span className="text-center">Qty × Rate</span>
                    <span className="text-right">Amount</span>
                </div>

                {invoiceFormData.items
                    .filter((item) => !!item?.name && item.name.trim() !== "")
                    .map((item: ProductItem, index: number) => {
                        const variantMrp = Number((item as any).variantMrp ?? (item as any).mrp ?? 0) || 0;
                        return (
                            <div key={item.id} className="ml-1 mb-1">
                                <div className="font-semibold">
                                    {index + 1}. {item.name} (HSN: {item.hsn_code})
                                </div>
                                {item.variantName && (
                                    <div className="text-[10px] ml-4">{item.variantName}</div>
                                )}
                                <div className="grid grid-cols-[28px_1fr_70px_60px] gap-2 text-[10px]">
                                    <span />
                                    <span>{variantMrp > 0 ? `MRP: ${variantMrp.toFixed(2)}` : ""}</span>
                                    <span className="text-center">
                                        {item.qty} × {Number(item.rate || 0).toFixed(2)}
                                    </span>
                                    <span className="text-right">
                                        {(Number(item.qty) * Number(item.rate || 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                {exchangeOriginalItems.length > 0 && (
                    <>
                        <hr className="my-1 border-black border-solid" />
                        <div className="my-1 font-semibold">Previous Items (Exchange)</div>
                        {exchangeOriginalItems
                            .filter((item) => !!item?.name && item.name.trim() !== "")
                            .map((item: ProductItem, index: number) => {
                                const variantMrp = Number((item as any).variantMrp ?? (item as any).mrp ?? 0) || 0;
                                return (
                                    <div key={item.id || `prev-${index}`} className="ml-1 mb-1">
                                        <div className="font-semibold">
                                            {index + 1}. {item.name} (HSN: {item.hsn_code})
                                        </div>
                                        {item.variantName && (
                                            <div className="text-[10px] ml-4">{item.variantName}</div>
                                        )}
                                        <div className="grid grid-cols-[28px_1fr_70px_60px] gap-2 text-[10px]">
                                            <span />
                                            <span>{variantMrp > 0 ? `MRP: ${variantMrp.toFixed(2)}` : ""}</span>
                                            <span className="text-center">
                                                {item.qty} × {Number(item.rate || 0).toFixed(2)}
                                            </span>
                                            <span className="text-right">
                                                {(Number(item.qty) * Number(item.rate || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                    </>
                )}

                <hr className="my-1 border-black border-solid" />

                <div className="my-1">
                    <div className="flex items-center justify-between">
                        <span>Total Qty :</span>
                        <span>{totalQuantity}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Sub Total :</span>
                        <span>{Number(invoiceFormData.subTotal ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Discount :</span>
                        <span>-{Number(invoiceFormData.totalDiscount ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>{isInclusive ? "Inc. Tax" : "Tax"} :</span>
                        <span>{Number(invoiceFormData.totalTax ?? 0).toFixed(2)}</span>
                    </div>
                </div>

                <hr className="my-1 border-black border-solid" />


                {exchangeOriginalItems.length > 0 && exchangeOldTotal !== null && exchangeNewTotal !== null && (
                    <>
                        <div className="my-1 text-[10px]">
                            <div className="flex items-center justify-between">
                                <span>Old Total (Exchange):</span>
                                <span>{exchangeOldTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>New Total (Exchange):</span>
                                <span>{exchangeNewTotal.toFixed(2)}</span>
                            </div>
                            {exchangeAmountDifference !== null && exchangeAmountDifference < 0 ? (
                                <div className="flex items-center justify-between">
                                    <span>Refund:</span>
                                    <span>{Math.abs(exchangeAmountDifference).toFixed(2)}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span>Extra Payable:</span>
                                    <span>{Math.max((exchangeAmountDifference || 0), 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        <hr className="my-1 border-black border-solid" />
                    </>
                )}

                {isPartialCreditInvoice && (
                    <div className="text-center text-[13px] my-1 font-bold">
                        Paid Amount : {Number(invoiceFormData.totalPaid ?? 0).toFixed(2)}
                    </div>
                )}

                <div className="text-center text-[15px] my-1 font-black uppercase">
                    {totalPaidLabel} : {totalPaidValue.toFixed(2)}
                </div>

                {totalMRP > 0 && totalMRP > totalSale && (
                    <>
                        <hr className="my-1 border-black border-solid" />
                        <div className="my-1 text-[10px]">
                            <div className="flex items-center justify-between">
                                <span>Total MRP:</span>
                                <span>{parseFloat(totalMRP.toFixed(2))}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Total Sale:</span>
                                <span>{parseFloat(totalSale.toFixed(2))}</span>
                            </div>
                            <div className="flex items-center justify-between font-bold mt-0.5">
                                <span>Total Savings:</span>
                                <span>{parseFloat(gapPercentage.toFixed(2))}%</span>
                            </div>
                        </div>
                        <hr className="my-1 border-black border-solid" />
                    </>
                )}

                <div className="my-2">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="border-y border-black border-solid">
                                <th className="py-0.5 text-left">HSN/SAC</th>
                                <th className="py-0.5 text-center">GST%</th>
                                <th className="py-0.5 text-right">Amount</th>
                                <th className="py-0.5 text-right">CGST</th>
                                <th className="py-0.5 text-right">SGST</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const taxGroups = new Map();

                                invoiceFormData.items
                                    .filter((item: any) => !!item?.name && item.name.trim() !== "")
                                    .forEach((item: any) => {
                                        const hsnCode = item.hsn_code || "N/A";

                                        const qty = Number(item.qty) || 0;
                                        const rate = Number(item.rate) || 0;
                                        const discount = Number(item.discount) || 0;
                                        const taxAmount = Number(item.tax) || 0;

                                        const saleAmount = Math.max(qty * rate, 0);
                                        const baseBeforeTax = Math.max(saleAmount - discount, 0);
                                        const taxableValue = isInclusive
                                            ? Math.max(baseBeforeTax - taxAmount, 0)
                                            : baseBeforeTax;
                                        let taxRate = Number(item.taxRate ?? item.tax_rate ?? item.total_tax_rate ?? 0) || 0;
                                        const rateBaseAmount = isInclusive ? baseBeforeTax : taxableValue;
                                        if (taxRate <= 0 && rateBaseAmount > 0 && taxAmount > 0) {
                                            taxRate = Number(((taxAmount / rateBaseAmount) * 100).toFixed(2));
                                        }

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
                                        group.taxableAmount += saleAmount;
                                        group.taxAmount += taxAmount;
                                    });

                                return Array.from(taxGroups.values()).map((group, index) => {
                                    const cgstAmount = (group.taxAmount / 2).toFixed(2);
                                    const sgstAmount = (group.taxAmount / 2).toFixed(2);

                                    return (
                                        <tr key={index} className="border-b border-black border-solid">
                                            <td className="py-0.5">{group.hsn}</td>
                                            <td className="py-0.5 text-center">{group.taxRate}%</td>
                                            <td className="py-0.5 text-right">{group.taxableAmount.toFixed(2)}</td>
                                            <td className="py-0.5 text-right">{cgstAmount}</td>
                                            <td className="py-0.5 text-right">{sgstAmount}</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                {invoiceFormData.termsAndCondition && (
                    <div className="text-center text-[10px] whitespace-pre-wrap break-words">
                        {invoiceFormData.termsAndCondition}
                    </div>
                )}

                {invoiceFormData.notes && (
                    <div className="text-center text-[10px] whitespace-pre-wrap break-words">
                        {invoiceFormData.notes}
                    </div>
                )}

                {phonepeQRCode && (
                    <div className="text-center my-3">
                        <strong className="text-[11px]">Scan to Pay (UPI):</strong>
                        <img
                            src={phonepeQRCode}
                            alt="PhonePe QR"
                            className="w-[35mm] h-[35mm] mt-2 mx-auto"
                        />
                    </div>
                )}

                {upiQRCode && (
                    <div className="text-center my-3">
                        <strong className="text-[11px]">Scan to Pay (UPI):</strong>
                        <img
                            src={upiQRCode}
                            alt="UPI QR"
                            className="w-[35mm] h-[35mm] mt-2 mx-auto"
                        />
                    </div>
                )}
            </div>
        );
    }
);

ThermalInvoice58mm.displayName = "ThermalInvoice58mm";

export default ThermalInvoice58mm;
