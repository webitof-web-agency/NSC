import { useState } from "react";
import InvoicePreferences from "@pages/admin/settings/moduleSettings/invoice/InvoicePreferences";
interface TabProps {
    label: string;
    slug: string;
}
const tabs = [
    { label: 'Preferences', slug: 'preferences' },
];

const QuotationSettings: React.FC = () => {

    const [activeTab, setActiveTab] = useState<TabProps>(tabs[0]);

    return (
        <div className="space-y-4">
            <h4 className="text-2xl font-bold">Invoice Settings</h4>
            <div className="flex gap-4 py-2">
                {tabs.map((tab, index) => {
                    return (
                        <button
                            key={index + 1}
                            className={`font-medium text-sm ${activeTab?.slug === tab.slug ? 'border-b-2 text-primary' : ''} hover:text-primary`}
                            onClick={() => setActiveTab(tab)}
                        >{tab.label}
                        </button>
                    );
                })}
            </div>
            {/* Tab Content */}
            <div className="mt-4">
                {activeTab.slug === 'preferences' && <InvoicePreferences />}
            </div>
        </div>
    );
}
export default QuotationSettings;
