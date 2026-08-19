import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import QRCode from "qrcode";
import DateInput from "@components/admin/DateInput";

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceDraft: FormData;
  grandTotal: number; // ✅ EXACT payable amount (₹ with decimals)
  onSuccess: (data?: any) => void; // ✅ Updated to accept data (like QR code)
  isEdit?: boolean; // NEW: indicates if we're editing
  invoiceId?: string; // NEW: invoice ID for edit mode
  isExchangePayment?: boolean; // NEW: indicates this is for exchange upgrade payment
  updateExistingPayment?: boolean; // NEW: update existing payment record on edit extra payments
  recordPaymentOnly?: boolean; // For paying remaining balance from invoice list without editing invoice data
}

// Removed RAZORPAY
type PaymentMode = "CASH" | "CARD" | "MIXED" | "CREDIT" | "PHONEPE" | "UPI";
type MixedSplitMode = "CASH_UPI" | "CARD_UPI" | "CASH_CARD";

const PaymentModal: React.FC<Props> = ({
  open,
  onClose,
  invoiceDraft,
  grandTotal,
  onSuccess,
  isEdit = false,
  invoiceId,
  isExchangePayment = false, // Default to false for regular payments
  updateExistingPayment = false,
  recordPaymentOnly = false,
}) => {
  const { token } = useSelector((state: RootState) => state.auth);

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [cardAmount, setCardAmount] = useState<number | "">("");
  const [mixedSplitMode, setMixedSplitMode] = useState<MixedSplitMode>("CASH_UPI");
  const [creditPaidAmount, setCreditPaidAmount] = useState<number>(0);
  const [creditDueDate, setCreditDueDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [phonePeEnabled, setPhonePeEnabled] = useState<boolean>(false);

  // New state for Mixed Payment QR
  const [showMixedQR, setShowMixedQR] = useState(false);
  const [mixedQRImage, setMixedQRImage] = useState<string | null>(null);
  const [mixedTransactionId] = useState<string | null>(null);
  const [mixedPhonePeAmount, setMixedPhonePeAmount] = useState<number>(0);

  // 🔒 Single source of truth
  const payableAmount = Number(grandTotal.toFixed(2)); // ₹
  const payableAmountPaise = Math.round(payableAmount * 100); // paise

  const getApiErrorMessage = (err: any, fallback: string) => {
    const firstError = Array.isArray(err?.response?.data?.errors) ? err.response.data.errors[0] : null;
    return (
      firstError?.msg ||
      firstError?.message ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      fallback
    );
  };

  const getMixedSplitAmounts = (totalAmount = payableAmount) => {
    const normalizedCash = Number(Number(cashAmount || 0).toFixed(2));
    const normalizedCard = Number(Number(cardAmount || 0).toFixed(2));

    if (mixedSplitMode === "CASH_UPI") {
      return {
        cash: normalizedCash,
        card: 0,
        upi: Number(Math.max(totalAmount - normalizedCash, 0).toFixed(2)),
      };
    }

    if (mixedSplitMode === "CARD_UPI") {
      return {
        cash: 0,
        card: normalizedCard,
        upi: Number(Math.max(totalAmount - normalizedCard, 0).toFixed(2)),
      };
    }

    return {
      cash: normalizedCash,
      card: normalizedCard,
      upi: 0,
    };
  };

  const getMixedModeLabel = () => {
    if (mixedSplitMode === "CASH_UPI") return "Cash + UPI";
    if (mixedSplitMode === "CARD_UPI") return "Card + UPI";
    return "Cash + Card";
  };

  // Fetch PhonePe enabled setting
  React.useEffect(() => {
    const fetchPhonePeStatus = async () => {
      try {
        const response = await axios.get(
          Constants.GET_UPI_SETTINGS_URL,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const enabled = response.data?.data?.phonePeEnabled || false;
        setPhonePeEnabled(enabled);
      } catch (err) {
        console.error("Error fetching PhonePe status:", err);
        // Default to false if there's an error
        setPhonePeEnabled(false);
      }
    };

    if (open) {
      fetchPhonePeStatus();
    }
  }, [open, token]);

  // ✅ Safe close handler to prevent hooks error during unmount
  const handleClose = () => {
    // Small delay to ensure any pending state updates complete
    setTimeout(() => {
      onClose();
    }, 50);
  };

  /* ---------------------------------------------------
    CREATE/UPDATE INVOICE + PAYMENT
  --------------------------------------------------- */
  const createInvoiceAndPayment = async (
    paymentMethod: "CASH" | "CARD" | "PHONEPE" | "UPI" | "MIXED",
    amount: number,
    status: "PAID" | "PENDING" = "PAID"
  ) => {
    // For exchange payment, use different endpoint
    if (isExchangePayment && invoiceId) {
      await axios.post(
        `${Constants.EXCHANGE_INVOICE_PAYMENT_URL}/${invoiceId}/exchange-payment`,
        {
          payment_method: paymentMethod,
          amount: Number(amount.toFixed(2)),
          ...(paymentMethod === "MIXED"
            ? (() => {
              const mixedSplit = getMixedSplitAmounts(Number(amount.toFixed(2)));
              return {
                cashAmount: mixedSplit.cash,
                cardAmount: mixedSplit.card,
                upiAmount: mixedSplit.upi,
              };
            })()
            : {})
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return invoiceId;
    }

    const shouldDirectlyRecordExistingInvoicePayment =
      !!invoiceId && !isExchangePayment && recordPaymentOnly;

    if (shouldDirectlyRecordExistingInvoicePayment && invoiceId) {
      const paymentPayload: Record<string, any> = {
        invoiceId,
        payment_method: paymentMethod,
        amount: Number(amount.toFixed(2)),
      };

      if (paymentMethod === "MIXED") {
        const mixedSplit = getMixedSplitAmounts(Number(amount.toFixed(2)));
        paymentPayload.cashAmount = mixedSplit.cash;
        paymentPayload.cardAmount = mixedSplit.card;
        paymentPayload.upiAmount = mixedSplit.upi;
      }

      await axios.post(
        Constants.CREATE_INVOICE_PAYMENT_URL,
        paymentPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return invoiceId;
    }

    // Regular invoice creation/update flow
    const finalFormData = new FormData();

    invoiceDraft.forEach((value, key) => {
      finalFormData.append(key, value as string);
    });

    finalFormData.set("payment_method", paymentMethod);
    finalFormData.set("status", status); // Set status
    if (paymentMethod === "MIXED") {
      const mixedSplit = getMixedSplitAmounts(Number(amount.toFixed(2)));
      finalFormData.set("cashAmount", mixedSplit.cash.toString());
      finalFormData.set("cardAmount", mixedSplit.card.toString());
      finalFormData.set("upiAmount", mixedSplit.upi.toString());
    }

    let resolvedInvoiceId = invoiceId;

    // 1️⃣ CREATE or UPDATE INVOICE
    if (isEdit && invoiceId) {
      // UPDATE existing invoice
      await axios.put(
        `${Constants.UPDATE_INVOICE_URL}/${invoiceId}`,
        finalFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else {
      // CREATE new invoice
      const invoiceRes = await axios.post(
        Constants.CREATE_NEW_INVOICE_URL,
        finalFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      resolvedInvoiceId = invoiceRes.data?.data?._id || invoiceRes.data?.data?.id;

      if (!resolvedInvoiceId) {
        console.error("Invoice API response:", invoiceRes.data);
        throw new Error("Invoice ID not returned");
      }
    }

    // 2️⃣ CREATE PAYMENT RECORD (₹ ONLY) - ONLY IF PAID
    if (status === "PAID") {
      const paymentPayload: Record<string, any> = {
        invoiceId: resolvedInvoiceId,
        payment_method: paymentMethod,
        amount: Number(amount.toFixed(2)), // ₹ value
      };
      if (updateExistingPayment && isEdit && !isExchangePayment) {
        paymentPayload.updateExistingPayment = true;
      }

      if (paymentMethod === "MIXED") {
        const mixedSplit = getMixedSplitAmounts(Number(amount.toFixed(2)));
        paymentPayload.cashAmount = mixedSplit.cash;
        paymentPayload.cardAmount = mixedSplit.card;
        paymentPayload.upiAmount = mixedSplit.upi;
      }

      await axios.post(
        Constants.CREATE_INVOICE_PAYMENT_URL,
        paymentPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }

    return resolvedInvoiceId;
  };

  /* ---------------------------------------------------
    CASH PAYMENT
  --------------------------------------------------- */
  const handleCash = async () => {
    let success = false;

    try {
      setLoading(true);

      await createInvoiceAndPayment("CASH", payableAmount);

      toast.success("Invoice paid with cash");
      success = true;
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Cash payment failed"));
    } finally {
      setLoading(false);
    }

    // Call onSuccess AFTER try-catch-finally completes
    if (success) {
      onSuccess({ totalPaid: payableAmount, paymentMethod: "CASH" });
    }
  };

  const handleCard = async () => {
    let success = false;

    try {
      setLoading(true);

      await createInvoiceAndPayment("CARD", payableAmount);

      toast.success("Invoice paid with card");
      success = true;
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Card payment failed"));
    } finally {
      setLoading(false);
    }

    if (success) {
      onSuccess({ totalPaid: payableAmount, paymentMethod: "CARD" });
    }
  };

  /* ---------------------------------------------------
    CREDIT PAYMENT (Deferred - No Payment)
  --------------------------------------------------- */
  const handleCredit = async () => {
    let success = false;
    let successData: Record<string, unknown> | null = null;
    const paidNow = Number(Number(creditPaidAmount || 0).toFixed(2));

    try {
      setLoading(true);

      if (paidNow < 0) {
        toast.error("Credit paid amount cannot be negative");
        return;
      }

      const finalFormData = new FormData();
      invoiceDraft.forEach((value, key) => {
        finalFormData.append(key, value as string);
      });

      let creditStatus = "UNPAID";
      if (paidNow >= payableAmount) {
        creditStatus = "PAID";
      } else if (paidNow > 0) {
        creditStatus = "PARTIAL";
      }

      finalFormData.set("status", creditStatus);
      finalFormData.set("payment_method", "CREDIT");
      // Override dueDate with what user picked in the modal
      if (creditDueDate instanceof Date) {
        const y = creditDueDate.getFullYear();
        const m = String(creditDueDate.getMonth() + 1).padStart(2, "0");
        const d = String(creditDueDate.getDate()).padStart(2, "0");
        finalFormData.set("dueDate", `${y}-${m}-${d}`);
      }

      let savedInvoiceId = invoiceId;
      if (isEdit && invoiceId) {
        await axios.put(
          `${Constants.UPDATE_INVOICE_URL}/${invoiceId}`,
          finalFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        const invoiceRes = await axios.post(
          Constants.CREATE_NEW_INVOICE_URL,
          finalFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        savedInvoiceId = invoiceRes.data?.data?._id || invoiceRes.data?.data?.id;
      }

      if (!savedInvoiceId) {
        throw new Error("Invoice ID not returned");
      }

      const balance = Number((payableAmount - paidNow).toFixed(2));
      const paymentRes = await axios.post(
        Constants.CREATE_INVOICE_PAYMENT_URL,
        {
          invoiceId: savedInvoiceId,
          payment_method: "CREDIT",
          amount: paidNow,
          creditAmount: balance,
          received_on: new Date(),
          notes: paidNow > 0
            ? "Partial payment received while saving credit invoice"
            : "Full credit invoice created",
          ...(updateExistingPayment && isEdit && !isExchangePayment
            ? { updateExistingPayment: true }
            : {})
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const invoiceStatus =
        paymentRes.data?.data?.invoiceStatus ||
        (paidNow > 0 ? "PARTIALLY_PAID" : "UNPAID");
      toast.success(
        paidNow > 0
          ? `Credit invoice saved with partial payment. Balance Rs.${balance.toFixed(2)}`
          : "Invoice saved on credit - payment deferred"
      );
      successData = {
        invoiceId: savedInvoiceId,
        totalPaid: paidNow,
        paymentMethod: "CREDIT",
        invoiceStatus,
        balanceAmount: balance,
      };
      success = true;
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Failed to save on credit"));
    } finally {
      setLoading(false);
    }

    // Call onSuccess AFTER try-catch-finally completes
    if (success) {
      onSuccess(successData);
    }
  };

  /* ---------------------------------------------------
    PHONEPE HANDLER
  --------------------------------------------------- */
  const handlePhonePe = async () => {
    let successData: any = null;

    try {
      setLoading(true);
      // 1. Create Invoice with PENDING status
      const savedInvoiceId = await createInvoiceAndPayment("PHONEPE", payableAmount, "PENDING");

      if (!savedInvoiceId) {
        throw new Error("Failed to save invoice");
      }

      // 2. Generate QR Code
      const res = await axios.post(
        Constants.PHONEPE_CREATE_QR_ORDER,
        {
          invoiceId: savedInvoiceId,
          amount: payableAmountPaise, // paise
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        toast.success("PhonePe QR Code Generated - Printing...");

        // Store success data instead of calling onSuccess immediately
        successData = {
          qrCode: res.data.qrCodeImage,
          transactionId: res.data.transactionId,
          invoiceId: savedInvoiceId,
          paymentMethod: "PHONEPE",
          totalPaid: payableAmount
        };
      } else {
        toast.error("Failed to generate QR Code");
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "PhonePe initiation failed");
    } finally {
      setLoading(false);
    }

    // Call onSuccess AFTER try-catch-finally completes
    if (successData) {
      onSuccess(successData);
    }
  };

  /* ---------------------------------------------------
    UPI HANDLER
  --------------------------------------------------- */
  const handleUpi = async () => {
    let successData: any = null;

    try {
      setLoading(true);

      // 1. Fetch UPI ID from settings
      const settingsRes = await axios.get(
        Constants.GET_UPI_SETTINGS_URL,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const fetchedUpiId = settingsRes.data?.data?.upiId;
      if (!fetchedUpiId) {
        toast.error("UPI ID not configured. Please configure it in UPI Settings.");
        setLoading(false);
        return;
      }

      // 2. Create Invoice with PENDING status
      const savedInvoiceId = await createInvoiceAndPayment("UPI", payableAmount, "PENDING");

      if (!savedInvoiceId) {
        throw new Error("Failed to save invoice");
      }

      // 3. Generate UPI Payment Link
      const invoiceNumber = invoiceDraft.get("invoiceNumber") || savedInvoiceId;
      const businessName = invoiceDraft.get("billFrom") || "Business";

      const upiLink = `upi://pay?pa=${fetchedUpiId}&pn=${encodeURIComponent(businessName as string)}&am=${payableAmount}&cu=INR&tn=Invoice_${invoiceNumber}`;

      // 4. Generate QR Code from UPI Link
      const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
        width: 300,
        margin: 2,
      });

      toast.success("UPI QR Code Generated - Printing...");

      // Store success data instead of calling onSuccess immediately
      successData = {
        qrCode: qrCodeDataUrl,
        upiLink: upiLink,
        invoiceId: savedInvoiceId,
        paymentMethod: "UPI",
        totalPaid: payableAmount
      };

    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "UPI payment initiation failed");
    } finally {
      setLoading(false);
    }

    // Call onSuccess AFTER try-catch-finally completes
    if (successData) {
      onSuccess(successData);
    }
  };


  // RE-WROTE `handleMixedPayment` to store invoiceId:
  const [mixedInvoiceId, setMixedInvoiceId] = useState<string | null>(null);

  // Re-run this part with `setMixedInvoiceId` added
  const handleMixedPayment = async () => {
    const invoiceNumber = invoiceDraft.get("invoiceNumber");
    if (!invoiceNumber) { toast.error("Invoice number missing"); return; }
    const mixedSplit = getMixedSplitAmounts();
    const primaryAmount = mixedSplitMode === "CASH_UPI" ? mixedSplit.cash : mixedSplit.card;
    const remainingAmount = mixedSplit.upi;

    let successData: any = null;

    try {
      setLoading(true);

      if (mixedSplitMode === "CASH_CARD") {
        if (mixedSplit.cash <= 0 || mixedSplit.card <= 0) {
          toast.error("Enter both cash and card amounts");
          return;
        }

        if (Number((mixedSplit.cash + mixedSplit.card).toFixed(2)) !== Number(payableAmount.toFixed(2))) {
          toast.error("Cash + Card total must equal invoice amount");
          return;
        }

        const savedInvoiceId = await createInvoiceAndPayment("MIXED", payableAmount, "PAID");
        toast.success("Invoice paid with Cash + Card");
        successData = {
          invoiceId: savedInvoiceId,
          paymentMethod: "MIXED",
          cashAmount: mixedSplit.cash,
          cardAmount: mixedSplit.card,
          upiAmount: 0,
          totalPaid: payableAmount
        };
        onSuccess(successData);
        return;
      }

      if (primaryAmount <= 0 || primaryAmount >= payableAmount) {
        toast.error(`Invalid ${mixedSplitMode === "CASH_UPI" ? "cash" : "card"} amount`);
        return;
      }

      // 1. Fetch UPI ID from settings
      const settingsRes = await axios.get(
        Constants.GET_UPI_SETTINGS_URL,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const fetchedUpiId = settingsRes.data?.data?.upiId;
      if (!fetchedUpiId) {
        toast.error("UPI ID not configured. Please configure it in UPI Settings.");
        setLoading(false);
        return;
      }

      if (isExchangePayment) {
        await createInvoiceAndPayment("MIXED", payableAmount, "PENDING");
        const businessName = invoiceDraft.get("billFrom") || "Business";
        const upiLink = `upi://pay?pa=${fetchedUpiId}&pn=${encodeURIComponent(businessName as string)}&am=${remainingAmount}&cu=INR&tn=Invoice_${invoiceNumber}_Mixed`;
        const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
          width: 300,
          margin: 2,
        });

        successData = {
          qrCode: qrCodeDataUrl,
          upiLink: upiLink,
          invoiceId: invoiceId,
          paymentMethod: "MIXED",
          cashAmount: mixedSplit.cash,
          cardAmount: mixedSplit.card,
          upiAmount: remainingAmount,
          totalPaid: payableAmount
        };
      } else {
        let savedId = invoiceId;
        if (isEdit && invoiceId) {
          await createInvoiceAndPayment("MIXED", payableAmount, "PENDING");
        } else {
          const finalFormData = new FormData();
          invoiceDraft.forEach((value, key) => { finalFormData.append(key, value as string); });
          finalFormData.set("payment_method", "MIXED");
          finalFormData.set("status", "PENDING");
          finalFormData.set("cashAmount", mixedSplit.cash.toString());
          finalFormData.set("cardAmount", mixedSplit.card.toString());
          finalFormData.set("upiAmount", remainingAmount.toString());

          const res = await axios.post(Constants.CREATE_NEW_INVOICE_URL, finalFormData, { headers: { Authorization: `Bearer ${token}` } });
          savedId = res.data?.data?._id || res.data?.data?.id;
        }

        if (!savedId) throw new Error("Failed");
        setMixedInvoiceId(savedId);

        // 3. Generate UPI Payment Link for remaining amount
        const businessName = invoiceDraft.get("billFrom") || "Business";
        const upiLink = `upi://pay?pa=${fetchedUpiId}&pn=${encodeURIComponent(businessName as string)}&am=${remainingAmount}&cu=INR&tn=Invoice_${invoiceNumber}_Mixed`;

        const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
          width: 300,
          margin: 2,
        });

        setMixedQRImage(qrCodeDataUrl);
        setMixedPhonePeAmount(remainingAmount);
        toast.success(`Mixed Payment QR Generated - ${getMixedModeLabel()} ₹${primaryAmount} + UPI ₹${remainingAmount}`);

        successData = {
          qrCode: qrCodeDataUrl,
          upiLink: upiLink,
          invoiceId: savedId,
          paymentMethod: "MIXED",
          cashAmount: mixedSplit.cash,
          cardAmount: mixedSplit.card,
          upiAmount: remainingAmount,
          totalPaid: payableAmount
        };
      }

    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Error creating mixed payment"));
    } finally {
      setLoading(false);
    }

    // Call onSuccess AFTER try-catch-finally completes
    if (successData) {
      onSuccess(successData);
    }
  };


  // Simulate Success for Mixed
  const simulateMixedSuccess = async () => {
    if (!mixedInvoiceId || !mixedTransactionId) return;

    try {
      setLoading(true);
      toast.info("Finalizing mixed payment...");

      // 1. Create Invoice Payment Record (MIXED)
      await axios.post(
        Constants.CREATE_INVOICE_PAYMENT_URL,
        {
          invoiceId: mixedInvoiceId,
          payment_method: "MIXED",
          amount: payableAmount, // TOTAL AMOUNT
          cashAmount: getMixedSplitAmounts().cash,
          cardAmount: getMixedSplitAmounts().card,
          upiAmount: mixedPhonePeAmount, // The split part
          received_on: new Date(),
          notes: `Mixed Payment: ${getMixedModeLabel()} + UPI ₹${mixedPhonePeAmount}`,
          ...(updateExistingPayment && isEdit && !isExchangePayment
            ? { updateExistingPayment: true }
            : {})
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2. Explicitly update status to PAID (Controller does validation but good to be sure)
      // Actually controller `recordInvoicePayment` updates status if paid in full.
      // Since we are sending Total Amount in the record for Mixed (which wraps both), it should mark as PAID.
      // Wait, do we create 2 records or 1? `InvoicePayment.js` supports `cashAmount` and `phonePeAmount` in ONE record.

      toast.success("Mixed Payment Successful!");
      onSuccess({
        qrCode: mixedQRImage,
        transactionId: mixedTransactionId,
        invoiceId: mixedInvoiceId,
        paymentMethod: "MIXED",
        totalPaid: payableAmount
      }); // Close modal and Trigger Print with QR

    } catch (err) {
      console.error(err);
      toast.error("Failed to record mixed payment");
    } finally {
      setLoading(false);
    }
  };


  /* ---------------------------------------------------
    SUBMIT
  --------------------------------------------------- */
  const handlePay = () => {
    if (paymentMode === "CASH") return handleCash();
    if (paymentMode === "CARD") return handleCard();
    if (paymentMode === "PHONEPE") return handlePhonePe();
    if (paymentMode === "UPI") return handleUpi();
    if (paymentMode === "MIXED") return handleMixedPayment(); // Used the new one
    if (paymentMode === "CREDIT") return handleCredit();
  };

  /* ---------------------------------------------------
    UI
  --------------------------------------------------- */
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white w-[420px] rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-bold">
          {isExchangePayment ? 'Complete Exchange Payment' : 'Complete Payment'}
        </h2>

        {/* MIXED PAYMENT QR VIEW */}
        {showMixedQR ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Scan to pay remaining amount</p>
              <p className="text-xl font-bold text-primary">₹{mixedPhonePeAmount.toFixed(2)}</p>
            </div>

            {mixedQRImage ? (
              <img src={mixedQRImage} alt="Payment QR" className="w-48 h-48 border rounded shadow-sm" />
            ) : (
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded">
                <span className="text-xs text-gray-500">Loading QR...</span>
              </div>
            )}

            <div className="text-xs text-gray-500">
              Full Amount: ₹{payableAmount.toFixed(2)} <br />
              ({getMixedModeLabel()}: ₹{Number(mixedSplitMode === "CASH_UPI" ? cashAmount : cardAmount).toFixed(2)} + UPI: ₹{mixedPhonePeAmount.toFixed(2)})
            </div>

            <div className="w-full flex gap-2 pt-2">
              <button
                onClick={simulateMixedSuccess}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
                disabled={loading}
              >
                {loading ? "Verifying..." : "I have paid (Simulate Success)"}
              </button>
              <button
                onClick={() => setShowMixedQR(false)}
                className="px-4 py-2 border rounded"
                disabled={loading}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          // STANDARD SELECTION VIEW
          <>
            <div className="flex gap-4 flex-wrap">
              {/* Conditionally include PHONEPE based on phonePeEnabled setting */}
              {["CASH", "CARD", ...(phonePeEnabled ? ["PHONEPE"] : []), "UPI", "MIXED", "CREDIT"].map((m) => (
                <label key={m} className={`flex gap-2 items-center cursor-pointer border p-2 rounded ${paymentMode === m ? 'bg-primary/10 border-primary' : ''}`}>
                  <input
                    type="radio"
                    checked={paymentMode === m}
                    onChange={() => setPaymentMode(m as PaymentMode)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{m}</span>
                </label>
              ))}
            </div>

            {paymentMode === "MIXED" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mixed Combination</label>
                <div className="flex gap-3 mb-3 flex-wrap">
                  {([
                    { key: "CASH_UPI" as MixedSplitMode, label: "Cash + UPI" },
                    { key: "CARD_UPI" as MixedSplitMode, label: "Card + UPI" },
                    { key: "CASH_CARD" as MixedSplitMode, label: "Cash + Card" },
                  ]).map((mode) => (
                    <label key={mode.key} className={`flex gap-2 items-center cursor-pointer border px-3 py-2 rounded ${mixedSplitMode === mode.key ? 'bg-primary/10 border-primary' : ''}`}>
                      <input
                        type="radio"
                        checked={mixedSplitMode === mode.key}
                        onChange={() => {
                          setMixedSplitMode(mode.key);
                          setCashAmount("");
                          setCardAmount("");
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">{mode.label}</span>
                    </label>
                  ))}
                </div>
                {mixedSplitMode === "CASH_CARD" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cash Amount</label>
                        <input
                          type="number"
                          className="border border-gray-300 rounded-md px-3 py-[7px] w-full text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder:text-gray-400"
                          placeholder="Cash amount received"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Card Amount</label>
                        <input
                          type="number"
                          className="border border-gray-300 rounded-md px-3 py-[7px] w-full text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder:text-gray-400"
                          placeholder="Card amount received"
                          value={cardAmount}
                          onChange={(e) => setCardAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                      <span>Total Allocated:</span>
                      <span className="font-bold">
                        ₹{Number((Number(cashAmount) + Number(cardAmount)).toFixed(2)).toFixed(2)} / ₹{payableAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Enter {mixedSplitMode === "CASH_UPI" ? "Cash" : "Card"} Amount</label>
                    <input
                      type="number"
                      className="border border-gray-300 rounded-md px-3 py-[7px] w-full text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder:text-gray-400"
                      placeholder={`${mixedSplitMode === "CASH_UPI" ? "Cash" : "Card"} amount received`}
                      value={mixedSplitMode === "CASH_UPI" ? cashAmount : cardAmount}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        if (mixedSplitMode === "CASH_UPI") setCashAmount(val);
                        else setCardAmount(val);
                      }}
                    />
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                      <span>Remaining (UPI):</span>
                      <span className="font-bold">
                        ₹{getMixedSplitAmounts().upi.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {paymentMode === "CREDIT" && (
              <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">

                {/* Due Date */}
                <DateInput
                  label="Due Date (optional)"
                  value={creditDueDate}
                  onChange={(date) => setCreditDueDate(date)}
                  minDate={new Date()}
                />

                {/* Partial Payment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 pb-1">
                    Paid Amount Now <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={Math.max(payableAmount - 0.01, 0)}
                    step="0.01"
                    className="border border-gray-300 rounded-md px-3 py-[7px] w-full text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder:text-gray-400"
                    placeholder="Enter amount received now"
                    value={creditPaidAmount || ""}
                    onChange={(e) => setCreditPaidAmount(Number(e.target.value || 0))}
                  />
                </div>

                {/* Balance */}
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm">
                  <span className="text-gray-500">Credit Balance</span>
                  <span className="font-semibold text-gray-900">
                    ₹{Math.max(0, payableAmount - Number(creditPaidAmount || 0)).toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  Leave blank for full credit. Enter a partial amount to collect some now.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={handleClose} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={handlePay}
                className={`px-4 py-2 bg-primary rounded flex items-center justify-center min-w-[100px] relative ${paymentMode === "CREDIT" ? "text-transparent" : "text-white"}`}
              >
                {paymentMode === "CREDIT" && (
                  <span className="absolute inset-0 flex items-center justify-center text-white">
                    {loading ? "Processing..." : `Credit ₹${Math.max(0, payableAmount - Number(creditPaidAmount || 0)).toFixed(2)}`}
                  </span>
                )}
                {loading ? "Processing..." : `Pay ₹${paymentMode === "MIXED"
                  ? (mixedSplitMode === "CASH_CARD"
                    ? payableAmount.toFixed(2)
                    : getMixedSplitAmounts().upi > 0
                      ? getMixedSplitAmounts().upi.toFixed(2)
                      : payableAmount.toFixed(2))
                  : payableAmount.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
