import Modal from "@components/admin/Modal";
import { CheckCircle2, ChevronRight } from "lucide-react";

type OptionItem = {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
};

interface OptionSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    options: OptionItem[];
    onSelect: (value: string) => void;
}

export default function OptionSelectionModal({
    isOpen,
    onClose,
    title,
    description,
    options,
    onSelect,
}: OptionSelectionModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
            <div className="space-y-4">
                {description && (
                    <div className="rounded-lg border border-fourth/30 bg-third/20 px-4 py-3.5">
                        <p className="text-sm text-gray-700 leading-relaxed font-sans">{description}</p>
                    </div>
                )}

                <div className="space-y-2.5">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onSelect(option.value)}
                            className="group w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-third/15 hover:shadow-sm cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-md bg-third text-primary p-2 group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                                        {option.icon ? option.icon : <CheckCircle2 size={16} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors duration-200">
                                            {option.label}
                                        </div>
                                        {option.description && (
                                            <div className="mt-0.5 text-xs text-gray-500 font-medium">
                                                {option.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight
                                    size={16}
                                    className="shrink-0 text-gray-300 transition-all duration-200 group-hover:text-primary group-hover:translate-x-1"
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
