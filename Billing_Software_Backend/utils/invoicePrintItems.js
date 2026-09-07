const normalizeInvoiceItems = (items = []) =>
  (items || []).map((item) =>
    typeof item?.toObject === "function" ? item.toObject() : item
  );

const enrichInvoicePrintItems = (
  items = [],
  { variantMrpMap = new Map(), productHsnMap = new Map(), taxGroupRateMap = new Map() } = {}
) =>
  normalizeInvoiceItems(items).map((item) => ({
    ...item,
    hsn_code: String(
      item?.hsn_code ||
      productHsnMap.get(String(item?.product_id || "")) ||
      ""
    ).trim(),
    variantMrp:
      item?.variantMrp ??
      variantMrpMap.get(String(item?.variantId || "")) ??
      null,
    taxRate:
      item?.taxRate ??
      item?.tax_rate ??
      item?.total_tax_rate ??
      taxGroupRateMap.get(String(item?.tax_group_id || "")) ??
      0,
  }));

module.exports = {
  enrichInvoicePrintItems,
  normalizeInvoiceItems,
};
