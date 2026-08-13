import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import Constants from "@constants/api";
import { toast } from "react-toastify";

const CommissionSettings: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);

  const [commissionPercent, setCommissionPercent] = useState<number | "">("");
  const [formErrors, setFormErrors] = useState<{ percent?: string }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch existing commission %
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await axios.get(
          Constants.FETCH_COMMISSION_SETTINGS_URL,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const percent = response.data?.settings?.commissionPercent ?? 0;
        setCommissionPercent(percent);
      } catch (err) {
        console.error("Error loading commission:", err);
        toast.error("Unable to load commission settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [token]);

  const validate = () => {
    const errors: any = {};

    if (commissionPercent === "" || commissionPercent === null) {
      errors.percent = "Commission percentage is required";
    } else if (Number(commissionPercent) < 0 || Number(commissionPercent) > 100) {
      errors.percent = "Percentage must be between 0 and 100";
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
        Constants.UPDATE_COMMISSION_SETTINGS_URL,
        { percent: Number(commissionPercent) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Commission settings updated successfully");
    } catch (error) {
      console.error("Failed to update commission settings", error);
      toast.error("Update failed");
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
      <h1 className="text-2xl font-bold text-gray-950">Commission Settings</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white p-6 rounded-md border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-950 mb-6">
            Global Commission Percentage
          </h3>

          {/* Input Field */}
          <div className="w-full mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Commission Percentage (%) <em className="text-red-500">*</em>
            </label>

            <input
              type="number"
              min={0}
              max={100}
              className="border border-gray-300 mt-1 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
              value={commissionPercent}
              onChange={(e) =>
                setCommissionPercent(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              placeholder="Enter percentage"
            />

            {formErrors.percent && (
              <p className="text-red-500 text-sm mt-1">{formErrors.percent}</p>
            )}
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

export default CommissionSettings;
