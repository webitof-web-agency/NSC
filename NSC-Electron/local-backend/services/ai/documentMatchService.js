const Supplier = require("@models/Supplier");
const Customer = require("@models/Customer");
const ProductVariant = require("@models/ProductVariant");

const normalize = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeAlphaNum = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const digitsOnly = (value = "") => String(value || "").replace(/\D/g, "");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toObjectIdString = (value) => (value ? String(value) : "");

const scoreNameMatch = (source, target) => {
  const left = normalize(source);
  const right = normalize(target);
  if (!left || !right) return 0;
  if (left === right) return 40;
  if (right.includes(left) || left.includes(right)) return 28;

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const matches = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return matches > 0 ? Math.min(22, matches * 8) : 0;
};

const buildPartyMatch = (doc, kind) => {
  const nameField = kind === "supplier" ? doc.company_name : doc.name;
  const phoneField = kind === "supplier" ? doc.phone_number : doc.phone;
  const gstField = doc.gst_no || "";

  return {
    matched: true,
    id: String(doc._id),
    name: nameField || "",
    phone: phoneField || "",
    gstin: gstField || "",
  };
};

const findSupplierMatch = async (userId, extracted = {}) => {
  const suppliers = await Supplier.find({ user_id: userId, isDeleted: { $ne: true } })
    .select("_id company_name phone_number gst_no")
    .lean();

  if (!suppliers.length) return null;

  const extractedGstin = normalizeAlphaNum(extracted.supplierGSTIN || "");
  const extractedPhone = digitsOnly(extracted.supplierPhone || "");
  const extractedName = extracted.supplierName || "";

  const scored = suppliers
    .map((supplier) => {
      let score = 0;
      const matchedBy = [];

      if (extractedGstin && normalizeAlphaNum(supplier.gst_no || "") === extractedGstin) {
        score += 100;
        matchedBy.push("gstin");
      }
      if (extractedPhone && digitsOnly(supplier.phone_number || "") === extractedPhone) {
        score += 80;
        matchedBy.push("phone");
      }
      const nameScore = scoreNameMatch(extractedName, supplier.company_name || "");
      if (nameScore > 0) {
        score += nameScore;
        matchedBy.push("name");
      }

      return { supplier, score, matchedBy };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  const best = scored[0];
  const next = scored[1];
  const ambiguous = Boolean(next && next.score === best.score);

  return {
    ...buildPartyMatch(best.supplier, "supplier"),
    matchMeta: {
      score: best.score,
      matchedBy: best.matchedBy,
      ambiguous,
      candidateCount: scored.length,
    },
  };
};

const findCustomerMatch = async (userId, extracted = {}) => {
  const customers = await Customer.find({ userId, isDeleted: { $ne: true } })
    .select("_id name phone gst_no")
    .lean();

  if (!customers.length) return null;

  const extractedPhone = digitsOnly(extracted.customerPhone || "");
  const extractedGstin = normalizeAlphaNum(extracted.customerGSTIN || "");
  const extractedName = extracted.customerName || "";

  const scored = customers
    .map((customer) => {
      let score = 0;
      const matchedBy = [];

      if (extractedPhone && digitsOnly(customer.phone || "") === extractedPhone) {
        score += 100;
        matchedBy.push("phone");
      }
      if (extractedGstin && normalizeAlphaNum(customer.gst_no || "") === extractedGstin) {
        score += 80;
        matchedBy.push("gstin");
      }
      const nameScore = scoreNameMatch(extractedName, customer.name || "");
      if (nameScore > 0) {
        score += nameScore;
        matchedBy.push("name");
      }

      return { customer, score, matchedBy };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  const best = scored[0];
  const next = scored[1];
  const ambiguous = Boolean(next && next.score === best.score);

  return {
    ...buildPartyMatch(best.customer, "customer"),
    matchMeta: {
      score: best.score,
      matchedBy: best.matchedBy,
      ambiguous,
      candidateCount: scored.length,
    },
  };
};

const populateVariantQuery = (query) =>
  query.populate({
    path: "productId",
    select: "name code hsn_code brand unit tax",
    populate: [
      { path: "brand", select: "brand_name" },
      { path: "unit", select: "unit_name short_name name" },
      { path: "tax", select: "tax_name total_tax_rate" },
    ],
  });

const buildVariantResult = (variantDoc, score, matchedBy, candidateCount) => {
  if (!variantDoc?.productId) return null;

  const product = variantDoc.productId;
  return {
    matched: true,
    variantId: String(variantDoc._id),
    productId: String(product._id),
    matchMeta: {
      score,
      matchedBy,
      ambiguous: candidateCount > 1 && score > 0,
      candidateCount,
    },
    product: {
      id: String(product._id),
      name: product.name || "",
      code: product.code || "",
      hsn_code: product.hsn_code || "",
      brand: {
        _id: toObjectIdString(product.brand?._id),
        brand_name: product.brand?.brand_name || "",
      },
      unit: {
        id: toObjectIdString(product.unit?._id),
        name: product.unit?.short_name || product.unit?.unit_name || product.unit?.name || "",
      },
      tax: {
        group_id: toObjectIdString(product.tax?._id),
        group_name: product.tax?.tax_name || "",
        total_rate: Number(product.tax?.total_tax_rate || 0),
      },
    },
    variant: {
      _id: String(variantDoc._id),
      designNo: variantDoc.designNo || "",
      color: variantDoc.color || "",
      size: variantDoc.size || "",
      purchase_price: Number(variantDoc.purchase_price || 0),
      sale_price: Number(variantDoc.sale_price || 0),
      barcode: variantDoc.barcode || "",
      mrp: Number(variantDoc.mrp || 0),
    },
  };
};

const scoreVariantCandidate = (item, candidate) => {
  let score = 0;
  const matchedBy = [];

  const sourceBarcode = normalizeAlphaNum(item.barcode || "");
  const sourceDesign = normalizeAlphaNum(item.designNumber || item.description || "");
  const sourceBrand = normalize(item.brand || "");
  const sourceColor = normalize(item.color || "");
  const sourceSize = normalize(item.size || "");
  const sourceUnit = normalize(item.unit || "");
  const sourceHsn = normalizeAlphaNum(item.hsnCode || "");
  const sourceTaxRate = Number(item.taxRate || 0);

  const product = candidate.productId || {};
  const candidateBarcode = normalizeAlphaNum(candidate.barcode || "");
  const candidateDesign = normalizeAlphaNum(candidate.designNo || "");
  const candidateBrand = normalize(product.brand?.brand_name || "");
  const candidateColor = normalize(candidate.color || "");
  const candidateSize = normalize(candidate.size || "");
  const candidateUnit = normalize(product.unit?.short_name || product.unit?.unit_name || product.unit?.name || "");
  const candidateHsn = normalizeAlphaNum(product.hsn_code || "");
  const candidateTaxRate = Number(product.tax?.total_tax_rate || 0);

  if (sourceBarcode && candidateBarcode === sourceBarcode) {
    score += 120;
    matchedBy.push("barcode");
  }
  if (sourceDesign && candidateDesign === sourceDesign) {
    score += 70;
    matchedBy.push("designNo");
  } else {
    const designScore = scoreNameMatch(item.designNumber || item.description || "", candidate.designNo || "");
    if (designScore > 0) {
      score += Math.min(45, designScore + 8);
      matchedBy.push("designNo_partial");
    }
  }
  if (sourceBrand && candidateBrand && sourceBrand === candidateBrand) {
    score += 20;
    matchedBy.push("brand");
  }
  if (sourceColor && candidateColor && sourceColor === candidateColor) {
    score += 15;
    matchedBy.push("color");
  }
  if (sourceSize && candidateSize && sourceSize === candidateSize) {
    score += 15;
    matchedBy.push("size");
  }
  if (sourceUnit && candidateUnit && sourceUnit === candidateUnit) {
    score += 8;
    matchedBy.push("unit");
  }
  if (sourceHsn && candidateHsn && sourceHsn === candidateHsn) {
    score += 10;
    matchedBy.push("hsn");
  }
  if (sourceTaxRate > 0 && candidateTaxRate === sourceTaxRate) {
    score += 8;
    matchedBy.push("taxRate");
  }

  return { score, matchedBy };
};

const fetchVariantCandidates = async (items = []) => {
  const barcodeValues = Array.from(
    new Set(items.map((item) => String(item.barcode || "").trim()).filter(Boolean))
  );
  const designValues = Array.from(
    new Set(items.map((item) => String(item.designNumber || item.description || "").trim()).filter(Boolean))
  );

  const [barcodeDocs, designDocs] = await Promise.all([
    barcodeValues.length
      ? populateVariantQuery(ProductVariant.find({ barcode: { $in: barcodeValues } })).lean()
      : Promise.resolve([]),
    designValues.length
      ? populateVariantQuery(
          ProductVariant.find({
            designNo: { $in: designValues },
          })
        ).lean()
      : Promise.resolve([]),
  ]);

  const uniqueMap = new Map();
  [...barcodeDocs, ...designDocs].forEach((doc) => {
    uniqueMap.set(String(doc._id), doc);
  });

  return [...uniqueMap.values()];
};

const findVariantMatchFromCandidates = (item = {}, candidates = []) => {
  const scoredCandidates = candidates
    .filter((candidate) => candidate?.productId)
    .map((candidate) => ({ candidate, ...scoreVariantCandidate(item, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scoredCandidates.length) return null;

  const best = scoredCandidates[0];
  const sameTopCount = scoredCandidates.filter((entry) => entry.score === best.score).length;
  return buildVariantResult(best.candidate, best.score, best.matchedBy, sameTopCount);
};

const matchDocumentData = async ({ userId, documentType, extracted }) => {
  const [supplier, customer, variantCandidates] = await Promise.all([
    documentType === "purchase_bill" ? findSupplierMatch(userId, extracted) : Promise.resolve(null),
    documentType === "invoice" || documentType === "quotation"
      ? findCustomerMatch(userId, extracted)
      : Promise.resolve(null),
    fetchVariantCandidates(extracted.items || []),
  ]);

  const items = (extracted.items || []).map((item) => ({
    source: {
      description: item.description || "",
      brand: item.brand || "",
      designNumber: item.designNumber || "",
      size: item.size || "",
      color: item.color || "",
      unit: item.unit || "",
      hsnCode: item.hsnCode || "",
      taxRate: Number(item.taxRate || 0),
    },
    ...findVariantMatchFromCandidates(item, variantCandidates),
  }));

  return {
    supplier,
    customer,
    items,
  };
};

module.exports = {
  matchDocumentData,
};
