import { Phone } from "lucide-react";
import React, { useState } from "react";

interface CustomerCardProps {

    phone: string;              // ✅ REQUIRED
    name?: string;              // optional (if exists)
    className?: string;
}

const CustomerCard: React.FC<CustomerCardProps> = ({
    // image,
    phone,
    name,
    // email,
    // defaultImage,
    className = "",
}) => {


    return (
        <div className={`flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md ${className}`} >
            {/* Icon / Placeholder */}
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white font-bold text-lg">
                <Phone size={16}/>
            </div>

            {/* Details */}
            <div className="flex flex-col">
                {name && (
                    <span className="text-sm font-semibold text-gray-900 uppercase">
                        {name}
                    </span>
                )}

                <span className="text-sm text-gray-700">
                    <span className="font-semibold">Phone:</span> {phone}
                </span>
            </div>
        </div>
    );
};

export default CustomerCard;
