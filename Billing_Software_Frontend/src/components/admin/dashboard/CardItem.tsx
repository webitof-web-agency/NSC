import type { ReactNode } from "react";

interface CardItemProps {
    icon: ReactNode;
    label: string;
    value: string | number;
    color: string;
    onClick?: () => void;
}

export function CardItem({ icon, label, value, color, onClick }: CardItemProps) {

    const colors: Record<string, string> = {
        purple: "bg-third border border-fourth text-primary",
        green: "bg-green-50 border border-green-300 text-green-700",
        blue: "bg-blue-50 border border-blue-300 text-blue-700",
        yellow: "bg-yellow-50 border border-yellow-300 text-yellow-700",
        red: "bg-red-50 border border-red-300 text-red-700",
        gray: "bg-gray-50 border border-gray-300 text-gray-700",
        indigo: "bg-indigo-50 border border-indigo-300 text-indigo-700",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 text-left ${onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
            disabled={!onClick}
        >
            <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow transition-all duration-300 ${colors[color]}`}
            >
                {icon}
            </div>
            <div>
                <p className="text-xs text-gray-600 font-medium">{label}</p>
                <p className="text-sm font-semibold text-gray-600">{value}</p>
            </div>
        </button>

    );
}
