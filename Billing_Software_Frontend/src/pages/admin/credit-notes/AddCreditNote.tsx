import React from "react";
import CreateInvoice from "../invoices/CreateInvoice";

const AddCreditNote: React.FC = () => {
  return (
    <CreateInvoice
      mode="create"
      forceStatus="UNPAID"
      disablePaymentModal
      isCreditNote
    />
  );
};

export default AddCreditNote;
