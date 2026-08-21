const { generateStructuredContent } = require("./geminiService");

const basePrompt = (documentType) => `
You are extracting structured billing data from a scanned business document.
Return only valid JSON with no markdown.
If any value is unclear, return an empty string or 0.
Document type: ${documentType}.
All dates should be in YYYY-MM-DD format if confidently recognized.
Numeric amounts should be numbers, not strings.
Very important:
- Always extract the supplier or customer display/legal name or phone number from the document header or bill-to/supplier section whenever visible.
- For phone numbers, capture the actual contact/mobile/phone number even if it is written with spaces, +91 prefix, or separators.
- If the model is unsure of field naming, still place customer phone under customerPhone and supplier phone under supplierPhone.
- Leave supplierName/customerName empty if the name is not visible anywhere near address, GSTIN, phone, invoice header, or bill-to block.
- For items, prefer the printed item/design/article name exactly as visible.
`;

const purchasePrompt = `${basePrompt("purchase_bill")}
Return this exact shape:
{
  "documentType": "purchase_bill",
  "supplierName": "",
  "supplierPhone": "",
  "supplierEmail": "",
  "supplierGSTIN": "",
  "supplierBillNumber": "",
  "purchaseDate": "",
  "dueDate": "",
  "paymentMode": "",
  "taxType": "",
  "notes": "",
  "items": [
    {
      "description": "",
      "brand": "",
      "designNumber": "",
      "size": "",
      "color": "",
      "barcode": "",
      "hsnCode": "",
      "quantity": 0,
      "unit": "",
      "rate": 0,
      "discount": 0,
      "taxRate": 0,
      "amount": 0
    }
  ],
  "totals": {
    "subtotal": 0,
    "discount": 0,
    "tax": 0,
    "grandTotal": 0
  },
  "warnings": []
}`;

const invoicePrompt = `${basePrompt("invoice")}
Return this exact shape:
{
  "documentType": "invoice",
  "invoiceNumber": "",
  "invoiceDate": "",
  "dueDate": "",
  "customerName": "",
  "customerPhone": "",
  "customerEmail": "",
  "customerGSTIN": "",
  "billingAddress": "",
  "shippingAddress": "",
  "paymentMode": "",
  "taxType": "",
  "notes": "",
  "items": [
    {
      "description": "",
      "brand": "",
      "designNumber": "",
      "size": "",
      "color": "",
      "barcode": "",
      "hsnCode": "",
      "quantity": 0,
      "unit": "",
      "rate": 0,
      "discount": 0,
      "taxRate": 0,
      "amount": 0
    }
  ],
  "totals": {
    "subtotal": 0,
    "discount": 0,
    "tax": 0,
    "grandTotal": 0
  },
  "warnings": []
}`;

const quotationPrompt = `${basePrompt("quotation")}
Return this exact shape:
{
  "documentType": "quotation",
  "quotationNumber": "",
  "quotationDate": "",
  "expiryDate": "",
  "customerName": "",
  "customerPhone": "",
  "customerEmail": "",
  "customerGSTIN": "",
  "billingAddress": "",
  "notes": "",
  "items": [
    {
      "description": "",
      "brand": "",
      "designNumber": "",
      "size": "",
      "color": "",
      "barcode": "",
      "hsnCode": "",
      "quantity": 0,
      "unit": "",
      "rate": 0,
      "discount": 0,
      "taxRate": 0,
      "amount": 0
    }
  ],
  "totals": {
    "subtotal": 0,
    "discount": 0,
    "tax": 0,
    "grandTotal": 0
  },
  "warnings": []
}`;

const supplierDetailsPrompt = `${basePrompt("supplier_details")}
Return this exact shape:
{
  "documentType": "supplier_details",
  "supplierName": "",
  "supplierPhone": "",
  "supplierEmail": "",
  "supplierGSTIN": "",
  "supplierPAN": "",
  "supplierAddress": "",
  "country": "",
  "state": "",
  "city": "",
  "pinCode": "",
  "bankAccounts": [
    {
      "accountHolderName": "",
      "bankName": "",
      "branchName": "",
      "accountType": "",
      "accountNumber": "",
      "ifscCode": ""
    }
  ],
  "warnings": []
}`;

const normalizeItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    description: item?.description || "",
    brand: item?.brand || "",
    designNumber: item?.designNumber || "",
    size: item?.size || "",
    color: item?.color || "",
    barcode: item?.barcode || "",
    hsnCode: item?.hsnCode || "",
    quantity: Number(item?.quantity || 0),
    unit: item?.unit || "",
    rate: Number(item?.rate || 0),
    discount: Number(item?.discount || 0),
    taxRate: Number(item?.taxRate || 0),
    amount: Number(item?.amount || 0),
  }));

const firstNonEmpty = (...values) => values.find((value) => String(value || "").trim()) || "";

const deriveNameFromAddress = (address = "") => {
  const lines = String(address || "")
    .split(/\r?\n|,/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const candidate = lines[0];
  if (/^(bill to|ship to|supplier|customer|name)\b/i.test(candidate)) {
    return lines[1] || "";
  }
  return candidate;
};

const extractPhoneFromText = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;

    const matches = text.match(/(?:\+91[-\s]?)?[6-9]\d(?:[-\s]?\d){8,9}/g);
    if (!matches?.length) continue;

    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 10) {
        return digits.slice(-10);
      }
    }
  }
  return "";
};

const extractEmailFromText = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) return match[0];
  }
  return "";
};

