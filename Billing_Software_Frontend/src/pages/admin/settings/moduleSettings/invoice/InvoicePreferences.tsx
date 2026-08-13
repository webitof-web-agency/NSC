





import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

interface FormData {
  termsAndConditions: string;
  customerNotes: string;
}

const invoicePreferences: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    termsAndConditions: "",
    customerNotes: "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* =========================
     FETCH INVOICE PREFERENCES
     ========================= */
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setIsLoading(true);
        const res = await axios.get(
          Constants.GET_INVOICE_PREFERENCES_SETTINGS_URL,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.data?.data) {
          setFormData({
            termsAndConditions: res.data.data.termsAndConditions || "",
            customerNotes: res.data.data.customerNotes || "",
          });
        }
      } catch (error) {
        toast.error("Failed to load invoice preferences");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [token]);

  /* =========================
     HANDLERS
     ========================= */
  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.termsAndConditions.trim()) {
      errors.termsAndConditions = "Terms & Conditions are required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* =========================
     SUBMIT (UPSERT)
     ========================= */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      await axios.post(
        Constants.UPDATE_INVOICE_PREFERENCES_SETTINGS_URL,
        {
          termsAndConditions: formData.termsAndConditions,
          customerNotes: formData.customerNotes,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Invoice preferences updated successfully.");
    } catch (error) {
      toast.error("Failed to update invoice preferences.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================
     DELETE (OPTIONAL)
     ========================= */
  const handleDelete = async () => {
    try {
      await axios.delete(
        Constants.DELETE_INVOICE_PREFERENCES_SETTINGS_URL,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setFormData({ termsAndConditions: "", customerNotes: "" });
      toast.success("Invoice preferences cleared.");
    } catch {
      toast.error("Failed to delete preferences.");
    }
  };

  /* =========================
     LOADER
     ========================= */
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <LoaderSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div>
          <p className="text-md font-semibold">Invoice Preferences</p>
          <small className="text-gray-500 text-xs">
            Configure default Terms & Conditions and Notes for invoices.
          </small>
        </div>

        <hr className="my-4" />

        {/* Terms & Conditions */}
        <div className="mb-3">
          <p className="text-md font-semibold">Terms & Conditions</p>
        </div>
        <div className="md:w-2/4">
          <textarea
            rows={5}
            value={formData.termsAndConditions}
            onChange={(e) =>
              handleChange("termsAndConditions", e.target.value)
            }
            className="border border-gray-300 rounded-md px-4 py-2 w-full text-sm text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
          />
          {formErrors.termsAndConditions && (
            <p className="text-red-500 text-xs mt-1">
              {formErrors.termsAndConditions}
            </p>
          )}
        </div>

        {/* Customer Notes */}
        <div className="mb-3 mt-4">
          <p className="text-md font-semibold">Customer Notes</p>
        </div>
        <div className="md:w-2/4">
          <textarea
            rows={5}
            value={formData.customerNotes}
            onChange={(e) => handleChange("customerNotes", e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-2 w-full text-sm text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="bg-white border px-4 py-2 rounded-md"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-md"
          >
            Clear
          </button>

          <SubmitButton
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
            mode="edit"
          />
        </div>
      </form>
    </div>
  );
};

export default invoicePreferences;
