import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Constants from "@constants/api";
import axios from "axios";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import ProfessionalPrintDialog from "@components/admin/ProfessionalPrintDialog";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import type { QuotationDetail } from "@models/quotation";
import QuotationTemplate from "./QuotationTemplate";

const ViewQuotation: React.FC = () => {
    const { id: quotationId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { token } = useSelector((state: RootState) => state.auth);
    const [isFetching, setIsFetching] = useState(true);
    const [quotationDetails, setQuotationDetails] = useState<QuotationDetail | null>(null);
    const [showPrintDialog, setShowPrintDialog] = useState(false);

    useEffect(() => {
        const fetchQuotationDetails = async () => {
            try {
                setIsFetching(true);
                const response = await axios.get(`${Constants.FETCH_QUOTATION_DETAILS_URL}/${quotationId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                });
                if (response.data.data) {
                    setQuotationDetails(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching quotation details:", error);
            } finally {
                setIsFetching(false);
            }
        };
        if (quotationId) {
            fetchQuotationDetails();
        }
    }, [quotationId, token]);

    const navigate = useNavigate();

    const handleSendWhatsAppClick = async () => {
        if (!quotationDetails?.customerPhone && !quotationDetails?.phone) {
            toast.error('No phone number attached to this quotation');
            return;
        }

        try {
            await axios.post(
                Constants.WHATSAPP_SEND_MANUAL_URL,
                {
                    documentId: quotationDetails.id,
                    documentType: 'quotation'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('WhatsApp send requested successfully');
        } catch (error: any) {
            console.error('Failed to send quotation on WhatsApp:', error);
            toast.error(error.response?.data?.message || 'Failed to send WhatsApp message');
        }
    };

    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: "Quotation",
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
        if (!quotationDetails) return;
        if (searchParams.get("print") !== "true") return;

        const timer = window.setTimeout(() => {
            setShowPrintDialog(true);
        }, 150);

        return () => window.clearTimeout(timer);
    }, [quotationDetails, searchParams]);

    if (isFetching) {
        return (
            <div className="p-6 space-y-4 flex items-center justify-center h-screen">
                <LoaderSpinner />
            </div>
        );
    }

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
                onWhatsApp={async () => {
                    await handleSendWhatsAppClick();
                    setShowPrintDialog(false);
                }}
                onPrintAndWhatsApp={async () => {
                    await handleSendWhatsAppClick();
                    setShowPrintDialog(false);
                    window.setTimeout(() => handlePrint(), 80);
                }}
                title="Print Quotation"
                documentName={quotationDetails?.quotationNumber || "Quotation"}
                documentType="Quotation"
                description="Review the quotation before sending it to print."
                preview={printPreview}
                previewWrapperClassName="min-w-full overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm"
                footerNote="The final print layout will use the quotation template."
                printButtonLabel="Print Quotation"
                showCopies={false}
                showPaperSize={false}
                showOrientation={false}
            />

            <div ref={componentRef}>
                {quotationDetails ? (
                    <QuotationTemplate quotationDeta={quotationDetails} />
                ) : (
                    <p>Loading quotation...</p>
                )}
            </div>

            <div className="flex p-12 font-sans text-gray-950 max-w-5xl mx-auto my-8">
                <button
                    onClick={() => setShowPrintDialog(true)}
                    className="mr-4 bg-primary hover:bg-gray-950 text-white px-4 py-2 rounded cursor-pointer"
                >
                    Print / Save as PDF
                </button>
                {token && (
                    <button
                        onClick={handleSendWhatsAppClick}
                        className="mr-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded cursor-pointer"
                    >
                        Send on WhatsApp
                    </button>
                )}
                {token && (
                    <button
                        onClick={() => navigate("/admin/quotations")}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-950 px-4 py-2 rounded cursor-pointer"
                    >
                        Back
                    </button>
                )}
            </div>
        </>
    );
};

export default ViewQuotation;
