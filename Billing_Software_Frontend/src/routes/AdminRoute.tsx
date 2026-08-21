import { Navigate, Route, Routes } from "react-router-dom";
import AdminLogin from "@pages/admin/auth/AdminLogin";
import AdminDashboard from "@pages/admin/AdminDashboard";
import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "@components/admin/layouts/AdminLayout";
import UnitList from "@pages/admin/productAndServices/UnitList";
import BrandList from "@pages/admin/productAndServices/BrandList";
import CategoryList from "@pages/admin/productAndServices/Categories";
import ProductList from "@pages/admin/productAndServices/ProductList";
import AddProduct from "@pages/admin/productAndServices/AddProduct";
import EditProduct from "@pages/admin/productAndServices/EditProduct";
import BulkProductUpload from "@pages/admin/productAndServices/BulkProductUpload";
import TaxSettings from "@pages/admin/settings/TaxSettings";
import BulkTaxUpload from "@pages/admin/settings/BulkTaxUpload";
import AccountSettings from "@pages/admin/settings/AccountSettings";
import SupplierList from "@pages/admin/purchases/SupplierList";
import CompanySettings from "@pages/admin/settings/websiteSettings/CompanySettings";
import PurchaseList from "@pages/admin/purchases/PurchaseList";
import CreatePurchase from "@pages/admin/purchases/CreatePurchase";
import SupplierPayments from "@pages/admin/purchases/SupplierPayments";
import OverviewSupplierPayment from "@pages/admin/purchases/OverviewSupplierPayment";
import PurchaseExpenses from "@pages/admin/purchases/PurchaseExpenses";
import PurchaseExpenseView from "@pages/admin/purchases/PurchaseExpenseView";
import DebitNoteList from "@pages/admin/purchases/DebitNoteList";
import CreateDebitNote from "@pages/admin/purchases/CreateDebitNote";
import EditDebitNote from "@pages/admin/purchases/EditDebitNote";
import OverviewDebitNote from "@pages/admin/purchases/OverviewDebitNote";
import BulkImportPurchases from "@pages/admin/purchases/BulkImportPurchases";
import BulkImportSuppliers from "@pages/admin/purchases/BulkImportSuppliers";
import CurrencyList from "@pages/admin/settings/financeSettings/currencies/CurrencyList";
import LocalizationSettings from "@pages/admin/settings/websiteSettings/LocalizationSettings";
import LegalSettings from "@pages/admin/settings/websiteSettings/LegalSettings";
import CustomerPortalBranding from "@pages/admin/settings/websiteSettings/CustomerPortalBranding";
import CustomerList from "@pages/admin/customers/CustomerList";
import CustomerForm from "@pages/admin/customers/CreateCustomer";
import EditCustomer from "@pages/admin/customers/EditCustomer";
import BulkImportCustomers from "@pages/admin/customers/BulkImportCustomers";
import CustomerActivityDashboard from "@pages/admin/customers/CustomerActivityDashboard";
import QuotationList from "@pages/admin/quotations/QuotationList";
import CreateNewQuotation from "@pages/admin/quotations/CreateNewQuotation";
import EditQuotation from "@pages/admin/quotations/EditQuotation";
import AdminLogout from "@pages/admin/auth/AdminLogout";
import InvoiceTemplateList from "@pages/admin/invoices/InvoiceTemplateList";
import CreateInvoice from "@pages/admin/invoices/CreateInvoice";
import InvoiceList from "@pages/admin/invoices/InvoiceList";
import EditInvoice from "@pages/admin/invoices/EditInvoice";
import ViewInvoice from "@pages/admin/invoices/ViewInvoice";
import BulkImportInvoices from "@pages/admin/invoices/BulkImportInvoices";
import ExchangeList from "@pages/admin/invoices/exchange/ExchangeList";
import NewExchange from "@pages/admin/invoices/exchange/NewExchange";
import CreditNoteList from "@pages/admin/credit-notes/CreditNoteList";
import AddCreditNote from "@pages/admin/credit-notes/AddCreditNote";
import EditCreditNote from "@pages/admin/credit-notes/EditCreditNote";
import InventoryList from "@pages/admin/inventory/InventoryList";
import RolesList from "@pages/admin/roles-permissions/RolesList";
import UserList from "@pages/admin/users/UserList";
import RolePermissions from "@pages/admin/roles-permissions/RolePermissions";
import Unauthorized from "@pages/admin/errors/Unauthorized";
import PurchaseReport from "@pages/admin/reports/transaction-reports/PurchaseReport";
import PurchaseReturnReport from "@pages/admin/reports/transaction-reports/PurchaseReturnReport";
import SalesReport from "@pages/admin/reports/transaction-reports/SalesReport";
import SalesReturnReport from "@pages/admin/reports/transaction-reports/SalesReturnReport";
import HsnGstReport from "@pages/admin/reports/transaction-reports/HsnGstReport";
import IncomeReport from "@pages/admin/reports/accounting-reports/IncomeReport";
import ProfileSettings from "@pages/admin/settings/ProfileSettings";
import InventoryReport from "@pages/admin/reports/inventory-reports/InventoryReport";
import LowStockReport from "@pages/admin/reports/inventory-reports/LowStockReport";
import OutOfStockReport from "@pages/admin/reports/inventory-reports/OutOfStockReport";
import Seo from "@components/admin/Seo";
import OverviewPurchase from "@pages/admin/purchases/OverviewPurchase";
import EmailInvoice from "@pages/admin/invoices/EmailInvoice";
import EditPurchase from "@pages/admin/purchases/EditPurchase";
import QuotationSettings from "@pages/admin/settings/moduleSettings/quotation/QuotationSettings";
import InvoiceSetting from "@pages/admin/settings/moduleSettings/invoice/InvoiceSetting";
import BarcodeCustomization from "@pages/admin/settings/moduleSettings/barcodeCustomization/BarcodeCustomization";
import ViewQuotation from "@pages/admin/quotations/ViewQuotation";
import CommissionSettings from "@pages/admin/settings/CommissionSettings";
import StaffCommissionList from "@pages/admin/users/StaffCommissionList";
import StaffCommissionDashboard from "@pages/admin/users/StaffCommissionDashboard";
import StaffDailyCommissionHistory from "@pages/admin/users/StaffCommissionHistory/StaffDailyCommissionHistory";
import StaffMonthlyCommissionSummary from "@pages/admin/users/StaffCommissionHistory/StaffMonthlyCommissionSummary";
import StaffSalary from "@pages/admin/users/StaffSalary";
import ProductVariantList from "@pages/admin/productAndServices/ProductVariantList";
import AttendanceMarkingPage from "@pages/admin/attendance/AttendanceMarkingPage";
import AttendanceReportPage from "@pages/admin/attendance/AttendanceReportPage";
import StaffAttendanceHistory from "@pages/admin/attendance/StaffAttendanceHistory";
import MonthlyExpenseList from "@pages/admin/reports/accounting-reports/MonthlyExpenseList";
import ProfitLossReport from "@pages/admin/reports/accounting-reports/ProfitLossReport";
import BrokerList from "../pages/admin/reports/accounting-reports/BrokerList";
import BulkImportBrokers from "../pages/admin/reports/accounting-reports/BulkImportBrokers";
import BrokerDeals from "../pages/admin/reports/accounting-reports/BrokerDeals";
import UpiSettings from "@pages/admin/settings/UpiSettings";
import MrpSettings from "@pages/admin/settings/systemSettings/MrpSettings";
import WhatsAppDashboard from '@pages/admin/whatsapp/WhatsAppDashboard';
import WhatsAppSettings from '@pages/admin/whatsapp/WhatsAppSettings';
import WhatsAppTemplates from '@pages/admin/whatsapp/WhatsAppTemplates';
import WhatsAppMarketing from '@pages/admin/whatsapp/WhatsAppMarketing';
import WhatsAppMessages from '@pages/admin/whatsapp/WhatsAppMessages';