const extractLabeledValue = (labelPatterns = [], ...values) => {
  for (const value of values) {
    const text = String(value || "");
    if (!text.trim()) continue;

    for (const labelPattern of labelPatterns) {
      const regex = new RegExp(`${labelPattern}\\s*[:\\-]?\\s*([^\\n\\r,|]+)`, "i");
      const match = text.match(regex);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }
  return "";
};

const normalizePayload = (documentType, payload = {}) => {
  const normalized = {
    ...payload,
    documentType,
    items: normalizeItems(payload.items),
    totals: {
      subtotal: Number(payload?.totals?.subtotal || 0),
      discount: Number(payload?.totals?.discount || 0),
      tax: Number(payload?.totals?.tax || 0),
      grandTotal: Number(payload?.totals?.grandTotal || 0),
    },
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  };

  if (documentType === "purchase_bill") {
    normalized.supplierName = firstNonEmpty(
      payload.supplierName,
      payload.vendorName,
      payload.partyName,
      payload.supplier,
      payload.vendor,
      extractLabeledValue(
        [
          "supplier\\s*name",
          "vendor\\s*name",
          "supplier",
          "vendor",
          "party\\s*name",
          "bill\\s*from",
        ],
        payload.supplierAddress,
        payload.billingAddress
      ),
      deriveNameFromAddress(payload.supplierAddress),
      deriveNameFromAddress(payload.billingAddress),
    );
    normalized.supplierPhone = firstNonEmpty(
      extractPhoneFromText(
        payload.supplierPhone,
        payload.vendorPhone,
        payload.phone,
        payload.mobile,
        payload.contact,
        payload.contactNo,
        payload.supplierContact,
        payload.vendorContact,
        payload.supplierAddress,
        payload.billingAddress
      )
    );
    normalized.supplierEmail = firstNonEmpty(
      payload.supplierEmail,
      payload.vendorEmail,
      payload.email,
      extractEmailFromText(payload.supplierAddress, payload.billingAddress)
    );
    normalized.supplierGSTIN = firstNonEmpty(payload.supplierGSTIN, payload.vendorGSTIN, payload.gstin, payload.gstNo);
    normalized.supplierBillNumber = firstNonEmpty(payload.supplierBillNumber, payload.billNumber, payload.invoiceNumber);
    normalized.purchaseDate = payload.purchaseDate || payload.billDate || "";
    normalized.dueDate = payload.dueDate || "";
  }

  if (documentType === "supplier_details") {
    normalized.supplierName = firstNonEmpty(
      payload.supplierName,
      payload.companyName,
      payload.businessName,
      payload.name,
      deriveNameFromAddress(payload.supplierAddress),
      deriveNameFromAddress(payload.address)
    );
    normalized.supplierPhone = firstNonEmpty(
      extractPhoneFromText(
        payload.supplierPhone,
        payload.phone,
        payload.mobile,
        payload.contact,
        payload.contactNo,
        payload.supplierAddress,
        payload.address
      )
    );
    normalized.supplierEmail = firstNonEmpty(
      payload.supplierEmail,
      payload.email,
      extractEmailFromText(payload.supplierAddress, payload.address)
    );
    normalized.supplierGSTIN = firstNonEmpty(payload.supplierGSTIN, payload.gstin, payload.gstNo);
    normalized.supplierPAN = firstNonEmpty(payload.supplierPAN, payload.pan, payload.panNo);
    normalized.supplierAddress = firstNonEmpty(payload.supplierAddress, payload.companyAddress, payload.address);
    normalized.country = payload.country || "";
    normalized.state = payload.state || "";
    normalized.city = payload.city || "";
    normalized.pinCode = String(payload.pinCode || payload.pincode || payload.pin_code || "").replace(/\D/g, "");
    normalized.bankAccounts = (Array.isArray(payload.bankAccounts) ? payload.bankAccounts : []).map((account) => ({
      accountHolderName: account?.accountHolderName || "",
      bankName: account?.bankName || "",
      branchName: account?.branchName || "",
      accountType: String(account?.accountType || "").toLowerCase() === "current" ? "current" : "savings",
      accountNumber: String(account?.accountNumber || "").replace(/\s/g, ""),
      ifscCode: String(account?.ifscCode || "").toUpperCase(),
    }));
  }

  if (documentType === "invoice" || documentType === "quotation") {
    normalized.customerName = firstNonEmpty(
      payload.customerName,
      payload.partyName,
      payload.billToName,
      payload.customer,
      payload.billTo,
      extractLabeledValue(
        [
          "customer\\s*name",
          "bill\\s*to",
          "party\\s*name",
        ],
        payload.billingAddress,
        payload.shippingAddress,
      ),
      deriveNameFromAddress(payload.billingAddress),
      deriveNameFromAddress(payload.shippingAddress),
    );
    normalized.customerPhone = firstNonEmpty(
      extractPhoneFromText(
        payload.customerPhone,
        payload.phone,
        payload.mobile,
        payload.contact,
        payload.contactNo,
        payload.customerMobile,
        payload.customerContact,
        payload.billingAddress,
        payload.shippingAddress,
      )
    );
    normalized.customerEmail = firstNonEmpty(
      payload.customerEmail,
      payload.email,
      extractEmailFromText(payload.billingAddress, payload.shippingAddress)
    );
    normalized.customerGSTIN = firstNonEmpty(payload.customerGSTIN, payload.gstin, payload.gstNo);
    normalized.billingAddress = payload.billingAddress || payload.billToAddress || "";
  }

  return normalized;
};

const extractDocumentData = async ({ documentType, filePart }) => {
  const prompt =
    documentType === "purchase_bill"
      ? purchasePrompt
      : documentType === "invoice"
        ? invoicePrompt
        : documentType === "supplier_details"
          ? supplierDetailsPrompt
          : quotationPrompt;

  const payload = await generateStructuredContent({ prompt, filePart });
  return normalizePayload(documentType, payload);
};

module.exports = {
  extractDocumentData,
};
