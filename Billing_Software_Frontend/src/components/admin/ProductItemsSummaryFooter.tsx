import React from "react";

type SummaryColumn =
  | "serial"
  | "label"
  | "product"
  | "colorSize"
  | "unit"
  | "quantity"
  | "rate"
  | "discount"
  | "tax"
  | "staff"
  | "amount"
  | "action"
  | "blank";

type ProductSummaryItem = {
  qty?: number | string | null;
  rate?: number | string | null;
  discount?: number | string | null;
  tax?: number | string | null;
  amount?: number | string | null;
};

type ProductItemsSummaryFooterProps = {
  items: ProductSummaryItem[];
  columns: SummaryColumn[];
  currencySymbol?: string;
  minWidthClassName?: string;
  colClassNames?: string[];
};

type SummaryTotals = {
  quantity: number;
  rate: number;
  discount: number;
  tax: number;
  amount: number;
};

const toNumber = (value: ProductSummaryItem[keyof ProductSummaryItem]) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const formatQuantity = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const formatAmount = (value: number) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
};

const ProductItemsSummaryFooter: React.FC<ProductItemsSummaryFooterProps> = ({
  items,
  columns,
  currencySymbol = "",
  minWidthClassName = "min-w-[1080px]",
  colClassNames = [],
}) => {
  if (items.length === 0) return null;

  const totals = items.reduce<SummaryTotals>(
    (acc, item) => ({
      quantity: acc.quantity + toNumber(item.qty),
      rate: acc.rate + toNumber(item.rate),
      discount: acc.discount + toNumber(item.discount),
      tax: acc.tax + toNumber(item.tax),
      amount: acc.amount + toNumber(item.amount),
    }),
    { quantity: 0, rate: 0, discount: 0, tax: 0, amount: 0 }
  );

  const renderCell = (column: SummaryColumn) => {
    switch (column) {
      case "label":
        return "Total";
      case "quantity":
        return formatQuantity(totals.quantity);
      case "rate":
        return formatAmount(totals.rate);
      case "discount":
        return formatAmount(totals.discount);
      case "tax":
        return formatAmount(totals.tax);
      case "amount":
        return `${currencySymbol}${formatAmount(totals.amount)}`;
      default:
        return "";
    }
  };

  return (
    <div className="overflow-x-auto border-x border-b border-gray-200 bg-gray-50 shadow-sm">
      <table className={`w-full ${minWidthClassName} table-fixed border-separate border-spacing-0`}>
        {colClassNames.length > 0 && (
          <colgroup>
            {columns.map((_, index) => (
              <col key={index} className={colClassNames[index] || ""} />
            ))}
          </colgroup>
        )}
        <tbody>
          <tr className="text-sm font-semibold text-gray-950">
            {columns.map((column, index) => (
              <td key={`${column}-${index}`} className="p-2 tabular-nums">
                {renderCell(column)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ProductItemsSummaryFooter;
