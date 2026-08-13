import { Navigate, Route, Routes } from "react-router-dom";
import CustomerProtectedRoute from "./CustomerProtectedRoute";
import CustomerLogin from "@pages/customer/auth/CustomerLogin";
import CustomerLayout from "@components/customer/CustomerLayout";
import CustomerDashboard from "@pages/customer/CustomerDashboard";
import CustomerInvoices from "@pages/customer/CustomerInvoices";
import CustomerInvoiceView from "@pages/customer/CustomerInvoiceView";
import CustomerProfile from "@pages/customer/CustomerProfile";
import Seo from "@components/admin/Seo";

const CustomerRoute = () => {
    return (
        <Routes>
            <Route path="/login" element={<><Seo title="Customer Login" /><CustomerLogin /></>} />

            <Route element={<CustomerProtectedRoute />}>
                <Route element={<CustomerLayout />}>
                    <Route index element={<Navigate to="/customer/dashboard" replace />} />
                    <Route path="/dashboard" element={<><Seo title="Customer Dashboard" /><CustomerDashboard /></>} />
                    <Route path="/invoices" element={<><Seo title="Customer Invoices" /><CustomerInvoices /></>} />
                    <Route path="/invoices/:id" element={<><Seo title="Customer Invoice" /><CustomerInvoiceView /></>} />
                    <Route path="/profile" element={<><Seo title="Customer Profile" /><CustomerProfile /></>} />
                </Route>
            </Route>
        </Routes>
    );
};

export default CustomerRoute;
