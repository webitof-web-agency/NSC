const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const UnitsController = require('../controllers/UnitsController');
const BrandsController = require('../controllers/BrandsController');
const CategoryController = require('../controllers/CategoryController');
const TaxRateController = require('../controllers/TaxRateController');
const TaxGroupController = require('../controllers/TaxGroupController');
const ProductController = require('../controllers/ProductController');
const SupplierController = require('@controllers/Admin/Purchases/SupplierController');
const debitNoteController = require('@controllers/Admin/Purchases/debitNoteController');
const purchaseController = require('@controllers/Admin/Purchases/purchaseController');
const ewayController = require('@controllers/Admin/Purchases/eWayBillController');
const supplierPaymentController = require('@controllers/Admin/Purchases/supplierPaymentController');
const invoiceController = require('@controllers/Admin/Invoice/invoiceController');
const SignatureController = require('../controllers/SignatureController');
const currencyController = require('../controllers/currencyController');
const BankDetailController = require('@controllers/bankDetailController');
const CompanySettings = require('@controllers/CompanySettingsController');
const legalSettingsController = require('@controllers/legalSettingsController');
const appVersionController = require('@controllers/appVersionController');
const dashboardController = require('@controllers/Admin/dashboardController');
const { uploadCompanyFields, handleUploadError } = require('../middleware/uploadCompanyImages');
const { uploadCustomerPortalBranding, uploadCustomerPortalPromoMedia, handleCustomerPortalUploadError } = require('../middleware/uploadCustomerPortalBranding');
const protect = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const excelUpload = require('../middleware/excelUpload');
const setup = require('../middleware/setup');
const { uploadSingle, uploadMultiple, uploadProductFields } = require('../middleware/uploadProductImages');
const { createUnitValidator, updateUnitValidator } = require('../validators/unitsValidator');
const { createBrandValidator, updateBrandValidator } = require('../validators/brandValidator');
const { createCategoryValidator, updateCategoryValidator } = require('../validators/categoryValidator');
const { createTaxRateValidator, updateTaxRateValidator } = require('../validators/taxRateValidator');
const { createTaxGroupValidator, updateTaxGroupValidator } = require('../validators/taxGroupValidator');
const { createProductValidator, updateProductValidator, createProductVariantValidator, updateVariantValidator } = require('../validators/productValidator');
const { updateProfileValidator } = require('../validators/updateProfileValidator');
const { createSupplierValidator } = require('../validators/Admin/Purchases/SupplierVaidator');
const { supplierPaymentValidator } = require('../validators/Admin/Purchases/supplierPaymentValidator');
const { purchaseValidator } = require('../validators/Admin/Purchases/purchaseValidator');
const { debitNoteValidator } = require('../validators/Admin/Purchases/debitNoteValidator');
const { createSignatureValidator, updateSignatureValidator } = require('../validators/signatureValidator');
const { createCurrencyValidator } = require('../validators/currencyValidator');
const { createBankDetailValidator, updateBankDetailValidator, updateBankDetailStatusValidator } = require('@validators/bankDetailValidator');
const { updateCompanySettingsValidator } = require('@validators/companySettingsValidator');
const { createCustomerValidator } = require('@validators/customerValidator');
const customerController = require('@controllers/customerController');
const localizationController = require('@controllers/localizationController');
const multer = require('multer');
const quotationController = require('@controllers/Admin/Invoice/quotationController');
const { quotationValidator, updateQuotationValidator } = require('../validators/Admin/Invoice/quotationValidator');
const invoiceTemplateController = require('@controllers/invoiceTemplateController');
const { createInvoiceValidator } = require('../validators/Admin/Invoice/invoiceValidator');
const { createCreditNoteValidator } = require('../validators/Admin/Invoice/creditNoteValidator');
const { createDeliveryChallanValidator } = require('../validators/Admin/Invoice/deliveryChallanValidator');
const creditNoteController = require('@controllers/Admin/Invoice/creditNoteController');
const inventoryController = require('@controllers/Admin/Invoice/inventoryController');
const deliveryChallanController = require('@controllers/Admin/Invoice/deliveryChallanController');
const emailSettingsController = require('@controllers/emailSettingsController');
const emailTeamplateController = require('@controllers/emailTeamplateController');
const roleController = require('@controllers/roleController');
const permissionController = require('@controllers/permissionController');
const userController = require('@controllers/userController');
const commissionController = require('@controllers/commissionController');      // for staff commission
const {validateCommissionUpdate} = require('../validators/commissionValidator');
const reportController = require('@controllers/reportController');
const accountingReportController = require('@controllers/accountingReportController');
const transactionReportController = require('@controllers/transactionReportController');
const securityController = require('@controllers/securityController');
const pettyCashController = require('@controllers/pettyCashController');
const { createStaffValidator } = require('../validators/staffValidator');
const attendanceController = require('@controllers/attendanceController');
const { markAttendanceValidator, markCheckOutValidator, updateAttendanceValidator } = require('../validators/attendanceValidator');
const { createRoleValidator } = require('../validators/roleValidator');
const expenseController = require('@controllers/expenseController');
const staffSalaryController = require('@controllers/staffSalaryController');
const { createExpenseValidator } = require('../validators/expenseValidator');
const expenseCategoryController = require('../controllers/expenseCategoryController');
const sizeColorController = require('../controllers/sizeColorController');
const customFieldController = require('../controllers/customFieldController');
const { createCustomFieldValidator, updateCustomFieldValidator } = require('../validators/customFieldValidator');
const customFieldDataTypeController = require('../controllers/customFieldDataTypeController');
const { createCustomFieldDataTypeValidator, updateCustomFieldDataTypeValidator } = require('../validators/customFieldDataTypeValidator');
const invoicePreferenceController = require('../controllers/invoicePreferencesController');
const brokerController = require('../controllers/brokerController');
const mrpSettingsController = require('../controllers/mrpSettingsController');
const notificationController = require('../controllers/notificationController');
const todoController = require('../controllers/todoController');
const customerPortalController = require('../controllers/customerPortalController');
const aiController = require('../controllers/aiController');
const aiUpload = require('../middleware/aiUpload');


