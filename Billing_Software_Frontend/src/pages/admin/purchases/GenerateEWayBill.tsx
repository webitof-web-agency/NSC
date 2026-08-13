import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import SubmitButton from "@components/admin/SubmitButton";

export default function GenerateEWayBill() {
  const navigate = useNavigate();
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const { token } = useSelector((state: RootState) => state.auth);

  const [purchase, setPurchase] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    supplyType: "INWARD",
    subSupplyType: "Purchase",
    transMode: "1",
    vehicleType: "R",
    vehicleNo: "",
    distance: "",
    transporterName: "",
    transporterId: "",
    lrNo: "",
    lrDate: ""
  });

  useEffect(() => {
    fetchPurchase();
  }, []);

  const fetchPurchase = async () => {
    try {
      const res = await axios.get(
        `${Constants.GET_PURCHASE_URL}/${purchaseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPurchase(res.data.data);
    } catch {
      toast.error("Failed to load purchase");
      navigate("/admin/purchases");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicleNo || !formData.distance) {
      toast.error("Vehicle No and Distance are mandatory");
      return;
    }

    try {
      setIsSubmitting(true);

      await axios.post(
        Constants.GENERATE_EWAY_BILL_URL.replace(":purchaseId", purchaseId!),
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("E-Way Bill generated successfully");
      navigate("/admin/purchases");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "E-Way Bill generation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!purchase) return null;

  return (
    <div className="bg-white p-6 rounded-md border border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto">

        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-950">
            Generate E-Way Bill
          </h1>
        </div>

        {/* ================= DOCUMENT DETAILS ================= */}
        <Section title="Document Details">
          <Grid>
            <ReadOnlyInput label="Document Type" value="Invoice" />
            <ReadOnlyInput label="Purchase No" value={purchase.purchaseId} />
            <ReadOnlyInput
              label="Invoice Date"
              value={new Date(purchase.purchaseDate).toLocaleDateString()}
            />
          </Grid>
        </Section>

        {/* ================= SUPPLIER ================= */}
        <Section title="Supplier Details">
          <Grid>
            <ReadOnlyInput label="GSTIN" value={purchase.billTo.gstin} />
            <ReadOnlyInput label="Business Name" value={purchase.billTo.businessName} />
            <ReadOnlyInput label="Address" value={purchase.billTo.address} />
            <ReadOnlyInput label="City" value={purchase.billTo.city} />
            <ReadOnlyInput label="Pincode" value={purchase.billTo.pincode} />
            <ReadOnlyInput label="State Code" value={purchase.billTo.stateCode} />
          </Grid>
        </Section>

        {/* ================= RECIPIENT ================= */}
        <Section title="Recipient Details">
          <Grid>
            <ReadOnlyInput label="GSTIN" value={purchase.billFrom.gstin} />
            <ReadOnlyInput label="Company Name" value={purchase.billFrom.companyName} />
            <ReadOnlyInput label="Address" value={purchase.billFrom.address} />
            <ReadOnlyInput label="City" value={purchase.billFrom.city} />
            <ReadOnlyInput label="Pincode" value={purchase.billFrom.pincode} />
            <ReadOnlyInput label="State Code" value={purchase.billFrom.stateCode} />
          </Grid>
        </Section>

        {/* ================= ITEMS ================= */}
        <Section title="Item Details">
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-white">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">HSN</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.hsn_code}</td>
                    <td className="p-3">{item.qty}</td>
                    <td className="p-3">{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ================= TRANSPORT ================= */}
        <Section title="Transport Details">
          <Grid>
            <Select
              label="Transport Mode"
              name="transMode"
              value={formData.transMode}
              onChange={handleChange}
              options={[
                { value: "1", label: "Road" },
                { value: "2", label: "Rail" },
                { value: "3", label: "Air" },
                { value: "4", label: "Ship" }
              ]}
            />

            <Select
              label="Vehicle Type"
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              options={[
                { value: "R", label: "Regular" },
                { value: "O", label: "ODC" }
              ]}
            />

            <Input label="Vehicle No *" name="vehicleNo" value={formData.vehicleNo} onChange={handleChange} />
            <Input label="Distance (KM) *" name="distance" value={formData.distance} onChange={handleChange} />
            <Input label="Transporter Name" name="transporterName" value={formData.transporterName} onChange={handleChange} />
            <Input label="LR No" name="lrNo" value={formData.lrNo} onChange={handleChange} />
          </Grid>
        </Section>

        {/* ================= ACTIONS ================= */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate("/admin/purchases")}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <SubmitButton isLoading={isSubmitting}>
            Generate E-Way Bill
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/* ================= REUSABLE UI HELPERS ================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>;
}

function ReadOnlyInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        readOnly
        value={value || ""}
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
      />
    </div>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        {...props}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
      />
    </div>
  );
}

function Select({ label, options, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        {...props}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
