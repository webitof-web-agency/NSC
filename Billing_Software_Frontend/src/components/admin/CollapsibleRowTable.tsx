import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleRowTableProps {
    children: React.ReactNode;
    // The content to display in the expanded section
    expandedContent: React.ReactNode;
    // Whether the row has expandable items
    hasItems: boolean;
    // How many columns the expanded row should span
    colSpan?: number;
}

const CollapsibleRowTable: React.FC<CollapsibleRowTableProps> = ({
    children,
    expandedContent,
    hasItems,
    colSpan = 7
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <tr
                className={`border-b border-gray-100 transition-colors ${hasItems ? "cursor-pointer hover:bg-gray-50" : ""
                    }`}
                onClick={() => hasItems && setIsOpen(!isOpen)}
            >
                {children}

                {/* Automatic Expansion/Chevron Column */}
                <td className="px-3 py-2 text-sm text-gray-400 text-center">
                    {hasItems && (
                        <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                                }`}
                        />
                    )}
                </td>
            </tr>

            {/* Expanded Content Row */}
            {isOpen && hasItems && (
                <tr className="bg-gray-50">
                    <td colSpan={colSpan} className="px-4 py-3">
                        {expandedContent}
                    </td>
                </tr>
            )}
        </>
    );
};

export default CollapsibleRowTable;
