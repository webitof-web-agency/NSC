type ResolveInvoiceWhatsAppTargetInput = {
  isEditMode: boolean;
  isExchangeDocument: boolean;
  invoiceId?: string;
  createdInvoiceId: string | null;
  exchangeSourceInvoiceId: string;
};

export const resolveInvoiceWhatsAppTarget = ({
  isEditMode,
  isExchangeDocument,
  invoiceId,
  createdInvoiceId,
  exchangeSourceInvoiceId,
}: ResolveInvoiceWhatsAppTargetInput) => ({
  documentId: isExchangeDocument && exchangeSourceInvoiceId
    ? exchangeSourceInvoiceId
    : (isEditMode ? invoiceId : createdInvoiceId),
  documentType: isExchangeDocument ? "exchange" : "invoice",
});
