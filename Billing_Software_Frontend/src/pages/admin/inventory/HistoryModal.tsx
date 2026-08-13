import Modal from "@components/admin/Modal";
import type { InventoryHistoryData } from "@models/inventory";
import { useRef, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDownIcon } from "lucide-react";

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: InventoryHistoryData | null;
}

export default function HistoryModal({ isOpen, onClose, data }: HistoryModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = useCallback(() => {
        if (!data) return;

        const doc = new jsPDF();
        const variantLabel = `${data.variantDetails?.designNo || ""} - ${data.variantDetails?.color || ""} - ${data.variantDetails?.size || ""}`.replace(/\s+-\s+$/, "").replace(/^-\s+/, "").trim();
        doc.text(`Inventory History - ${variantLabel || "Variant"}`, 14, 10);

        autoTable(doc, {
            head: [["Date", "Unit", "Adjustment", "Stock", "Reason"]],
            body: data.history.map((h) => [
                new Date(h.createdAt).toLocaleString(),
                h.unitName,
                h?.adjustment && h.adjustment > 0 ? `+${h.adjustment}` : h.adjustment || "-",
                h.quantity,
                h.referenceType || h.notes || "-",
            ]),
        });

        doc.save(`Inventory_History_${data.productId?.code || ""}.pdf`);
    }, [data]);

    if (!isOpen) return null;

    const getAdjustmentDisplay = (adj: number) => {
        if (adj > 0) {
            return <span className="text-green-600 font-semibold">+{adj}</span>;
        }
        if (adj < 0) {
            return <span className="text-red-600 font-semibold">{adj}</span>;
        }
        return "-";
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inventory History" size="3xl">
            {!data ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : (
                <>
                    {/* Product Info */}
                    <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                        <div className="font-semibold text-gray-950 capitalize flex items-center gap-2">
                            {`${data.variantDetails?.designNo || ""} - ${data.variantDetails?.color || ""} - ${data.variantDetails?.size || ""}`.replace(/\s+-\s+$/, "").replace(/^-\s+/, "").trim() || "-"}
                            <div>
                                <span className="text-sm text-gray-600">- Current Stock:</span> <span className="font-semibold text-gray-950">{data.currentQuantity}</span>
                            </div>

                        </div>
                        <div className="mt-1 flex justify-between items-center">
                            <div className="text-sm text-primary">{data.productId?.code}</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadPDF}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 shadow-sm"
                                >
                                    <FileDownIcon size={16} className="text-gray-500" />
                                    Download PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Printable Section */}
                    <div ref={printRef} className="overflow-x-auto rounded-sm shadow border border-gray-200 mt-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                    <th className="px-3 py-2 font-medium text-left">Date</th>
                                    <th className="px-3 py-2 font-medium">Unit</th>
                                    <th className="px-3 py-2 font-medium">Adjustments</th>
                                    <th className="px-3 py-2 font-medium">Before Adjustment</th>
                                    <th className="px-3 py-2 font-medium">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.history.map((h) => (
                                    <tr key={h._id} className="border-b hover:bg-gray-50 border-gray-200">
                                        <td className="px-3 py-2 text-gray-600">
                                            {new Date(h.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 text-center">{h.unitName}</td>
                                        <td className="px-3 py-2 text-center">{getAdjustmentDisplay(h.adjustment || 0)}</td>
                                        <td className="px-3 py-2 text-gray-600 text-center">{h.quantity}</td>
                                        <td className="px-3 py-2 text-gray-600 text-center capitalize">{h.referenceType || h.notes || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Modal>
    );
}
