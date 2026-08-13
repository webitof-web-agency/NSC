import { useState } from "react";
import TaxRates from "./TaxRates";
import TaxGroups from "./TaxGroups";
import { CalculatorIcon, LayersIcon, Upload } from "lucide-react";
import { Link } from "react-router-dom";

const TaxSettings = () => {
    const [activeTab, setActiveTab] = useState<"rates" | "groups">("rates");

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-950">Tax Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your tax rates and tax groups here.</p>
                </div>
                <Link
                    to="/admin/settings/taxes/bulk-upload"
                    className="border border-gray-100 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2"
                >
                    <Upload size={16} />
                    Upload Excel
                </Link>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab("rates")}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                            ${activeTab === "rates"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                        `}
                    >
                        <CalculatorIcon size={16} />
                        Tax Rates
                    </button>
                    <button
                        onClick={() => setActiveTab("groups")}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                            ${activeTab === "groups"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                        `}
                    >
                        <LayersIcon size={16} />
                        Tax Groups
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="mt-6">
                {activeTab === "rates" && <TaxRates isEmbedded={true} />}
                {activeTab === "groups" && <TaxGroups isEmbedded={true} />}
            </div>
        </div>
    );
};

export default TaxSettings;
