import React from "react";
import { useParams } from "react-router-dom";
import CreateDebitNote from "./CreateDebitNote";

const EditDebitNote: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <CreateDebitNote editId={id} />;
};

export default EditDebitNote;
