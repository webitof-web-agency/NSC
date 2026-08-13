import React from "react";
import { useParams } from "react-router-dom";
import CreateInvoice from "../invoices/CreateInvoice";

const EditCreditNote: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <CreateInvoice
      mode="edit"
      invoiceId={id}
      forceStatus="UNPAID"
      disablePaymentModal
      isCreditNote
    />
  );
};

export default EditCreditNote;
