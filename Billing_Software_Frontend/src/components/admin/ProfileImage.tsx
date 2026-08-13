import { Phone } from "lucide-react";
import React, { useState } from "react";

interface ProfileCardProps {
    phone: string | null;
    className?: string;
    primary?: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ phone, className = "", primary = false }) => {


    return (
        <div className={`flex items-center ${className}`}>

            <div>

                <div className="flex justify-between items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white font-bold text-lg">
                        <Phone size={14}/>
                    </div>
                    <span className={`font-medium ${primary ? "text-indigo-600" : "text-gray-600"} capitalize`}>
                        {phone || "Deleted User"}
                    </span>
                </div>

            </div>
        </div>
    );
};

export default ProfileCard;
