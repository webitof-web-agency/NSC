import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
    /** Controls if the modal is visible */
    isOpen: boolean;
    /** Function to call when the modal is closed (e.g., by clicking cancel, 'X', or the backdrop) */
    onClose: () => void;
    /** Function to call when the confirm button is clicked */
    onConfirm: () => void;
    /** The main title of the modal */
    title: string;
    /** The descriptive message inside the modal */
    message: ReactNode;
    /** Type of confirmation - determines icon and button colors */
    type?: 'danger' | 'warning' | 'success' | 'info';
    /** Custom confirm button text */
    confirmText?: string;
    /** Custom cancel button text */
    cancelText?: string;
    /** A boolean to indicate that the action is in progress (disables buttons and shows a spinner) */
    isLoading?: boolean;
}

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'warning',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isLoading = false,
}: ConfirmationModalProps) => {
    if (!isOpen) return null;

    // Determine icon and colors based on type
    const getTypeStyles = () => {
        switch (type) {
            case 'danger':
                return {
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    Icon: AlertTriangle,
                    buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400',
                };
            case 'success':
                return {
                    iconBg: 'bg-green-100',
                    iconColor: 'text-green-600',
                    Icon: CheckCircle2,
                    buttonBg: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-400',
                };
            case 'info':
                return {
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    Icon: Info,
                    buttonBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400',
                };
            case 'warning':
            default:
                return {
                    iconBg: 'bg-yellow-100',
                    iconColor: 'text-yellow-600',
                    Icon: AlertTriangle,
                    buttonBg: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 disabled:bg-yellow-400',
                };
        }
    };

    const { iconBg, iconColor, Icon, buttonBg } = getTypeStyles();

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={!isLoading ? onClose : undefined}
            />

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                aria-labelledby="confirmation-modal-title"
                role="dialog"
                aria-modal="true"
            >
                <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute top-2 right-2 rounded-full p-1 text-gray-500 hover:bg-gray-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>

                    <div className="text-center">
                        {/* Icon */}
                        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
                            <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
                        </div>

                        {/* Title */}
                        <h3
                            id="confirmation-modal-title"
                            className="mt-4 text-lg font-bold text-gray-950"
                        >
                            {title}
                        </h3>

                        {/* Message */}
                        <div className="mt-2 text-sm font-medium text-gray-600">
                            {message}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex w-full items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${buttonBg}`}
                        >
                            {isLoading ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {isLoading ? 'Processing...' : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ConfirmationModal;
