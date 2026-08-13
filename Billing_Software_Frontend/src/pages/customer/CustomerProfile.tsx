import { useEffect, useState } from "react";
import axios from "axios";
import Constants from "@constants/api";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@store/index";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { toast } from "react-toastify";
import { updateCustomerProfileState } from "@store/customerAuthSlice";
import { User, Mail, Phone, Globe, MapPin, Lock } from "lucide-react";

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:border-[#A43275] transition";
const disabledInputCls = "w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed";

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <span className="text-gray-400">{icon}</span>
            <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
);

const CustomerProfile: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const { token, customer } = useSelector((state: RootState) => state.customerAuth);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<any>({
        name: "", email: "", phone: "", website: "", notes: "",
        billingAddress:  { name: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "", pincode: "" },
        shippingAddress: { name: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "", pincode: "" },
        currentPassword: "", newPassword: "", confirmPassword: "",
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await axios.get(Constants.CUSTOMER_PORTAL_ME_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = response.data.data || {};
                setForm((prev: any) => ({
                    ...prev,
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    website: data.website || "",
                    notes: data.notes || "",
                    billingAddress:  data.billingAddress  || prev.billingAddress,
                    shippingAddress: data.shippingAddress || prev.shippingAddress,
                }));
                dispatch(updateCustomerProfileState({ id: data.id, name: data.name || "", email: data.email || "", phone: data.phone || "" }));
            } catch (error) {
                console.error("Error fetching customer profile:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchProfile();
    }, [dispatch, token]);

    const set = (field: string, value: string) => setForm((p: any) => ({ ...p, [field]: value }));
    const setAddr = (section: "billingAddress" | "shippingAddress", field: string, value: string) =>
        setForm((p: any) => ({ ...p, [section]: { ...p[section], [field]: value } }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await axios.put(Constants.CUSTOMER_PORTAL_PROFILE_URL, {
                name: form.name,
                email: form.email,
                website: form.website,
                notes: form.notes,
                billingAddress:  form.billingAddress,
                shippingAddress: form.shippingAddress,
                currentPassword: form.currentPassword || undefined,
                newPassword:     form.newPassword     || undefined,
                confirmPassword: form.confirmPassword  || undefined,
            }, { headers: { Authorization: `Bearer ${token}` } });

            dispatch(updateCustomerProfileState({ ...(customer || {}), name: form.name, email: form.email, phone: form.phone }));
            setForm((p: any) => ({ ...p, currentPassword: "", newPassword: "", confirmPassword: "" }));
            toast.success("Profile updated successfully");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex min-h-[300px] items-center justify-center"><LoaderSpinner /></div>;
    }

    const displayName = form.name || form.phone || "Customer";
    const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

    const addrFields = [
        { key: "name",         label: "Contact Name",  col: "sm:col-span-2" },
        { key: "addressLine1", label: "Address Line 1",col: "sm:col-span-2" },
        { key: "addressLine2", label: "Address Line 2",col: "sm:col-span-2" },
        { key: "city",         label: "City",          col: "" },
        { key: "state",        label: "State",         col: "" },
        { key: "country",      label: "Country",       col: "" },
        { key: "pincode",      label: "Pincode",       col: "" },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">

            {/* Page heading */}
            <div className="hidden lg:block">
                <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
                <p className="text-sm text-gray-500 mt-0.5">Manage your account details and password.</p>
            </div>

            {/* ── Avatar + name (mobile) ── */}
            <div className="lg:hidden bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#A43275] flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                    {initials}
                </div>
                <div>
                    <p className="text-base font-semibold text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-400">{form.phone}</p>
                </div>
            </div>

            {/* ── Personal Info ── */}
            <SectionCard title="Personal Information" icon={<User className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full Name"
                                className={`${inputCls} pl-8`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                            <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="Email" type="email"
                                className={`${inputCls} pl-8`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Phone (read-only)</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                            <input value={form.phone} disabled placeholder="Phone"
                                className={`${disabledInputCls} pl-8`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                            <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..."
                                className={`${inputCls} pl-8`} />
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes..."
                            className={`${inputCls} min-h-[80px] resize-none`} />
                    </div>
                </div>
            </SectionCard>

            {/* ── Addresses ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                {(["billingAddress", "shippingAddress"] as const).map(section => (
                    <SectionCard
                        key={section}
                        title={section === "billingAddress" ? "Billing Address" : "Shipping Address"}
                        icon={<MapPin className="w-4 h-4" />}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            {addrFields.map(f => (
                                <div key={f.key} className={f.col || ""}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input
                                        value={form[section][f.key] || ""}
                                        onChange={e => setAddr(section, f.key,
                                            f.key === "pincode" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value
                                        )}
                                        placeholder={f.label}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                ))}
            </div>

            {/* ── Change Password ── */}
            <SectionCard title="Change Password" icon={<Lock className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { key: "currentPassword", label: "Current Password" },
                        { key: "newPassword",      label: "New Password"     },
                        { key: "confirmPassword",  label: "Confirm Password" },
                    ].map(f => (
                        <div key={f.key}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                            <input
                                type="password"
                                value={form[f.key]}
                                onChange={e => set(f.key, e.target.value)}
                                placeholder={f.label}
                                className={inputCls}
                            />
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Leave password fields empty to keep your current password.</p>
            </SectionCard>

            {/* ── Save ── */}
            <div className="flex justify-end pb-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#A43275] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#8a2963] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </form>
    );
};

export default CustomerProfile;
