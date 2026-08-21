import { Navigate, Route, Routes } from "react-router-dom";
import AdminRoute from "./AdminRoute";
import CustomerRoute from "./CustomerRoute";
import AdminRegister from "@pages/admin/auth/AdminRegister";
import SetupOrganizationInfo from "@pages/admin/auth/SetupOrganizationInfo";
import { useSetupStatus } from "@context/SetupStatusContext";
import LegalPage from "@pages/public/LegalPage";
import PublicInvoice from "@pages/public/PublicInvoice";
import PublicQuotation from "@pages/public/PublicQuotation";
import PublicExchange from "@pages/public/PublicExchange";
const AppRoutes = () => {
    const { status, isLoading } = useSetupStatus();

    if (isLoading) return <></>;

    const storedStatus = sessionStorage.getItem("setupStatus");
    const currentStatus = storedStatus
        ? JSON.parse(storedStatus)
        : status;

    const { new_register, company_settings } = currentStatus;

    if (!new_register && !company_settings) {
        return (
            <Routes>
                <Route path="/privacy-policy" element={<LegalPage documentType="privacyPolicy" title="Privacy Policy" />} />
                <Route path="/terms-and-conditions" element={<LegalPage documentType="termsAndConditions" title="Terms & Conditions" />} />
                <Route path="/data-deletion" element={<LegalPage documentType="dataDeletion" title="Data Deletion Policy" />} />
                <Route path="/invoice/:publicShareId" element={<PublicInvoice />} />
                <Route path="/quotation/:publicShareId" element={<PublicQuotation />} />
                <Route path="/exchange/:publicShareId" element={<PublicExchange />} />
                <Route path="/admin/*" element={<AdminRoute />} />
                <Route path="/customer/*" element={<CustomerRoute />} />
                <Route
                    path="/documentation"
                    element={
                        <iframe
                            src="/documentation/index.html"
                            style={{ width: "100%", height: "100vh", border: "none" }}
                            title="Documentation"
                        />
                    }
                />
                <Route
                    path="/landing"
                    element={
                        <iframe
                            src="/landing/index.html"
                            style={{ width: "100%", height: "100vh", border: "none" }}
                            title="Landing"
                        />
                    }
                />
                <Route path="*" element={<Navigate to="/admin" />} />
            </Routes>
        );
    }

    if (!new_register && company_settings) {
        return (
            <Routes>
                <Route path="/privacy-policy" element={<LegalPage documentType="privacyPolicy" title="Privacy Policy" />} />
                <Route path="/terms-and-conditions" element={<LegalPage documentType="termsAndConditions" title="Terms & Conditions" />} />
                <Route path="/data-deletion" element={<LegalPage documentType="dataDeletion" title="Data Deletion Policy" />} />
                <Route path="/invoice/:publicShareId" element={<PublicInvoice />} />
                <Route path="/quotation/:publicShareId" element={<PublicQuotation />} />
                <Route path="/exchange/:publicShareId" element={<PublicExchange />} />
                <Route path="/setup" element={<SetupOrganizationInfo />} />
                <Route path="*" element={<Navigate to="/setup" />} />
            </Routes>
        );
    }

    if (new_register) {
        return (
            <Routes>
                <Route path="/privacy-policy" element={<LegalPage documentType="privacyPolicy" title="Privacy Policy" />} />
                <Route path="/terms-and-conditions" element={<LegalPage documentType="termsAndConditions" title="Terms & Conditions" />} />
                <Route path="/data-deletion" element={<LegalPage documentType="dataDeletion" title="Data Deletion Policy" />} />
                <Route path="/invoice/:publicShareId" element={<PublicInvoice />} />
                <Route path="/quotation/:publicShareId" element={<PublicQuotation />} />
                <Route path="/exchange/:publicShareId" element={<PublicExchange />} />
                <Route path="/register" element={<AdminRegister />} />
                <Route path="*" element={<Navigate to="/register" />} />
            </Routes>
        );
    }

    return <Navigate to="/register" />;
};

export default AppRoutes;