router.get('/', protect, adminController.dashboard);
router.get('/countries', protect, adminController.getCountries);
router.get('/states/:countryId', protect, adminController.getStates);
router.get('/cities/:stateId', protect, adminController.getCities);
router.get('/country/:id', protect, adminController.getCountryById);
router.get('/state/:id', protect, adminController.getStateById);
router.get('/city/:id', protect, adminController.getCityById);
router.get('/profile', protect, adminController.getProfile);
router.put('/profile', protect, upload.single('profileImage'), updateProfileValidator, adminController.updateProfile);

//Unit routes
router.get('/units', protect, UnitsController.getUnits);
router.post('/units', protect, createUnitValidator, UnitsController.createUnit);
router.get('/units/:id', protect, UnitsController.getUnitById);
router.put('/units/:id', protect, updateUnitValidator, UnitsController.updateUnit);
router.delete('/units/:id', protect, UnitsController.deleteUnit);
router.post('/units/bulk-delete', protect, UnitsController.bulkDeleteUnits);

//Brand routes
router.get('/brands', protect, BrandsController.getAllBrands);
router.post('/brands', protect, upload.single('brand_image'), createBrandValidator, BrandsController.createBrand);
router.get('/brands/:id', protect, BrandsController.getBrandById);
router.put('/brands/:id', protect, upload.single('brand_image'), updateBrandValidator, BrandsController.updateBrand);
router.delete('/brands/:id', protect, BrandsController.deleteBrand);
router.post('/brands/bulk-delete', protect, BrandsController.bulkDeleteBrands);

//Category routes
router.get('/categories', protect, CategoryController.getAllCategories);
router.post('/categories', protect, upload.single('category_image'), createCategoryValidator, CategoryController.createCategory);
router.get('/categories/:id', protect, CategoryController.getCategoryById);
router.put('/categories/:id', protect, upload.single('category_image'), updateCategoryValidator, CategoryController.updateCategory);
router.delete('/categories/:id', protect, CategoryController.deleteCategory);
router.post('/categories/bulk-delete', protect, CategoryController.bulkDeleteCategories);

// Size & Color routes
router.get('/sizes', protect, sizeColorController.listSizes);
router.post('/sizes', protect, sizeColorController.createSize);
router.delete('/sizes/:id', protect, sizeColorController.deleteSize);
router.get('/colors', protect, sizeColorController.listColors);
router.post('/colors', protect, sizeColorController.createColor);
router.delete('/colors/:id', protect, sizeColorController.deleteColor);

// Tax Rate routes
router.get('/tax-rates', protect, TaxRateController.getAllTaxRates);
router.post('/tax-rates', protect, createTaxRateValidator, TaxRateController.createTaxRate);
router.get('/tax-rates/:id', protect, TaxRateController.getTaxRateById);
router.put('/tax-rates/:id', protect, updateTaxRateValidator, TaxRateController.updateTaxRate);
router.delete('/tax-rates/:id', protect, TaxRateController.deleteTaxRate);


//Tax Group routes
router.get('/tax-groups', protect, TaxGroupController.getAllTaxGroups);
router.post('/tax-groups', protect, createTaxGroupValidator, TaxGroupController.createTaxGroup);
router.get('/tax-groups/:id', protect, TaxGroupController.getTaxGroupById);
router.put('/tax-groups/:id', protect, updateTaxGroupValidator, TaxGroupController.updateTaxGroup);
router.delete('/tax-groups/:id', protect, TaxGroupController.deleteTaxGroup);

