import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import type { InvoiceData } from "@types/invoice";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import InvoiceTemplateA from "@pages/admin/invoices/InvoiceTemplateA";
import InvoiceTemplateB from "@pages/admin/invoices/InvoiceTemplateB";
import { useReactToPrint } from "react-to-print";

const CustomerInvoiceView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useSelector((state: RootState) => state.customerAuth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const navigate = useNavigate();
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${Constants.CUSTOMER_PORTAL_INVOICES_URL}/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setInvoice(response.data.data || null);
            } catch (error) {
                console.error("Error fetching customer invoice:", error);
            } finally {
                setLoading(false);
            }
        };

        if (id && token) {
            fetchInvoice();
        }
    }, [id, token]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: invoice?.invoiceNumber || "Invoice",
        pageStyle: `
            @page {
                size: auto;
                margin: 5mm 5mm 2mm 2mm;
            }
            @page:first {
                margin: 2mm;
            }
            .page-break {
                page-break-before: always;
            }
        `,
    });

    const defaultInvoiceTemplate = Number(systemSettings?.invoiceTemplate?.default_invoice_template || 1);
    const template = defaultInvoiceTemplate > 2 ? 1 : defaultInvoiceTemplate;

    const SelectedTemplate = template === 2 ? InvoiceTemplateB : InvoiceTemplateA;

    if (loading) {
        return <div className="flex min-h-[300px] items-center justify-center"><LoaderSpinner /></div>;
    }

    if (!invoice) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                Invoice not found.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={() => navigate("/customer/invoices")}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                    Back
                </button>
                <button
                    onClick={handlePrint}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-95 cursor-pointer"
                >
                    Print / Save PDF
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div ref={componentRef}>
                    <SelectedTemplate invoiceData={invoice} />
                </div>
            </div>
        </div>
    );
};

export default CustomerInvoiceView;
