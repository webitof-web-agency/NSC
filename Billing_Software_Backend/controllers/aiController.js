const { prepareInlineFile } = require("@utils/ai/filePreprocessor");
const cleanupTempFile = require("@utils/ai/cleanupTempFile");
const { extractDocumentData } = require("@services/ai/documentExtractionService");
const { matchDocumentData } = require("@services/ai/documentMatchService");

const resolveUserId = (req) => {
  if (typeof req.user === "string") return req.user;
  return req.user?.id || req.user?._id || req.user;
};

const buildReviewWarnings = ({ documentType, extracted, matches }) => {
  const warnings = [...(Array.isArray(extracted?.warnings) ? extracted.warnings : [])];

  if (documentType === "purchase_bill") {
    if (!extracted?.supplierName && !extracted?.supplierPhone && !extracted?.supplierGSTIN) {
      warnings.push("Supplier details could not be confidently extracted.");
    } else if (!matches?.supplier?.matched) {
      warnings.push("No existing supplier match found. Please verify supplier details before applying.");
    } else if (matches?.supplier?.matchMeta?.ambiguous) {
      warnings.push("Supplier match is ambiguous. Please confirm the selected supplier manually.");
    }
  }

  if (documentType === "supplier_details") {
    if (!extracted?.supplierName && !extracted?.supplierPhone && !extracted?.supplierGSTIN) {
      warnings.push("Supplier details could not be confidently extracted.");
    }
  }

  if (documentType === "invoice" || documentType === "quotation") {
    if (!extracted?.customerName && !extracted?.customerPhone && !extracted?.customerGSTIN) {
      warnings.push("Customer details could not be confidently extracted.");
    } else if (!matches?.customer?.matched) {
      warnings.push("No existing customer match found. Please verify customer details before applying.");
    } else if (matches?.customer?.matchMeta?.ambiguous) {
      warnings.push("Customer match is ambiguous. Please confirm the selected customer manually.");
    }
  }

  (matches?.items || []).forEach((itemMatch, index) => {
    const lineNo = index + 1;
    if (!itemMatch?.matched) {
      warnings.push(`Item ${lineNo} could not be matched to an existing variant.`);
      return;
    }

    if (itemMatch?.matchMeta?.ambiguous) {
      warnings.push(`Item ${lineNo} matched multiple variants with similar confidence. Please verify it manually.`);
    }

    const sourceUnit = String(itemMatch?.source?.unit || "").trim().toLowerCase();
    const matchedUnit = String(itemMatch?.product?.unit?.name || "").trim().toLowerCase();
    if (sourceUnit && matchedUnit && sourceUnit !== matchedUnit) {
      warnings.push(`Item ${lineNo} unit differs from matched variant unit (${itemMatch.product.unit.name}).`);
    }

    const sourceTaxRate = Number(itemMatch?.source?.taxRate || 0);
    const matchedTaxRate = Number(itemMatch?.product?.tax?.total_rate || 0);
    if (sourceTaxRate > 0 && matchedTaxRate > 0 && sourceTaxRate !== matchedTaxRate) {
      warnings.push(`Item ${lineNo} tax rate ${sourceTaxRate}% differs from matched product tax ${matchedTaxRate}%.`);
    }

    const sourceHsn = String(itemMatch?.source?.hsnCode || "").trim();
    const matchedHsn = String(itemMatch?.product?.hsn_code || "").trim();
    if (sourceHsn && matchedHsn && sourceHsn !== matchedHsn) {
      warnings.push(`Item ${lineNo} HSN ${sourceHsn} differs from matched product HSN ${matchedHsn}.`);
    }
  });

  return Array.from(new Set(warnings.filter(Boolean)));
};

const buildReviewSummary = ({ matches, warnings }) => ({
  extractedItems: Array.isArray(matches?.items) ? matches.items.length : 0,
  matchedItems: Array.isArray(matches?.items)
    ? matches.items.filter((item) => item?.matched).length
    : 0,
  unmatchedItems: Array.isArray(matches?.items)
    ? matches.items.filter((item) => !item?.matched).length
    : 0,
  warningCount: warnings.length,
  hasSupplierMatch: Boolean(matches?.supplier?.matched),
  hasCustomerMatch: Boolean(matches?.customer?.matched),
});

const buildHandler = (documentType) => async (req, res) => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = resolveUserId(req);
    const filePart = await prepareInlineFile(req.file);
    const extracted = await extractDocumentData({ documentType, filePart });
    const matches = await matchDocumentData({ userId, documentType, extracted });
    const reviewWarnings = buildReviewWarnings({ documentType, extracted, matches });
    const reviewSummary = buildReviewSummary({ matches, warnings: reviewWarnings });

    return res.status(200).json({
      success: true,
      message: "Document extracted successfully",
      data: {
        documentType,
        extracted,
        matches,
        reviewRequired: true,
        warnings: reviewWarnings,
        reviewSummary,
        meta: {
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          processedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error(`AI ${documentType} extraction error:`, error);
    return res.status(500).json({
      success: false,
      message: "Could not extract document data",
      errors: [error.message || "Unknown extraction error"],
    });
  } finally {
    await cleanupTempFile(tempFilePath);
  }
};

module.exports = {
  extractPurchaseBill: buildHandler("purchase_bill"),
  extractSupplierDetails: buildHandler("supplier_details"),
  extractInvoice: buildHandler("invoice"),
  extractQuotation: buildHandler("quotation"),
};