router.get('/tax-settings/sample-template', protect, TaxGroupController.downloadUnifiedTaxSample);
router.post('/tax-settings/upload-unified-excel', protect, excelUpload.single('file'), TaxGroupController.uploadUnifiedTaxExcel);

//Product Routes
router.post('/products', protect, uploadProductFields, handleUploadError, createProductValidator, ProductController.createProduct);
router.get('/products', protect, ProductController.getAllProducts);
router.get('/products-invoice', protect, ProductController.getProductsForInvoice);
router.get('/products/download-template', protect, ProductController.downloadProductExcelTemplate);
router.get('/products/export', protect, ProductController.exportProductsExcel);
router.post('/products/export-draft', protect, ProductController.exportDraftProductsExcel);
router.get('/products/:id', protect, ProductController.getProductById);
router.put('/products/:id', protect, uploadProductFields, updateProductValidator, ProductController.updateProduct);
router.delete('/products/:id', protect, ProductController.deleteProduct);
router.post('/products/bulk-delete', protect, ProductController.bulkDeleteProducts);
router.get('/product-categories', protect, ProductController.getAllProductCategories);
router.get('/product-brands', protect, ProductController.getAllProductBrands);
router.get('/product-units', protect, ProductController.getAllUnits);
router.get('/product-taxes', protect, ProductController.getAllTaxGroups);
router.post('/products-variant/create', protect, ProductController.createProductVariant);
router.get('/products-variant/:id', protect, ProductController.getProductVariantById);
router.put('/products-variant/:id', protect, ProductController.updateProductVariant);
router.delete('/products-variant/:id', protect, ProductController.deleteProductVariant);
router.post('/products-variant/bulk-delete', protect, ProductController.bulkDeleteProductVariants);
router.get('/products-variants/export', protect, ProductController.exportProductVariantsExcel);
router.post('/products-variants/by-ids', protect, ProductController.getVariantsByIds);
router.get('/products-variants', protect, ProductController.getAllProductVariants);
router.post('/products/upload-excel', protect, excelUpload.single('file'), ProductController.uploadProductsExcel); // ✅ Bulk upload

// MRP Settings
router.get('/mrp-settings', protect, mrpSettingsController.getSettings);
router.put('/mrp-settings', protect, mrpSettingsController.upsertSettings);

//suppliers routes
router.post('/suppliers', protect, upload.single('profileImage'), createSupplierValidator, SupplierController.createSupplier);
router.get('/suppliers', protect, SupplierController.listSuppliers);
router.get('/suppliers/export', protect, SupplierController.exportSuppliers);
router.get('/suppliers/:id/ledger', protect, SupplierController.downloadSupplierLedger);
router.post('/suppliers/upload-excel', protect, excelUpload.single('file'), SupplierController.uploadSuppliersFromExcel);
router.get('/suppliers/download-template', protect, SupplierController.downloadSupplierExcelTemplate);
router.put('/suppliers/:id', protect, upload.single('profileImage'), SupplierController.updateSupplier);
router.delete('/suppliers/:id', protect, SupplierController.deleteSupplier);
router.post('/suppliers/bulk-delete', protect, SupplierController.bulkDeleteSuppliers);
router.get("/suppliers/:id", protect, SupplierController.getSupplierById);

//debitnote
router.post('/debitnote', protect, upload.single('signatureImage'), debitNoteValidator, debitNoteController.createDebitNote);
router.get('/debitnote', protect, debitNoteController.getAllDebitNotes);
router.put('/debitnote/:id', protect, upload.single('signatureImage'), debitNoteValidator, debitNoteController.updateDebitNote);
router.get('/debitnote/:id', protect, debitNoteController.getDebitNoteById);
router.delete('/debitnote/:id', protect, debitNoteController.deleteDebitNote);
router.post('/debitnote/bulk-delete', protect, debitNoteController.bulkDeleteDebitNotes);

//supplierpayment
router.post('/supplierpayments', protect, upload.single('attachment'), supplierPaymentValidator, supplierPaymentController.createSupplierPayment);
router.get('/supplierpayments', protect, supplierPaymentController.listSupplierPayments);
router.get('/supplierpayments/:id', protect, supplierPaymentController.getSupplierPaymentById);
router.put('/supplierpayments/:id', protect, upload.single('attachment'), supplierPaymentController.updateSupplierPayment);
router.delete('/supplierpayments/:id', protect, supplierPaymentController.deleteSupplierPayment);
router.post('/supplierpayments/bulk-delete', protect, supplierPaymentController.bulkDeleteSupplierPayments);

