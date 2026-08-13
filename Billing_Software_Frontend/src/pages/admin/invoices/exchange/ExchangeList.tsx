import React from "react";
import InvoiceList from "@pages/admin/invoices/InvoiceList";

const ExchangeList: React.FC = () => {
  return (
    <InvoiceList
      title="Exchange"
      showExchangeAction
      exchangeRouteBase="/admin/invoices/exchange"
      createPath="/admin/invoices/exchange/new"
      createLabel="New Exchange"
      fixedStatusFilter={["EXCHANGE", "PENDING"]}
      hideStatusFilter
      hideUploadButton
      hideNewExchangeButton
      exportStatusOverride="EXCHANGE"
      customFilter={(invoice) => invoice.status === "EXCHANGE" || invoice.exchangePending === true}
    />
  );
};

export default ExchangeList;
