import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useReactToPrint } from "react-to-print"; // To Print Bill
import { PlusCircle, Settings, Loader2Icon, Edit2Icon, Eye, EyeOff, Save, Truck, FileText, MapPin, CheckCircle2, FileSearch } from "lucide-react";
import DateInput from "@components/admin/DateInput";
import axios, { AxiosError } from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { useDebounce } from "@hooks/useDebounce";
import Modal from "@components/admin/Modal";
import ProductDetailsModal from "@components/admin/ProductDetailsModal";
import { numberToWords } from "@utils/converters";
import { toast } from "react-toastify";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import FullPageLoader from "@components/admin/FullPageLoader";
import InvoiceTableRow from "@components/admin/InvoiceTableRow";
import ProductItemsSummaryFooter from "@components/admin/ProductItemsSummaryFooter";
import CreateCustomerForm from "@components/admin/CreateCustomerForm";
import SmartDropdown from "@components/admin/SmartDropdown";
import CreateBankAccountModal from "./CreateBankAccountModal";
import type { Customer } from "@models/customer";
import type { OptionType, SelectedAdmin } from "@models/common";
import type { Product, ProductItem } from "@models/product";
import type { BankAccountCreatedResponse } from "@models/bank-account";
import InvoiceNumberConfigModal from "./InvoiceNumberConfigModal";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import PaymentModal from "./PaymentModal";
import ThermalInvoice58mm from "./ThermalInvoice58mm";
import { formatVariantDisplay, getBrandName } from "@utils/formatVariantDisplay";
import AiDocumentScanModal from "@components/admin/AiDocumentScanModal";
import ProfessionalPrintDialog from "@components/admin/ProfessionalPrintDialog";

interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  referenceNo?: string;
  status: string;
  isRecurring: boolean;
  repeatEvery: "day" | "week" | "month" | "year" | "custom" | null;
  customIntervalNumber: number | null;
  customIntervalType: "day" | "week" | "month" | "year" | null;
  startOn: Date | null;
  endsOn: Date | null;
  neverExpire: boolean;
  billFrom: string;
  billTo: string;
  items: ProductItem[];
  notes: string;
  termsAndCondition: string;
  bank: string | null;
  subTotal: number | null;
  totalTax: number | null;
  totalDiscount: number | null;
  grandTotal: number | null;
  totalPaid?: number | null;
  payment_method?: string | null;
  paymentMethod?: string | null;
  isCreditInvoice?: boolean;
  exchangeOldTotal?: number | null;
  exchangeNewTotal?: number | null;
  taxType: "GST" | "Non-GST";
  gstType?: "Inclusive" | "Exclusive";
  customerGstin: string;
  ewayBillNumber: string;
  shippingAddress: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
  };
}

interface taxGroup {
  _id: string;
  tax_name: string;
  total_tax_rate: number;
  tax_rates: {
    _id: string;
    tax_name: string;
    tax_rate: number;
  }[];
}


type CreateInvoiceProps = {
  mode?: "create" | "edit";
  invoiceId?: string;
  forceStatus?: "UNPAID" | "DRAFT" | "SENT" | "PAID" | "CANCELLED";
  disablePaymentModal?: boolean;
  skipInventoryCheck?: boolean;
  isCreditNote?: boolean;
};

