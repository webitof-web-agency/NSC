import { useEffect, useRef, useState } from "react";
import InvoiceTemplateA from "./InvoiceTemplateA";
import { useReactToPrint } from "react-to-print";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Constants from "@constants/api";
import axios from "axios";
import type { InvoiceData } from "@models/invoice";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import ProfessionalPrintDialog from "@components/admin/ProfessionalPrintDialog";
import InvoiceTemplateB from "./InvoiceTemplateB";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";

const ViewInvoice: React.FC = () => {
    const { id: invoiceId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [isFetching, setIsFetching] = useState(true);
    const [invoiceDetails, setInvoiceDetails] = useState<InvoiceData | null>(null);
    const [showPrintDialog, setShowPrintDialog] = useState(false);

    useEffect(() => {
        const fetchInvoiceDetails = async () => {
            try {
                setIsFetching(true);
                const response = await axios.get(`${Constants.FETCH_INVOICE_DETAILS_NO_AUTH_URL}/${invoiceId}`);
                if (response.data.data) {
                    setInvoiceDetails(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching invoice details:", error);
            } finally {
                setIsFetching(false);
            }
        };
        if (invoiceId) {
            fetchInvoiceDetails();
        }
    }, [invoiceId]);

    const navigate = useNavigate();
    let template = Number(systemSettings?.invoiceTemplate.default_invoice_template || 1);
    if (template > 2) template = 1;
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: "Invoice",
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

    useEffect(() => {
        if (!invoiceDetails) return;
        if (searchParams.get("print") !== "true") return;

        const timer = window.setTimeout(() => {
            setShowPrintDialog(true);
        }, 150);

        return () => window.clearTimeout(timer);
    }, [invoiceDetails, searchParams]);

    if (isFetching) {
        return (
            <div className="p-6 space-y-4 flex items-center justify-center h-screen">
                <LoaderSpinner />
            </div>
        );
    }

    const templates: Record<number, React.FC<{ invoiceData: any }>> = {
        1: InvoiceTemplateA,
        2: InvoiceTemplateB,
    };
    const SelectedTemplate = templates[template] || InvoiceTemplateA;
    const previewHtml = componentRef.current
        ? componentRef.current.innerHTML
            .replace(/max-w-4xl\s+mx-auto/g, "w-full")
            .replace(/max-w-5xl\s+mx-auto/g, "w-full")
            .replace(/\smx-auto/g, "")
        : "";
    const printPreview = previewHtml ? (
        <div className="bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
    ) : null;

    return (
        <>
            <ProfessionalPrintDialog
                isOpen={showPrintDialog}
                onClose={() => setShowPrintDialog(false)}
                onPrint={() => {
                    setShowPrintDialog(false);
                    window.setTimeout(() => handlePrint(), 80);
                }}
                title="Print Invoice"
                documentName={invoiceDetails?.invoiceNumber || "Invoice"}
                documentType="Invoice Template"
                description="Review the invoice template before sending it to print."
                preview={printPreview}
                previewWrapperClassName="min-w-full overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm"
                footerNote="The final print layout will use the selected invoice template."
                printButtonLabel="Print Invoice"
                showCopies={false}
                showPaperSize={false}
                showOrientation={false}
            />

            <div ref={componentRef}>
                {invoiceDetails ? (
                    <SelectedTemplate invoiceData={invoiceDetails} />
                ) : (
                    <p>Loading invoice...</p>
                )}
            </div>

            <div className="flex p-12 font-sans text-gray-950 max-w-5xl mx-auto my-8">
                <button
                    onClick={() => setShowPrintDialog(true)}
                    className="mr-4 bg-primary hover:bg-gray-950 text-white px-4 py-2 rounded cursor-pointer"
                >
                    Print / Save as PDF
                </button>
                <button
                    onClick={() => navigate("/admin/invoices")}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-950 px-4 py-2 rounded cursor-pointer"
                >
                    Back
                </button>
            </div>
        </>
    );
};

export default ViewInvoice;
