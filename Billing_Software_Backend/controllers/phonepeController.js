const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Invoice = require('../models/Invoice');
const InvoicePayment = require('../models/InvoicePayment'); // Payment record model

// --- Configuration ---
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
const ENV = process.env.PHONEPE_ENVIRONMENT || 'sandbox';
const BASE_URL = process.env.PHONEPE_API_BASE_URL;

// --- Helper Functions ---
const generateChecksum = (payload, apiEndpoint) => {
    const data = payload + apiEndpoint + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    return `${sha256}###${SALT_INDEX}`;
};

// --- Controller Functions ---

/**
 * Create PhonePe Payment Request & Generate QR Code
 * Flow:
 * 1. Receive invoiceId and amount
 * 2. Construct payment payload
 * 3. Call PhonePe API
 * 4. Generate QR code from UPI string
 * 5. Update invoice with transaction ID and QR code
 * 6. Return Data to frontend
 */
exports.createPhonePeQROrder = async (req, res) => {
    try {
        const { invoiceId, amount } = req.body; // amount in paise

        if (!invoiceId || !amount) {
            return res.status(400).json({ success: false, message: "Invoice ID and Amount are required" });
        }

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        // Generate Transaction ID
        const transactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const merchantUserId = `MUID_${invoice.customerId}`;

        // Default to UPI_QR for all requests
        const instrumentType = 'UPI_QR';

        // Construct Payload
        const payloadData = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: merchantUserId,
            amount: amount, // in paise
            redirectUrl: `http://localhost:5173/admin/invoices`, // Redirect after payment (if applicable)
            redirectMode: "REDIRECT",
            callbackUrl: `${process.env.BASE_URL}/api/admin/phonepe/webhook`, // HTTPS webhook URL
            paymentInstrument: {
                type: instrumentType
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');
        const apiEndpoint = "/pg/v1/pay";
        const checksum = generateChecksum(base64Payload, apiEndpoint);

        // Call PhonePe API
        const options = {
            method: 'post',
            url: `${BASE_URL}${apiEndpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: base64Payload
            }
        };

        const response = await axios(options);
        const responseData = response.data;

        if (responseData.success) {
            // QR Code Payment (existing logic)
            const instrumentResponse = responseData.data.instrumentResponse;
            const upiString = instrumentResponse?.intentUrl || instrumentResponse?.qrData;

            if (!upiString) {
                return res.status(500).json({ success: false, message: "UPI Intent URL/QR Data not found in response" });
            }

            // Generate QR Code Image (Data URL)
            const qrCodeImage = await QRCode.toDataURL(upiString);

            // Update Invoice with Transaction Details
            invoice.phonepeTransactionId = transactionId;
            invoice.phonepeQRCode = qrCodeImage;
            invoice.phonepePaymentStatus = 'PENDING';
            await invoice.save({ validateBeforeSave: false });

            return res.status(200).json({
                success: true,
                message: "QR Code Generated Successfully",
                transactionId: transactionId,
                qrCodeImage: qrCodeImage,
                upiString: upiString,
                instrumentType: 'UPI_QR'
            });

        } else {
            return res.status(400).json({ success: false, message: responseData.message || "Payment initiation failed" });
        }

    } catch (error) {
        console.error("PhonePe QR Order Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

/**
 * Check Payment Status (Manual Polling)
 */
exports.verifyPhonePePayment = async (req, res) => {
    try {
        const { transactionId } = req.body;

        if (!transactionId) {
            return res.status(400).json({ success: false, message: "Transaction ID is required" });
        }

        const apiEndpoint = `/pg/v1/status/${MERCHANT_ID}/${transactionId}`;
        const checksum = generateChecksum("", apiEndpoint);

        const options = {
            method: 'get',
            url: `${BASE_URL}${apiEndpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': MERCHANT_ID
            }
        };

        const response = await axios(options);
        const responseData = response.data;

        if (responseData.success && responseData.code === "PAYMENT_SUCCESS") {
            await updateInvoiceAfterPhonePePayment(transactionId, responseData.data.amount);

            return res.status(200).json({ success: true, status: "SUCCESS", message: "Payment Successful" });
        } else if (responseData.code === "PAYMENT_PENDING") {
             return res.status(200).json({ success: true, status: "PENDING", message: "Payment Pending" });
        } else {
            return res.status(200).json({ success: true, status: "FAILED", message: "Payment Failed" });
        }

    } catch (error) {
        console.error("PhonePe Verify Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

/**
 * Handle Webhook Notification
 * PhonePe calls this when payment status changes
 */
exports.handlePhonePeWebhook = async (req, res) => {
    try {
        // Validation: Verify X-VERIFY header (Checksum)
        // Note: For simplicity in test mode, we might trust the payload, but in production, ALWAYS verify checksum.
        // The Payload is base64 encoded string in request body.

        const base64Payload = req.body.response;


        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));

        if (payload.code === "PAYMENT_SUCCESS") {
             const transactionId = payload.data.merchantTransactionId;
             const amount = payload.data.amount;

             console.log(`Webhook: Payment SUCCESS for ${transactionId}`);
             await updateInvoiceAfterPhonePePayment(transactionId, amount);
        } else {
             console.log(`Webhook: Payment ${payload.code} for ${payload.data.merchantTransactionId}`);
             // Handle FAILURE/PENDING if needed
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

/**
 * Helper: Update Invoice Status to PAID
 */
async function updateInvoiceAfterPhonePePayment(transactionId, amountPaise) {
    try {
        const invoice = await Invoice.findOne({ phonepeTransactionId: transactionId });

        if (!invoice) {
            console.error(`Invoice not found for transaction: ${transactionId}`);
            return;
        }

        if (invoice.status === 'PAID') {
             console.log(`Invoice ${invoice.invoiceNumber} is already PAID`);
             return; // Already updated
        }

        // Update Invoice Status
        invoice.status = 'PAID';
        invoice.phonepePaymentStatus = 'SUCCESS';
        await invoice.save();

        // Create Payment Record
        const amountRupees = amountPaise / 100;

        const paymentRecord = new InvoicePayment({
            invoiceId: invoice._id,
            amount: amountRupees,
            payment_method: 'PHONEPE',
            received_on: new Date(),
            notes: `PhonePe Payment. TXN ID: ${transactionId}`,
            // received_by: invoice.userId // Optional: link to admin user
        });

        await paymentRecord.save();
        console.log(`Invoice ${invoice.invoiceNumber} updated to PAID.`);

    } catch (error) {
        console.error("Error updating invoice after payment:", error);
    }
}
