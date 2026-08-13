import React from "react";
import { useParams } from "react-router-dom";
import CreateInvoice from "./CreateInvoice";

const EditInvoice: React.FC = () => {
  const { invoiceId, id } = useParams<{ invoiceId?: string; id?: string }>();
  return <CreateInvoice mode="edit" invoiceId={invoiceId || id} />;
};

export default EditInvoice;