router.post('/purchases', protect, upload.single('signatureImage'), purchaseValidator, purchaseController.createPurchase);
router.get('/purchases/next-id', protect, purchaseController.getNextPurchaseId);
router.post('/purchases/upload-excel', protect, excelUpload.single('file'), purchaseController.uploadPurchasesFromExcel);
router.get('/purchases/download-template', protect, purchaseController.downloadPurchaseExcelTemplate);
router.get('/purchases/export', protect, purchaseController.exportPurchases);
router.put('/purchases/:id', protect, upload.single('signatureImage'), purchaseController.updatePurchase);
router.get('/purchases', protect, purchaseController.getAllPurchases);
router.get('/purchases/:id', protect, purchaseController.getPurchaseById);
router.delete('/purchases/:id', protect, purchaseController.deletePurchase);
router.post('/purchases/bulk-delete', protect, purchaseController.bulkDeletePurchases);
router.get('/purchases-minimal', protect, purchaseController.listPurchasesMinimal);
router.get('/purchases-pending', protect, purchaseController.listPurchasesPending);

//eway
router.post('/generate/from-purchase/:purchaseId', protect, ewayController.generateEWayBillFromPurchase);

//signature
router.post('/signatures', protect, upload.single('signatureImage'), createSignatureValidator, SignatureController.createSignature);
router.get('/signatures', protect, SignatureController.getUserSignatures);
router.put('/signatures/:signatureId', protect, upload.single('signatureImage'), updateSignatureValidator, SignatureController.updateSignature);
router.delete('/signatures/:signatureId', protect, SignatureController.deleteSignature);
router.patch('/signatures/set-default/:signatureId', protect, SignatureController.setAsDefaultSignature);
router.patch('/signatures/status/:signatureId', protect, SignatureController.updateSignatureStatus);
router.post('/paymentmode', protect, SignatureController.createPaymentMode);
router.get('/paymentmode', protect, SignatureController.listPaymentModes);

//currency
router.post('/currency', protect, createCurrencyValidator, currencyController.createCurrency);
router.get('/currency', protect, currencyController.getAllCurrencies);
router.put('/currency/:id', protect, currencyController.updateCurrency);
router.delete('/currency/:id', protect, currencyController.deleteCurrency);
router.patch('/currency/:id', protect, currencyController.updateCurrencyStatus);

//bankDetails
router.post('/bank-accounts', protect, createBankDetailValidator, BankDetailController.createBankDetail);
router.get('/bank-accounts', protect, BankDetailController.listBankDetails);
router.put('/bank-accounts/:id', protect, updateBankDetailValidator, BankDetailController.updateBankDetail);
router.delete('/bank-accounts/:id', protect, BankDetailController.deleteBankDetail);
router.patch('/bank-accounts/status/:id', updateBankDetailStatusValidator, BankDetailController.updateBankDetailStatus);
router.get('/bank-transactions', protect, BankDetailController.listBankTransactions);
router.post('/bank-reconcile/:id', protect, BankDetailController.reconcileTransaction);
router.get('/bank-petty', protect, BankDetailController.listFinancialDetails);
router.get('/bank-transactions-reconcile', protect, BankDetailController.listBankTransactionsReconciled);
router.get('/bank-transactions-details/:id', protect, BankDetailController.getBankTransactionDetails);


//company
router.put('/company-details/:userId', protect, uploadCompanyFields, handleUploadError, updateCompanySettingsValidator, CompanySettings.updateCompanySettings);
router.get('/company-details/:userId', protect, CompanySettings.getCompanySettings);
router.get('/system-settings', protect, CompanySettings.getBasicDetails);
router.patch('/company/setup', protect, setup.single('siteLogo'), CompanySettings.updateCompanySetup);
router.post('/create-general-settings', protect, CompanySettings.createOrUpdateGeneralSetting);
router.get('/general-settings-list', protect, CompanySettings.listGeneralSettings);

// Legal Settings
router.get('/settings/legal', protect, legalSettingsController.getLegalSettings);
router.put('/settings/legal', protect, legalSettingsController.updateLegalSettings);

router.get('/customers/portal-branding', protect, customerPortalController.getAdminCustomerPortalBranding);
router.put('/customers/portal-branding', protect, uploadCustomerPortalBranding, handleCustomerPortalUploadError, customerPortalController.updateAdminCustomerPortalBranding);
router.post('/customers/portal-branding/promo-gallery', protect, uploadCustomerPortalPromoMedia, handleCustomerPortalUploadError, customerPortalController.addPromoGalleryItem);
router.patch('/customers/portal-branding/promo-gallery/reorder', protect, customerPortalController.reorderPromoGalleryItems);
router.patch('/customers/portal-branding/promo-gallery/:itemId/media', protect, uploadCustomerPortalPromoMedia, handleCustomerPortalUploadError, customerPortalController.replacePromoGalleryItemMedia);
router.patch('/customers/portal-branding/promo-gallery/:itemId', protect, customerPortalController.updatePromoGalleryItem);
router.delete('/customers/portal-branding/promo-gallery/:itemId', protect, customerPortalController.deletePromoGalleryItem);

