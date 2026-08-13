import React, { useState } from "react";
import BarcodeCustomizationTab from "./BarcodeCustomizationTab";
import QrCustomization from "./QrCustomization";

const BarcodeCustomizationIndex = () => {
    const [activeTab, setActiveTab] = useState<"barcode" | "qr">("barcode");

    return (
        <div className="container mx-auto p-3 max-w-6xl">
            <h1 className="text-2xl font-bold mb-1 text-gray-800">Barcode & QR Settings</h1>
            <p className="text-gray-500 mb-4 text-sm">Customize how your product barcodes and QR codes appear on printed sticker labels.</p>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "barcode"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                    onClick={() => setActiveTab("barcode")}
                >
                    Barcode Settings
                </button>
                <button
                    className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "qr"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                    onClick={() => setActiveTab("qr")}
                >
                    QR Settings
                </button>
            </div>

            {/* Content */}
            {activeTab === "barcode" && <BarcodeCustomizationTab />}
            {activeTab === "qr" && <QrCustomization />}
        </div>
    );
};

export default BarcodeCustomizationIndex;
