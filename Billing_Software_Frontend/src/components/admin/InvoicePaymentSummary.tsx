import PaymentModeBadge from "@components/admin/PaymentModeBadge";
import { useCurrencyFormatter } from "@hooks/useCurrencyFormatter";

interface InvoicePaymentSummaryProps {
  mode?: string | null;
  amount?: number | null;
  cashAmount?: number | null;
  cardAmount?: number | null;
  upiAmount?: number | null;
  creditAmount?: number | null;
  outstandingAmount?: number | null;
}

const InvoicePaymentSummary: React.FC<InvoicePaymentSummaryProps> = ({
  mode,
  amount = 0,
  cashAmount = 0,
  cardAmount = 0,
  upiAmount = 0,
  creditAmount = 0,
  outstandingAmount = 0,
}) => {
  const { format } = useCurrencyFormatter();
  const normalizedMode = String(mode || "").toUpperCase();
  const normalizedCash = Number(cashAmount || 0);
  const normalizedCard = Number(cardAmount || 0);
  const normalizedUpi = Number(upiAmount || 0);
  const normalizedAmount = Number(amount || 0);
  const normalizedCredit = Number(creditAmount || 0);
  const normalizedOutstanding = Number(outstandingAmount || 0);

  let summary = format(normalizedAmount);

  if (normalizedMode === "MIXED") {
    const parts: string[] = [];
    if (normalizedCash > 0) parts.push(`Cash: ${format(normalizedCash)}`);
    if (normalizedCard > 0) parts.push(`Card: ${format(normalizedCard)}`);
    if (normalizedUpi > 0) parts.push(`UPI: ${format(normalizedUpi)}`);
    summary = parts.length > 0 ? parts.join(" | ") : format(normalizedAmount);
  } else if (normalizedMode === "CREDIT") {
    const pendingCredit = normalizedCredit > 0 ? normalizedCredit : normalizedOutstanding;
    summary = pendingCredit > 0
      ? `Credit: ${format(pendingCredit)}${normalizedAmount > 0 ? ` | Paid: ${format(normalizedAmount)}` : ""}`
      : `Paid: ${format(normalizedAmount)}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-[140px]">
      <span className="text-xs font-medium text-gray-600">{summary}</span>
      <PaymentModeBadge mode={normalizedMode} />
    </div>
  );
};

export default InvoicePaymentSummary;
