import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@store/index";
import axios from "axios";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import CustomSelectDropdown from "@components/admin/CustomSelectDropdown";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import { fetchSystemSettings } from "@store/systemSettingsSlice";

const UpiSettings: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { token } = useSelector((state: RootState) => state.auth);

    const [upiId, setUpiId] = useState<string>("");
    const [phonePeEnabled, setPhonePeEnabled] = useState<boolean>(false);
    const [gstMode, setGstMode] = useState<'Inclusive' | 'Exclusive'>('Exclusive');
    const [formErrors, setFormErrors] = useState<{ upiId?: string }>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Fetch existing UPI ID
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await axios.get(
                    Constants.GET_UPI_SETTINGS_URL,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const savedUpiId = response.data?.data?.upiId || "";
                const savedPhonePeEnabled = response.data?.data?.phonePeEnabled || false;
                const savedGstMode = response.data?.data?.gstMode || 'Exclusive';
                setUpiId(savedUpiId);
                setPhonePeEnabled(savedPhonePeEnabled);
                setGstMode(savedGstMode);
            } catch (err) {
                console.error("Error loading UPI settings:", err);
                toast.error("Unable to load UPI settings");
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [token]);

    const validate = () => {
        const errors: any = {};

        if (!upiId || upiId.trim() === "") {
            errors.upiId = "UPI ID is required";
        } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upiId)) {
            errors.upiId = "Invalid UPI ID format. Expected format: username@bankcode";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await axios.put(
                Constants.UPDATE_UPI_SETTINGS_URL,
                { upiId: upiId.trim(), phonePeEnabled, gstMode },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("UPI settings updated successfully");

            // Refresh system settings in Redux store to reflect changes immediately
            if (token) {
                dispatch(fetchSystemSettings(token));
            }
        } catch (error: any) {
            console.error("Failed to update UPI settings", error);
            const errorMessage = error.response?.data?.message || "Update failed";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                <LoaderSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Page Title */}
            <h1 className="text-2xl font-bold text-gray-950">UPI Settings</h1>

            <form onSubmit={handleSubmit} noValidate>
                <div className="bg-white p-6 rounded-md border border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-950 mb-6">
                        Configure UPI ID for Payments
                    </h3>

                    <p className="text-sm text-gray-600 mb-4">
                        Enter your UPI ID to enable UPI payment collection. This UPI ID will be used to generate QR codes for invoice payments.
                    </p>

                    {/* Input Field */}
                    <div className="w-full mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            UPI ID <em className="text-red-500">*</em>
                        </label>

                        <input
                            type="text"
                            className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="yourname@bank"
                        />

                        {formErrors.upiId && (
                            <p className="text-red-500 text-sm mt-1">{formErrors.upiId}</p>
                        )}

                        <p className="text-xs text-gray-500 mt-1">
                            Format: username@bankcode (e.g., john@paytm, shop@ybl, business@oksbi)
                        </p>
                    </div>

                    {/* PhonePe Toggle */}
                    <div className="w-full mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Enable PhonePe Payment Option
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                    Toggle to show/hide PhonePe option in Payment Modal (inactive by default)
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={phonePeEnabled}
                                    onChange={(e) => setPhonePeEnabled(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* GST Mode Selector */}
                    <div className="w-full mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            GST Mode <em className="text-red-500">*</em>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Select how GST/tax should be calculated for all invoices
                        </p>
                        <CustomSelectDropdown
                            value={gstMode}
                            onChange={(value) => setGstMode(value as 'Inclusive' | 'Exclusive')}
                            options={[
                                { value: 'Exclusive', label: 'Exclusive (Tax added separately)' },
                                { value: 'Inclusive', label: 'Inclusive (Tax included in price)' }
                            ]}
                            placeholder="Select GST Mode"
                            className="w-full"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end mt-4 gap-4">
                        <SubmitButton
                            isDisabled={isSubmitting}
                            isLoading={isSubmitting}
                            mode="edit"
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default UpiSettings;
