import React, { useEffect, useState } from "react";
import Modal from "./Modal";

interface BarcodePrintDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm: (quantity: number | number[]) => void;
  title?: string;
  singleQuantityLabel?: string;
  singleQuantityPlaceholder?: string;
  items?: {
    designNumber?: string;
    brandName?: string;
    variantSize?: string;
    variantColor?: string;
    mrp?: number;
    salePrice?: number;
    barcode?: string;
    codeLabel?: string;
    defaultQuantity?: number;
  }[];
}

const BarcodePrintDialog: React.FC<BarcodePrintDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Print Barcode",
  singleQuantityLabel = "Quantity",
  singleQuantityPlaceholder = "Enter barcode count",
  items = [],
}) => {
  const [quantity, setQuantity] = useState<number | "">("");
  const [quantities, setQuantities] = useState<Array<number | "">>([]);
  const showDetails = items.length > 0;
  const isMulti = items.length > 1;

  useEffect(() => {
    if (!isOpen) return;
    if (isMulti) {
      setQuantities(items.map((item) => {
        const qty = Number(item.defaultQuantity ?? 1);
        return Number.isFinite(qty) && qty > 0 ? qty : 1;
      }));
    } else {
      const qty = Number(items[0]?.defaultQuantity ?? 1);
      setQuantity(Number.isFinite(qty) && qty > 0 ? qty : 1);
    }
  }, [isOpen, isMulti, items]);

  const handleConfirm = () => {
    if (isMulti) {
      const hasInvalid = quantities.some((q) => q === "" || !Number.isFinite(q) || q <= 0);
      if (hasInvalid || quantities.length !== items.length) {
        alert("All quantities must be greater than 0");
        return;
      }
      onConfirm(quantities as number[]);
    } else {
      if (quantity === "" || quantity <= 0) {
        alert("Values must be greater than 0");
        return;
      }
      onConfirm(quantity);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose ?? (() => { })}   // fallback function
      title={title}
      size={isMulti ? "2xl" : "sm"}
    >
      <div
        className="space-y-4 font-sans"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
          }
        }}
      >
        {showDetails && (
          <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
            <p className="text-sm font-semibold text-gray-800 mb-2">Variant Details</p>
            {items.length === 1 ? (
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500">Design No:</span> {items[0].designNumber || "-"}
                </div>
                <div>
                  <span className="text-gray-500">Brand:</span> {items[0].brandName || "-"}
                </div>
                <div>
                  <span className="text-gray-500">Size:</span> {items[0].variantSize || "-"}
                </div>
                <div>
                  <span className="text-gray-500">Color:</span> {items[0].variantColor || "-"}
                </div>
                <div>
                  <span className="text-gray-500">MRP:</span> {items[0].mrp ?? "-"}
                </div>
                <div>
                  <span className="text-gray-500">Sale Price:</span> {items[0].salePrice ?? "-"}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">{items[0].codeLabel || "Barcode"}:</span> {items[0].barcode || "-"}
                </div>
              </div>
            ) : (
              <div className="max-h-40 overflow-auto text-xs text-gray-700">
                <table className="w-full border-collapse">
                  <thead className="text-[11px] text-gray-500">
                    <tr>
                      <th className="text-left pb-1">Design No</th>
                      <th className="text-left pb-1">Brand</th>
                      <th className="text-left pb-1">Size</th>
                      <th className="text-left pb-1">MRP</th>
                      <th className="text-left pb-1">Sale</th>
                      <th className="text-left pb-1">Code</th>
                      <th className="text-left pb-1">Color</th>
                      <th className="text-left pb-1">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={`${item.barcode || "item"}-${index}`} className="border-t border-gray-200">
                        <td className="py-1 pr-2">{item.designNumber || "-"}</td>
                        <td className="py-1 pr-2">{item.brandName || "-"}</td>
                        <td className="py-1 pr-2">{item.variantSize || "-"}</td>
                        <td className="py-1 pr-2">{item.mrp ?? "-"}</td>
                        <td className="py-1 pr-2">{item.salePrice ?? "-"}</td>
                        <td className="py-1 pr-2">{item.barcode || "-"}</td>
                        <td className="py-1 pr-2">{item.variantColor || "-"}</td>
                        <td className="py-1 pl-2">
                          <input
                            type="number"
                            min="1"
                            value={quantities[index] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next = raw === "" ? "" : parseInt(raw, 10);
                              setQuantities((prev) => {
                                const updated = [...prev];
                                if (next === "") {
                                  updated[index] = "";
                                  return updated;
                                }
                                updated[index] = Number.isFinite(next) && next > 0 ? next : "";
                                return updated;
                              });
                            }}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-950"
                            placeholder="Qty"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {!isMulti && (
          <div>
            <label className="block text-gray-600 font-medium mb-1">{singleQuantityLabel}</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => {
                const raw = e.target.value;
                setQuantity(raw === "" ? "" : parseInt(raw, 10));
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 text-gray-950"
              placeholder={singleQuantityPlaceholder}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            className="cursor-pointer px-4 py-2 bg-primary text-white rounded-md hover:bg-gray-950"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BarcodePrintDialog;