//customer
router.get('/customers/download-template', protect, customerController.downloadCustomerTemplate);
router.post('/customers/upload-excel', protect, excelUpload.single('file'), customerController.uploadCustomersFromExcel);
router.post('/customers/minimal', protect, customerController.createMinimalCustomer);
router.post('/customers', protect, upload.single('image'), createCustomerValidator, customerController.createCustomer);
router.get('/customers', protect, customerController.getCustomers);
router.get('/customers/export', protect, customerController.exportCustomers);
router.get('/customers/activity/summary', protect, customerController.getCustomerActivitySummary);
router.get('/customers/activity', protect, customerController.listCustomerActivity);
router.get('/customers/activity/export', protect, customerController.exportCustomerActivity);
router.get('/customers/:id', protect, customerController.getCustomerById);
router.put('/customers/:id', protect, upload.single('image'), customerController.updateCustomer);
router.delete('/customers/:id', protect, customerController.deleteCustomer);
router.post('/customers/bulk-delete', protect, customerController.bulkDeleteCustomers);
router.post('/customers/:id/portal-access', protect, customerPortalController.generateAdminCustomerPortalAccess);
//localization
router.get('/localization', protect, localizationController.getDropdownOptions);
router.post('/localizations', protect, localizationController.saveLocalization);
router.get('/localizations', protect, localizationController.getLocalization);
router.get('/settings-dropdown', localizationController.getSettingsDropdownList);

//Quotation
router.post('/quotations', protect, upload.single('signatureImage'), quotationValidator, quotationController.createQuotation);
router.get('/quotations', protect, quotationController.listQuotations);
router.get('/quotations/:id', quotationController.getQuotationById);
router.put('/quotations/:id', protect, upload.single('signatureImage'), updateQuotationValidator, quotationController.updateQuotation);
router.delete('/quotations/:id', protect, quotationController.deleteQuotation);
router.post('/quotations/bulk-delete', protect, quotationController.bulkDeleteQuotations);
router.get('/quotations', protect, quotationController.listQuotations);
router.get('/customers-all', protect, quotationController.getAllCustomers);
router.get('/quotations-minimal', protect, quotationController.getAllCustomers);
router.patch('/quotations-status/:id', protect, quotationController.updateQuotationStatus);
router.post('/quotations/mail', protect, quotationController.sendQuotationEmailAndUpdateStatus);

//invoicetemplate
router.post('/invoice-template', protect, invoiceTemplateController.createOrUpdateTemplate);
router.get('/invoice-templates', protect, invoiceTemplateController.getAllTemplates);
//Invoice
router.post('/invoices', protect, upload.single('signatureImage'), createInvoiceValidator, invoiceController.createInvoice);
router.post('/invoices/mail', protect, invoiceController.sendInvoiceEmail);
router.post('/invoices/update-status', protect, invoiceController.updateInvoiceStatus);
router.get('/invoices/next-number', protect, invoiceController.getNextInvoiceNumber);
router.get('/invoices/next-exchange-number', protect, invoiceController.getNextExchangeInvoiceNumber);
router.get('/invoices/export', protect, invoiceController.exportInvoicesExcel);
// IMPORTANT: Specific routes MUST come before parameterized routes
router.get('/invoices/download-template', protect, invoiceController.downloadInvoiceTemplate);
router.post('/invoices/upload-excel', protect, excelUpload.single('file'), invoiceController.uploadInvoicesFromExcel);
router.get('/invoices', protect, invoiceController.getAllInvoices);
router.get('/invoices/:id', protect, invoiceController.getInvoice);
router.get('/invoices/details/:id', invoiceController.getInvoice);
router.put('/invoices/:id', protect, upload.single('signatureImage'), invoiceController.updateInvoice);
router.delete('/invoices/:id', protect, invoiceController.deleteInvoice);
router.post('/invoices/bulk-delete', protect, invoiceController.bulkDeleteInvoices);
router.post('/quotation-convert-to-invoice/:quotationId', protect, upload.single('signatureImage'), invoiceController.convertQuotationToInvoice);
router.post('/invoice/payment', protect, invoiceController.recordInvoicePayment);
router.post('/invoices-minimal', protect, invoiceController.listInvoicesMinimal);
router.get('/invoice-payment-details/:id', protect, invoiceController.getInvoicePaymentDetails);
router.get('/invoices-recurring', protect, invoiceController.getChildInvoices);
router.post('/invoices-minimal-delivery', protect, invoiceController.listInvoicesMinimalWithoutChallan);
//invoice
router.put('/invoice/cancel/:id', protect, invoiceController.cancelInvoice);
router.post('/invoices/:invoiceId/exchange-payment', protect, invoiceController.handleExchangePayment); // ✅ Exchange payment endpoint


