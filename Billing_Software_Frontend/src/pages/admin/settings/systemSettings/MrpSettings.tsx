import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import Constants from "@constants/api";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import { toast } from "react-toastify";

const MrpSettings: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [multiplier, setMultiplier] = useState<string>("0");
    const [saleMultiplier, setSaleMultiplier] = useState<string>("0");
    const [allowManualOverride, setAllowManualOverride] = useState(true);
    const [allowSaleManualOverride, setAllowSaleManualOverride] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await axios.get(Constants.GET_MRP_SETTINGS_URL, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = response.data?.data;
                if (data?.multiplier !== undefined && data?.multiplier !== null) {
                    setMultiplier(String(data.multiplier));
                } else if (data?.mode === "2x") {
                    setMultiplier("2");
                } else if (data?.mode === "3x") {
                    setMultiplier("3");
                } else {
                    setMultiplier("0");
                }
                if (data?.saleMultiplier !== undefined && data?.saleMultiplier !== null) {
                    setSaleMultiplier(String(data.saleMultiplier));
                } else {
                    setSaleMultiplier("0");
                }
                if (typeof data?.allowManualOverride === "boolean") {
                    setAllowManualOverride(data.allowManualOverride);
                }
                if (typeof data?.allowSaleManualOverride === "boolean") {
                    setAllowSaleManualOverride(data.allowSaleManualOverride);
                }
            } catch (err) {
                toast.error("Unable to load MRP settings");
            } finally {
                setIsLoading(false);
            }
        };

        if (token) loadSettings();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.put(
                Constants.UPDATE_MRP_SETTINGS_URL,
                {
                    multiplier: Number(multiplier) || 0,
                    saleMultiplier: Number(saleMultiplier) || 0,
                    allowManualOverride,
                    allowSaleManualOverride
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("MRP settings updated");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to update MRP settings");
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
            <h1 className="text-2xl font-bold text-gray-950">MRP Settings</h1>

            <form onSubmit={handleSubmit}>
                <div className="bg-white p-6 rounded-md border border-gray-200 space-y-4">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-950">Product Variant Price Configuration</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Set the multiplier used to calculate MRP and Sale Price from Purchase Price.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                MRP Multiplier
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Example: 2 means MRP = Purchase Price × 2.
                            </p>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={multiplier}
                                onChange={(e) => setMultiplier(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                            <div className="text-sm text-gray-600 mt-2">
                                <div className="font-medium text-gray-700">Preview</div>
                                <div>
                                    Purchase 100 × {Number(multiplier || 0)} ={" "}
                                    <span className="font-semibold text-gray-800">
                                        {Number(multiplier || 0) * 100}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Set 0 to disable auto calculation.
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Sale Multiplier
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Example: 1.5 means Sale Price = Purchase Price × 1.5.
                            </p>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={saleMultiplier}
                                onChange={(e) => setSaleMultiplier(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                            <div className="text-sm text-gray-600 mt-2">
                                <div className="font-medium text-gray-700">Preview</div>
                                <div>
                                    Purchase 100 × {Number(saleMultiplier || 0)} ={" "}
                                    <span className="font-semibold text-gray-800">
                                        {Number(saleMultiplier || 0) * 100}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Set 0 to disable auto calculation.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Allow Manual Override (MRP)
                            </label>
                            <p className="text-xs text-gray-500">
                                If enabled, you can edit MRP even when auto mode is selected.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={allowManualOverride}
                                onChange={(e) => setAllowManualOverride(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Allow Manual Override (Sale Price)
                            </label>
                            <p className="text-xs text-gray-500">
                                If enabled, you can edit Sale Price even when auto mode is selected.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={allowSaleManualOverride}
                                onChange={(e) => setAllowSaleManualOverride(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex justify-end mt-4">
                        <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode="edit" />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default MrpSettings;
