import { BadgeCheck, Mail, MapPin, Phone, UserRound } from "lucide-react";
import React from "react";

interface CustomerCardProps {

    phone: string;
    name?: string;
    email?: string;
    address?: string;
    variant?: "compact" | "detailed";
    className?: string;
}

const CustomerCard: React.FC<CustomerCardProps> = ({
    phone,
    name,
    email,
    address,
    variant = "compact",
    className = "",
}) => {
    if (variant === "compact") {
        return (
            <div className={`flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 ${className}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                    <Phone size={16} aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col">
                    {name && (
                        <span className="truncate text-sm font-semibold uppercase text-gray-900">
                            {name}
                        </span>
                    )}
                    <span className="text-sm text-gray-700">
                        <span className="font-semibold">Phone:</span> {phone}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`overflow-hidden rounded-lg border border-primary/20 bg-white shadow-sm ${className}`}>
            <div className="flex items-start gap-3 border-l-4 border-primary p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserRound size={18} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Selected customer
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <BadgeCheck size={12} aria-hidden="true" />
                            Selected
                        </span>
                    </div>

                    {name && (
                        <p className="truncate text-sm font-semibold text-gray-950" title={name}>
                            {name}
                        </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                            <Phone size={13} className="text-primary" aria-hidden="true" />
                            {phone || "Phone not available"}
                        </span>
                        {email && (
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Mail size={13} className="shrink-0 text-primary" aria-hidden="true" />
                                <span className="truncate" title={email}>{email}</span>
                            </span>
                        )}
                    </div>

                    {address && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-4 text-gray-500">
                            <MapPin size={13} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                            <span>{address}</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerCard;