//invoice-preference-module-setting
router.get("/invoice-preferences-get", protect, invoicePreferenceController.getPreferences);
router.post("/invoice-preferences-upsert", protect, invoicePreferenceController.upsertPreferences);
router.delete("/invoice-preferences-delete", protect, invoicePreferenceController.deletePreferences);

//barcode-settings
const barcodeSettingsController = require('../controllers/barcodeSettingsController');
router.get("/barcode-settings/get", protect, barcodeSettingsController.getSettings);
router.post("/barcode-settings/upsert", protect, barcodeSettingsController.upsertSettings);

//qr-settings
const qrSettingsController = require('../controllers/qrSettingsController');
router.get("/qr-settings/get", protect, qrSettingsController.getSettings);
router.post("/qr-settings/upsert", protect, qrSettingsController.upsertSettings);

//UPI Settings
const upiSettingsController = require('@controllers/Admin/upiSettingsController');
router.get("/settings/upi", protect, upiSettingsController.getUpiSettings);
router.put("/settings/upi", protect, upiSettingsController.updateUpiSettings);

//Email Settings
router.post("/email-settings", protect, emailSettingsController.createOrUpdateEmailSettings);
router.get("/email-settings", protect, emailSettingsController.getEmailSettings);

//Email Template
router.post("/email-template", protect, emailTeamplateController.createEmailTemplate);
router.get("/email-template", protect, emailTeamplateController.listEmailTemplates);
router.put("/email-template/:id", protect, emailTeamplateController.updateEmailTemplate);
router.delete("/email-template/:id", protect, emailTeamplateController.deleteEmailTemplate);
router.get("/notification-types", protect, emailTeamplateController.listNotificationTypes);


//credit notes
router.post('/credit-notes', protect, upload.single('signatureImage'), createCreditNoteValidator, creditNoteController.createCreditNote);
router.get('/credit-notes', protect, creditNoteController.getAllCreditNotes);
router.get('/credit-notes/:id', protect, creditNoteController.getCreditNoteById);
router.put('/credit-notes/:id', protect, upload.single('signatureImage'), creditNoteController.updateCreditNote);
router.delete('/credit-notes/:id', protect, creditNoteController.deleteCreditNote);
router.post('/credit-notes/bulk-delete', protect, creditNoteController.bulkDeleteCreditNotes);

//delivery challan
router.post('/delivery-challan', protect, upload.single('signatureImage'), createDeliveryChallanValidator, deliveryChallanController.createDeliveryChallan);
router.get('/delivery-challan', protect, deliveryChallanController.getDeliveryChallans);
router.get('/delivery-challan/:id', protect, deliveryChallanController.getDeliveryChallanById);
router.put('/delivery-challan/:id', protect, upload.single('signatureImage'), deliveryChallanController.updateDeliveryChallan);
router.delete('/delivery-challan/:id', protect, deliveryChallanController.deleteDeliveryChallan);

//inventory
router.get('/inventory', protect, inventoryController.listInventory);
router.get('/inventory/history/:id', protect, inventoryController.getInventoryHistory);
router.post('/inventory', protect, inventoryController.updateStock);

//staff
router.post('/staff', protect, upload.single('profileImage'), createStaffValidator, userController.createStaffUser);
router.put('/staff/:id', protect, upload.single('profileImage'), userController.updateStaffUser);
router.get('/staff', protect, userController.listStaffUsers);
router.delete('/staff/:id', protect, userController.deleteStaffUser);
router.post('/staff/bulk-delete', protect, userController.bulkDeleteStaffUsers);
router.get('/cashiers', protect, userController.listCashiersRoleName);
router.get('/staffslist', protect, userController.listStaffsRoleName);
router.get('/staffs-commission-list', protect, userController.listStaffCommissionData);
router.get('/staff/:id/commission/daily', protect, userController.getStaffDailyCommissionHistory);
router.get('/staff/:id/commission/monthly', protect, userController.getStaffMonthlyCommissionSummary);
router.get('/staff/:id/commission/dashboard', protect, userController.getStaffCommissionDashboard);
router.get('/staff/:id/commission/chart/daily', protect, userController.getDailyChartData);
router.get('/staff/:id/commission/chart/monthly', protect, userController.getMonthlyChartData);

// staff salary
router.get('/staff-salary/summary', protect, staffSalaryController.getStaffSalarySummary);
router.get('/staff-salary', protect, staffSalaryController.listStaffSalaryPayments);
router.post('/staff-salary', protect, staffSalaryController.createStaffSalaryPayment);
router.get('/staff-salary/export', protect, staffSalaryController.exportStaffSalaryExcel);

//commission
router.put('/commission', protect, commissionController.updateCommission);
router.get('/commission', protect, validateCommissionUpdate, commissionController.getCommission);

