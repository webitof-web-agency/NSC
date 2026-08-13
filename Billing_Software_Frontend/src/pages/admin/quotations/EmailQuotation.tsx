import FullPageLoader from "@components/admin/FullPageLoader";
import QuillEditor from "@components/admin/QuillEditor";
import Constants from "@constants/api";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";
import useDateFormatter from "@hooks/useDateFormatter";
import type { RootState } from "@store/index";
import axios from "axios";
import { Loader2, Send, Settings } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

interface SMTPSettings {
    from: string;
    fromName: string;
    host: string;
    port: number;
    username: string;
}

interface QuotationData {
    id: string;
    quotationId: string;
    quotationDate: string;
    TotalAmount: number;
    billTo: {
        name: string;
        email: string;
        phone: string;
    };
}

interface EmailFormData {
    quotationId: string;
    to: string;
    cc: string | null;
    subject: string;
    htmlContent: string;
    status: string;
}

const EmailQuotation: React.FC = () => {
    const navigate = useNavigate();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const { format } = useCurrencyFormatter();
    const { formatDate } = useDateFormatter();

    const { id: quotationId } = useParams<{ id: string }>();
    const [quotationDetails, setQuotationDetails] = useState<QuotationData | null>(null);
    const [emailSettings, setEmailSettings] = useState<SMTPSettings>({
        from: "",
        fromName: "",
        host: "",
        port: 0,
        username: "",
    });

    const [isSMTPNotConfigured, setIsSMTPNotConfigured] = useState(false);
    const [isFetchingEmailSettings, setIsFetchingEmailSettings] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editorContent, setEditorContent] = useState("");
    const [formData, setFormData] = useState<EmailFormData>({
        quotationId: quotationId || "",
        to: "",
        cc: null,
        subject: "",
        htmlContent: "",
        status: "sent",
    });

    // fetch email settings
    useEffect(() => {
        const fetchEmailSettings = async () => {
            try {
                setIsFetchingEmailSettings(true);
                const response = await axios.get(Constants.GET_EMAIL_SETTINGS_URL, {
                    params: { userId: user?.id },
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = response.data.data;
                if (data) {
                    const settings = data.smtp_status
                        ? {
                            from: data.smtpFromEmail,
                            fromName: data.smtpFromName,
                            host: data.smtpHost,
                            port: data.smtpPort,
                            username: data.smtpUsername,
                        }
                        : data.node_status
                            ? {
                                from: data.nodeFromEmail,
                                fromName: data.nodeFromName,
                                host: data.nodeHost,
                                port: data.nodePort,
                                username: data.nodeUsername,
                            }
                            : null;

                    if (settings) setEmailSettings(settings);

                    if (
                        !settings ||
                        !settings.from ||
                        !settings.fromName ||
                        !settings.host ||
                        !settings.port ||
                        !settings.username
                    ) {
                        setIsSMTPNotConfigured(true);
                    }
                } else {
                    setIsSMTPNotConfigured(true);
                }
            } catch (error) {
                console.error("Error fetching email settings:", error);
                setIsSMTPNotConfigured(true);
            } finally {
                setIsFetchingEmailSettings(false);
            }
        };

        fetchEmailSettings();
    }, [token, user]);

    // fetch quotation details
    useEffect(() => {
        const fetchQuotationDetails = async () => {
            try {
                const response = await axios.get(
                    `${Constants.FETCH_QUOTATION_DETAILS_URL}/${quotationId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setQuotationDetails(response.data.data);
            } catch (error) {
                console.error("Error fetching quotation details:", error);
            }
        };

        if (quotationId && token) fetchQuotationDetails();
    }, [quotationId, token]);

    // build dynamic email template
    useEffect(() => {
        if (quotationDetails) {
            const customerName = quotationDetails.billTo.name ?? "Customer";
            const quotationNo = quotationDetails.quotationId ?? "";
            const quotationDate = formatDate(quotationDetails.quotationDate, "MMMM DD, YYYY");
            const totalAmount = format(quotationDetails.TotalAmount ?? 0);
            const companyName = systemSettings?.company.companyName ?? "";
            const viewQuotationLink = `${window.location.origin}/admin/view-quotation/${quotationDetails.id}`;

            const template = `<h2 style="font-family:Arial,sans-serif;background-color:#4191f2;font-size:24px;text-align:center;padding:8px;color:#fff;margin:0 0 12px 0">Quotation #${quotationNo}</h2><p style="font-family:Arial,sans-serif;font-size:16px;color:#333;">Dear ${customerName},</p><p style="font-family:Arial,sans-serif;font-size:16px;color:#333;">We appreciate your interest in our services. Please find below the details of your quotation for your review.</p><br><p style="font-family:Arial,sans-serif;font-size:14px;text-transform:uppercase;color:#555;text-align:center;margin:0 0 4px 0">Total Amount</p><p style="font-family:Arial,sans-serif;font-size:32px;font-weight:700;color:#d61915;text-align:center;margin:0 0 12px 0">${totalAmount}</p><p style="text-align:center;margin:0 0 12px 0"><a href="${viewQuotationLink}" style="display:inline-block;padding:10px 20px;background-color:#4191f2;color:#fff;text-decoration:none;border-radius:4px;">View Quotation</a></p><p style="font-family:Arial,sans-serif;font-size:16px;color:#333;"><strong>Quotation Date:</strong> ${quotationDate}</p><p style="font-family:Arial,sans-serif;font-size:16px;color:#333;">Should you have any questions or require adjustments, please don’t hesitate to reach out. We look forward to working with you.</p><p style="font-family:Arial,sans-serif;font-size:16px;color:#333;">Warm regards,<br/>The ${companyName} Team</p>`;

            setEditorContent(template);
            setFormData({
                quotationId: quotationDetails.id,
                to: quotationDetails.billTo.email ?? "",
                cc: null,
                subject: `Quotation #${quotationNo} from ${companyName}`,
                htmlContent: template,
                status: "sent",
            });
        }
    }, [quotationDetails, emailSettings, formatDate, format, systemSettings]);

    useEffect(() => {
        setFormData((prev) => ({ ...prev, htmlContent: editorContent }));
    }, [editorContent]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await axios.post(Constants.SEND_QUOTATION_MAIL_URL, formData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success(response.data.message);
        } catch (error) {
            toast.error("Failed to send quotation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isFetchingEmailSettings) return <FullPageLoader />;

    if (isSMTPNotConfigured) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 rounded-lg border border-gray-200">
                <Settings className="w-16 h-16 text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">SMTP Not Configured</h2>
                <p className="text-gray-500 mb-4 text-center">
                    You need to configure your SMTP or NodeMailer settings before sending quotations.
                </p>
                <button
                    onClick={() => navigate("/admin/settings/email-settings")}
                    className="px-6 py-2 bg-primary text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
                >
                    <Settings size={18} /> Configure Email Settings
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="sticky top-0 z-10 p-2 mb-4">
                <h4 className="text-2xl text-gray-700 font-semibold">
                    Email Quotation to {quotationDetails?.billTo?.name || "Customer"}
                </h4>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
                    {/* From */}
                    <div className="p-4 flex items-center gap-4">
                        <label className="w-32 text-gray-600 font-medium">From</label>
                        <input
                            type="email"
                            value={emailSettings.from}
                            disabled
                            className="flex-1 border border-gray-200 rounded-md p-2 bg-gray-100 text-gray-700"
                        />
                    </div>

                    {/* To */}
                    <div className="p-4 flex items-center gap-4">
                        <label className="w-32 text-gray-600 font-medium">To</label>
                        <input
                            type="email"
                            value={quotationDetails?.billTo?.email || ""}
                            placeholder="customer@email.com"
                            disabled
                            className="flex-1 border border-gray-200 rounded-md p-2 bg-gray-50 text-gray-700"
                        />
                    </div>

                    {/* Subject */}
                    <div className="p-4 flex items-center gap-4">
                        <label className="w-32 text-gray-600 font-medium">Subject</label>
                        <input
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="flex-1 border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                        />
                    </div>

                    {/* Quill Editor */}
                    <div className="p-4">
                        <QuillEditor
                            value={formData.htmlContent}
                            onChange={(html) => setEditorContent(html)}
                        />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex justify-end gap-3 mt-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-800 focus:outline-none flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Sending...
                            </>
                        ) : (
                            <>
                                <Send size={16} /> Send
                            </>
                        )}
                    </button>
                </div>
            </form>
        </>
    );
};

export default EmailQuotation;
