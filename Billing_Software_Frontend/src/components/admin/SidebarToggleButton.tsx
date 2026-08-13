import { Package } from 'lucide-react';

interface SidebarToggleButtonProps {
    onClick: () => void;
}

export default function SidebarToggleButton({ onClick }: SidebarToggleButtonProps) {
    return (
        <button
            onClick={onClick}
            className="fixed right-0 top-1/2 -translate-y-1/2 bg-primary hover:bg-gray-950 text-white px-2 py-4 rounded-l-lg shadow-lg hover:shadow-xl transition-all duration-300 z-30 group"
            title="View Products"
        >
            <div className="flex flex-col items-center gap-1">
                <Package size={24} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
                    Products
                </span>
            </div>
        </button>
    );
}