//attendance - NEW FEATURE
router.post('/attendance', protect, markAttendanceValidator, attendanceController.markAttendance);
router.patch('/attendance/checkout/:id', protect, markCheckOutValidator, attendanceController.markCheckOut);
router.get('/attendance', protect, attendanceController.getAllAttendance);
router.get('/attendance/staff/:staffId', protect, attendanceController.getStaffAttendance);
router.get('/attendance/date/:date', protect, attendanceController.getAttendanceByDate);
router.get('/attendance/today', protect, attendanceController.getTodayAttendance);
router.put('/attendance/:id', protect, updateAttendanceValidator, attendanceController.updateAttendanceStatus);
router.get('/attendance/report/:staffId', protect, attendanceController.getAttendanceReport);
router.get('/attendance/summary/:staffId', protect, attendanceController.getStaffAttendanceSummary);

//roles
router.get('/roles', protect, roleController.getRoles);
router.get('/roles-minimal', protect, roleController.getAllRoles);
router.post('/roles', protect, createRoleValidator, roleController.createRole);
router.put('/roles/:id', protect, roleController.updateRole);
router.delete('/roles/:id', protect, roleController.deleteRole);
router.get('/user-by-role/:roleId', protect, roleController.listUsersByRole);


//permission
router.get('/permissions/:roleId', protect, permissionController.getPermissionsByRole);
router.get('/module-hierarchy', protect, permissionController.getModuleHierarchy);
router.post('/permissions', protect, permissionController.createOrUpdatePermissions);

//report
router.get('/inventory/stock-summary', protect, reportController.getInventoryStockSummary);
router.get('/report/inventory', protect, reportController.getInventoryReport);
router.get('/report/best-seller', protect, reportController.getBestSellerReport);
router.get('/report/low-stock', protect, reportController.getLowStockReport);
router.get('/report/stock-history', protect, reportController.getStockHistoryReport);
router.get('/report/out-of-stock', protect, reportController.getOutStockReport);

//accounting report
router.get('/report/income', protect, accountingReportController.getIncomeStats);
router.get('/report/expense', protect, accountingReportController.getPurchaseReport);
router.get('/report/payment-summary', protect, accountingReportController.getPaymentSummaryReport);
router.get('/report/profit-loss', protect, accountingReportController.getProfitLossReport);
router.get('/report/profit-loss/export-excel', protect, accountingReportController.exportProfitLossReportExcel);

//transaction report
router.get('/report/sales', protect, transactionReportController.getInvoiceSalesReport);
router.get('/report/sales/export-excel', protect, transactionReportController.exportSalesReportExcel);  // ✅ Export sales report to Excel
router.get('/report/sales/export-gst-excel', protect, transactionReportController.exportSalesGstReportExcel);
router.get('/report/hsn-gst', protect, transactionReportController.getHsnGstReport);
router.get('/report/hsn-gst/export-excel', protect, transactionReportController.exportHsnGstReportExcel);
router.get('/report/sales-return', protect, transactionReportController.getCreditNoteSalesReport);
router.get('/report/purchase', protect, transactionReportController.getPurchaseReport);
router.get('/report/purchase/export', protect, transactionReportController.exportPurchaseReport);
router.get('/report/purchase/export-gst', protect, transactionReportController.exportPurchaseGstReportExcel);
router.get('/report/debit-note', protect, transactionReportController.getDebitNoteReport);
router.get('/report/quotation', protect, transactionReportController.getQuotationSalesReport);

//security Settings
router.put('/security/reset-password/:userId', protect, securityController.resetPassword);
router.delete('/security/delete-account/:userId', protect, securityController.deleteAccount);
router.get('/security/login-activities/:userId', protect, securityController.getLoginActivitiesByUser);

//dashboard
router.get('/dashboard', protect, dashboardController.getDashboard);

// notifications
router.get('/notifications', protect, notificationController.listNotifications);
router.get('/notifications/unread-count', protect, notificationController.getUnreadNotificationCount);
router.patch('/notifications/:id/read', protect, notificationController.markNotificationRead);
router.patch('/notifications/read-all', protect, notificationController.markAllNotificationsRead);
router.post('/notifications/run-check', protect, notificationController.runNotificationCheck);

// ai document extraction
router.post('/ai/extract/purchase-bill', protect, aiUpload.single('file'), aiController.extractPurchaseBill);
router.post('/ai/extract/supplier-details', protect, aiUpload.single('file'), aiController.extractSupplierDetails);
router.post('/ai/extract/invoice', protect, aiUpload.single('file'), aiController.extractInvoice);
router.post('/ai/extract/quotation', protect, aiUpload.single('file'), aiController.extractQuotation);

// to-do tasks
router.get('/todos', protect, todoController.listTodoTasks);
router.get('/todos/summary', protect, todoController.getTodoTaskSummary);
router.post('/todos', protect, todoController.createTodoTask);
router.put('/todos/:id', protect, todoController.updateTodoTask);
router.patch('/todos/:id/complete', protect, todoController.markTodoTaskCompleted);
router.delete('/todos/:id', protect, todoController.deleteTodoTask);

