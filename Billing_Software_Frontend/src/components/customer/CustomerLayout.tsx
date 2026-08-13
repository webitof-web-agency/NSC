import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { logoutCustomer } from "@store/customerAuthSlice";
import { clearSystemSettings, setSystemSettings } from "@store/systemSettingsSlice";
import { useEffect, useState } from "react";
import axios from "axios";
import Constants from "@constants/api";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import { ExternalLink, Facebook, FileText, Globe, Instagram, LayoutDashboard, LogOut, MapPin, Mail, Phone, ShoppingBag, UserCircle2, Youtube } from "lucide-react";

const CustomerLayout: React.FC = () => {
    const { token, customer } = useSelector((state: RootState) => state.customerAuth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                if (!token) return;
                const response = await axios.get(Constants.CUSTOMER_PORTAL_SETTINGS_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                dispatch(setSystemSettings(response.data.data || null));
            } catch (error) {
                console.error("Error fetching customer portal settings:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [dispatch, token]);

    const handleLogout = () => {
        dispatch(logoutCustomer());
        dispatch(clearSystemSettings());
        navigate("/customer/login");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <LoaderSpinner />
            </div>
        );
    }

    const displayName = (customer as any)?.name || (customer as any)?.phone || "Customer";
    const initials = displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const branding = systemSettings?.company?.customerPortalBranding;

    const sidebarLink = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
            ? "bg-[#A43275] text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`;

    const bottomTab = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-1 text-[10px] font-semibold transition-colors ${isActive ? "text-[#A43275]" : "text-gray-400"
        }`;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 h-14 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#A43275]">
                            <ShoppingBag className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm">Customer Portal</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#A43275] flex items-center justify-center text-[10px] font-bold text-white">
                                {initials}
                            </div>
                            <span className="text-sm text-gray-700 max-w-[120px] truncate">{displayName}</span>
                        </div>

                        <div className="sm:hidden w-8 h-8 rounded-full bg-[#A43275] flex items-center justify-center text-xs font-bold text-white">
                            {initials}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-5 pb-24 lg:pb-6 sm:px-6 lg:px-8">
                <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
                    <aside className="hidden lg:block">
                        <div className="bg-white border border-gray-200 rounded-xl p-3 sticky top-20">
                            <div className="flex items-center gap-3 px-3 py-3 mb-2 border-b border-gray-100">
                                <div className="w-9 h-9 rounded-full bg-[#A43275] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                    {initials}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                                    <p className="text-xs text-gray-400">Customer</p>
                                </div>
                            </div>

                            <nav className="space-y-0.5">
                                <NavLink to="/customer/dashboard" className={sidebarLink}>
                                    <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                                    Dashboard
                                </NavLink>
                                <NavLink to="/customer/invoices" className={sidebarLink}>
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    Invoices
                                </NavLink>
                                <NavLink to="/customer/profile" className={sidebarLink}>
                                    <UserCircle2 className="h-4 w-4 flex-shrink-0" />
                                    Profile
                                </NavLink>
                            </nav>

                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                    <LogOut className="h-4 w-4 flex-shrink-0" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </aside>

                    <main className="min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>

            <footer className="bg-white m-4 mb-20 lg:mb-4 rounded-b-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(to right, #A43275, #c0428e, #e863b1)" }} />

                <div className="px-6 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Column 1: Brand Info & Socials */}
                        <div className="space-y-4">
                            {branding?.footerLogo ? (
                                <img src={branding.footerLogo} alt="Portal footer logo" className="h-10 w-auto object-contain" />
                            ) : (
                                <h3 className="text-base font-bold text-gray-900">{systemSettings?.company?.companyName || "Naresh Saree Collection"}</h3>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                {branding?.instagramUrl && (
                                    <a href={branding.instagramUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#A43275] hover:bg-gray-100 transition-colors">
                                        <Instagram className="w-4 h-4" />
                                    </a>
                                )}
                                {branding?.whatsappNumber && (
                                    <a href={`https://wa.me/${branding.whatsappNumber.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#A43275] hover:bg-gray-100 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                        </svg>
                                    </a>
                                )}
                                {branding?.facebookUrl && (
                                    <a href={branding.facebookUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#A43275] hover:bg-gray-100 transition-colors">
                                        <Facebook className="w-4 h-4" />
                                    </a>
                                )}
                                {branding?.youtubeUrl && (
                                    <a href={branding.youtubeUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#A43275] hover:bg-gray-100 transition-colors">
                                        <Youtube className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Location */}
                        {(branding?.footerAddress) && (
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wide mb-3">Location</h4>
                                <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                        <MapPin className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-gray-600 leading-relaxed pt-1.5 whitespace-pre-line">{branding.footerAddress}</span>
                                </div>
                            </div>
                        )}

                        {/* Column 3: Contact Us */}
                        {(branding?.footerPhone || branding?.footerPhoneAlt || branding?.footerEmail) && (
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wide mb-3">Contact Us</h4>
                                <div className="space-y-3">
                                    {branding?.footerPhone && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <a href={`tel:${branding.footerPhone}`} className="text-xs text-gray-600 hover:text-[#A43275] font-medium transition-colors">
                                                {branding.footerPhone}
                                            </a>
                                        </div>
                                    )}
                                    {branding?.footerPhoneAlt && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <a href={`tel:${branding.footerPhoneAlt}`} className="text-xs text-gray-600 hover:text-[#A43275] font-medium transition-colors">
                                                {branding.footerPhoneAlt}
                                            </a>
                                        </div>
                                    )}
                                    {branding?.footerEmail && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                                <Mail className="w-3.5 h-3.5" />
                                            </div>
                                            <a href={`mailto:${branding.footerEmail}`} className="text-xs text-gray-600 hover:text-[#A43275] font-medium transition-colors">
                                                {branding.footerEmail}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </footer>

            <nav
                className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex">
                    <NavLink to="/customer/dashboard" className={bottomTab}>
                        {({ isActive }) => (
                            <>
                                <LayoutDashboard className={`w-5 h-5 ${isActive ? "text-[#A43275]" : "text-gray-400"}`} />
                                <span>Home</span>
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/customer/invoices" className={bottomTab}>
                        {({ isActive }) => (
                            <>
                                <FileText className={`w-5 h-5 ${isActive ? "text-[#A43275]" : "text-gray-400"}`} />
                                <span>Invoices</span>
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/customer/profile" className={bottomTab}>
                        {({ isActive }) => (
                            <>
                                <UserCircle2 className={`w-5 h-5 ${isActive ? "text-[#A43275]" : "text-gray-400"}`} />
                                <span>Profile</span>
                            </>
                        )}
                    </NavLink>
                </div>
            </nav>
        </div>
    );
};

export default CustomerLayout;
