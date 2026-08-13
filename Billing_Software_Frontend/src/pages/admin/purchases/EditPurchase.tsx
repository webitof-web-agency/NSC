import React from "react";
import { useParams } from "react-router-dom";
import CreatePurchase from "./CreatePurchase";

const EditPurchase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <CreatePurchase editId={id} />;
};

export default EditPurchase;