//expense
router.post("/expenses", protect, upload.single("attachment"), createExpenseValidator, expenseController.createExpense);
router.get("/expenses", protect, expenseController.getAllExpenses);
router.get("/expenses/:id", protect, expenseController.getExpenseById);
router.put("/expenses/:id", protect, upload.single("attachment"), expenseController.updateExpense);
router.delete("/expenses/:id", protect, expenseController.deleteExpense);

//expenseCategory
router.post("/expense-category", protect, expenseCategoryController.createExpenseCategory);
router.get("/expense-category", protect, expenseCategoryController.getAllExpenseCategories);
router.get("/expense-category/:id", protect, expenseCategoryController.getExpenseCategoryById);
router.put('/expense-category/:id', protect, expenseCategoryController.updateExpenseCategory);
router.delete('/expense-category/:id', protect, expenseCategoryController.deleteExpenseCategory);
router.get("/expense-category-minimal", protect, expenseCategoryController.listExpenseCategories);

//monthly expenses
const monthlyExpenseController = require('@controllers/Admin/monthlyExpenseController');
router.post('/monthly-expenses', protect, monthlyExpenseController.validateMonthlyExpense, monthlyExpenseController.createMonthlyExpense);
router.get('/monthly-expenses', protect, monthlyExpenseController.getAllMonthlyExpenses);
router.get('/monthly-expenses/summary', protect, monthlyExpenseController.getExpenseSummary);
router.get('/monthly-expenses/:id', protect, monthlyExpenseController.getMonthlyExpenseById);
router.put('/monthly-expenses/:id', protect, monthlyExpenseController.validateMonthlyExpense, monthlyExpenseController.updateMonthlyExpense);
router.delete('/monthly-expenses/:id', protect, monthlyExpenseController.deleteMonthlyExpense);


//pettyCash
router.post("/petty-cash", protect, pettyCashController.createPettyCash);
router.get("/petty-cash", protect, pettyCashController.listPettyCash);
router.get("/bank-petty-chart", protect, pettyCashController.getFinancialSummary);
router.put("/petty-cash", protect, pettyCashController.returnPettyCash);
router.get("/petty-cash-transaction", protect, pettyCashController.listPettyCashTransactions);

//app-version
router.get("/app-version", appVersionController.getAppVersionStatus);

//custom-fields
router.post('/custom-fields', protect, createCustomFieldValidator, customFieldController.createCustomField);
router.get('/custom-fields', protect, customFieldController.getAllCustomFields);
router.get('/custom-fields/:id', protect, customFieldController.getCustomFieldById);
router.put('/custom-fields/:id', protect, updateCustomFieldValidator, customFieldController.updateCustomField);
router.delete('/custom-fields/:id', protect, customFieldController.deleteCustomField);
router.get('/custom-fields-minimal', protect, customFieldController.getCustomFieldsMinimal);

//custom-field-data-types
router.post('/custom-field-data-types', protect, createCustomFieldDataTypeValidator, customFieldDataTypeController.createCustomFieldDataType);
router.get('/custom-field-data-types', protect, customFieldDataTypeController.getAllCustomFieldDataTypes);

// PhonePe Routes
const phonepeRoutes = require('./phonepeRoutes');
router.use('/phonepe', phonepeRoutes);

//Broker routes
router.post('/brokers', protect, brokerController.createBroker);
router.get('/brokers', protect, brokerController.getBrokers);
router.put('/brokers/:id', protect, brokerController.updateBroker);
router.delete('/brokers/:id', protect, brokerController.deleteBroker);
router.delete('/brokers/master/:id', protect, brokerController.deleteBrokerMaster);
router.post('/brokers/master/bulk-delete', protect, brokerController.bulkDeleteBrokerMasters);
router.post('/brokers/upload-excel', protect, excelUpload.single('file'), brokerController.uploadBrokersFromExcel);
router.get('/brokers/sample-template', protect, brokerController.downloadBrokerSampleTemplate);
router.get('/brokers-deals/:id', protect, brokerController.getBrokerDeals);

// ─────────────────────────────────────────────
// Offline Sync Routes (Electron Desktop App)
// Receive offline records and upsert to Atlas using _localId deduplication
// ─────────────────────────────────────────────
const offlineSyncController = require('../controllers/offlineSyncController');
router.get('/offline-sync/status', protect, offlineSyncController.getSyncStatus);
['invoices','quotations','credit-notes','purchases','suppliers','supplier-payments','customers','users','attendance','staff-salary'].forEach((col) => {
  router.post(`/${col}/sync-offline`, protect, offlineSyncController.syncFromOffline);
});

module.exports = router;
