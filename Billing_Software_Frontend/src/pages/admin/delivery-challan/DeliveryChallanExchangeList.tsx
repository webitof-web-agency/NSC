import React from "react";
import { CirclePlusIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { hasPermission } from "@utils/hasPermission";
import InvoiceList from "@pages/admin/invoices/InvoiceList";

const DeliveryChallanExchangeList: React.FC = () => {
    const navigate = useNavigate();
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];

    return (
        <InvoiceList
            title="Exchange"
            showExchangeAction
            exchangeRouteBase="/admin/delivery-challans/exchange"
            showCreateActions={false}
            showOnlyExchangeAction
            headerActions={
                hasPermission(permissions, 'delivery-challans', 'create') ? (
                    <button
                        onClick={() => navigate('/admin/delivery-challans/new')}
                        className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                        <CirclePlusIcon size={14} /> New Delivery Challan
                    </button>
                ) : null
            }
        />
    );
};

export default DeliveryChallanExchangeList;
