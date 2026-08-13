import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppDispatch, RootState } from "@store/index";
import { loginCustomer } from "@store/customerAuthSlice";
import { fetchSystemSettings } from "@store/systemSettingsSlice";
import { ArrowLeft, Eye, EyeOff, Lock, Phone, ShoppingBag, CheckCircle2 } from "lucide-react";

const CustomerLogin: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isLoading, error } = useSelector((state: RootState) => state.customerAuth);
    const adminToken = useSelector((state: RootState) => state.auth.token);
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            const target = (location.state as any)?.from || "/customer/dashboard";
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, location.state, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await dispatch(loginCustomer({ phone, password }));
    };

    const handleBackToCustomers = async () => {
        if (adminToken) {
            try {
                await dispatch(fetchSystemSettings(adminToken)).unwrap();
            } catch (error) {
                console.error("Error restoring admin system settings:", error);
            }
        }
        navigate("/admin/customers");
    };

    const features = [
        "View all your invoices in one place",
        "Download bills & payment receipts",
        "Track outstanding balances",
        "Manage your profile & preferences",
    ];

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* ── Branded top section on mobile / Left panel on desktop ── */}
            <div
                className="flex flex-col lg:w-[45%] lg:justify-between p-6 lg:p-12 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #A43275 0%, #c0428e 60%, #d4589f 100%)" }}
            >
                {/* Decorative blobs */}
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute bottom-10 -right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl hidden lg:block" />

                {/* Brand */}
                <div className="relative z-10 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleBackToCustomers}
                        className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm text-white hover:bg-white/25 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-bold text-xl tracking-tight">Customer Portal</span>
                </div>

                {/* Headline — full on desktop, compact on mobile */}
                <div className="relative z-10 mt-6 lg:mt-0 space-y-3 lg:space-y-6">
                    <div>
                        <h2 className="text-2xl lg:text-4xl font-extrabold text-white leading-tight">
                            Your invoices,<br className="hidden lg:block" /> anytime & anywhere
                        </h2>
                        <p className="mt-2 text-white/75 text-sm leading-relaxed hidden lg:block">
                            Sign in to access your complete billing history and manage your account effortlessly.
                        </p>
                    </div>

                    <ul className="space-y-2 lg:space-y-3">
                        {features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-white/90 text-xs lg:text-sm">
                                <CheckCircle2 className="w-4 h-4 text-white/70 flex-shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative z-10 text-white/50 text-xs mt-6 lg:mt-0 hidden lg:block">
                    © {new Date().getFullYear()} — Secure customer portal
                </p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start lg:justify-center bg-gray-50 px-5 py-6 lg:px-6 lg:py-12">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6 lg:p-10">
                        {/* Header */}
                        <div className="mb-6 lg:mb-8">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#fce6f4" }}>
                                <Lock className="w-5 h-5" style={{ color: "#A43275" }} />
                            </div>
                            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Welcome back</h1>
                            <p className="mt-1 text-sm text-gray-500">Sign in to your customer account to continue.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                                    Phone Number
                                </label>
                                <div className="relative">
                                    <Phone
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                                    />
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                                        placeholder="Enter your 10-digit phone"
                                        maxLength={10}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                                        style={{ "--tw-ring-color": "#A4327540" } as any}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = "#A43275";
                                            e.target.style.boxShadow = "0 0 0 3px #A4327520";
                                            e.target.style.backgroundColor = "#fff";
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = "";
                                            e.target.style.boxShadow = "";
                                            e.target.style.backgroundColor = "";
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                                    />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition"
                                        onFocus={(e) => {
                                            e.target.style.borderColor = "#A43275";
                                            e.target.style.boxShadow = "0 0 0 3px #A4327520";
                                            e.target.style.backgroundColor = "#fff";
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = "";
                                            e.target.style.boxShadow = "";
                                            e.target.style.backgroundColor = "";
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((p) => !p)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Hint banner */}
                            <div
                                className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs"
                                style={{ backgroundColor: "#fce6f4", color: "#A43275" }}
                            >
                                <span className="mt-0.5 flex-shrink-0">💡</span>
                                <span>Default password is your phone number unless you have changed it.</span>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                                    <span className="flex-shrink-0">⚠️</span>
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isLoading || phone.length < 10}
                                className="relative w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
                                style={{ backgroundColor: "#A43275" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#8a2963"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#A43275"; }}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Signing in…
                                    </span>
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-6">
                        Having trouble logging in? Contact your store for assistance.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CustomerLogin;
