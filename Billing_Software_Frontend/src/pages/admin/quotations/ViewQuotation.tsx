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
import { Link2, Copy, RefreshCw, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import { syncBeforeCloudAction } from "@utils/syncBeforeCloudAction";
const ViewQuotation: React.FC = () => {
    const { id: quotationId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { token } = useSelector((state: RootState) => state.auth);
    const [isFetching, setIsFetching] = useState(true);
    const [quotationDetails, setQuotationDetails] = useState<QuotationDetail | null>(null);
    const [showPrintDialog, setShowPrintDialog] = useState(false);

    // Public Link States
    const [publicLink, setPublicLink] = useState<string | null>(null);
    const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
    const [isLinkActionLoading, setIsLinkActionLoading] = useState(false);

    useEffect(() => {
        const fetchQuotationDetails = async () => {
            try {
                setIsFetching(true);
                const response = await axios.get(`${Constants.FETCH_QUOTATION_DETAILS_URL}/${quotationId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                });
                if (response.data.data) {
                    setQuotationDetails(response.data.data);
                    checkExistingPublicLink();
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

    const checkExistingPublicLink = async () => {
        if (!token) return;
        try {
            const res = await axios.post(
                `${Constants.BASE_URL}/api/admin/quotations/${quotationId}/public-link`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success && res.data.publicShareId) {
                setPublicLink(res.data.publicUrl);
                setPublicLinkEnabled(res.data.enabled);
            }
        } catch (e) {
            console.log("No existing public link found");
        }
    };

    const handleGenerateLink = async () => {
        if (!token) return;
        try {
            setIsLinkActionLoading(true);
            const res = await axios.post(
                `${Constants.BASE_URL}/api/admin/quotations/${quotationId}/public-link`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setPublicLink(res.data.publicUrl);
                setPublicLinkEnabled(res.data.enabled);
                toast.success("Public link ready");
            }
        } catch (e) {
            toast.error("Failed to generate link");
        } finally {
            setIsLinkActionLoading(false);
        }
    };

    const handleRegenerateLink = async () => {
        if (!token) return;
        if (!window.confirm("Warning: Previously shared quotation links will stop working. Generate a new link?")) return;
        try {
            setIsLinkActionLoading(true);
            const res = await axios.post(
                `${Constants.BASE_URL}/api/admin/quotations/${quotationId}/public-link/regenerate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setPublicLink(res.data.publicUrl);
                setPublicLinkEnabled(res.data.enabled);
                toast.success("Public link regenerated");
            }
        } catch (e) {
            toast.error("Failed to regenerate link");
        } finally {
            setIsLinkActionLoading(false);
        }
    };

    const handleDisableLink = async () => {
        if (!token) return;
        try {
            setIsLinkActionLoading(true);
            const res = await axios.delete(
                `${Constants.BASE_URL}/api/admin/quotations/${quotationId}/public-link`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setPublicLinkEnabled(false);
                toast.success("Public link disabled");
            }
        } catch (e) {
            toast.error("Failed to disable link");
        } finally {
            setIsLinkActionLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!publicLink) return;
        navigator.clipboard.writeText(publicLink);
        toast.success("Link copied to clipboard");
    };

    const navigate = useNavigate();

    const handleSendWhatsAppClick = async () => {
        if (!quotationDetails?.customerPhone && !quotationDetails?.phone) {
            toast.error('No phone number attached to this quotation');
            return;
        }

        try {
            await syncBeforeCloudAction();
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

            {/* Public Link Section */}
            <div className="p-8 max-w-5xl mx-auto mb-12 bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                        <Link2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Public Quotation Link</h3>
                        <p className="text-sm text-gray-500">Share this quotation securely via WhatsApp or SMS.</p>
                    </div>
                </div>

                {isLinkActionLoading ? (
                    <div className="py-4"><LoaderSpinner /></div>
                ) : (
                    <div className="mt-4">
                        {!publicLink ? (
                            <button
                                onClick={handleGenerateLink}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Generate Public Link
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-600 break-all select-all">
                                        {publicLinkEnabled ? publicLink : 'Link is disabled'}
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        disabled={!publicLinkEnabled}
                                        className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                                        title="Copy Link"
                                    >
                                        <Copy size={20} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleRegenerateLink}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                    >
                                        <RefreshCw size={16} /> Regenerate
                                    </button>
                                    {publicLinkEnabled ? (
                                        <button
                                            onClick={handleDisableLink}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                        >
                                            <EyeOff size={16} /> Disable
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleGenerateLink}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                        >
                                            <Link2 size={16} /> Enable
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default ViewQuotation;