const AdminRoute = () => {
    return (
        <Routes>
            <Route path="/login" element={<><Seo title="Login" /><AdminLogin /></>} />

            <Route element={<AdminLayout />}>
                {/* Dashboard */}
                <Route element={<ProtectedRoute moduleSlug="dashboard" action="view" />}>
                    <Route
                        index
                        element={<><Seo title="Dashboard" /><AdminDashboard /></>}
                    />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="dashboard" action="view" />}>
                    <Route path="/dashboard" element={<><Seo title="Dashboard" /><AdminDashboard /></>} />
                </Route>

                {/* Product & Services */}
                <Route element={<ProtectedRoute moduleSlug="product-services" action="view" />}>
                    <Route path="/units" element={<><Seo title="Units" /><UnitList /></>} />
                    <Route path="/brands" element={<><Seo title="Brands" /><BrandList /></>} />
                    <Route path="/categories" element={<><Seo title="Categories" /><CategoryList /></>} />
                    <Route path="/products" element={<><Seo title="Products" /><ProductList /></>} />
                    <Route path="/products/new" element={<><Seo title="New Product" /><AddProduct /></>} />
                    <Route path="/products/bulk-upload" element={<><Seo title="Bulk Product Upload" /><BulkProductUpload /></>} />
                    <Route path="/products/edit/:id" element={<><Seo title="Edit Product" /><EditProduct /></>} />
                    <Route path="/product-variants" element={<><Seo title="Product Variants" /><ProductVariantList /></>} />
                </Route>

                {/* Inventory */}
                <Route element={<ProtectedRoute moduleSlug="inventory" action="view" />}>
                    <Route path="/inventory" element={<><Seo title="Inventory" /><InventoryList /></>} />
                </Route>

                {/* Invoices */}
                <Route element={<ProtectedRoute moduleSlug="invoices" action="view" />}>
                    <Route path="/invoices" element={<><Seo title="Invoices" /><InvoiceList showExchangeAction={false} /></>} />
                    <Route path="/invoices/create-invoice" element={<><Seo title="New Invoice" /><CreateInvoice /></>} />
                    <Route path="/invoices/edit-invoice/:invoiceId" element={<><Seo title="Edit Invoice" /><EditInvoice /></>} />
                    <Route path="/invoices/exchange" element={<><Seo title="Exchange" /><ExchangeList /></>} />
                    <Route path="/invoices/exchange/new" element={<><Seo title="New Exchange" /><NewExchange /></>} />
                    <Route path="/invoices-exchange/:invoiceId" element={<><Seo title="Exchange Invoice" /><EditInvoice /></>} />
                    <Route path="/invoices/email/:invoiceId" element={<><Seo title="Email Invoice" /><EmailInvoice /></>} />
                    <Route path="/invoices/bulk-import" element={<><Seo title="Bulk Import Invoices" /><BulkImportInvoices /></>} />
                </Route>

                {/* Credit Notes */}
                <Route element={<ProtectedRoute moduleSlug="credit-notes" action="view" />}>
                    <Route path="/credit-notes" element={<><Seo title="Credit Notes" /><CreditNoteList /></>} />
                </Route>
                <Route element={<ProtectedRoute moduleSlug="credit-notes" action="create" />}>
                    <Route path="/credit-notes/new" element={<><Seo title="New Credit Note" /><AddCreditNote /></>} />
                </Route>
                <Route element={<ProtectedRoute moduleSlug="credit-notes" action="edit" />}>
                    <Route path="/credit-notes/edit/:id" element={<><Seo title="Edit Credit Note" /><EditCreditNote /></>} />
                </Route>

                {/* Quotations */}
                <Route element={<ProtectedRoute moduleSlug="quotations" action="view" />}>
                    <Route path="/quotations" element={<><Seo title="Quotations" /><QuotationList /></>} />
                    <Route path="/quotations/view/:id" element={<><Seo title="View Quotation" /><ViewQuotation /></>} />
                </Route>
                <Route element={<ProtectedRoute moduleSlug="quotations" action="create" />}>
                    <Route path="/quotations/new" element={<><Seo title="New Quotation" /><CreateNewQuotation /></>} />
                </Route>
                <Route element={<ProtectedRoute moduleSlug="quotations" action="edit" />}>
                    <Route path="/quotations/edit/:id" element={<><Seo title="Edit Quotation" /><EditQuotation /></>} />
                </Route>

                {/* Delivery Challans */}

                {/* Customers */}
                <Route element={<ProtectedRoute moduleSlug="customers" action="view" />}>
                    <Route path="/customers" element={<><Seo title="Customers" /><CustomerList /></>} />
                    <Route path="/customers/new" element={<><Seo title="New Customer" /><CustomerForm /></>} />
                    <Route path="/customers/bulk-import" element={<><Seo title="Bulk Import Customers" /><BulkImportCustomers /></>} />
                    <Route path="/customers/edit/:id" element={<><Seo title="Edit Customer" /><EditCustomer /></>} />
                    <Route path="/customers/activity" element={<><Seo title="Customer Activity" /><CustomerActivityDashboard /></>} />
                    <Route path="/customers/portal-branding" element={<><Seo title="Customer Portal Branding" /><CustomerPortalBranding /></>} />
                </Route>

                {/* General Settings */}
                <Route element={<ProtectedRoute moduleSlug="general-settings" action="view" />}>
                    <Route path="/settings/account" element={<><Seo title="Account Settings" /><AccountSettings /></>} />
                    <Route path="/settings/profile" element={<><Seo title="Profile Settings" /><ProfileSettings /></>} />
                    <Route path="/settings/staff-commission" element={<><Seo title="Staff Commission Settings" /><CommissionSettings /></>} />
                </Route>

                {/* Website Settings */}
                <Route element={<ProtectedRoute moduleSlug="website-settings" action="view" />}>
                    <Route path="/settings/company-settings" element={<><Seo title="Company Settings" /><CompanySettings /></>} />
                    <Route path="/settings/localization" element={<><Seo title="Localization Settings" /><LocalizationSettings /></>} />
                    <Route path="/settings/legal-pages" element={<><Seo title="Legal Settings" /><LegalSettings /></>} />
                </Route>

                {/* System Settings */}
                <Route element={<ProtectedRoute moduleSlug="system-settings" action="view" />}>
                    <Route path="/settings/mrp-settings" element={<><Seo title="MRP Settings" /><MrpSettings /></>} />
                </Route>

                {/* Module Settings */}
                <Route element={<ProtectedRoute moduleSlug="module-settings" action="view" />}>
                    <Route path="/settings/module-settings/invoices" element={<><Seo title="Module Settings - Invoices" /><InvoiceSetting /></>} />
                    <Route path="/settings/module-settings/invoices" element={<><Seo title="Module Settings - Invoices" /><InvoiceSetting /></>} />
                    <Route path="/settings/module-settings/barcode-customization" element={<><Seo title="Barcode Customization" /><BarcodeCustomization /></>} />
                    <Route path="/settings/module-settings/quotations" element={<><Seo title="Module Settings - Quotations" /><QuotationSettings /></>} />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="website-settings" action="view" />}>
                    <Route path="/whatsapp" element={<><Seo title="WhatsApp Dashboard" /><WhatsAppDashboard /></>} />
                    <Route path="/whatsapp/settings" element={<><Seo title="WhatsApp Settings" /><WhatsAppSettings /></>} />
                    <Route path="/whatsapp/templates" element={<><Seo title="WhatsApp Templates" /><WhatsAppTemplates /></>} />
                    <Route path="/whatsapp/marketing" element={<><Seo title="WhatsApp Marketing" /><WhatsAppMarketing /></>} />
                    <Route path="/whatsapp/messages" element={<><Seo title="WhatsApp Messages" /><WhatsAppMessages /></>} />
                    <Route path="/whatsapp/delivered" element={<Navigate to="/admin/whatsapp/messages?status=delivered" replace />} />
                    <Route path="/whatsapp/read" element={<Navigate to="/admin/whatsapp/messages?status=read" replace />} />
                </Route>

                {/* Finance Settings */}
                <Route element={<ProtectedRoute moduleSlug="finance-settings" action="view" />}>
                    <Route path="/settings/taxes" element={<><Seo title="Tax Settings" /><TaxSettings /></>} />
                    <Route path="/settings/taxes/bulk-upload" element={<><Seo title="Bulk Tax Upload" /><BulkTaxUpload /></>} />
                    <Route path="/settings/currencies" element={<><Seo title="Currencies" /><CurrencyList /></>} />
                    <Route path="/settings/upi-settings" element={<><Seo title="UPI Settings" /><UpiSettings /></>} />
                    <Route path="/settings/invoice-templates" element={<><Seo title="Invoice Templates" /><InvoiceTemplateList /></>} />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="purchase-list" action="view" />}>
                    <Route path="/purchases" element={<><Seo title="Purchases" /><PurchaseList /></>} />
                    <Route path="/purchases/new" element={<><Seo title="New Purchase" /><CreatePurchase /></>} />
                    <Route path="/purchases/bulk-import" element={<><Seo title="Bulk Import Purchases" /><BulkImportPurchases /></>} />
                    <Route path="/purchases/edit/:id" element={<><Seo title="Edit Purchase" /><EditPurchase /></>} />
                    <Route path="/purchases/view/:id" element={<><Seo title="Purchase Overview" /><OverviewPurchase /></>} />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="debit-notes" action="view" />}>
                    <Route path="/debit-notes" element={<><Seo title="Debit Notes" /><DebitNoteList /></>} />
                    <Route path="/debit-notes/new" element={<><Seo title="New Debit Note" /><CreateDebitNote /></>} />
                    <Route path="/debit-notes/edit/:id" element={<><Seo title="Edit Debit Note" /><EditDebitNote /></>} />
                    <Route path="/debit-notes/view/:id" element={<><Seo title="Debit Note Overview" /><OverviewDebitNote /></>} />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="suppliers" action="view" />}>
                    <Route path="/suppliers" element={<><Seo title="Suppliers" /><SupplierList /></>} />
                    <Route path="/suppliers/bulk-import" element={<><Seo title="Bulk Import Suppliers" /><BulkImportSuppliers /></>} />
                </Route>

                <Route element={<ProtectedRoute moduleSlug="supplier-payments" action="view" />}>
                    <Route path="/supplier-payments" element={<><Seo title="Supplier Payments" /><SupplierPayments /></>} />
                    <Route path="/supplier-payments/view/:id" element={<><Seo title="Supplier Payment Overview" /><OverviewSupplierPayment /></>} />
                    <Route path="/purchase-expenses" element={<><Seo title="Purchases Expenses" /><PurchaseExpenses /></>} />
                    <Route path="/purchase-expenses/view/:id" element={<><Seo title="Purchase Expense" /><PurchaseExpenseView /></>} />
                </Route>

                {/* Finance & Accounting */}

                {/* Roles & Permissions */}
                <Route element={<ProtectedRoute moduleSlug="manage-users" action="view" />}>
                    <Route path="/users" element={<><Seo title="Users" /><UserList /></>} />
                    <Route path="/roles" element={<><Seo title="Roles" /><RolesList /></>} />
                    <Route path="/roles/permissions/:id" element={<><Seo title="Role Permissions" /><RolePermissions /></>} />
                    <Route path="/staff" element={<><Seo title="Staff Commission List" /><StaffCommissionList /></>} />
                    <Route path="/staff/:id/commission-dashboard" element={<><Seo title="Staff Commission Dashboard" /><StaffCommissionDashboard /></>} />
                    <Route path="/staff/:id/daily-commission" element={<><Seo title="Staff Daily Commission History" /><StaffDailyCommissionHistory /></>} />
                    <Route path="/staff/:id/monthly-commission" element={<><Seo title="Staff Monthly Commission Summary" /><StaffMonthlyCommissionSummary /></>} />
                    <Route path="/staff-salary" element={<><Seo title="Staff Salary" /><StaffSalary /></>} />
                </Route>

                {/* Attendance - NEW FEATURE */}
                <Route element={<ProtectedRoute moduleSlug="manage-users" action="view" />}>
                    <Route path="/attendance" element={<><Seo title="Mark Attendance" /><AttendanceMarkingPage /></>} />
                    <Route path="/attendance-report" element={<><Seo title="Attendance Report" /><AttendanceReportPage /></>} />
                    <Route path="/attendance/staff/:staffId/history" element={<><Seo title="Staff Attendance History" /><StaffAttendanceHistory /></>} />
                </Route>

                {/* Reports - Transaction */}
                <Route element={<ProtectedRoute moduleSlug="transaction-reports" action="view" />}>
                    <Route path="/reports/sales" element={<><Seo title="Sales Report" /><SalesReport /></>} />
                    <Route path="/reports/sales-return" element={<><Seo title="Sales Return Report" /><SalesReturnReport /></>} />
                    <Route path="/reports/hsn-gst" element={<><Seo title="HSN GST Export" /><HsnGstReport /></>} />
                    <Route path="/reports/purchase" element={<><Seo title="Purchase Report" /><PurchaseReport /></>} />
                    <Route path="/reports/purchase-return" element={<><Seo title="Purchase Return Report" /><PurchaseReturnReport /></>} />
                </Route>

                {/* Reports - Accounting */}
                <Route element={<ProtectedRoute moduleSlug="accounting-reports" action="view" />}>
                    <Route path="/reports/income" element={<><Seo title="Income Report" /><IncomeReport /></>} />
                    <Route path="/reports/profit-loss" element={<><Seo title="Profit / Loss Report" /><ProfitLossReport /></>} />
                    <Route path="/reports/monthly-expenses" element={<><Seo title="Monthly Expenses" /><MonthlyExpenseList /></>} />
                    <Route path="/reports/broker-details" element={<><Seo title="Broker Details" /><BrokerList /></>} />
                    <Route path="/reports/broker-details/import" element={<><Seo title="Bulk Import Brokers" /><BulkImportBrokers /></>} />
                    <Route path="/reports/view-broker-deals/:id" element={<><Seo title="Broker Deals" /><BrokerDeals /></>} />
                </Route>

                {/* Reports - Inventory */}
                <Route element={<ProtectedRoute moduleSlug="item-reports" action="view" />}>
                    <Route path="/reports/inventory" element={<><Seo title="Inventory Report" /><InventoryReport /></>} />
                    <Route path="/reports/low-stock" element={<><Seo title="Low Stock Report" /><LowStockReport /></>} />
                    <Route path="/reports/out-of-stock" element={<><Seo title="Out Of Stock Report" /><OutOfStockReport /></>} />
                </Route>

                {/* Logout */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/logout" element={<AdminLogout />} />
                </Route>
            </Route>

            {/* No Layout Routes ex: print,pdf,view */}
            <Route path="/view-invoice/:id" element={<ViewInvoice />} />

            {/* Error Routes */}
            <Route path="/unauthorized" element={<><Seo title="Unauthorized" /><Unauthorized /></>} />
        </Routes>
    );
};

export default AdminRoute;
