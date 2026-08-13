import styled from 'styled-components';
import { numberToWords } from '@utils/converters';
import type { InvoiceData } from '@models/invoice';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import useDateFormatter from '@hooks/useDateFormatter';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

type InvoiceDetailsProps = {
    invoiceData: InvoiceData
}
const InvoiceTemplateA: React.FC<InvoiceDetailsProps> = ({ invoiceData }) => {
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const cachedSettings = (() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem("systemSettings");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();
    const { formatDate } = useDateFormatter();
    const { format } = useCurrencyFormatter();
    const exchangeOriginalItems = invoiceData?.exchangeOriginalItems ?? [];
    const exchangeOldTotal = invoiceData?.exchangeOldTotal ?? null;
    const exchangeNewTotal = invoiceData?.exchangeNewTotal ?? null;
    const exchangeAmountDifference =
        exchangeOldTotal !== null && exchangeNewTotal !== null
            ? Number((exchangeNewTotal - exchangeOldTotal).toFixed(2))
            : null;
    const hasShippingAddress = Boolean(
        invoiceData?.shippingAddress &&
        Object.values(invoiceData.shippingAddress).some((value) => String(value || "").trim() !== "")
    );
    const companyName = systemSettings?.company?.companyName || cachedSettings?.company?.companyName || "N/A";
    const companyAddress = systemSettings?.company?.address || cachedSettings?.company?.address || "N/A";
    const companyPhone = systemSettings?.company?.phone || cachedSettings?.company?.phone || "N/A";
    const InvoiceWrapper = styled.div`
    p{
      font-size: 12px;
      font-weight: 500;
    }
  `;

    return (
        <InvoiceWrapper className="bg-white pl-12 pr-12 font-sans text-gray-950 max-w-5xl mx-auto my-8">

            {/* Header Section */}
            <header className="pb-2 border-b border-gray-200">
                {/* Row 1: Logo + Title */}
                <div className="flex justify-between items-center">
                    <img
                        src={
                            resolveAssetUrl(systemSettings?.company?.siteLogo) ||
                            resolveAssetUrl(systemSettings?.company?.favicon) ||
                            logoImage
                        }
                        alt="Company Logo"
                        className="w-32 h-auto"
                    />
                    <h1 className="text-xl font-bold text-gray-950">TAX INVOICE</h1>
                </div>

                {/* Row 2: Original + Date/Invoice */}
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                    <p className="text-xs">Original For Recipient</p>
                    <div className="flex items-center gap-4">
                        <p>Date: {formatDate(invoiceData?.invoiceDate, systemSettings?.dateFormat.format ?? 'DD-MM-YYYY')}</p>
                        <p>
                            Invoice No: {invoiceData?.invoiceNumber}
                        </p>
                    </div>
                </div>
            </header>


            {/* Billing Information Section */}
            <section className="flex justify-between mt-2">
                <div className="w-2/5">
                    <h2 className="font-bold text-primary mb-2">Invoice To :</h2>
                    <p className="font-semibold capitalize">{invoiceData?.billTo?.name || "N/A"}</p>
                    <p className="text-sm text-gray-600">
                        {invoiceData?.billTo?.phone || "N/A"}
                    </p>
                    {invoiceData?.customerGstin && (
                        <p className="text-sm text-gray-600">Customer GSTIN: {invoiceData.customerGstin}</p>
                    )}
                    {invoiceData?.ewayBillNumber && (
                        <p className="text-sm text-gray-600">EWay Bill: {invoiceData.ewayBillNumber}</p>
                    )}
                    {hasShippingAddress && (
                        <div className="mt-2">
                            <p className="text-sm font-semibold text-gray-800">Shipping Address</p>
                            {invoiceData?.shippingAddress?.name && (
                                <p className="text-sm text-gray-600">{invoiceData.shippingAddress.name}</p>
                            )}
                            {invoiceData?.shippingAddress?.addressLine1 && (
                                <p className="text-sm text-gray-600">{invoiceData.shippingAddress.addressLine1}</p>
                            )}
                            {invoiceData?.shippingAddress?.addressLine2 && (
                                <p className="text-sm text-gray-600">{invoiceData.shippingAddress.addressLine2}</p>
                            )}
                            <p className="text-sm text-gray-600">
                                {[
                                    invoiceData?.shippingAddress?.city,
                                    invoiceData?.shippingAddress?.state,
                                    invoiceData?.shippingAddress?.country,
                                ]
                                    .filter(Boolean)
                                    .join(", ")}
                                {invoiceData?.shippingAddress?.pincode ? ` - ${invoiceData.shippingAddress.pincode}` : ""}
                            </p>
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <h2 className="font-bold text-primary mb-2">{companyName}</h2>
                    <p className="text-sm text-gray-600">Address: {companyAddress}</p>
                    <p className="text-sm text-gray-600">Mobile: {companyPhone}</p>
                </div>
            </section>

            {invoiceData?.status === "EXCHANGE" && exchangeOriginalItems.length > 0 ? (
                <section className="mt-4">
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Previous Items (Exchange)</h4>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr className="border-b border-gray-200">
                                    <th className="p-3 text-sm font-semibold text-gray-600">#</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600">Item</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Qty</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Price</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Discount</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Tax</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exchangeOriginalItems.map((item: any, index: number) => (
                                    <tr key={item.id || `prev-${index}`} className="border-b border-gray-200">
                                        <td className="p-3">{index + 1}</td>
                                        <td className="p-3 font-medium">
                                            {item.name}
                                            <p className="text-xs text-gray-500">{item.variantName}</p>
                                        </td>
                                        <td className="p-3 text-right">{item.qty}</td>
                                        <td className="p-3 text-right">{format(item.rate)}</td>
                                        <td className="p-3 text-right">{format(item.discount || 0)}</td>
                                        <td className="p-3 text-right">{format(item.tax || 0)}</td>
                                        <td className="p-3 text-right font-medium">{format(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">New Items</h4>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr className="border-b border-gray-200">
                                    <th className="p-3 text-sm font-semibold text-gray-600">#</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600">Item</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Qty</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Price</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Discount</th>
                                    <th className="p-3 text-sm font-semibold text-gray-600 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceData && invoiceData.items.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-200">
                                        <td className="p-3">{index + 1}</td>
                                        <td className="p-3 font-medium">{item.name}<p className="text-xs text-gray-500">{item.variantName}</p></td>
                                        <td className="p-3 text-right">{item.qty}</td>
                                        <td className="p-3 text-right">{format(item.rate)}</td>
                                        <td className="p-3 text-right">{format(item.discount)}</td>
                                        <td className="p-3 text-right font-medium">{format(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : (
                <section className="mt-4">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                                <th className="p-3 text-sm font-semibold text-gray-600">#</th>
                                <th className="p-3 text-sm font-semibold text-gray-600">Item</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 text-right">Qty</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 text-right">Price</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 text-right">Discount</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceData && invoiceData.items.map((item, index) => (
                                <tr key={item.id} className="border-b border-gray-200">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3 font-medium">{item.name}<p className="text-xs text-gray-500">{item.variantName}</p></td>
                                    <td className="p-3 text-right">{item.qty}</td>
                                    <td className="p-3 text-right">{format(item.rate)}</td>
                                    <td className="p-3 text-right">{format(item.discount)}</td>
                                    <td className="p-3 text-right font-medium">{format(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* Totals Section */}
            <section className="flex justify-end mt-2">
                <div className="w-full max-w-xs">
                    {invoiceData?.status === "EXCHANGE" && exchangeOldTotal !== null && exchangeNewTotal !== null && (
                        <>
                            <div className="flex justify-between text-sm text-gray-600 py-2">
                                <span className='font-bold'>Old Amount</span>
                                <span className='font-semibold'>{format(exchangeOldTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 py-2">
                                <span className='font-bold'>New Amount</span>
                                <span className='font-semibold'>{format(exchangeNewTotal)}</span>
                            </div>
                            {exchangeAmountDifference !== null && exchangeAmountDifference < 0 ? (
                                <div className="flex justify-between text-sm text-gray-600 py-2">
                                    <span className='font-bold'>Refund</span>
                                    <span className='font-semibold'>{format(Math.abs(exchangeAmountDifference))}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-sm text-gray-600 py-2">
                                    <span className='font-bold'>Extra Payable</span>
                                    <span className='font-semibold'>{format(Math.max(exchangeAmountDifference || 0, 0))}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="flex justify-between text-sm text-gray-600 py-2">
                        <span className='font-bold'>Sub Total</span>
                        <span className='font-semibold'>{format(invoiceData?.taxableAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 py-2">
                        <span className='font-bold'>Tax</span>
                        <span className='font-semibold'>{format(invoiceData?.vat || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 py-2">
                        <span className='font-bold'>Discount</span>
                        <span className='font-semibold'>{format(invoiceData?.totalDiscount || 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg py-3">
                        <span className='font-bold'>Total</span>
                        <span className='font-semibold'>{format(invoiceData?.TotalAmount || 0)}</span>
                    </div>
                </div>
            </section>

            {/* Amount in words and Summary */}
            <section className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">Total Items : {invoiceData?.items.length} | Total Qty : {invoiceData?.items.reduce((sum, item) => sum + item.qty, 0)}</p>
                <p className="text-sm mt-2">
                    <span className="font-semibold">Total amount ( in words) : </span>
                    {numberToWords(invoiceData?.TotalAmount || 0)}
                </p>
            </section>

            {/* Footer: Bank Details & Signature */}
            <footer className="mt-2 pt-2 flex justify-between border-t border-gray-200">
            </footer>

            {/* Terms and Conditions */}
            <section className="mt-2 mb-4">
                <h3 className="font-semibold mb-2">Terms & Conditions :</h3>
                <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                    <li>{invoiceData?.termsAndCondition}</li>
                </ol>
            </section>

            <div className="mt-2 pt-4 pb-4 text-start text-sm text-gray-500 border-t border-b border-gray-200">
                <p>Thanks for your Business</p>
            </div>

        </InvoiceWrapper>
    );
}

export default InvoiceTemplateA;
