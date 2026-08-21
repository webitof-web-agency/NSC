import styled from 'styled-components';
import { numberToWords } from '@utils/converters';
import type { InvoiceData } from '@models/invoice';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import useDateFormatter from '@hooks/useDateFormatter';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

type InvoiceDetailsProps = {
    invoiceData: InvoiceData;
    companyDetails?: {
        name?: string;
        address?: string;
        phone?: string;
        logo?: string;
        dateFormat?: string;
    };
};

const InvoiceWrapper = styled.div`
    --invoice-accent: #a52f72;
    --invoice-border: #e5e7eb;
    --invoice-muted: #6b7280;

    min-width: 0;
    overflow-wrap: anywhere;

    p {
        font-size: 12px;
        font-weight: 500;
    }

    .invoice-items-table {
        table-layout: auto;
    }

    @media screen and (max-width: 640px) {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        padding: 1rem !important;

        .invoice-header-primary {
            align-items: center;
            gap: 0.75rem;
        }

        .invoice-logo {
            width: min(42vw, 8rem);
            min-width: 0;
        }

        .invoice-title {
            flex-shrink: 0;
            font-size: clamp(1.125rem, 5vw, 1.25rem);
            line-height: 1.1;
            text-align: right;
            white-space: nowrap;
        }

        .invoice-header-meta {
            display: block;
        }

        .invoice-recipient-copy {
            margin-bottom: 0.5rem;
        }

        .invoice-document-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem 0.75rem;
        }

        .invoice-document-meta p {
            min-width: 0;
            line-height: 1.4;
        }

        .invoice-billing-section {
            display: block;
        }

        .invoice-billing-section > div {
            width: 100%;
        }

        .invoice-items-section {
            margin-top: 0.75rem;
        }

        .invoice-items-table,
        .invoice-items-table tbody,
        .invoice-items-table td {
            display: block;
            width: 100%;
        }

        .invoice-items-table {
            table-layout: fixed;
        }

        .invoice-items-table thead {
            display: none;
        }

        .invoice-items-table tbody {
            display: grid;
            gap: 0.5rem;
        }

        .invoice-items-table tr {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.5rem 0.75rem;
            width: 100%;
            border: 1px solid var(--invoice-border);
            border-left: 3px solid var(--invoice-accent);
            border-radius: 0.25rem;
            padding: 0.55rem 0.65rem;
        }

        .invoice-items-table td {
            display: flex;
            min-width: 0;
            flex-direction: column;
            gap: 0.1rem;
            border-bottom: 0;
            padding: 0 !important;
            text-align: left !important;
        }

        .invoice-items-table td::before {
            content: attr(data-label);
            color: var(--invoice-muted);
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-align: left;
            text-transform: uppercase;
        }

        .invoice-items-table td.invoice-line-number {
            display: none;
        }

        .invoice-items-table td.invoice-item-name {
            display: block;
            grid-column: 1 / -1;
            border-bottom: 1px dashed var(--invoice-border);
            padding-bottom: 0.45rem !important;
            font-size: 1rem;
            line-height: 1.3;
            text-align: left !important;
        }

        .invoice-items-table td.invoice-item-name::before {
            display: none;
        }

        .invoice-items-table td.invoice-item-name p {
            margin-top: 0.1rem;
            line-height: 1.25;
        }

        .invoice-items-table td:last-child {
            font-weight: 700;
        }

        .invoice-total-section {
            margin-top: 0.75rem;
        }

        .invoice-total-panel {
            max-width: none;
        }
    }

    @media print {
        margin-top: 1rem !important;
        margin-bottom: 1rem !important;
        padding-left: 3rem !important;
        padding-right: 3rem !important;
    }
`;