const CreateInvoice: React.FC<CreateInvoiceProps> = ({
  mode = "create",
  invoiceId,
  forceStatus,
  disablePaymentModal = false,
  skipInventoryCheck = false,
  isCreditNote = false,
}) => {
  const formatWholeAmountDisplay = (value: number | string | null | undefined) =>
    Number(value || 0).toFixed(2);

  const navigate = useNavigate();
  const location = useLocation();
  const reloadCreateInvoicePage = () => window.location.reload();
  const reloadExchangeCreatePage = () => window.location.reload();
  const isEditMode = mode === "edit";
  const isExchangeCreate = !isEditMode && location.pathname.startsWith("/admin/invoices/exchange");
  const [searchParams, setSearchParams] = useSearchParams();
  const exchangeSourceInvoiceId = searchParams.get("fromInvoice") || "";
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { data: systemSettings } = useSelector(
    (state: RootState) => state.systemSettings
  );

  const [adminUsers, setAdminUsers] = useState<OptionType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDropdownItems, setCustomerDropdownItems] = useState<
    { id: string; name: string; subLabel?: string }[]
  >([]);
  const [customerSearchInput, setCustomerSearchInput] = useState<string>("");
  const debouncedSearchTermCustomer = useDebounce(customerSearchInput, 500);
  const [exchangeInvoiceOptions, setExchangeInvoiceOptions] = useState<OptionType[]>([]);
  const [exchangeInvoiceSearchInput, setExchangeInvoiceSearchInput] = useState("");
  const debouncedExchangeInvoiceSearch = useDebounce(exchangeInvoiceSearchInput, 500);
  const [selectedAdmin, setSelectedAdmin] = useState<OptionType | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [companyDetails, setCompanyDetails] = useState<SelectedAdmin | null>(
    null
  );
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [enableInvoiceDetails, setEnableInvoiceDetails] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showAiInvoiceScanModal, setShowAiInvoiceScanModal] = useState(false);
  const exchangePrefillLoadedRef = useRef(false);
  const [exchangeOriginalItems, setExchangeOriginalItems] = useState<ProductItem[]>([]);
  const [selectedExchangeItemIds, setSelectedExchangeItemIds] = useState<string[]>([]);

  const getExchangeItemKey = useCallback((item: ProductItem, fallbackIndex?: number) => {
    const rowId = (item as any)?.rowId || item.id || fallbackIndex;
    return rowId ? String(rowId) : "";
  }, []);


  const [invoiceFormData, setInvoiceFormData] = useState<InvoiceFormData>({
    invoiceNumber: "",
    invoiceDate: new Date(),
    dueDate: null,
    status: "DRAFT",
    isRecurring: false,
    repeatEvery: null,
    customIntervalNumber: null,
    customIntervalType: null,
    startOn: new Date(),
    endsOn: null,
    neverExpire: true,
    billFrom: "",
    billTo: "",
    items: [
    ],
    notes: "",
    termsAndCondition: "",
    bank: null,
    // sign_type: "digitalSignature",
    // signatureId: null,
    // signatureName: "",
    // esignDataUrl: null,
    subTotal: null,
    totalTax: null,
    totalDiscount: null,
    grandTotal: null,
    totalPaid: null,
    payment_method: null,
    paymentMethod: null,
    isCreditInvoice: false,
    taxType: "GST",
    gstType: "Exclusive",
    customerGstin: "",
    ewayBillNumber: "",
    shippingAddress: {
      name: "",
      addressLine1: "",
      addressLine2: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
    },
  });
  const [originalGrandTotal, setOriginalGrandTotal] = useState<number>(0);
  const [invoiceDetailsDraft, setInvoiceDetailsDraft] = useState({
    customerGstin: "",
    ewayBillNumber: "",
    shippingAddress: {
      name: "",
      addressLine1: "",
      addressLine2: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
    },
  });

  const exchangeItemKeys = useMemo(
    () => exchangeOriginalItems
      .map((item, idx) => getExchangeItemKey(item, idx))
      .filter((key) => key !== ""),
    [exchangeOriginalItems, getExchangeItemKey]
  );

  const selectedExchangeItems = useMemo(() => {
    if (selectedExchangeItemIds.length === 0) return [];
    const selectedSet = new Set(selectedExchangeItemIds);
    return exchangeOriginalItems.filter((item, idx) =>
      selectedSet.has(getExchangeItemKey(item, idx))
    );
  }, [exchangeOriginalItems, selectedExchangeItemIds, getExchangeItemKey]);

  const exchangeOldTotal = useMemo(() => {
    if (isExchangeCreate) {
      return Number(originalGrandTotal || 0);
    }
    return selectedExchangeItems.reduce((sum, item) => {
      const amount = Number(item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0)));
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
  }, [isExchangeCreate, originalGrandTotal, selectedExchangeItems]);

  const exchangeNewTotal = useMemo(
    () => Number(invoiceFormData.grandTotal || 0),
    [invoiceFormData.grandTotal]
  );
  const exchangeAmountDifference = useMemo(
    () => Number((exchangeNewTotal - exchangeOldTotal).toFixed(2)),
    [exchangeNewTotal, exchangeOldTotal]
  );

  const allExchangeSelected =
    exchangeItemKeys.length > 0 &&
    exchangeItemKeys.every((key) => selectedExchangeItemIds.includes(key));

  const toggleExchangeItem = (key: string, checked: boolean) => {
    setSelectedExchangeItemIds((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((id) => id !== key);
    });
  };

  const toggleAllExchangeItems = (checked: boolean) => {
    setSelectedExchangeItemIds(checked ? [...exchangeItemKeys] : []);
  };

  useEffect(() => {
    if (!isExchangeCreate || exchangeOriginalItems.length === 0) return;

    const selectedSet = new Set(selectedExchangeItemIds);
    const unselectedOriginals = exchangeOriginalItems.filter((item, idx) =>
      !selectedSet.has(getExchangeItemKey(item, idx))
    );

    setInvoiceFormData((prev) => {
      const existingItems = Array.isArray(prev.items) ? prev.items : [];
      const preservedNonOriginal = existingItems.filter(
        (item: any) => item.exchangeSource !== "original"
      );
      const existingOriginalMap = new Map(
        existingItems
          .filter((item: any) => item.exchangeSource === "original")
          .map((item: any) => [getExchangeItemKey(item, undefined), item])
      );

      const mergedOriginals = unselectedOriginals.map((item, idx) => {
        const key = getExchangeItemKey(item, idx);
        const existing = existingOriginalMap.get(key);
        if (existing) return existing;
        const rowId = (item as any).rowId || item.id || crypto.randomUUID();
        return {
          ...item,
          id: rowId,
          rowId,
          exchangeSource: "original",
        } as ProductItem & { exchangeSource?: string };
      });

      return {
        ...prev,
        items: [...mergedOriginals, ...preservedNonOriginal],
      };
    });
  }, [isExchangeCreate, exchangeOriginalItems, selectedExchangeItemIds, getExchangeItemKey]);
  const [invoiceLevelDiscount, setInvoiceLevelDiscount] = useState(0);
  const [invoiceLevelDiscountType, setInvoiceLevelDiscountType] = useState<"Fixed" | "Percentage">("Fixed");
  const [isEditLoading, setIsEditLoading] = useState(isEditMode);
  const [isExtraPaymentMode, setIsExtraPaymentMode] = useState(false);

  const effectiveGstMode = isEditMode
    ? (invoiceFormData.gstType || systemSettings?.company?.gstMode || "Exclusive")
    : (systemSettings?.company?.gstMode || "Exclusive");

  const getInvoiceDiscountAmount = (
    baseAmount: number,
    value: number,
    type: "Fixed" | "Percentage"
  ) => {
    const safeBase = Math.max(baseAmount, 0);
    if (type === "Percentage") {
      const safeValue = Math.min(Math.max(Number(value) || 0, 0), 100);
      return Math.min((safeBase * safeValue) / 100, safeBase);
    }
    const safeValue = Math.max(Number(value) || 0, 0);
    return Math.min(safeValue, safeBase);
  };

  const getInvoiceDiscountForPayload = () => {
    const subTotal = Number(invoiceFormData.subTotal || 0);
    const totalTax = Number(invoiceFormData.totalTax || 0);
    const isInclusive = invoiceFormData.taxType === "GST" && effectiveGstMode === "Inclusive";
    const discountBase = isInclusive ? subTotal : subTotal + totalTax;
    const lineDiscount = Math.max(
      Number(invoiceFormData.totalDiscount || 0) - Math.max(Number(invoiceLevelDiscount) || 0, 0),
      0
    );
    const base = Math.max(discountBase - lineDiscount, 0);
    return getInvoiceDiscountAmount(base, invoiceLevelDiscount, invoiceLevelDiscountType);
  };

  // Edit Modal State
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [taxes, setTaxes] = useState<taxGroup[]>([]);

  // Extra Information State
  const [activeInfoTab, setActiveInfoTab] = useState<"notes" | "termsAndCondition" | "bank">("termsAndCondition");
  const [bankAccounts, setBankAccounts] = useState<OptionType[]>([]);

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bankAccountSearchInput, setBankAccountSearchInput] =
    useState<string>("");
  const debouncedSearchTermBankAccount = useDebounce(
    bankAccountSearchInput,
    500
  );
  const [isCreateBankAccountModalOpen, setIsCreateBankAccountModalOpen] = useState(false);
  const [invoiceNumberConfigModalOpen, setInvoiceNumberConfigModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [invoiceDraft, setInvoiceDraft] = useState<FormData | null>(null);   // For Payment Modes
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isExchangePaymentMode, setIsExchangePaymentMode] = useState(false);
  const [exchangePaymentAmount, setExchangePaymentAmount] = useState(0);
  const [exchangeInvoiceId, setExchangeInvoiceId] = useState<string | null>(null);
  const [phonepeQRCode, setPhonepeQRCode] = useState<string | null>(null);
  const [upiQRCode, setUpiQRCode] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  useEffect(() => {
    if (isEditMode || !forceStatus) return;
    setInvoiceFormData((prev) => ({ ...prev, status: forceStatus }));
  }, [forceStatus, isEditMode]);

  const ensureFreshInventoryAndValidate = async () => {
    const latestMap = await fetchInventory();
    return validateInventoryBeforePayment(latestMap);
  };

  const handleSaveAndSendWithPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isExchangeCreate && exchangeSourceInvoiceId) {
      await saveQuotation(e, "EXCHANGE");
      return;
    }

    const errors = validateQuotationData();
    if (Object.keys(errors).length > 0) return;
    if (!(await ensureFreshInventoryAndValidate())) return;

    const invoiceDataForSubmit = await ensureBillToCustomer(invoiceFormData);
    if (!invoiceDataForSubmit) return;

    const draft = new FormData();

    const useGrossAmountForInclusive =
      invoiceFormData.taxType === "GST" && effectiveGstMode === "Inclusive";

    appendInvoiceFormData(draft, invoiceDataForSubmit, { useGrossAmountForInclusive });

    // ✅ Add GST Mode from system settings
    const currentGstMode = effectiveGstMode;
    draft.set("gstType", currentGstMode);
    draft.set("overall_discount", String(getInvoiceDiscountForPayload()));

    if (isEditMode && !isExchangeCreate && invoiceFormData.status !== "DRAFT") {
      setIsExtraPaymentMode(true);
    }

    setInvoiceDraft(draft);
    setShowPaymentModal(true);
  };

  const handleEditSaveWithPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateQuotationData();
    if (Object.keys(errors).length > 0) return;
    if (!(await ensureFreshInventoryAndValidate())) return;

    const invoiceDataForSubmit = await ensureBillToCustomer(invoiceFormData);
    if (!invoiceDataForSubmit) return;

    const draft = new FormData();
    const useGrossAmountForInclusive =
      invoiceFormData.taxType === "GST" && effectiveGstMode === "Inclusive";

    appendInvoiceFormData(draft, invoiceDataForSubmit, { useGrossAmountForInclusive });

    draft.set("gstType", effectiveGstMode);
    draft.set("overall_discount", String(getInvoiceDiscountForPayload()));
    if (isEditMode) {
      draft.set("skipExchangeDetection", "true");
    }
    setInvoiceDraft(draft);
    setShowPaymentModal(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const statusToSave = invoiceFormData.status === "DRAFT" ? "UNPAID" : invoiceFormData.status;
    await saveQuotation(e, statusToSave);
  };

  const handlePrimaryAction = async (e: React.FormEvent) => {
    if (isEditMode) {
      await handleSaveAndSendWithPayment(e);
      return;
    }

    if (forceStatus && disablePaymentModal) {
      setInvoiceFormData((prev) => ({ ...prev, status: forceStatus }));
      await saveQuotation(e, forceStatus);
      return;
    }

    await handleSaveAndSendWithPayment(e);
  };

  const validateInventoryBeforePayment = (mapOverride?: Record<string, number>) => {
    const mapToUse = mapOverride ?? inventoryMap;
    for (const item of invoiceFormData.items) {
      if (!item.name?.trim()) {
        continue;
      }
      if (!item.variantId) {
        toast.error("Please select a product variant");
        return false;
      }

      if (skipInventoryCheck) {
        continue;
      }

      // Inventory validation removed: allow invoice creation even if stock is zero or missing.
      // Backend will create inventory if missing and allow negative stock.
    }

    return true;
  };

  // For Product variants
  const rowRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  const [variantList, setVariantList] = useState<any[]>([]);   // For Product Variant's Barcode Scanning
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});

  const mergeVariantsIntoCache = useCallback((variants: any[]) => {
    setVariantList((prev) => {
      const byId = new Map(prev.map((variant: any) => [String(variant?._id || ""), variant]));
      variants.forEach((variant: any) => {
        if (variant?._id) byId.set(String(variant._id), variant);
      });
      return Array.from(byId.values());
    });
  }, []);

  const fetchVariantsBySearch = useCallback(async (search: string) => {
    try {
      const res = await axios.get(
        Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { search: search.trim(), all: true }
        }
      );
      const responseData = res.data.data;
      const variants = Array.isArray(responseData?.variants) ? responseData.variants : [];
      mergeVariantsIntoCache(variants);
      return variants;
    } catch (err) {
      console.error("Variant list error:", err);
      return [];
    }
  }, [mergeVariantsIntoCache, token]);

  const fetchVariantsByBarcode = useCallback(async (barcode: string) => {
    const normalizedBarcode = barcode.trim();
    const variants = await fetchVariantsBySearch(normalizedBarcode);
    return variants.filter((variant: any) => String(variant?.barcode || "").trim() === normalizedBarcode);
  }, [fetchVariantsBySearch]);

  // STAFF SELECTION STATE
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);
  const [showStaffSelector, setShowStaffSelector] = useState(true);

  const fetchStaffList = async () => {
    try {
      const res = await axios.get(Constants.FETCH_STAFF_FOR_LIST_STAFF_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data?.data ?? [];
      const formatted = data.map((u: any) => ({
        id: u.id,
        name: u.name
      }));

      setStaffList(formatted);
    } catch (err) {
      console.error("Error loading staff list:", err);
    }
  };

  const resolveStaffName = useCallback((staffId: any, fallbackName?: string) => {
    if (fallbackName) return fallbackName;
    if (!staffId) return "";
    const matchedStaff = staffList.find((staff: any) => String(staff.id) === String(staffId));
    return matchedStaff?.name || "";
  }, [staffList]);

  const handleSelectStaff = (staff: any) => {
    setSelectedStaffId(staff.id);
    setSelectedStaffName(staff.name);

    setShowStaffSelector(false);

    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.map(row => ({
        ...row,
        staffId: row.staffId ?? staff.id,
        staffName: row.staffName ?? staff.name,
      }))
    }));
  };


  const scanBufferRef = useRef("");
  const scanTimeoutRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const [productList, setProductList] = useState<Product[]>([]);
  const [quickAddSearch, setQuickAddSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(-1);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const quickAddListRef = useRef<HTMLUListElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuickAddSearch = useDebounce(quickAddSearch, 400);
  const [showDuplicateBarcodeModal, setShowDuplicateBarcodeModal] = useState(false);
  const [duplicateBarcodeMatches, setDuplicateBarcodeMatches] = useState<any[]>([]);
  const [pendingBarcodeRowId, setPendingBarcodeRowId] = useState<string | null>(null);
  const [pendingBarcodeSource, setPendingBarcodeSource] = useState<"scan" | "row">("scan");

  const [isQuickAddQuantityModalOpen, setIsQuickAddQuantityModalOpen] = useState(false);
  const [quickAddStaffId, setQuickAddStaffId] = useState<string | null>(null);
  const [pendingQuickAddEntry, setPendingQuickAddEntry] = useState<{ product: any; variant: any; rowId?: string; isEdit?: boolean; qty?: number; rate?: number; discount?: number; name?: string; } | null>(null);

  const clearQuickAddScannerInput = useCallback(() => {
    setQuickAddSearch("");
    setShowQuickAdd(false);
    setQuickAddActiveIndex(-1);
  }, []);

  // To Print the Bill
  const printRef = useRef<HTMLDivElement>(null);
  const [showProfessionalPrintDialog, setShowProfessionalPrintDialog] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const pendingPrintActionRef = useRef<(() => void) | null>(null);

  const handleSendWhatsAppClick = async () => {
    const phone = customerDetails?.phone || selectedCustomer?.phone || customerSearchInput;
    if (!phone) {
      toast.error('No phone number attached to this invoice');
      return;
    }
    const targetInvoiceId = isEditMode ? invoiceId : createdInvoiceId;
    if (!targetInvoiceId) {
      toast.error('Invoice ID not found. Please save first.');
      return;
    }
    try {
      await axios.post(
        Constants.WHATSAPP_SEND_MANUAL_URL,
        { documentId: targetInvoiceId, documentType: 'invoice' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('WhatsApp send requested successfully');
    } catch (error: any) {
      console.error('Failed to send invoice on WhatsApp:', error);
      toast.error(error.response?.data?.message || 'Failed to send WhatsApp message');
    }
  };

  const executePrintBill = useReactToPrint({
    documentTitle: `Invoice-${invoiceFormData.invoiceNumber || ""}`,
    contentRef: printRef,
    onAfterPrint: () => {
      const nextAction = pendingPrintActionRef.current;
      pendingPrintActionRef.current = null;
      if (nextAction) nextAction();
    },
  });

  const handlePrintBill = (onAfterPrint?: () => void) => {
    pendingPrintActionRef.current = onAfterPrint || null;
    setShowProfessionalPrintDialog(true);
  };

  const printWithQr = (
    qrCode: string,
    method: "UPI" | "MIXED" | "PHONEPE",
    onAfterPrint?: () => void
  ) => {
    if (method === "UPI" || method === "MIXED") {
      setUpiQRCode(qrCode);
      setPhonepeQRCode(null);
    } else {
      setPhonepeQRCode(qrCode);
      setUpiQRCode(null);
    }

    const img = new Image();
    img.onload = () => {
      setTimeout(() => {
        handlePrintBill(onAfterPrint);
      }, 100);
    };
    img.src = qrCode;
  };

  useEffect(() => {
    fetchAdminUsers();
    fetchTaxes();
    if (!isEditMode) {
      fetchNextInvoiceNumber();
    }
    fetchStaffList();
  }, [isEditMode]);

  useEffect(() => {
    const fetchQuickAddProducts = async () => {
      const term = debouncedQuickAddSearch.trim();
      if (!term) {
        return;
      }

      try {
        const [productsResponse] = await Promise.all([
          axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
            params: { search: term, limit: 50 },
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetchVariantsBySearch(term),
        ]);
        const products = productsResponse?.data?.data?.products ?? productsResponse?.data?.data ?? [];
        const productList = Array.isArray(products) ? products : [];
        setProductList((prev) => {
          const byId = new Map(prev.map((product: any) => [String(product?.id || product?._id || ""), product]));
          productList.forEach((product: any) => {
            const id = String(product?.id || product?._id || "");
            if (id) byId.set(id, product);
          });
          return Array.from(byId.values()) as Product[];
        });
      } catch {
      }
    };
    fetchQuickAddProducts();
  }, [debouncedQuickAddSearch, fetchVariantsBySearch, token]);

  useEffect(() => {
    if (isEditMode || isQuickAddQuantityModalOpen) return;
    window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
  }, [isEditMode, isQuickAddQuantityModalOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowQuickAdd(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  const invoicePrefLoadedRef = useRef(false);
  const editPrefillLoadedRef = useRef(false);

  useEffect(() => {
    if (!token || invoicePrefLoadedRef.current || isEditMode) return;

    const fetchInvoicePreferences = async () => {
      try {
        const response = await axios.get(
          Constants.GET_INVOICE_PREFERENCES_SETTINGS_URL,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = response.data?.data;

        if (data) {
          setInvoiceFormData(prev => ({
            ...prev,
            termsAndCondition:
              prev.termsAndCondition || data.termsAndConditions || "",
            notes:
              prev.notes || data.customerNotes || "",
          }));

          invoicePrefLoadedRef.current = true;
        }

      } catch (error) {
        console.error("Failed to load invoice preferences", error);
      }
    };

    fetchInvoicePreferences();
  }, [token]);

  useEffect(() => {
    if (!isExchangeCreate) return;
    const fetchInvoicesQuery = async () => {
      try {
        const response = await axios.get(Constants.GET_INVOICES_FOR_LIST_URL, {
          params: { search: debouncedExchangeInvoiceSearch || "", page: 1, limit: 20 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data?.data;
        const list = Array.isArray(data?.invoices) ? data.invoices : [];
        const allowed = new Set(["PAID", "PARTIALLY_PAID", "EXCHANGE"]);
        const formattedOptions = list
          .filter((invoice: any) => allowed.has(String(invoice.status).toUpperCase()))
          .map((invoice: any) => ({
            id: invoice.id,
            name: invoice.invoiceNumber,
          }));
        setExchangeInvoiceOptions(formattedOptions);
      } catch (error) {
        console.error("Error fetching invoices:", error);
        setExchangeInvoiceOptions([]);
      }
    };

    fetchInvoicesQuery();
  }, [debouncedExchangeInvoiceSearch, token, isExchangeCreate]);

  useEffect(() => {
    const fetchInvoiceForEdit = async () => {
      if (!isEditMode) {
        setIsEditLoading(false);
        return;
      }
      if (!invoiceId || !token || editPrefillLoadedRef.current) {
        setIsEditLoading(false);
        return;
      }
      try {
        setIsEditLoading(true);
        const response = await axios.get(
          `${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${invoiceId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const invoiceData = response.data?.data;
        let resolvedTotalPaid = 0;

        try {
          const paymentDetailsResponse = await axios.get(
            `${Constants.FETCH_INVOICE_PAYMENT_DETAILS_URL}/${invoiceId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          resolvedTotalPaid = Number(
            paymentDetailsResponse.data?.data?.payment?.totalPaid ??
            invoiceData?.totalPaid ??
            0
          );
        } catch {
          resolvedTotalPaid = Number(invoiceData?.totalPaid ?? 0);
        }

        if (invoiceData) {
          const normalizedItems = (invoiceData.items || []).map((item: any) => {
            const rowId = item.rowId || item.id || crypto.randomUUID();
            return {
              ...item,
              id: rowId,
              rowId,
              staffName: resolveStaffName(item.staffId, item.staffName),
            };
          });
          setInvoiceFormData((prev) => ({
            ...prev,
            invoiceNumber: invoiceData.invoiceNumber || "",
            invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : null,
            dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
            status: invoiceData.status || prev.status,
            isRecurring: invoiceData.isRecurring,
            repeatEvery: invoiceData.repeatEvery,
            customIntervalNumber: invoiceData.customIntervalNumber,
            customIntervalType: invoiceData.customIntervalType,
            startOn: invoiceData.startOn ? new Date(invoiceData.startOn) : null,
            endsOn: invoiceData.endsOn ? new Date(invoiceData.endsOn) : null,
            neverExpire: invoiceData.neverExpire,
            billFrom: invoiceData?.billFrom?.id || "",
            billTo: invoiceData?.billTo?.id || "",
            items: normalizedItems,
            notes: invoiceData.notes || "",
            termsAndCondition: invoiceData.termsAndCondition || "",
            bank: invoiceData.bank?.id || null,
            subTotal: invoiceData.taxableAmount ?? prev.subTotal,
            totalTax: invoiceData.vat ?? prev.totalTax,
            totalDiscount: invoiceData.totalDiscount ?? prev.totalDiscount,
            grandTotal: invoiceData.TotalAmount ?? prev.grandTotal,
            totalPaid: resolvedTotalPaid,
            payment_method: invoiceData.payment_method || prev.payment_method,
            paymentMethod: invoiceData.payment_method || prev.paymentMethod,
            isCreditInvoice: String(invoiceData.payment_method || "").toUpperCase() === "CREDIT",
            taxType: invoiceData.taxType || prev.taxType,
            gstType: invoiceData.gstType || prev.gstType,
            customerGstin: invoiceData.customerGstin || "",
            ewayBillNumber: invoiceData.ewayBillNumber || "",
            shippingAddress: {
              name: invoiceData.shippingAddress?.name || "",
              addressLine1: invoiceData.shippingAddress?.addressLine1 || "",
              addressLine2: invoiceData.shippingAddress?.addressLine2 || "",
              country: invoiceData.shippingAddress?.country || "",
              state: invoiceData.shippingAddress?.state || "",
              city: invoiceData.shippingAddress?.city || "",
              pincode: invoiceData.shippingAddress?.pincode || "",
            },
          }));
          setOriginalGrandTotal(Number(invoiceData.TotalAmount || invoiceData.totalAmount || invoiceData.grandTotal || 0));

          if (invoiceData.billFrom) {
            const _admin = { id: invoiceData.billFrom.id, name: invoiceData.billFrom.name };
            handleAdminChange(_admin);
          }
          if (invoiceData.billTo) {
            const _customer = {
              id: invoiceData.billTo.id,
              name: invoiceData.billTo.name,
              email: invoiceData.billTo.email,
              phone: invoiceData.billTo.phone,
              image: invoiceData.billTo.image,
            };
            handleCustomerChange(_customer as any);
          }

          const lineDiscountTotal = Array.isArray(invoiceData.items)
            ? invoiceData.items.reduce((sum: number, item: any) => sum + Number(item.discount || 0), 0)
            : 0;
          const rawInvoiceDiscount =
            invoiceData.overall_discount !== undefined && invoiceData.overall_discount !== null
              ? Number(invoiceData.overall_discount || 0)
              : Number(invoiceData.totalDiscount || 0) - lineDiscountTotal;
          setInvoiceLevelDiscount(Math.max(0, rawInvoiceDiscount));
          setInvoiceLevelDiscountType("Fixed");

          editPrefillLoadedRef.current = true;
        }
      } catch (error) {
        console.error("Error fetching invoice for edit:", error);
      } finally {
        setIsEditLoading(false);
      }
    };

    fetchInvoiceForEdit();
  }, [isEditMode, invoiceId, token]);

  useEffect(() => {
    const prefillFromInvoice = async () => {
      if (!isExchangeCreate || !exchangeSourceInvoiceId || exchangePrefillLoadedRef.current) {
        return;
      }
      try {
        const response = await axios.get(
          `${Constants.FETCH_INVOICE_FOR_EDIT_URL}/${exchangeSourceInvoiceId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const invoiceData = response.data?.data;
        if (invoiceData) {
          const normalizedItems = (invoiceData.items || []).map((item: any) => {
            const rowId = item.rowId || item.id || crypto.randomUUID();
            return {
              ...item,
              id: rowId,
              rowId,
              staffName: resolveStaffName(item.staffId, item.staffName),
            };
          });
          setInvoiceFormData((prev) => ({
            ...prev,
            status: "EXCHANGE",
            billFrom: invoiceData?.billFrom?.id || "",
            billTo: invoiceData?.billTo?.id || "",
            notes: invoiceData.notes || "",
            termsAndCondition: invoiceData.termsAndCondition || "",
            referenceNo: invoiceData.referenceNo || prev.referenceNo,
            taxType: invoiceData.taxType || prev.taxType,
            gstType: invoiceData.gstType || prev.gstType,
            customerGstin: invoiceData.customerGstin || prev.customerGstin,
            ewayBillNumber: invoiceData.ewayBillNumber || prev.ewayBillNumber,
            shippingAddress: {
              name: invoiceData.shippingAddress?.name || prev.shippingAddress.name,
              addressLine1: invoiceData.shippingAddress?.addressLine1 || prev.shippingAddress.addressLine1,
              addressLine2: invoiceData.shippingAddress?.addressLine2 || prev.shippingAddress.addressLine2,
              country: invoiceData.shippingAddress?.country || prev.shippingAddress.country,
              state: invoiceData.shippingAddress?.state || prev.shippingAddress.state,
              city: invoiceData.shippingAddress?.city || prev.shippingAddress.city,
              pincode: invoiceData.shippingAddress?.pincode || prev.shippingAddress.pincode,
            },
          }));

          if (invoiceData.billFrom) {
            let _admin = { id: invoiceData.billFrom.id, name: invoiceData.billFrom.name };
            handleAdminChange(_admin);
          }
          if (invoiceData.billTo) {
            let _customer = {
              id: invoiceData.billTo.id,
              name: invoiceData.billTo.name,
              email: invoiceData.billTo.email,
              phone: invoiceData.billTo.phone,
              image: invoiceData.billTo.image,
            };
            handleCustomerChange(_customer as any);
          }

          const lineDiscountTotal = Array.isArray(invoiceData.items)
            ? invoiceData.items.reduce((sum: number, item: any) => sum + Number(item.discount || 0), 0)
            : 0;
          const rawInvoiceDiscount =
            invoiceData.overall_discount !== undefined && invoiceData.overall_discount !== null
              ? Number(invoiceData.overall_discount || 0)
              : Number(invoiceData.totalDiscount || 0) - lineDiscountTotal;
          setInvoiceLevelDiscount(Math.max(0, rawInvoiceDiscount));
          setInvoiceLevelDiscountType("Fixed");

          setExchangeOriginalItems(normalizedItems);
          setOriginalGrandTotal(Number(invoiceData.TotalAmount || invoiceData.totalAmount || invoiceData.grandTotal || 0));
          setSelectedExchangeItemIds([]);
          exchangePrefillLoadedRef.current = true;
        }
      } catch (error) {
        console.error("Error pre-filling exchange invoice:", error);
      }
    };

    prefillFromInvoice();
  }, [isExchangeCreate, exchangeSourceInvoiceId, token]);

  useEffect(() => {
    if (!staffList.length) return;

    setInvoiceFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        staffName: resolveStaffName((item as any).staffId, (item as any).staffName),
      })),
    }));

    setExchangeOriginalItems((prev) =>
      prev.map((item: any) => ({
        ...item,
        staffName: resolveStaffName(item.staffId, item.staffName),
      }))
    );
  }, [staffList, resolveStaffName]);

  const handleExchangeInvoiceSelect = (option: OptionType) => {
    if (!option?.id) return;
    exchangePrefillLoadedRef.current = false;
    setSearchParams({ fromInvoice: option.id });
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        isExchangeCreate
          ? Constants.FETCH_NEXT_EXCHANGE_INVOICE_NO_URL
          : Constants.FETCH_NEXT_INVOICE_NO_URL,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let data = response.data.data;
      if (data) {
        if (data.invoiceNumberType === "auto") {
          sessionStorage.setItem("defaultNextInvNo", data.nextInvoiceNumber);
          sessionStorage.setItem("nextInvoiceNo", data.nextInvoiceNumber);
          setInvoiceFormData((prev) => ({
            ...prev,
            invoiceNumber: data.nextInvoiceNumber,
          }));
        } else {
          sessionStorage.setItem("defaultNextInvNo", data.nextInvoiceNumber);
          sessionStorage.setItem("nextInvoiceNo", data.nextInvoiceNumber);
          setInvoiceFormData((prev) => ({ ...prev, invoiceNumber: "" }));
        }
      }
    } catch (error) {
      toast.error("Failed to fetch next invoice number.");
    } finally {
      setIsLoading(false);
    }
  };


  const fetchTaxes = async () => {
    if (!token) return;
    try {
      const response = await axios.get(Constants.FETCH_TAX_GROUP_LIST_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = response.data?.data;
      const taxGroups = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setTaxes(taxGroups);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      setTaxes([]);
    }
  };

  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (!token) return;
      try {
        const response = await axios.get(
          Constants.GET_BANK_ACCOUNTS_URL,
          {
            params: { search: debouncedSearchTermBankAccount },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const payload = response.data?.data;
        const bankDetails = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.bankDetails)
            ? payload.bankDetails
            : [];
        if (bankDetails.length > 0) {
          const formattedBankAccounts = bankDetails.map((item: any) => {
            return {
              id: item.id,
              name: item.bankName,
            };
          });

          setBankAccounts(formattedBankAccounts);
        } else {
          setBankAccounts([]);
        }
      } catch (error) {
        console.error("Error fetching bank accounts:", error);
      }
    };
    fetchBankAccounts();
  }, [debouncedSearchTermBankAccount, token]);


  const handleAdminChange = async (user: OptionType) => {
    setSelectedAdmin(user);
    try {
      setIsFetching(true);
      const response = await axios.get(
        `${Constants.FETCH_COMPANY_SETTINGS_URL}/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // set billFrom to formData
      setInvoiceFormData((prev) => ({ ...prev, billFrom: user.id }));
      setCompanyDetails(response.data.data);
    } catch (error) {
      setCompanyDetails(null);
      setInvoiceFormData((prev) => ({ ...prev, billFrom: "" }));
      setSelectedAdmin(null);
    } finally {
      setIsFetching(false);
    }
  };

  const handleCustomerChange = async (user: Customer | null) => {
    if (user) {
      setSelectedCustomer(user);
      setInvoiceFormData((prev) => ({ ...prev, billTo: user.id }));
      setCustomerDetails(user);
    } else {
      setSelectedCustomer(null);
      setInvoiceFormData((prev) => ({ ...prev, billTo: "" }));
      setCustomerDetails(null);
    }
  };

  const sanitizeCustomerPhoneInput = (value: string) =>
    value.replace(/\D/g, "").slice(0, 10);

  const handleCustomerSearchChange = (value: string) => {
    const phone = sanitizeCustomerPhoneInput(value);
    setCustomerSearchInput(phone);
    if (selectedCustomer && selectedCustomer.phone !== phone) {
      handleCustomerChange(null);
    }
  };

  const ensureBillToCustomer = async (
    source: InvoiceFormData
  ): Promise<InvoiceFormData | null> => {
    if (source.billTo) return source;

    const phone = sanitizeCustomerPhoneInput(customerSearchInput);
    if (!phone) return source;

    if (phone.length !== 10) {
      toast.error("Bill To phone number must be 10 digits.");
      return null;
    }

    const existingCustomer = customers.find(
      (customer) => sanitizeCustomerPhoneInput(customer.phone || "") === phone
    );
    if (existingCustomer) {
      await handleCustomerChange(existingCustomer);
      return { ...source, billTo: existingCustomer.id };
    }

    try {
      const response = await axios.post(
        Constants.CREATE_CUSTOMER_MINIMAL_URL,
        { phone },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newCustomer = response.data?.data;
      if (!newCustomer?.id) {
        toast.error("Failed to create customer from Bill To phone.");
        return null;
      }

      const createdCustomer = {
        ...newCustomer,
        phone: newCustomer.phone || phone,
      } as Customer;

      setCustomers((prev) => [createdCustomer, ...prev]);
      setCustomerDropdownItems((prev) => [
        {
          id: createdCustomer.id,
          name: createdCustomer.id,
          subLabel: createdCustomer.phone,
        },
        ...prev,
      ]);
      setCustomerSearchInput(createdCustomer.phone || phone);
      await handleCustomerChange(createdCustomer);

      return { ...source, billTo: createdCustomer.id };
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ errors?: { phone?: string }; message?: string }>;
      if (axiosError.response?.status === 409) {
        try {
          const lookupResponse = await axios.get(
            Constants.GET_CUSTOMERS_WITH_SEARCH_URL,
            {
              params: { search: phone, limit: 10, page: 1 },
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const matchedCustomer = lookupResponse.data?.data?.customers?.find(
            (customer: Customer) =>
              sanitizeCustomerPhoneInput(customer.phone || "") === phone
          );
          if (matchedCustomer?.id) {
            setCustomers((prev) => [matchedCustomer, ...prev.filter((customer) => customer.id !== matchedCustomer.id)]);
            setCustomerDropdownItems((prev) => [
              {
                id: matchedCustomer.id,
                name: matchedCustomer.id,
                subLabel: matchedCustomer.phone,
              },
              ...prev.filter((customer) => customer.id !== matchedCustomer.id),
            ]);
            setCustomerSearchInput(matchedCustomer.phone || phone);
            await handleCustomerChange(matchedCustomer);
            return { ...source, billTo: matchedCustomer.id };
          }
        } catch (lookupError) {
          console.error("Customer lookup after duplicate failed:", lookupError);
        }
      }

      const message =
        axiosError.response?.data?.errors?.phone ||
        axiosError.response?.data?.message ||
        "Failed to create customer from Bill To phone.";
      toast.error(message);
      return null;
    }
  };

  // --- ITEM & FORM HANDLERS ---
  const parseAiDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const findTaxGroupIdByRate = (rate?: number) => {
    const numericRate = Number(rate || 0);
    const matchedTax = taxes.find((tax) => Number(tax.total_tax_rate || 0) === numericRate);
    return matchedTax?._id || null;
  };

  const isValidMongoId = (value?: string | null) => /^[a-f\d]{24}$/i.test(String(value || ""));

  const resolveProductIdFromVariant = useCallback((variantId?: string | null, fallbackProductId?: string | null) => {
    if (isValidMongoId(fallbackProductId)) {
      return String(fallbackProductId);
    }

    const normalizedVariantId = String(variantId || "");
    if (!normalizedVariantId) return "";

    const variantMatch = variantList.find(
      (variant: any) => String(variant?._id || variant?.id || "") === normalizedVariantId
    );

    const productId = typeof variantMatch?.productId === "object" && variantMatch?.productId !== null
      ? (variantMatch.productId.id || variantMatch.productId._id)
      : variantMatch?.productId;

    return isValidMongoId(productId) ? String(productId) : "";
  }, [variantList]);

  const normalizeInvoiceItemsForSubmission = useCallback((items: ProductItem[] = []) => {
    return items
      .filter((item) => item.name?.trim())
      .map((item) => {
        const resolvedVariantId = String((item as any).variantId || "");
        const resolvedProductId = resolveProductIdFromVariant(resolvedVariantId, String((item as any).product_id || ""));

        return {
          ...item,
          product_id: resolvedProductId,
          variantId: resolvedVariantId,
        };
      })
      .filter((item: any) => isValidMongoId(item.product_id) && isValidMongoId(item.variantId));
  }, [resolveProductIdFromVariant]);
  const createAiInvoiceItem = (sourceItem: any, matchedItem: any): ProductItem => {
    const product = matchedItem?.product;
    const variant = matchedItem?.variant;
    const qty = Math.max(Number(sourceItem?.quantity || 1), 1);
    const rate = Number(sourceItem?.rate || variant?.sale_price || 0);
    const baseItem: any = {
      id: crypto.randomUUID(),
      product_id: product?.id || matchedItem?.productId || '',
      name: product
        ? (formatVariantDisplay({
          brandName: getBrandName(product.brand),
          designNo: variant?.designNo || sourceItem?.designNumber || sourceItem?.description,
          size: variant?.size || sourceItem?.size,
        }) || sourceItem?.description || product.name || '')
        : (sourceItem?.description || sourceItem?.designNumber || ''),
      hsn_code: sourceItem?.hsnCode || product?.hsn_code || '',
      unit: sourceItem?.unit || product?.unit?.name || '',
      qty,
      rate,
      discount: Number(sourceItem?.discount || 0),
      tax: 0,
      tax_group_id: (typeof product?.tax === 'object' && product?.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product?.tax) || findTaxGroupIdByRate(sourceItem?.taxRate),
      amount: Number(sourceItem?.amount || qty * rate || 0),
      staffId: selectedStaffId || null,
      staffName: selectedStaffName || '',
      variantId: variant?._id || matchedItem?.variantId || '',
      variantName: `${variant?.color || sourceItem?.color || ''} - ${variant?.size || sourceItem?.size || ''}`.trim(),
      variantDesignNo: variant?.designNo || sourceItem?.designNumber || '',
      variantColor: variant?.color || sourceItem?.color || '',
      variantSize: variant?.size || sourceItem?.size || '',
      variantBarcode: variant?.barcode || sourceItem?.barcode || '',
      variantMrp: Number(variant?.mrp || 0),
    };
    return recalculateItem(baseItem, invoiceFormData.taxType, effectiveGstMode, taxes);
  };

  const applyAiInvoiceExtraction = async (payload: any) => {
    const extracted = payload?.extracted || {};
    const matches = payload?.matches || {};

    if (matches?.customer?.id) {
      const customer = customers.find((item) => String(item.id) === String(matches.customer.id));
      if (customer) {
        await handleCustomerChange(customer);
        setCustomerSearchInput(customer.phone || '');
      }
    } else if (extracted.customerPhone) {
      setCustomerSearchInput(String(extracted.customerPhone).replace(/\D/g, '').slice(0, 10));
    }

    const nextItems = (extracted.items || [])
      .map((item: any, index: number) => ({ item, match: matches?.items?.[index] }))
      .filter((entry: any) => entry.match?.matched)
      .map((entry: any) => createAiInvoiceItem(entry.item, entry.match));

    setInvoiceFormData((prev) => ({
      ...prev,
      invoiceNumber: extracted.invoiceNumber || prev.invoiceNumber,
      invoiceDate: parseAiDate(extracted.invoiceDate) || prev.invoiceDate,
      dueDate: parseAiDate(extracted.dueDate) || prev.dueDate,
      customerGstin: extracted.customerGSTIN || prev.customerGstin,
      notes: extracted.notes || prev.notes,
      items: nextItems.length > 0 ? nextItems : prev.items,
    }));
  };

  const handleFormChange = (field: keyof InvoiceFormData, value: any) => {
    setInvoiceFormData((prev) => ({ ...prev, [field]: value }));
  };

  const syncInvoiceDetailsDraftFromForm = useCallback(() => {
    setInvoiceDetailsDraft({
      customerGstin: invoiceFormData.customerGstin || "",
      ewayBillNumber: invoiceFormData.ewayBillNumber || "",
      shippingAddress: {
        name: invoiceFormData.shippingAddress?.name || "",
        addressLine1: invoiceFormData.shippingAddress?.addressLine1 || "",
        addressLine2: invoiceFormData.shippingAddress?.addressLine2 || "",
        country: invoiceFormData.shippingAddress?.country || "",
        state: invoiceFormData.shippingAddress?.state || "",
        city: invoiceFormData.shippingAddress?.city || "",
        pincode: invoiceFormData.shippingAddress?.pincode || "",
      },
    });
  }, [invoiceFormData.customerGstin, invoiceFormData.ewayBillNumber, invoiceFormData.shippingAddress]);

  const openInvoiceDetailsModal = useCallback(() => {
    syncInvoiceDetailsDraftFromForm();
    setShowInvoiceDetailsModal(true);
  }, [syncInvoiceDetailsDraftFromForm]);

  const handleInvoiceDetailsDraftChange = (
    field: "customerGstin" | "ewayBillNumber",
    value: string
  ) => {
    setInvoiceDetailsDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleShippingAddressDraftChange = (
    field: keyof InvoiceFormData["shippingAddress"],
    value: string
  ) => {
    setInvoiceDetailsDraft((prev) => ({
      ...prev,
      shippingAddress: {
        ...prev.shippingAddress,
        [field]: value,
      },
    }));
  };

  const saveInvoiceDetailsFromModal = () => {
    const normalizedDetails = {
      customerGstin: invoiceDetailsDraft.customerGstin.trim(),
      ewayBillNumber: invoiceDetailsDraft.ewayBillNumber.trim(),
      shippingAddress: {
        name: invoiceDetailsDraft.shippingAddress.name.trim(),
        addressLine1: invoiceDetailsDraft.shippingAddress.addressLine1.trim(),
        addressLine2: invoiceDetailsDraft.shippingAddress.addressLine2.trim(),
        country: invoiceDetailsDraft.shippingAddress.country.trim(),
        state: invoiceDetailsDraft.shippingAddress.state.trim(),
        city: invoiceDetailsDraft.shippingAddress.city.trim(),
        pincode: invoiceDetailsDraft.shippingAddress.pincode.trim(),
      },
    };

    setInvoiceFormData((prev) => ({
      ...prev,
      ...normalizedDetails,
    }));
    setEnableInvoiceDetails(hasInvoiceDetailValues({
      ...invoiceFormData,
      ...normalizedDetails,
    }));
    setShowInvoiceDetailsModal(false);
  };

  const clearInvoiceDetails = useCallback(() => {
    setInvoiceFormData((prev) => ({
      ...prev,
      customerGstin: "",
      ewayBillNumber: "",
      shippingAddress: {
        name: "",
        addressLine1: "",
        addressLine2: "",
        country: "",
        state: "",
        city: "",
        pincode: "",
      },
    }));
  }, []);

  const hasInvoiceDetailValues = useCallback((data: InvoiceFormData) => {
    if ((data.customerGstin || "").trim()) return true;
    if ((data.ewayBillNumber || "").trim()) return true;
    return Object.values(data.shippingAddress || {}).some((value) =>
      String(value || "").trim() !== ""
    );
  }, []);

  useEffect(() => {
    if (hasInvoiceDetailValues(invoiceFormData)) {
      setEnableInvoiceDetails(true);
    }
  }, [invoiceFormData, hasInvoiceDetailValues]);

  const appendInvoiceFormData = useCallback((
    formData: FormData,
    source: InvoiceFormData,
    options?: {
      useGrossAmountForInclusive?: boolean;
      omitHiddenExtraInfo?: boolean;
    }
  ) => {
    const useGrossAmountForInclusive = options?.useGrossAmountForInclusive ?? false;
    const dataToSerialize = {
      ...source,
      ...((options?.omitHiddenExtraInfo && !showExtraInfo) && {
        notes: "",
        termsAndCondition: "",
        bank: null,
      }),
    };

    for (const [key, value] of Object.entries(dataToSerialize)) {
      if (key === "gstType" && !isEditMode) continue;

      if (key === "dueDate" && !value) {
        formData.append(key, "");
        continue;
      }

      if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        let targetKey = key;
        if (isCreditNote && key === "invoiceDate") {
          targetKey = "creditNoteDate";
        }

        formData.append(targetKey, `${year}-${month}-${day}`);
        continue;
      }

      if (Array.isArray(value) && key === "items") {
        normalizeInvoiceItemsForSubmission(value as ProductItem[])
          .forEach((item, index) => {
            const payloadItem = useGrossAmountForInclusive
              ? { ...item, amount: (Number(item.qty) || 0) * (Number(item.rate) || 0) }
              : item;
            Object.entries(payloadItem).forEach(([itemKey, itemValue]) => {
              if (itemValue !== undefined && itemValue !== null) {
                if (itemKey === "tax_group_id" && itemValue === "") {
                  return;
                }
                formData.append(`items[${index}][${itemKey}]`, String(itemValue));
              }
            });
          });
        continue;
      }

      if (key === "shippingAddress") {
        formData.append(key, JSON.stringify(value || {}));
        continue;
      }

      if (typeof value !== "object" && value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
  }, [isEditMode, showExtraInfo]);

  const taxTypeOptions = [
    { id: "GST", name: "GST" },
    { id: "Non-GST", name: "Non-GST" },
  ];


  // Helper to recalculate a single item based on current tax settings
  const recalculateItem = useCallback((item: ProductItem, taxType: string, gstType: string, taxList: taxGroup[]) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const discountValue = Number(item.discount_value) || 0;
    const discountType = item.discount_type || "Fixed";
    const taxGroupId = item.tax_group_id;

    let taxRate = 0;
    // Only find tax rate if we are in GST mode
    if (taxType === "GST") {
      const selectedTaxGroup = taxList.find((t) => String(t._id) === String(taxGroupId));
      taxRate = selectedTaxGroup?.total_tax_rate || 0;
    }

    let calculatedTax = 0;
    let discountAmount = 0;
    let finalAmount = 0;

    if (taxType === "GST" && gstType === "Inclusive") {
      // Keep the line amount inclusive, but calculate GST using the configured rate value.
      const grossInclusive = rate * qty;

      if (discountType === "Percentage") {
        discountAmount = (grossInclusive * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }

      if (discountAmount > grossInclusive) discountAmount = grossInclusive;

      const netInclusive = grossInclusive - discountAmount;
      calculatedTax = taxType === "GST" ? netInclusive - (netInclusive / (1 + (taxRate / 100))) : 0;
      finalAmount = netInclusive;
    } else {
      // GST Exclusive OR Non-GST
      const grossBase = rate * qty;

      if (discountType === "Percentage") {
        discountAmount = (grossBase * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }

      if (discountAmount > grossBase) discountAmount = grossBase;

      const netBase = grossBase - discountAmount;

      // Calculate Tax
      calculatedTax = taxType === "GST" ? netBase * (taxRate / 100) : 0;

      finalAmount = netBase + calculatedTax;
    }

    return {
      ...item,
      discount: discountAmount,
      tax: calculatedTax,
      amount: finalAmount
    };
  }, []);

  // Effect to recalculate all items when Tax Settings change
  useEffect(() => {
    if (!invoiceFormData.items.length) return;
    setInvoiceFormData(prev => {
      const updatedItems = prev.items.map(item => recalculateItem(item, prev.taxType, effectiveGstMode, taxes));
      return {
        ...prev,
        items: updatedItems
      };
    });
  }, [invoiceFormData.taxType, effectiveGstMode, taxes, recalculateItem]);


  const handleRemoveItem = (itemToRemove: ProductItem) => {
    handleFormChange(
      "items",
      invoiceFormData.items.filter((item) => item.id !== itemToRemove.id)
    );
  };

  const handleEditItem = (itemToEdit: ProductItem) => {
    setEditingItem({ ...itemToEdit });
    setIsEditProductModalOpen(true);
  };


  const handleEditingItemChange = (
    field: keyof ProductItem,
    value: string | number
  ) => {
    setEditingItem((prev) => {
      if (!prev) return null;

      const numericFields = [
        "qty",
        "rate",
        "discount_value",
      ] as (keyof ProductItem)[];
      let newValue: string | number = value;
      if (numericFields.includes(field)) {
        newValue = Number(value) || 0;
      }

      const updatedItem = { ...prev, [field]: newValue } as ProductItem;
      return recalculateItem(updatedItem, invoiceFormData.taxType, effectiveGstMode, taxes);
    });
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    const updatedItems = invoiceFormData.items.map((item) =>
      item.id === editingItem.id ? editingItem : item
    );
    handleFormChange("items", updatedItems);
    setIsEditProductModalOpen(false);
    setEditingItem(null);
  };


  // --- SYNCHRONOUS TOTALS CALCULATION ---
  const isInclusiveCalc = invoiceFormData.taxType === "GST" && effectiveGstMode === "Inclusive";
  let syncSubTotal = 0;
  let syncTotalTax = 0;
  let syncLineDiscount = 0;

  invoiceFormData.items.forEach((item) => {
    syncSubTotal += (Number(item.qty) || 0) * (Number(item.rate) || 0);
    syncTotalTax += Number(item.tax) || 0;
    syncLineDiscount += Number(item.discount) || 0;
  });

  const syncDiscountBase = isInclusiveCalc ? syncSubTotal : syncSubTotal + syncTotalTax;
  const syncMaxInvoiceDiscount = Math.max(syncDiscountBase - syncLineDiscount, 0);
  const syncExtraDiscount = getInvoiceDiscountAmount(
    syncMaxInvoiceDiscount,
    invoiceLevelDiscount,
    invoiceLevelDiscountType
  );
  const syncCombinedDiscount = syncLineDiscount + syncExtraDiscount;

  const syncGrandTotalExact = isInclusiveCalc
    ? syncSubTotal - syncCombinedDiscount
    : syncSubTotal + syncTotalTax - syncCombinedDiscount;

  const syncGrandTotal = Math.round(syncGrandTotalExact);
  const syncTotalInWords = numberToWords(syncGrandTotal);

  useEffect(() => {
    setInvoiceFormData((prev) => {
      // Avoid infinite loop: only update if values changed
      if (
        prev.subTotal === Number(syncSubTotal.toFixed(2)) &&
        prev.totalTax === Number(syncTotalTax.toFixed(2)) &&
        prev.totalDiscount === Number(syncCombinedDiscount.toFixed(2)) &&
        prev.grandTotal === syncGrandTotal
      ) {
        return prev;
      }
      return {
        ...prev,
        subTotal: Number(syncSubTotal.toFixed(2)),
        totalTax: Number(syncTotalTax.toFixed(2)),
        totalDiscount: Number(syncCombinedDiscount.toFixed(2)),
        grandTotal: syncGrandTotal,
      };
    });
  }, [syncSubTotal, syncTotalTax, syncCombinedDiscount, syncGrandTotal]);


  const fetchAdminUsers = async () => {
    if (adminUsers.length > 0 && selectedAdmin) return;
    if (user?.id) {
      const defaultAdmin = {
        id: user.id,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || user.email || "Admin",
      };
      setAdminUsers([defaultAdmin]);
      if (!selectedAdmin || selectedAdmin.id !== defaultAdmin.id) {
        setSelectedAdmin(defaultAdmin);
        handleAdminChange(defaultAdmin);
      }
      return;
    }
    try {
      const response = await axios.get(`${Constants.FETCH_USERS_URL}/1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(response.data?.data) ? response.data.data : [];
      if (list.length > 0) {
        const formattedUsers = list.map((user: any) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
        }));
        setAdminUsers(formattedUsers);

        // ✅ AUTO SELECT FIRST ADMIN
        const defaultAdmin = formattedUsers[0];
        setSelectedAdmin(defaultAdmin);
        handleAdminChange(defaultAdmin);
      } else {
        setAdminUsers([]);
      }
    } catch (error) {
      console.error("Error fetching admin users:", error);
    }
  };

  useEffect(() => {
    const fetchCustomersByQuery = async () => {
      try {
        const response = await axios.get(
          `${Constants.GET_CUSTOMERS_WITH_SEARCH_URL}`,
          {
            params: {
              search: debouncedSearchTermCustomer,
              limit: 100,
              page: 1,
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        let data = response.data.data;

        if (data.customers.length > 0) {
          const fetchedCustomers = response.data.data.customers;

          // keep original customers for details card
          setCustomers(fetchedCustomers);

          // ✅ FORMAT FOR SMART DROPDOWN (PHONE ONLY)
          const formattedCustomers = fetchedCustomers.map((c: any) => ({
            id: c.id,
            name: c.id,
            subLabel: c.phone,
          }));

          setCustomerDropdownItems(formattedCustomers);
        } else {
          setCustomers([]);
          setCustomerDropdownItems([]);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomersByQuery();
  }, [debouncedSearchTermCustomer, token]);

  const handleInLineItemChange = (product: ProductItem, rowId: string) => {
    const updatedProduct = recalculateItem(product, invoiceFormData.taxType, effectiveGstMode, taxes);
    setInvoiceFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === rowId ? updatedProduct : item
      ),
    }));
  };

  const handleNewProductCreated = (product: Product) => {
    const discount_type = product.discount?.type;
    const discount_value = product.discount?.value;
    const subtotal = product.prices?.selling ?? 0;
    const rate = product.prices?.selling ?? 0;
    const discountAmount =
      discount_type === "Percentage"
        ? (subtotal * (discount_value || 0)) / 100
        : discount_value || 0;
    const taxRate = product.tax?.total_rate ?? 0;
    const taxPerUnit = (rate * taxRate) / 100;

    const totalTax = taxPerUnit * 1;
    const discountedSubtotal = subtotal - discountAmount;
    const newAmount = discountedSubtotal + totalTax;

    let updated = false;
    setInvoiceFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (!updated && item.name === "") {
          updated = true;
          return {
            ...item,
            id: product.id,
            name: product.name,
            unit: product.unit?.name ?? "",
            qty: 1,
            rate: product.prices?.selling ?? 0,
            amount: newAmount,
            discount: discountAmount,
            tax: totalTax,
            tax_group_id: typeof product.tax === 'object' && product.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product.tax,
            discount_type: product.discount?.type || "Fixed",
            discount_value: product.discount?.value,
          };
        }
        return item;
      }),
    }));
  };

  const handleNewRow = (): string => {
    const newId = crypto.randomUUID();

    setInvoiceFormData((prev) => ({
      ...prev,
      items: [
        {
          id: newId,
          product_id: "",
          name: "",
          hsn_code: "",
          unit: "",
          qty: 1,
          rate: 0,
          discount: 0,
          tax: 0,
          tax_group_id: null,
          amount: 0,
          staffId: selectedStaffId || null,
          staffName: selectedStaffName || "",
        },
        ...prev.items,
      ],
    }));

    return newId;
  };
  // Add variant from ProductSidebar to invoice
  const addVariantToInvoice = (variant: any, product: any) => {
    const existingIndex = invoiceFormData.items.findIndex(
      item => item.variantId === variant._id
    );

    let defaultQty = 1;
    let defaultRate = variant.sale_price || 0;
    let defaultDiscount = variant.discount_value || 0;
    let defaultStaffId = selectedStaffId || null;
    let rowId = undefined;
    let isEdit = false;

    if (existingIndex > -1) {
       const existingRow = invoiceFormData.items[existingIndex];
       defaultQty = (Number(existingRow.qty) || 0) + 1;
       defaultRate = existingRow.rate;
       defaultDiscount = existingRow.discount || 0;
       defaultStaffId = existingRow.staffId || selectedStaffId || null;
       rowId = existingRow.id;
       isEdit = true;
    }

    const productName = formatVariantDisplay({
        brandName: getBrandName(product?.brand),
        designNo: variant?.designNo,
        size: variant?.size,
    }) || variant?.designNo || product?.name;

    setPendingQuickAddEntry({ variant, product, rowId, isEdit, qty: defaultQty, rate: defaultRate, discount: defaultDiscount || 0, name: productName } as any);
    setQuickAddStaffId(defaultStaffId);
    setIsQuickAddQuantityModalOpen(true);
  };

  const handleConfirmQuickAddQuantity = (qty: number, rate: number, discount: number) => {
    if (!pendingQuickAddEntry) return;

    const staffId = quickAddStaffId || null;
    const staffName = staffId ? resolveStaffName(staffId) : "";

    const { variant, product, rowId, isEdit } = pendingQuickAddEntry;

    const completeProduct = productList.find(p =>
      String(p.id) === String(product._id || product.id)
    ) || product;

    const taxGroupId = typeof completeProduct.tax === 'object' && completeProduct.tax !== null
      ? (completeProduct.tax._id || completeProduct.tax.group_id || completeProduct.tax.id)
      : (completeProduct.tax || "");
    const selectedTaxGroup = taxes.find(
      (t) => String(t._id) === String(taxGroupId)
    );
    const taxRate = selectedTaxGroup?.total_tax_rate || 0;

    const finalRate = isNaN(rate) ? (variant.sale_price || 0) : rate;
    const taxPerUnit = (finalRate * taxRate) / 100;
    const totalTax = taxPerUnit * qty;
    const subtotal = finalRate * qty;

    if (isEdit && rowId) {
       setInvoiceFormData((prev) => ({
         ...prev,
         items: prev.items.map(item => {
           if (item.id === rowId) {
             const updated = {
               ...item,
               qty,
               rate: finalRate,
               discount_value: discount,
               discount_type: "Fixed",
               staffId,
               staffName
             };
             return recalculateItem(updated, prev.taxType, effectiveGstMode, taxes);
           }
           return item;
         })
       }));
       toast.success("Item updated successfully");
    } else {
       const newId = crypto.randomUUID();
       const amount = subtotal + totalTax - discount;

       const newItem = {
         id: newId,
         product_id: completeProduct.id || completeProduct._id,
         name:
           formatVariantDisplay({
             brandName: getBrandName(completeProduct.brand),
             designNo: variant.designNo,
             size: variant.size,
           }) ||
           variant.designNo ||
           completeProduct.name,
         variantId: variant._id,
         variantName: `${variant.color || ""} - ${variant.size || ""}`.trim(),
         variantDesignNo: variant.designNo || "",
         variantColor: variant.color || "",
         variantSize: variant.size || "",
         variantBarcode: variant.barcode || "",
         variantMrp: Number(variant.mrp || 0),
         unit: completeProduct.unit?.name || "",
         qty,
         rate: finalRate,
         discount_value: discount,
         discount_type: "Fixed",
         tax: 0,
         tax_group_id: (typeof completeProduct.tax === 'object' && completeProduct.tax !== null ? ((completeProduct.tax as any)._id || (completeProduct.tax as any).group_id || (completeProduct.tax as any).id) : completeProduct.tax) || (typeof product.tax === 'object' && product.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id) : product.tax) || "",
         amount: amount,
         staffId: staffId,
         staffName: staffName,
       };

       const recalculatedNewItem = recalculateItem(
         newItem as ProductItem,
         invoiceFormData.taxType,
         effectiveGstMode,
         taxes
       );

       setInvoiceFormData((prev) => ({
         ...prev,
         items: [recalculatedNewItem, ...prev.items],
       }));
       toast.success("Item added successfully");
    }

    setIsQuickAddQuantityModalOpen(false);
    setPendingQuickAddEntry(null);
    clearQuickAddScannerInput();
    window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
  };

  const handleEditItemAction = (item: ProductItem) => {
    const product = productList.find(p => p.id === item.product_id) || { id: item.product_id, name: item.name, tax: { group_id: item.tax_group_id } };
    const variant = { _id: item.variantId, sale_price: item.rate, discount_value: item.discount, designNo: item.variantDesignNo, size: item.variantSize, color: item.variantColor, barcode: item.variantBarcode, mrp: item.variantMrp };

    setPendingQuickAddEntry({
      product,
      variant,
      rowId: item.id,
      isEdit: true,
      qty: Number(item.qty || 1),
      rate: Number(item.rate || 0),
      discount: Number(item.discount_value || item.discount || 0),
      name: item.name
    });
    setQuickAddStaffId(item.staffId || null);
    setIsQuickAddQuantityModalOpen(true);
  };

  const quickAddItems = useMemo(() => {
    const term = quickAddSearch.trim().toLowerCase();
    if (!term) return [] as Array<{ type: "variant"; product: Product; variant: any }>;
    const items: Array<{ type: "variant"; product: Product; variant: any }> = [];

    for (const v of variantList) {
      const searchable = `${v.designNo || ""} ${v.color || ""} ${v.size || ""} ${v.productId?.brand?.brand_name || ""}`.toLowerCase();
      if (!searchable.includes(term)) continue;

      const productId =
        typeof v.productId === "object" && v.productId !== null
          ? (v.productId.id || v.productId._id)
          : v.productId;
      const product =
        productList.find((p: any) => String((p as any).id || p._id) === String(productId)) ||
        ({
          id: String(productId || ""),
          item_type: typeof v.productId === "object" && v.productId !== null ? (v.productId.item_type || "Product") : "Product",
          name: typeof v.productId === "object" && v.productId !== null ? (v.productId.name || "") : "",
          code: typeof v.productId === "object" && v.productId !== null ? (v.productId.code || "") : "",
          hsn_code: typeof v.productId === "object" && v.productId !== null ? (v.productId.hsn_code || "") : "",
          barcode: typeof v.productId === "object" && v.productId !== null ? (v.productId.barcode || v.barcode || "") : (v.barcode || ""),
          unit:
            typeof v.productId === "object" && v.productId !== null && v.productId.unit
              ? {
                id: v.productId.unit.id || v.productId.unit._id || "",
                name:
                  v.productId.unit.short_name ||
                  v.productId.unit.name ||
                  v.productId.unit.unit_name ||
                  "",
              }
              : null,
          prices: {
            selling: Number(v.sale_price || 0),
            purchase: Number(v.purchase_price || 0),
          },
          discount: null,
          tax:
            typeof v.productId === "object" && v.productId !== null && v.productId.tax
              ? {
                group_id: v.productId.tax.group_id || v.productId.tax._id || "",
                group_name: v.productId.tax.group_name || v.productId.tax.tax_name || "",
                total_rate:
                  Number(v.productId.tax.total_rate) ||
                  Number(
                    Array.isArray(v.productId.tax.tax_rate_ids)
                      ? v.productId.tax.tax_rate_ids.reduce(
                        (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                        0
                      )
                      : 0
                  ),
              }
              : null,
          quantity: 0,
          rate: Number(v.sale_price || 0),
          amount: Number(v.sale_price || 0),
          brand:
            typeof v.productId === "object" && v.productId !== null
              ? (v.productId.brand || { _id: "", brand_name: "" })
              : { _id: "", brand_name: "" },
        } as Product);
      items.push({ type: "variant", product, variant: v });
      if (items.length >= 50) break;
    }

    return items;
  }, [quickAddSearch, variantList, productList]);

  useEffect(() => {
    if (quickAddActiveIndex > -1 && quickAddListRef.current) {
      const items = quickAddListRef.current.querySelectorAll('[data-quick-add-row="true"]');
      const activeItem = items[quickAddActiveIndex] as HTMLLIElement | undefined;
      if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [quickAddActiveIndex, showQuickAdd, quickAddItems.length]);

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = quickAddItems;
    if (!showQuickAdd || items.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setQuickAddActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setQuickAddActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (quickAddActiveIndex > -1) {
          const entry = items[quickAddActiveIndex];
          if (entry.type === "variant") {
            addVariantToInvoice(entry.variant, entry.product);
            setQuickAddSearch("");
            setShowQuickAdd(false);
            setQuickAddActiveIndex(-1);
          }
        }
        break;
      case "Escape":
        setShowQuickAdd(false);
        break;
    }
  };

  // Listen for variant click events from ProductSidebar
  useEffect(() => {
    const handleVariantAdd = (event: any) => {
      const { variant, product } = event.detail;
      addVariantToInvoice(variant, product);
    };

    window.addEventListener('addVariantToInvoice', handleVariantAdd);
    return () => window.removeEventListener('addVariantToInvoice', handleVariantAdd);
  }, [addVariantToInvoice]);

  useEffect(() => {
    const fetchProductsForInvoice = async () => {
      try {
        const res = await axios.get(Constants.FETCH_PRODUCTS_FOR_INVOICE_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const products = res?.data?.data?.products ?? [];
        setProductList(products);
      } catch (err) {
        toast.error("Failed to load products");
        setProductList([]);
      }
    };

    fetchProductsForInvoice();
  }, [token]);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await axios.get(
        Constants.FETCH_INVENTORY_LIST_URL,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { all: true },
        }
      );

      const map: Record<string, number> = {};

      res.data.data.forEach((inv: any) => {
        const variantKey =
          inv.variantId?._id ||
          inv.variantId ||
          inv.variantDetails?._id ||
          "";
        if (variantKey) {
          map[String(variantKey)] = inv.quantity;
        }
      });

      setInventoryMap(map);
      return map;
    } catch (err) {
      console.error("Failed to fetch inventory", err);
      setInventoryMap({});
      return {};
    }
  }, [token]);

  const applyVariantToInvoice = (variant: any, rowId?: string) => {
    const productId = typeof variant.productId === 'object' && variant.productId !== null
      ? (variant.productId.id || variant.productId._id)
      : variant.productId;

    const fallbackProduct = typeof variant.productId === 'object' && variant.productId !== null
      ? {
        id: variant.productId.id || variant.productId._id || "",
        item_type: variant.productId.item_type || "Product",
        name: variant.productId.name || "",
        code: variant.productId.code || "",
        hsn_code: variant.productId.hsn_code || "",
        barcode: variant.productId.barcode || variant.barcode || "",
        unit: variant.productId.unit
          ? {
            id: variant.productId.unit.id || variant.productId.unit._id || "",
            name:
              variant.productId.unit.short_name ||
              variant.productId.unit.name ||
              variant.productId.unit.unit_name ||
              "",
          }
          : null,
        prices: {
          selling: Number(variant.sale_price || 0),
          purchase: Number(variant.purchase_price || 0),
        },
        discount: null,
        tax: variant.productId.tax
          ? {
            group_id: variant.productId.tax.group_id || variant.productId.tax._id || "",
            group_name: variant.productId.tax.group_name || variant.productId.tax.tax_name || "",
            total_rate:
              Number(variant.productId.tax.total_rate) ||
              Number(
                Array.isArray(variant.productId.tax.tax_rate_ids)
                  ? variant.productId.tax.tax_rate_ids.reduce(
                    (sum: number, taxRate: any) => sum + Number(taxRate?.tax_rate || 0),
                    0
                  )
                  : 0
              ),
          }
          : null,
        quantity: 0,
        rate: Number(variant.sale_price || 0),
        amount: Number(variant.sale_price || 0),
        brand: variant.productId.brand || { _id: "", brand_name: "" },
      }
      : null;

    const product = productList.find(p => p.id === productId) || fallbackProduct;

    if (!product) {
      toast.error("Parent product not found!");
      return;
    }

    const existingRow = invoiceFormData.items.find(
      item =>
        item.product_id === product.id &&
        item.variantId === variant._id &&
        item.staffId === selectedStaffId
    );

    if (existingRow) {
      const updatedQty = existingRow.qty + 1;
      const rate = variant.sale_price ?? existingRow.rate ?? 0;

      setInvoiceFormData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.id === existingRow.id
            ? recalculateItem(
              { ...item, qty: updatedQty, rate } as ProductItem,
              invoiceFormData.taxType,
              effectiveGstMode,
              taxes
            )
            : item
        )
      }));

      setTimeout(() => scrollToRow(existingRow.id), 120);
      return;
    }

    const emptyRow = invoiceFormData.items.find(i => i.name.trim() === "");
    const targetRowId = rowId || (emptyRow ? emptyRow.id : handleNewRow());

    const rate = variant.sale_price ?? 0;
    const taxRate = product.tax?.total_rate ?? 0;
    const taxAmount = (rate * taxRate) / 100;
    const amount = rate + taxAmount;

    const discountValue = variant.discount_value ?? 0;
    const discountType: "Percentage" = "Percentage";

    const subtotal = rate * 1;
    const discountAmount = (subtotal * discountValue) / 100;

    const initialItem = {
      id: targetRowId,
      product_id: product.id,
      name:
        formatVariantDisplay({
          brandName: getBrandName((product as any).brand),
          designNo: variant.designNo,
          size: variant.size,
        }) ||
        variant.designNo ||
        product.name,
      hsn_code: product.hsn_code,
      unit: product.unit?.name || "",
      qty: 1,
      rate,
      discount_type: discountType,
      discount_value: discountValue,
      discount: discountAmount,
      tax: taxAmount,
      amount,
      tax_group_id: typeof product.tax === 'object' && product.tax !== null ? ((product.tax as any)._id || (product.tax as any).group_id || (product.tax as any).id || "") : (product.tax ?? ""),
      variantId: variant._id,
      variantDesignNo: variant.designNo,
      variantColor: variant.color,
      variantSize: variant.size,
      variantName: `${variant.color} - ${variant.size}`,
      variantBarcode: variant.barcode,
      variantMrp: variant.mrp,
      productBrandName: product.brand?.brand_name,
      staffId: selectedStaffId,
      staffName: selectedStaffName,
    };

    const finalItem = recalculateItem(
      initialItem as ProductItem,
      invoiceFormData.taxType,
      effectiveGstMode,
      taxes
    );

    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === targetRowId ? finalItem : item
      )
    }));

    setTimeout(() => scrollToRow(targetRowId), 120);
  };

  const handleFillProductByBarcode = async (barcode: string, rowId: string) => {
    const normalizedBarcode = barcode.trim();
    let matches = variantList.filter(v => String(v.barcode || "").trim() === normalizedBarcode);

    if (matches.length === 0) {
      matches = await fetchVariantsByBarcode(normalizedBarcode);
    }

    if (matches.length === 0) {
      toast.error("Variant not found!");
      return;
    }

    if (matches.length > 1) {
      setDuplicateBarcodeMatches(matches);
      setPendingBarcodeRowId(rowId);
      setPendingBarcodeSource("row");
      setShowDuplicateBarcodeModal(true);
      return;
    }

    applyVariantToInvoice(matches[0], rowId);
  };

  const scrollToRow = (rowId: string) => {
    const rowElement = rowRefs.current[rowId];
    if (rowElement) {
      rowElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const handleBarcodeScanned = useCallback(async (code: string) => {
    if (!code.trim()) return;
    clearQuickAddScannerInput();

    if (!Array.isArray(variantList)) {
      toast.error("Variant list not loaded. Please refresh the page.");
      return;
    }

    const normalizedCode = code.trim();
    let matches = variantList.filter(v => String(v.barcode || "").trim() === normalizedCode);

    if (matches.length === 0) {
      matches = await fetchVariantsByBarcode(normalizedCode);
    }

    if (matches.length === 0) {
      toast.error("Variant not found!");
      return;
    }

    if (matches.length > 1) {
      setDuplicateBarcodeMatches(matches);
      setPendingBarcodeRowId(null);
      setPendingBarcodeSource("scan");
      setShowDuplicateBarcodeModal(true);
      return;
    }

    applyVariantToInvoice(matches[0]);
    window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
  }, [variantList, fetchVariantsByBarcode, applyVariantToInvoice, clearQuickAddScannerInput]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Enter") {
        if (scanBufferRef.current.length >= 4) {
          const code = scanBufferRef.current;
          scanBufferRef.current = "";
          clearQuickAddScannerInput();
          if (scanTimeoutRef.current) {
            window.clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
          }
          if (isEditable) e.preventDefault();
          handleBarcodeScanned(code);
        }
        return;
      }

      if (e.key.length === 1) {
        const now = Date.now();
        if (now - lastScanTimeRef.current > 100) {
          scanBufferRef.current = "";
        }
        scanBufferRef.current += e.key;
        lastScanTimeRef.current = now;

        if (scanTimeoutRef.current) {
          window.clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = window.setTimeout(() => {
          scanBufferRef.current = "";
        }, 200);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scanTimeoutRef.current) {
        window.clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [handleBarcodeScanned, clearQuickAddScannerInput]);

  const handleDuplicateBarcodeSelect = (variant: any) => {
    setShowDuplicateBarcodeModal(false);
    setDuplicateBarcodeMatches([]);

    if (pendingBarcodeSource === "row" && pendingBarcodeRowId) {
      applyVariantToInvoice(variant, pendingBarcodeRowId);
    } else {
      applyVariantToInvoice(variant);
    }

    setPendingBarcodeRowId(null);
    setPendingBarcodeSource("scan");
    window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
  };

  const validateQuotationData = () => {
    const newErrors: { [key: string]: string } = {};

    if (!invoiceFormData.invoiceDate)
      newErrors.invoiceDate = "Invoice date is required.";

    if (!invoiceFormData.status.trim())
      newErrors.status = "Status is required.";

    if (!invoiceFormData.billFrom.trim())
      newErrors.billFrom = "Bill from is required.";

    const hasItemPopulated = invoiceFormData.items.some(
      (item) => item.name.trim() !== ""
    );
    if (!hasItemPopulated) newErrors.items = "At least one item is required.";

    setFormErrors(newErrors);
    return newErrors;
  };

  const handleSaveAsDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceFormData((prev) => ({ ...prev, status: "DRAFT" }));
    await saveQuotation(e, "DRAFT");
  };

  const saveQuotation = async (e: React.FormEvent, status: string) => {
    e.preventDefault();

    const errors = validateQuotationData();

    if (Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0];
      const firstErrorElement = document.querySelector(
        `[name="${firstErrorField}"]`
      ) as HTMLInputElement | null;
      firstErrorElement?.focus();
      return;
    }

    if (!(await ensureFreshInventoryAndValidate())) {
      return;
    }

    if (isExchangeCreate && exchangeOriginalItems.length > 0 && selectedExchangeItems.length === 0) {
      toast.error("Please select at least one original item to exchange.");
      return;
    }

    const invoiceDataForSubmit = await ensureBillToCustomer(invoiceFormData);
    if (!invoiceDataForSubmit) return;

    const formData = new FormData();

    const useGrossAmountForInclusive =
      invoiceFormData.taxType === "GST" && effectiveGstMode === "Inclusive";

    // Prepare data: exclude extra info fields if section is hidden
    appendInvoiceFormData(formData, invoiceDataForSubmit, {
      useGrossAmountForInclusive,
      omitHiddenExtraInfo: true,
    });
    formData.set("status", status);
    if (!isEditMode && disablePaymentModal && forceStatus === "UNPAID") {
      formData.set("payment_method", "CREDIT");
    }

    // ✅ Add GST Mode from system settings
    const currentGstMode = effectiveGstMode;
    formData.set("gstType", currentGstMode);
    formData.set("overall_discount", String(getInvoiceDiscountForPayload()));
    if (isEditMode) {
      formData.set("skipExchangeDetection", "true");
    }
    const requiresExtraPayment =
      isEditMode &&
      !isExchangeCreate &&
      status !== "DRAFT";
    if (requiresExtraPayment) {
      formData.set("skipPaymentSync", "true");
    }
    if (isExchangeCreate && selectedExchangeItems.length > 0) {
      formData.set("exchangeOriginalItems", JSON.stringify(selectedExchangeItems));
      formData.set("exchangeOldTotal", String(exchangeOldTotal.toFixed(2)));
      formData.set("exchangeNewTotal", String(exchangeNewTotal.toFixed(2)));
    }

    try {
      setIsSubmitting(true);
      if (isEditMode) {
        if (!invoiceId) {
          toast.error("Invoice ID missing.");
          return;
        }

        if (requiresExtraPayment && editOutstandingAmount > 0) {
          toast.info(`Outstanding amount of ₹${editOutstandingAmount} requires payment.`);
          // Prevent saving as PAID if there's an outstanding amount
          formData.set("status", "PARTIALLY_PAID");
        }

        const updateUrl = isCreditNote ? Constants.UPDATE_CREDIT_NOTE_URL : Constants.UPDATE_INVOICE_URL;
        const response = await axios.put(
          `${updateUrl}/${invoiceId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        const isExchange = response.data?.isExchange || false;
        const exchangeData = response.data?.exchangeData;

        if (isExchange) {
          if (exchangeData?.requiresPayment) {
            toast.info(`Exchange detected: Additional payment of ₹${exchangeData.amountDifference} required`);
            setIsExchangePaymentMode(true);
            setExchangePaymentAmount(Number(exchangeData.amountDifference || 0));
            setExchangeInvoiceId(invoiceId);
            setInvoiceDraft(formData);
            setShowPaymentModal(true);
            setPaymentPending(true);
            return;
          }

          if (exchangeData?.requiresRefund) {
            toast.success(`Exchange completed! Refund amount: ₹${Math.abs(exchangeData.amountDifference)}`);
          }

          handlePrintBill(() => {
            setTimeout(() => {
              navigate(isCreditNote ? "/admin/credit-notes" : "/admin/invoices");
            }, 800);
          });
          return;
        } else if (!disablePaymentModal && invoiceFormData.status !== "DRAFT") {
          setInvoiceDraft(formData);
          setIsExtraPaymentMode(true);
          setShowPaymentModal(true);
          setPaymentPending(true);
          setIsSubmitting(false);
          return;
        } else {
          toast.success("Invoice updated successfully.");
        }

        navigate(isCreditNote ? "/admin/credit-notes" : "/admin/invoices");
        return;
      }

      if (isExchangeCreate && exchangeSourceInvoiceId) {
        const response = await axios.put(
          `${Constants.UPDATE_INVOICE_URL}/${exchangeSourceInvoiceId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        const exchangeData = response.data?.exchangeData;
        if (exchangeData?.requiresPayment) {
          setIsExchangePaymentMode(true);
          setExchangePaymentAmount(Number(exchangeData.amountDifference || 0));
          setExchangeInvoiceId(exchangeSourceInvoiceId);
          const draft = new FormData();
          draft.set("invoiceNumber", invoiceFormData.invoiceNumber || "");
          draft.set("billFrom", companyDetails?.companyName || "Business");
          setInvoiceDraft(draft);
          setShowPaymentModal(true);
          return;
        }

        toast.success("Exchange completed successfully.");
        handlePrintBill(() => {
          setTimeout(() => {
            reloadExchangeCreatePage();
          }, 800);
        });
        return;
      }

      const createUrl = isCreditNote ? Constants.CREATE_NEW_CREDIT_NOTE_URL : Constants.CREATE_NEW_INVOICE_URL;
      await axios.post(createUrl, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Invoice created successfully.");
      reloadCreateInvoicePage();
    } catch (error: any) {
      console.error("SAVE INVOICE ERROR:", error);
      console.error("RESPONSE DATA:", error.response?.data);
      if (error.response?.data?.code === "INVENTORY_EMPTY") {
        toast.error(error.response.data.message);
        return;
      }

      if (error.response?.data?.code === "INSUFFICIENT_STOCK") {
        toast.error(error.response.data.message);
        return;
      }

      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
        toast.error("Please check the form for errors.");
        return;
      }
      const errorMsg = error.response?.data?.message || error.response?.data?.error || "Failed to create invoice";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewProductClick = () => {
  };

  const setNewInvoiceNumber = () => {
    let newInvoiceNumber = sessionStorage.getItem("nextInvoiceNo");
    if (newInvoiceNumber) {
      setInvoiceFormData((prev) => ({
        ...prev,
        invoiceNumber: newInvoiceNumber,
      }));
    }
    setInvoiceNumberConfigModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-2xl font-bold">
          <Loader2Icon className="animate-spin text-primary h-10 w-10" />
        </div>
      </div>
    );
  }

  if (isEditMode && isEditLoading) {
    return <FullPageLoader />;
  }

  const currentGrandTotal = syncGrandTotal;
  const editAdditionalPayable = isEditMode
    ? Math.max(currentGrandTotal - originalGrandTotal, 0)
    : currentGrandTotal;
  const editOutstandingAmount = isEditMode
    ? Math.max(currentGrandTotal - Number(invoiceFormData.totalPaid || 0), 0)
    : currentGrandTotal;
  const invoiceItemsTableTotals = invoiceFormData.items.reduce(
    (totals, item) => ({
      quantity: totals.quantity + Number(item.qty || 0),
      rate: totals.rate + Number(item.rate || 0),
      discount: totals.discount + Number(item.discount || 0),
      tax: totals.tax + Number(item.tax || 0),
      amount: totals.amount + Number(item.amount || 0),
    }),
    { quantity: 0, rate: 0, discount: 0, tax: 0, amount: 0 }
  );
  const formatQuantityTotal = (value: number) =>
    Number.isInteger(value) ? String(value) : formatWholeAmountDisplay(value);
  const renderInvoiceItemsColGroup = () => (
    <colgroup>
      <col className="w-[4rem]" />
      <col className="w-[27%]" />
      <col className="w-[12%]" />
      <col className="w-[9%]" />
      <col className="w-[9%]" />
      <col className="w-[9%]" />
      <col className="w-[9%]" />
      <col className="w-[7%]" />
      <col className="w-[12%]" />
      <col className="w-[6rem]" />
    </colgroup>
  );
  const renderInvoiceItemsTotalRow = () => (
    invoiceFormData.items.length > 0 ? (
      <div className="overflow-x-auto border-x border-b border-gray-200 bg-gray-50">
        <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0">
          {renderInvoiceItemsColGroup()}
          <tbody>
            <tr className="text-sm font-semibold text-gray-950">
              <td className="p-2"></td>
              <td className="p-2">Total</td>
              <td className="p-2"></td>
              <td className="p-2 tabular-nums">{formatQuantityTotal(invoiceItemsTableTotals.quantity)}</td>
              <td className="p-2 tabular-nums">{formatWholeAmountDisplay(invoiceItemsTableTotals.rate)}</td>
              <td className="p-2 tabular-nums">{formatWholeAmountDisplay(invoiceItemsTableTotals.discount)}</td>
              <td className="p-2 tabular-nums">{formatWholeAmountDisplay(invoiceItemsTableTotals.tax)}</td>
              <td className="p-2"></td>
              <td className="p-2 tabular-nums">{systemSettings?.currency.symbol || ""}{formatWholeAmountDisplay(invoiceItemsTableTotals.amount)}</td>
              <td className="p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    ) : null
  );

  return (
    <div className="md:p-4 bg-white-50 min-h-screen border border-gray-200 rounded pb-4 md:pb-24 relative">
      <form>
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-950 shrink-0">
                {isEditMode ? (isCreditNote ? "Edit Credit Note" : "Edit Invoice") : isExchangeCreate ? "New Exchange" : (isCreditNote ? "New Credit Note" : "New Invoice")}
              </h1>
              {!isEditMode && !isExchangeCreate && (
                <button
                  type="button"
                  onClick={() => setShowAiInvoiceScanModal(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <FileSearch className="h-4 w-4" />
                  Scan Invoice
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="w-48 shrink-0">
                <SmartDropdown
                  items={taxTypeOptions}
                  value={invoiceFormData.taxType}
                  selectedItem={taxTypeOptions.find(o => o.id === invoiceFormData.taxType)}
                  onSelect={(item) => { if (item) handleFormChange("taxType", item.id); }}
                  placeholder="Select Tax Type"
                  serverside={false}
                  onChange={() => { }}
                />
              </div>

              {/* GST / Shipping Details widget — stays on title line */}
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all duration-200 ${enableInvoiceDetails
                  ? "border-[#CCA2BB] bg-[#fce6f4]"
                  : "border-gray-300 bg-gray-50"
                  }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${enableInvoiceDetails ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                    }`}
                >
                  <Truck size={13} />
                </div>
                <div className="min-w-0">
                  <p className={`whitespace-nowrap text-xs font-semibold ${enableInvoiceDetails ? "text-primary" : "text-gray-700"
                    }`}>GST / Shipping</p>
                  <p className="whitespace-nowrap text-[10px] text-gray-400">
                    {enableInvoiceDetails ? "Details enabled" : "Optional"}
                  </p>
                </div>
                {!enableInvoiceDetails ? (
                  <button
                    type="button"
                    onClick={openInvoiceDetailsModal}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <PlusCircle size={12} />
                    Add
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={openInvoiceDetailsModal}
                      className="inline-flex items-center gap-1 rounded-md border border-[#CCA2BB] bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-[#fce6f4] transition-colors"
                    >
                      <Settings size={11} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEnableInvoiceDetails(false);
                        setShowInvoiceDetailsModal(false);
                        clearInvoiceDetails();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Compact single-row form fields ── */}
          <div className="bg-white border border-gray-200 rounded-lg px-4 pt-3 pb-4">
            {/* Logo in form card top-right */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">

              {/* Invoice Number */}
              <div className="w-44 shrink-0">
                <label htmlFor="invoiceNumber" className="block text-xs font-medium text-gray-600 mb-1">
                  {isCreditNote ? "Credit Note Number" : "Invoice Number"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="invoiceNumber"
                    id="invoiceNumber"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full pr-8 text-sm text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    placeholder="Invoice No."
                    value={invoiceFormData.invoiceNumber ?? ""}
                    readOnly={isEditMode}
                    onChange={(e) => handleFormChange("invoiceNumber", e.target.value)}
                  />
                  {!isEditMode && (
                    <Settings
                      size={14}
                      onClick={() => setInvoiceNumberConfigModalOpen(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-primary"
                    />
                  )}
                </div>
                {formErrors?.invoiceNumber && (
                  <span className="text-red-500 text-xs">{formErrors.invoiceNumber}</span>
                )}
              </div>

              {/* Invoice Date */}
              <div className="w-40 shrink-0">
                <DateInput
                  label={isCreditNote ? "Credit Note Date" : "Invoice Date"}
                  value={invoiceFormData.invoiceDate}
                  onChange={(newDate) => handleFormChange("invoiceDate", newDate)}
                  minDate={isEditMode ? undefined : new Date()}
                  isRequired
                />
                {formErrors?.invoiceDate && (
                  <span className="text-red-500 text-xs">{formErrors.invoiceDate}</span>
                )}
              </div>

              {/* Bill To */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">
                    Bill To (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="flex items-center text-xs text-primary font-semibold"
                  >
                    <PlusCircle className="h-3 w-3 mr-0.5" />
                    New Customer
                  </button>
                </div>
                <div className="relative z-20">
                  <SmartDropdown
                    items={customerDropdownItems}
                    value={customerSearchInput}
                    onChange={handleCustomerSearchChange}
                    onSelect={(item) => {
                      const fullCustomer = customers.find(c => c.id === item?.id);
                      handleCustomerChange(fullCustomer || null);
                    }}
                    onAddNew={() => setIsCustomerModalOpen(true)}
                    selectedItem={customerDropdownItems.find((c) => c.id === selectedCustomer?.id) || null}
                    addNewLabel="New Customer"
                    placeholder="Search customer..."
                    maxLength={10}
                    sanitizeInput={sanitizeCustomerPhoneInput}
                  />
                </div>
                {!selectedCustomer && formErrors?.billTo && (
                  <span className="text-red-500 text-xs">{formErrors.billTo}</span>
                )}
              </div>

              {/* Staff Member */}
              <div className="w-52 shrink-0">
                {showStaffSelector ? (
                  <>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Staff Member <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <SmartDropdown
                      items={staffList}
                      value={staffSearch}
                      placeholder="Select staff..."
                      onChange={(v) => setStaffSearch(v)}
                      onSelect={(staff) => handleSelectStaff(staff)}
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Staff Member</label>
                    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                      <span className="text-sm font-medium text-gray-800 flex-1 truncate">{selectedStaffName}</span>
                      <button
                        type="button"
                        className="flex items-center gap-0.5 text-xs text-primary font-semibold shrink-0"
                        onClick={() => setShowStaffSelector(true)}
                      >
                        <Edit2Icon className="h-3 w-3" />
                        Change
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Exchange Invoice (only on exchange create) */}
              {isExchangeCreate && (
                <div className="w-56 shrink-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exchange Invoice</label>
                  <SmartDropdown
                    items={exchangeInvoiceOptions}
                    placeholder="Select invoice"
                    value={exchangeInvoiceSearchInput}
                    onChange={(keyword) => setExchangeInvoiceSearchInput(keyword)}
                    onSelect={(option) => handleExchangeInvoiceSelect(option as OptionType)}
                    selectedItem={exchangeInvoiceOptions.find((option) => option.id === exchangeSourceInvoiceId) || null}
                  />
                </div>
              )}

            </div>
          </div>

          {/* Items & Details Section */}
          <div className="bg-white rounded-lg border border-gray-200 ">
            <div className="p-2">
              {formErrors?.items && (
                <span className="text-red-500 text-sm">{formErrors.items}</span>
              )}

              {isExchangeCreate ? (
                <>
                  <div className="flex flex-wrap gap-6 items-center pb-4">
                    <div ref={quickAddRef} className="relative flex-1 min-w-[320px]">
                      <input
                        ref={quickAddInputRef}
                        type="text"
                        autoFocus
                        value={quickAddSearch}
                        onChange={(e) => {
                          setQuickAddSearch(e.target.value);
                          setShowQuickAdd(true);
                          setQuickAddActiveIndex(0);
                        }}
                        onFocus={() => setShowQuickAdd(true)}
                        onKeyDown={handleQuickAddKeyDown}
                        placeholder="Search by design no. or brand..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                      {showQuickAdd && (
                        <ul ref={quickAddListRef} className="absolute top-full left-0 w-full bg-white border border-gray-200 z-50 max-h-56 overflow-auto rounded-md shadow-lg">
                          {quickAddItems.length === 0 ? (
                            <li className="p-3 text-center text-sm text-gray-500">No results</li>
                          ) : (
                            quickAddItems.map((entry, index) => {
                              const label = formatVariantDisplay({
                                brandName: getBrandName(entry.product?.brand),
                                designNo: entry.variant.designNo,
                                size: entry.variant.size,
                                includeSize: true,
                              });
                              return (
                                <li
                                  data-quick-add-row="true"
                                  key={`quick-variant-${entry.product.id}-${entry.variant._id}`}
                                  className={`p-2 pl-6 cursor-pointer hover:bg-third ${index === quickAddActiveIndex ? "bg-third" : ""}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    addVariantToInvoice(entry.variant, entry.product);
                                    setQuickAddSearch("");
                                    setShowQuickAdd(false);
                                    setQuickAddActiveIndex(-1);
                                  }}
                                >
                                  <div className="text-sm text-gray-800">
                                    {label || "Variant"} - {systemSettings?.currency.symbol || ""}{entry.variant.sale_price ?? 0}
                                  </div>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                    <div className="w-full">
                      <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0">
                        {renderInvoiceItemsColGroup()}
                        <thead className="bg-gray-950 text-white">
                          <tr>
                            <th className="p-2 text-left text-sm font-semibold rounded-tl-md w-12">
                              S.No.
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Product
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Color / Size
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Quantity
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Rate
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Discount
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              {invoiceFormData.taxType === "GST" && (effectiveGstMode) === "Inclusive" ? "Inc. Tax" : "Tax"}
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Staff
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Amount
                            </th>
                            <th className="p-2 text-left text-sm font-semibold rounded-tr-md">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceFormData.items.map((item, index) => (
                            <InvoiceTableRow
                              key={item.id}
                              index={index}
                              ref={(el) => {
                                rowRefs.current[item.id] = el;
                              }}
                              item={item}
                              currencySymbol={systemSettings?.currency.symbol ?? "$"}
                              onInLineItemChange={(updatedItem) =>
                                handleInLineItemChange(updatedItem, item.id)
                              }
                              onEditItem={handleEditItemAction}
                              onDeleteItem={handleRemoveItem}
                              availableItems={invoiceFormData.items}
                              addNewProduct={handleNewRow}

                              selectedStaffId={selectedStaffId}
                              selectedStaffName={selectedStaffName}
                            />
                          ))}
                          {invoiceFormData.items.length === 0 && (
                            <tr className="bg-white text-gray-950">
                              <td className="p-3 font-medium text-center" colSpan={8}>
                                No Items Selected
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {renderInvoiceItemsTotalRow()}

                  <div className="mt-4 border border-gray-200 rounded-lg">
                    <div className="px-3 py-2 border-b border-gray-200 font-bold text-lg text-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>⬇️ Original Invoice Items</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="w-full">
                        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
                          <colgroup>
                            <col className="w-[4rem]" />
                            <col className="w-[4rem]" />
                            <col className="w-[26%]" />
                            <col className="w-[12%]" />
                            <col className="w-[8%]" />
                            <col className="w-[9%]" />
                            <col className="w-[9%]" />
                            <col className="w-[9%]" />
                            <col className="w-[9%]" />
                            <col className="w-[12%]" />
                          </colgroup>
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="p-2 text-left text-xs font-semibold">
                                <CustomCheckbox
                                  checked={allExchangeSelected}
                                  onChange={toggleAllExchangeItems}
                                  name="exchange-select-all"
                                />
                              </th>
                              <th className="p-2 text-left text-xs font-semibold w-12">S.No.</th>
                              <th className="p-2 text-left text-xs font-semibold">Product</th>
                              <th className="p-2 text-left text-xs font-semibold">Color / Size</th>
                              <th className="p-2 text-left text-xs font-semibold">Unit</th>
                              <th className="p-2 text-left text-xs font-semibold">Qty</th>
                              <th className="p-2 text-left text-xs font-semibold">Rate</th>
                              <th className="p-2 text-left text-xs font-semibold">Discount</th>
                              <th className="p-2 text-left text-xs font-semibold">
                                {invoiceFormData.taxType === "GST" && (effectiveGstMode) === "Inclusive" ? "Inc. Tax" : "Tax"}
                              </th>
                              <th className="p-2 text-left text-xs font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exchangeOriginalItems.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="p-3 text-sm text-gray-500 text-center">
                                  No original items loaded
                                </td>
                              </tr>
                            ) : (
                              exchangeOriginalItems.map((it, idx) => (
                                <tr key={it.id || it.rowId || idx} className="bg-white border-b">
                                  <td className="p-2 text-sm">
                                    <CustomCheckbox
                                      checked={selectedExchangeItemIds.includes(getExchangeItemKey(it, idx))}
                                      onChange={(checked) => toggleExchangeItem(getExchangeItemKey(it, idx), checked)}
                                      name={`exchange-item-${getExchangeItemKey(it, idx)}`}
                                    />
                                  </td>
                                  <td className="p-2 text-sm text-center">{idx + 1}</td>
                                  <td className="p-2 text-sm">{it.name}</td>
                                  <td className="p-2 text-sm">{it.variantName || `${it.variantColor || ""} ${it.variantSize || ""}`}</td>
                                  <td className="p-2 text-sm">{it.unit || "-"}</td>
                                  <td className="p-2 text-sm">{it.qty}</td>
                                  <td className="p-2 text-sm">{it.rate}</td>
                                  <td className="p-2 text-sm">{it.discount ?? 0}</td>
                                  <td className="p-2 text-sm">{formatWholeAmountDisplay(it.tax)}</td>
                                  <td className="p-2 text-sm">{formatWholeAmountDisplay(it.amount)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <ProductItemsSummaryFooter
                      items={exchangeOriginalItems}
                      columns={["blank", "serial", "label", "colorSize", "unit", "quantity", "rate", "discount", "tax", "amount"]}
                      currencySymbol={systemSettings?.currency.symbol || ""}
                      minWidthClassName="min-w-[980px]"
                      colClassNames={["w-[4rem]", "w-[4rem]", "w-[26%]", "w-[12%]", "w-[8%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[12%]"]}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-6 items-center pb-4">
                    <div ref={quickAddRef} className="relative flex-1 min-w-[320px]">
                      <input
                        ref={quickAddInputRef}
                        type="text"
                        autoFocus
                        value={quickAddSearch}
                        onChange={(e) => {
                          setQuickAddSearch(e.target.value);
                          setShowQuickAdd(true);
                          setQuickAddActiveIndex(0);
                        }}
                        onFocus={() => setShowQuickAdd(true)}
                        onKeyDown={handleQuickAddKeyDown}
                        placeholder="Search by design no. or brand..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                      {showQuickAdd && (
                        <ul ref={quickAddListRef} className="absolute top-full left-0 w-full bg-white border border-gray-200 z-50 max-h-56 overflow-auto rounded-md shadow-lg">
                          {quickAddItems.length === 0 ? (
                            <li className="p-3 text-center text-sm text-gray-500">No results</li>
                          ) : (
                            quickAddItems.map((entry, index) => {
                              const label = formatVariantDisplay({
                                brandName: getBrandName(entry.product?.brand),
                                designNo: entry.variant.designNo,
                                size: entry.variant.size,
                                includeSize: true,
                              });
                              return (
                                <li
                                  data-quick-add-row="true"
                                  key={`quick-variant-${entry.product.id}-${entry.variant._id}`}
                                  className={`p-2 pl-6 cursor-pointer hover:bg-third ${index === quickAddActiveIndex ? "bg-third" : ""}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    addVariantToInvoice(entry.variant, entry.product);
                                    setQuickAddSearch("");
                                    setShowQuickAdd(false);
                                    setQuickAddActiveIndex(-1);
                                  }}
                                >
                                  <div className="text-sm text-gray-800">
                                    {label || "Variant"} - {systemSettings?.currency.symbol || ""}{entry.variant.sale_price ?? 0}
                                  </div>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                    <div className="w-full">
                      <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0">
                        {renderInvoiceItemsColGroup()}
                        <thead className="bg-gray-950 text-white">
                          <tr>
                            <th className="p-2 text-left text-sm font-semibold rounded-tl-md w-12">
                              S.No.
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Product
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Color / Size
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Quantity
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Rate
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Discount
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              {invoiceFormData.taxType === "GST" && (effectiveGstMode) === "Inclusive" ? "Inc. Tax" : "Tax"}
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Staff
                            </th>
                            <th className="p-2 text-left text-sm font-semibold">
                              Amount
                            </th>
                            <th className="p-2 text-left text-sm font-semibold rounded-tr-md">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceFormData.items.map((item, index) => (
                            <InvoiceTableRow
                              key={item.id}
                              index={index}
                              ref={(el) => {
                                rowRefs.current[item.id] = el;
                              }}
                              item={item}
                              currencySymbol={systemSettings?.currency.symbol ?? "$"}
                              onInLineItemChange={(updatedItem) =>
                                handleInLineItemChange(updatedItem, item.id)
                              }
                              onEditItem={handleEditItemAction}
                              onDeleteItem={handleRemoveItem}
                              availableItems={invoiceFormData.items}
                              addNewProduct={handleNewRow}

                              selectedStaffId={selectedStaffId}
                              selectedStaffName={selectedStaffName}
                            />
                          ))}
                          {invoiceFormData.items.length === 0 && (
                            <tr className="bg-white text-gray-950">
                              <td className="p-3 font-medium text-center" colSpan={8}>
                                No Items Selected
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {renderInvoiceItemsTotalRow()}
                </>
              )}

              <ProductDetailsModal
                  title={pendingQuickAddEntry?.isEdit ? "Edit Item" : "Add Item"}
                  isOpen={isQuickAddQuantityModalOpen}
                  onClose={() => {
                      setIsQuickAddQuantityModalOpen(false);
                      setPendingQuickAddEntry(null);
                      setQuickAddStaffId(null);
                  }}
                  onSave={handleConfirmQuickAddQuantity}
                  item={pendingQuickAddEntry ? {
                      qty: pendingQuickAddEntry.qty,
                      rate: pendingQuickAddEntry.rate,
                      discount: pendingQuickAddEntry.discount,
                      product: pendingQuickAddEntry.product,
                      name: pendingQuickAddEntry.name,
                      variant: pendingQuickAddEntry.variant
                  } : null}
                  currencySymbol={systemSettings?.currency.symbol ?? "$"}
              >
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                      <select
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          value={quickAddStaffId || ""}
                          onChange={(e) => setQuickAddStaffId(e.target.value || null)}
                      >
                          <option value="">-- Default / Empty --</option>
                          {staffList.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  </div>
              </ProductDetailsModal>

              {showDuplicateBarcodeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
                  <div className="bg-white p-5 rounded shadow-md space-y-4 w-[90vw] max-w-md">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Multiple Variants Found
                    </h2>
                    <p className="text-sm text-gray-600">
                      Select the variant you want to add.
                    </p>
                    <div className="max-h-60 overflow-auto border border-gray-200 rounded">
                      {duplicateBarcodeMatches.map((variant: any) => {
                        const productId = typeof variant.productId === 'object' && variant.productId !== null
                          ? (variant.productId.id || variant.productId._id)
                          : variant.productId;
                        const product = productList.find(p => p.id === productId);
                        const label = formatVariantDisplay({
                          brandName: getBrandName(product?.brand),
                          designNo: variant.designNo,
                          size: variant.size,
                        });
                        return (
                          <button
                            key={variant._id}
                            type="button"
                            onClick={() => handleDuplicateBarcodeSelect(variant)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100"
                          >
                            <div className="font-medium text-gray-800">{label || "Variant"}</div>
                            <div className="text-xs text-gray-500">Barcode: {variant.barcode}</div>
                          </button>
                        );
                      })}
                      {duplicateBarcodeMatches.length === 0 && (
                        <div className="p-3 text-sm text-gray-500 text-center">No variants found</div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowDuplicateBarcodeModal(false);
                          setDuplicateBarcodeMatches([]);
                          setPendingBarcodeRowId(null);
                          setPendingBarcodeSource("scan");
                        }}
                        className="px-3 py-1 bg-gray-300 text-black rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Extra Information & Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Extra Information */}
            <div className="bg-white p-2 rounded-lg border border-gray-200">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-gray-950">
                    Extra Information
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowExtraInfo(!showExtraInfo)}
                    className="text-gray-600 hover:text-primary transition-colors p-1"
                    title={showExtraInfo ? "Hide section" : "Show section"}
                  >
                    {showExtraInfo ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
                {showExtraInfo && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setActiveInfoTab("notes")}
                        className={`px-4 py-2 text-sm cursor-pointer font-medium rounded-md ${activeInfoTab === "notes"
                          ? "bg-primary text-white"
                          : "bg-gray-200  text-gray-700 "
                          }`}
                      >
                        Add Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInfoTab("termsAndCondition")}
                        className={`px-4 py-2 text-sm cursor-pointer font-medium rounded-md ${activeInfoTab === "termsAndCondition"
                          ? "bg-primary text-white"
                          : "bg-gray-200  text-gray-700 "
                          }`}
                      >
                        Add Terms & Conditions
                      </button>
                    </div>

                    {activeInfoTab === "notes" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 ">
                          Additional Notes
                        </label>
                        <textarea
                          value={invoiceFormData.notes}
                          onChange={(e) =>
                            handleFormChange("notes", e.target.value)
                          }
                          rows={4}
                          placeholder="Enter Notes"
                          className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                        ></textarea>
                      </div>
                    )}
                    {activeInfoTab === "termsAndCondition" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 ">
                          Terms & Conditions
                        </label>
                        <textarea
                          value={invoiceFormData.termsAndCondition}
                          onChange={(e) =>
                            handleFormChange("termsAndCondition", e.target.value)
                          }
                          rows={4}
                          placeholder="Enter Terms & Conditions"
                          className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                        ></textarea>
                      </div>
                    )}
                    {activeInfoTab === "bank" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 ">
                          Account
                        </label>
                        <SmartDropdown
                          items={bankAccounts}
                          value={bankAccountSearchInput}
                          onChange={(value) => {
                            setBankAccountSearchInput(value);
                            handleFormChange("bank", null);
                          }}
                          onSelect={(item) =>
                            handleFormChange("bank", (item as OptionType)?.id || null)
                          }
                          onAddNew={() => setIsCreateBankAccountModalOpen(true)}
                          selectedItem={bankAccounts.find(
                            (item) => item.id === invoiceFormData.bank
                          )}
                          addNewLabel="New Bank Account"
                          placeholder="Type to search Bank Account..."
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Payment Summary */}
            <div className="bg-white p-2 rounded-lg border border-gray-200 space-y-2">
              {(() => {
                const isInclusiveCalc = invoiceFormData.taxType === "GST" && (effectiveGstMode) === "Inclusive";
                let syncSubTotal = 0;
                let syncTotalTax = 0;
                let syncLineDiscount = 0;
                invoiceFormData.items.forEach((item) => {
                  syncSubTotal += (Number(item.qty) || 0) * (Number(item.rate) || 0);
                  syncTotalTax += Number(item.tax) || 0;
                  syncLineDiscount += Number(item.discount) || 0;
                });
                const discountBase = isInclusiveCalc ? syncSubTotal : syncSubTotal + syncTotalTax;
                const maxInvoiceDiscount = Math.max(discountBase - syncLineDiscount, 0);
                const syncExtraDiscount = getInvoiceDiscountAmount(maxInvoiceDiscount, invoiceLevelDiscount, invoiceLevelDiscountType);
                const combinedDiscount = syncLineDiscount + syncExtraDiscount;
                const syncGrandTotal = isInclusiveCalc ? syncSubTotal - combinedDiscount : syncSubTotal + syncTotalTax - combinedDiscount;
                const syncTotalInWords = numberToWords(Math.round(syncGrandTotal));

                const hasDiscountError = invoiceLevelDiscountType === "Percentage" ? Number(invoiceLevelDiscount) > 100 : Number(invoiceLevelDiscount) > maxInvoiceDiscount;

                return (
                  <>
                    <div className="flex justify-between text-sm text-gray-600 ">
                      <span>Subtotal </span>
                      <span>
                        {systemSettings?.currency.symbol}
                        {formatWholeAmountDisplay(syncSubTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 ">
                      <span>{isInclusiveCalc ? "Inc. Tax" : "Tax"}</span>
                      <span>
                        {systemSettings?.currency.symbol}
                        {formatWholeAmountDisplay(syncTotalTax)}
                      </span>
                    </div>
                    {syncLineDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 ">
                        <span>Item Discount</span>
                        <span>
                          -{systemSettings?.currency.symbol}
                          {formatWholeAmountDisplay(syncLineDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-600 ">
                      <span>Discount</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={invoiceLevelDiscountType}
                          onChange={(e) => setInvoiceLevelDiscountType(e.target.value as "Fixed" | "Percentage")}
                          className="p-1 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none"
                        >
                          <option value="Fixed">Fixed</option>
                          <option value="Percentage">%</option>
                        </select>
                        <span>- {invoiceLevelDiscountType === "Fixed" ? systemSettings?.currency.symbol : "%"}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Enter discount"
                          className="w-24 p-1 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none"
                          value={invoiceLevelDiscount ? invoiceLevelDiscount : ""}
                          onChange={(e) => {
                            const raw = Number(e.target.value) || 0;
                            setInvoiceLevelDiscount(invoiceLevelDiscountType === "Percentage" ? Math.min(Math.max(0, raw), 100) : Math.max(0, raw));
                          }}
                        />
                      </div>
                    </div>
                    {hasDiscountError && (
                      <p className="text-xs text-red-500">
                        {invoiceLevelDiscountType === "Percentage" ? "Discount cannot exceed 100%." : "Discount cannot exceed subtotal."}
                      </p>
                    )}
                    {syncExtraDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 ">
                        <span>Extra Discount</span>
                        <span>
                          -{systemSettings?.currency.symbol}
                          {formatWholeAmountDisplay(syncExtraDiscount)}
                        </span>
                      </div>
                    )}
                    <hr className="border-gray-200 " />
                    {isExchangeCreate && exchangeOriginalItems.length > 0 && (
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Old Amount</span>
                          <span>{systemSettings?.currency?.symbol || "₹"}{formatWholeAmountDisplay(exchangeOldTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>New Amount</span>
                          <span>{systemSettings?.currency?.symbol || "₹"}{formatWholeAmountDisplay(exchangeNewTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{exchangeAmountDifference < 0 ? "Refund" : "Extra Payable"}</span>
                          <span>{systemSettings?.currency?.symbol || "₹"}{formatWholeAmountDisplay(Math.abs(exchangeAmountDifference))}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-950 ">
                      <span>Total <small className="text-xs text-gray-500 font-medium">(Rounded)</small></span>
                      <span>{systemSettings?.currency.symbol}{formatWholeAmountDisplay(syncGrandTotal)}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      {syncTotalInWords}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer Buttons - Sticky at bottom on larger screens */}
            <div className="relative md:fixed bottom-0 left-0 md:left-60 right-0 bg-white border-t border-gray-200 shadow-lg md:z-30 mt-4 md:mt-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(isCreditNote ? "/admin/credit-notes" : "/admin/invoices")}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>


                  {!forceStatus && !isExchangeCreate && (
                    <button
                      type="button"
                      onClick={handleSaveAsDraft}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-950 focus:outline-none flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      Save as Draft
                    </button>
                  )}

                  <button
                    type="submit"
                    onClick={handlePrimaryAction}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-gray-950 focus:outline-none flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {isEditMode ? "Update Invoice" : "Save"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </form >


      <CreateCustomerForm
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(newCustomer: Customer) => {
          // 1️⃣ Add customer to list
          setCustomers(prev => [newCustomer, ...prev]);

          // 2️⃣ Auto-select newly created customer
          handleCustomerChange(newCustomer);

          // 3️⃣ Set dropdown input to phone
          setCustomerSearchInput(newCustomer.phone || "");

          // 4️⃣ Close modal
          setIsCustomerModalOpen(false);
        }}
      />

      {
        isEditProductModalOpen && editingItem && (
          <Modal
            isOpen={isEditProductModalOpen}
            onClose={() => setIsEditProductModalOpen(false)}
            title="Edit Item"
          >
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="edit-qty" className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  id="edit-qty"
                  min="1"
                  step="1"
                  value={editingItem.qty}
                  onChange={(e) => handleEditingItemChange('qty', e.target.value)}
                  className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div>
                <label htmlFor="edit-rate" className="block text-sm font-medium text-gray-700">Rate ({systemSettings?.currency.symbol})</label>
                <input
                  type="number"
                  id="edit-rate"
                  min="0"
                  value={editingItem.rate}
                  onChange={(e) => handleEditingItemChange('rate', e.target.value)}
                  className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div>
                <label htmlFor="edit-discount" className="block text-sm font-medium text-gray-700">Discount Amount ({systemSettings?.currency.symbol})</label>
                <input
                  type="number"
                  id="edit-discount"
                  min="0"
                  value={editingItem.discount_value}
                  onChange={(e) => handleEditingItemChange('discount_value', e.target.value)}
                  className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>


              <div className="pt-2">
                <p className="text-lg font-semibold text-gray-950">
                  New Amount: {systemSettings?.currency.symbol}{formatWholeAmountDisplay(editingItem.amount)}
                </p>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateItem}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-gray-950"
                >
                  Update Item
                </button>
              </div>
            </div>
          </Modal>
        )
      }


      <Modal
        isOpen={showInvoiceDetailsModal}
        onClose={() => setShowInvoiceDetailsModal(false)}
        title="GST / Shipping Details"
        size="3xl"
      >
        {/* GST Information Section */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <FileText size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">GST Information</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Customer GSTIN Number
              </label>
              <input
                type="text"
                value={invoiceDetailsDraft.customerGstin}
                onChange={(e) => handleInvoiceDetailsDraftChange("customerGstin", e.target.value)}
                placeholder="e.g. 29ABCDE1234F1Z5"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                EWay Bill Number
              </label>
              <input
                type="text"
                value={invoiceDetailsDraft.ewayBillNumber}
                onChange={(e) => handleInvoiceDetailsDraftChange("ewayBillNumber", e.target.value)}
                placeholder="e.g. 331234567890"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Shipping Address Section */}
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <MapPin size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Shipping Address</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Recipient Name</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.name}
                onChange={(e) => handleShippingAddressDraftChange("name", e.target.value)}
                placeholder="Full name"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Country</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.country}
                onChange={(e) => handleShippingAddressDraftChange("country", e.target.value)}
                placeholder="Country"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Address Line 1</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.addressLine1}
                onChange={(e) => handleShippingAddressDraftChange("addressLine1", e.target.value)}
                placeholder="Street, building, area"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Address Line 2 <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.addressLine2}
                onChange={(e) => handleShippingAddressDraftChange("addressLine2", e.target.value)}
                placeholder="Landmark, suite, floor"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">State</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.state}
                onChange={(e) => handleShippingAddressDraftChange("state", e.target.value)}
                placeholder="State / Province"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">City</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.city}
                onChange={(e) => handleShippingAddressDraftChange("city", e.target.value)}
                placeholder="City"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Pincode</label>
              <input
                type="text"
                value={invoiceDetailsDraft.shippingAddress.pincode}
                onChange={(e) => handleShippingAddressDraftChange("pincode", e.target.value)}
                placeholder="Postal / ZIP code"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowInvoiceDetailsModal(false)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveInvoiceDetailsFromModal}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <CheckCircle2 size={16} />
            Save Details
          </button>
        </div>
      </Modal>

      <CreateBankAccountModal
        isOpen={isCreateBankAccountModalOpen}
        onClose={() => setIsCreateBankAccountModalOpen(false)}
        onSuccess={(newBankAccount: BankAccountCreatedResponse) => {
          const formattedBankAccount: OptionType = {
            id: newBankAccount.id,
            name: newBankAccount.bankName,
          };
          setBankAccounts((prevBankAccounts) => [
            formattedBankAccount,
            ...prevBankAccounts,
          ]);
          setIsCreateBankAccountModalOpen(false);
        }}
      />

      <InvoiceNumberConfigModal
        isOpen={invoiceNumberConfigModalOpen}
        onClose={() => setInvoiceNumberConfigModalOpen(false)}
        onSuccess={() => setNewInvoiceNumber()}
      />

      <AiDocumentScanModal
        isOpen={showAiInvoiceScanModal}
        onClose={() => setShowAiInvoiceScanModal(false)}
        type="invoice"
        onApply={applyAiInvoiceExtraction}
      />

      {isFetching && <FullPageLoader />}

      {
        !disablePaymentModal && showPaymentModal && invoiceDraft && (
          <PaymentModal
            open={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setIsExtraPaymentMode(false);
            }}
            invoiceDraft={invoiceDraft}
            grandTotal={isExchangePaymentMode ? exchangePaymentAmount : (isEditMode ? editOutstandingAmount : editAdditionalPayable)}
            isEdit={isEditMode}
            onSuccess={(data) => {
              if (data?.invoiceId) setCreatedInvoiceId(data.invoiceId);
              if (data?.totalPaid !== undefined) {
                setInvoiceFormData(prev => ({
                  ...prev,
                  totalPaid: isEditMode
                    ? Number((Number(prev.totalPaid || 0) + Number(data.totalPaid || 0)).toFixed(2))
                    : Number(data.totalPaid || 0),
                  payment_method: data.paymentMethod || prev.payment_method || null,
                  paymentMethod: data.paymentMethod || prev.paymentMethod || null,
                  isCreditInvoice: data.paymentMethod === "CREDIT",
                  status: data.invoiceStatus || (data.paymentMethod === "CREDIT" ? "UNPAID" : prev.status)
                }));
              }

              if (isEditMode) {
                setShowPaymentModal(false);
                setIsExchangePaymentMode(false);
                setExchangePaymentAmount(0);
                setExchangeInvoiceId(null);
                setPaymentPending(false);
                setIsExtraPaymentMode(false);
                setTimeout(() => {
                  if (data?.qrCode) {
                    printWithQr(data.qrCode, data.paymentMethod || "UPI", () => {
                      navigate(isCreditNote ? "/admin/credit-notes" : "/admin/invoices");
                    });
                  } else {
                    handlePrintBill(() => navigate(isCreditNote ? "/admin/credit-notes" : "/admin/invoices"));
                  }
                }, 200);
                return;
              }

              setShowPaymentModal(false);
              if (isExchangePaymentMode) {
                setIsExchangePaymentMode(false);
                setExchangePaymentAmount(0);
                setExchangeInvoiceId(null);
                toast.success("Exchange payment completed.");
                setTimeout(() => {
                  if (data?.qrCode) {
                    printWithQr(data.qrCode, data.paymentMethod || "UPI", () => {
                      reloadExchangeCreatePage();
                    });
                  } else {
                    handlePrintBill(() => reloadExchangeCreatePage());
                  }
                }, 200);
                return;
              }

              if (data?.qrCode) {
                // PhonePe or UPI Flow
                printWithQr(data.qrCode, data.paymentMethod || "UPI", () => {
                  toast.success("Invoice Saved & QR Generated. Please Scan to Pay.");
                  setTimeout(() => reloadCreateInvoicePage(), 800);
                });
              } else {
                setTimeout(() => {
                  handlePrintBill(() => {
                    toast.success("Invoice created successfully!");
                    setTimeout(() => reloadCreateInvoicePage(), 800);
                  });
                }, 500);
              }
            }}
            invoiceId={isEditMode ? (invoiceId ?? undefined) : (isExchangePaymentMode ? exchangeInvoiceId ?? undefined : undefined)}
            isExchangePayment={isExchangePaymentMode}
            updateExistingPayment={isExtraPaymentMode}
          />
        )
      }

      <ProfessionalPrintDialog
        isOpen={showProfessionalPrintDialog}
        onClose={() => {
          setShowProfessionalPrintDialog(false);
          if (pendingPrintActionRef.current) pendingPrintActionRef.current();
          pendingPrintActionRef.current = null;
        }}
        onPrint={() => {
          setShowProfessionalPrintDialog(false);
          window.setTimeout(() => executePrintBill(), 80);
        }}
        onWhatsApp={async () => {
          await handleSendWhatsAppClick();
          setShowProfessionalPrintDialog(false);
          if (pendingPrintActionRef.current) pendingPrintActionRef.current();
          pendingPrintActionRef.current = null;
        }}
        onPrintAndWhatsApp={async () => {
          await handleSendWhatsAppClick();
          setShowProfessionalPrintDialog(false);
          window.setTimeout(() => executePrintBill(), 80);
        }}
        title="Print Thermal Bill"
        documentName={invoiceFormData.invoiceNumber || "Invoice Bill"}
        documentType="Thermal Bill"
        description="Review the thermal bill before sending it to print."
        preview={printRef.current ? <div className="bg-white" dangerouslySetInnerHTML={{ __html: printRef.current.innerHTML }} /> : null}
        previewWrapperClassName="overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm p-4"
        footerNote="The final print layout will use the thermal bill template."
        printButtonLabel="Print Bill"
        showCopies={false}
        showPaperSize={false}
        showOrientation={false}
      />

      {/* For Printing Bill */}
      <div className="hidden">
        <ThermalInvoice58mm
          ref={printRef}
          invoiceFormData={
            isExchangeCreate
              ? {
                ...invoiceFormData,
                exchangeOriginalItems: selectedExchangeItems,
                exchangeOldTotal,
                exchangeNewTotal
              }
              : invoiceFormData
          }
          companyDetails={companyDetails}
          customerDetails={customerDetails}
          phonepeQRCode={phonepeQRCode}
          upiQRCode={upiQRCode}
        />
      </div>
    </div >
  );
};

export default CreateInvoice;