const InvoiceTemplateB: React.FC<InvoiceDetailsProps> = ({ invoiceData, companyDetails }) => {
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
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();
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
    const termsAndConditions = String(invoiceData?.termsAndCondition || "")
        .split(/\r?\n/)
        .map((term) => term.trim())
        .filter(Boolean);
    const companyName = companyDetails?.name || systemSettings?.company?.companyName || cachedSettings?.company?.companyName || "N/A";
    const companyAddress = companyDetails?.address || systemSettings?.company?.address || cachedSettings?.company?.address || "N/A";
    const companyPhone = companyDetails?.phone || systemSettings?.company?.phone || cachedSettings?.company?.phone || "N/A";
    const companyLogo =
        resolveAssetUrl(companyDetails?.logo) ||
        resolveAssetUrl(systemSettings?.company?.siteLogo) ||
        resolveAssetUrl(systemSettings?.company?.favicon) ||
        logoImage;
    const invoiceDateFormat =
        companyDetails?.dateFormat ||
        systemSettings?.dateFormat?.format ||
        cachedSettings?.dateFormat?.format ||
        'DD-MM-YYYY';

    return (
        <InvoiceWrapper className="mx-auto my-4 max-w-5xl bg-white px-4 font-sans text-gray-950 sm:px-12">

            {/* Header Section */}
            <header className="pb-2 border-b border-gray-200">
                {/* Row 1: Logo + Title */}
                <div className="invoice-header-primary flex items-center justify-between">
                    <img
                        src={companyLogo}
                        alt="Company Logo"
                        className="invoice-logo h-auto w-32"
                    />
                    <h1 className="invoice-title text-xl font-bold text-gray-950">TAX INVOICE</h1>
                </div>

                {/* Row 2: Original + Date/Invoice */}
                <div className="invoice-header-meta mt-2 flex items-center justify-between text-sm text-gray-600">
                    <p className="invoice-recipient-copy text-xs">Original For Recipient</p>
                    <div className="invoice-document-meta flex items-center gap-4">
                        <p>Date: {formatDate(invoiceData?.invoiceDate, invoiceDateFormat)}</p>
                        <p>
                            Invoice No: {invoiceData?.invoiceNumber}
                        </p>
                    </div>
                </div>
            </header>

            {/* Company Details */}
            <section className="mt-2 border-b border-gray-200 pb-2">
                <div>
                    <h2 className="font-bold text-primary mb-2">{companyName}</h2>
                    <p className="text-sm text-gray-600">Address: {companyAddress}</p>
                    <p className="text-sm text-gray-600">Mobile: {companyPhone}</p>
                </div>
            </section>

            {/* Billing Information Section */}
            <section className="invoice-billing-section mt-2 flex justify-between">
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
            </section>

            {invoiceData?.status === "EXCHANGE" && exchangeOriginalItems.length > 0 ? (
                <section className="invoice-items-section mt-4">
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Previous Items (Exchange)</h4>
                        <table className="invoice-items-table w-full text-left">
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
                                {exchangeOriginalItems.map((item, index) => (
                                    <tr key={item.id || `prev-${index}`} className="border-b border-gray-200">
                                        <td className="invoice-line-number p-3" data-label="No.">{index + 1}</td>
                                        <td className="invoice-item-name p-3 font-medium" data-label="Item">{item.name}<p className="text-xs text-gray-500">{item.variantName}</p></td>
                                        <td className="p-3 text-right" data-label="Qty">{item.qty}</td>
                                        <td className="p-3 text-right" data-label="Rate">{format(item.rate)}</td>
                                        <td className="p-3 text-right" data-label="Disc">{format(item.discount || 0)}</td>
                                        <td className="p-3 text-right" data-label="Tax">{format(item.tax || 0)}</td>
                                        <td className="p-3 text-right font-medium" data-label="Total">{format(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">New Items</h4>
                        <table className="invoice-items-table w-full text-left">
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
                                        <td className="invoice-line-number p-3" data-label="No.">{index + 1}</td>
                                        <td className="invoice-item-name p-3 font-medium" data-label="Item">{item.name}<p className="text-xs text-gray-500">{item.variantName}</p></td>
                                        <td className="p-3 text-right" data-label="Qty">{item.qty}</td>
                                        <td className="p-3 text-right" data-label="Rate">{format(item.rate)}</td>
                                        <td className="p-3 text-right" data-label="Disc">{format(item.discount)}</td>
                                        <td className="p-3 text-right font-medium" data-label="Total">{format(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}

            {!(invoiceData?.status === "EXCHANGE" && exchangeOriginalItems.length > 0) && (
                <section className="invoice-items-section mt-4">
                    <table className="invoice-items-table w-full text-left">
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
                                    <td className="invoice-line-number p-3" data-label="No.">{index + 1}</td>
                                    <td className="invoice-item-name p-3 font-medium" data-label="Item">{item.name}<p className="text-xs text-gray-500">{item.variantName}</p></td>
                                    <td className="p-3 text-right" data-label="Qty">{item.qty}</td>
                                    <td className="p-3 text-right" data-label="Rate">{format(item.rate)}</td>
                                    <td className="p-3 text-right" data-label="Disc">{format(item.discount)}</td>
                                    <td className="p-3 text-right font-medium" data-label="Total">{format(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* Totals Section */}
            <section className="invoice-total-section mt-2 flex justify-end">
                <div className="invoice-total-panel w-full max-w-xs">
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
            <section className="mt-4 pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">Total Items : {invoiceData?.items.length} | Total Qty : {invoiceData?.items.reduce((sum, item) => sum + item.qty, 0)}</p>
                <p className="text-sm mt-2">
                    <span className="font-semibold">Total amount ( in words) : </span>
                    {numberToWords(invoiceData?.TotalAmount || 0)}
                </p>
            </section>

            {/* Footer: Bank Details & Signature */}
            <footer className="mt-2 pt-2 flex justify-between border-t border-gray-200">
                <div>
                    <h3 className="font-semibold mb-2">Payment Info</h3>
                    <p className="text-sm text-gray-600">Payment Status : {invoiceData.status}</p>
                    <p className="text-sm text-gray-600">Amount : {format(invoiceData.TotalAmount)}</p>
                </div>
            </footer>

            {/* Terms and Conditions */}
            {termsAndConditions.length > 0 && (
                <section className="mt-4">
                    <h3 className="font-semibold mb-2">Terms & Conditions :</h3>
                    <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                        {termsAndConditions.map((term, index) => (
                            <li key={`${index}-${term}`}>{term}</li>
                        ))}
                    </ol>
                </section>
            )}

            <div className="mt-2 pt-4 pb-4 text-center text-sm text-gray-500 border-t border-b border-gray-200">
                <p>Thanks for your Business</p>
            </div>

        </InvoiceWrapper>
    );
}

export default InvoiceTemplateB;
