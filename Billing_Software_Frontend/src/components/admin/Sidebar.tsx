import { useState, useMemo, useEffect, useRef } from "react";
import logoImage from "@assets/images/logo.png";
import { resolveAssetUrl } from "@utils/assetUrl";
import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { MdInventory, MdSecurity } from "react-icons/md";
import {
    Home,
    ChevronDown,
    Box,
    ShoppingBag,
    Users,
    BarChart2,
    Plus,
    FileText,
    ReceiptText,
    Package,
    Tags,
    Ruler,
    Palette,
    ShoppingCart,
    UserPlus,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    PackageOpen,
    AlertTriangle,
    XCircle,
    User,
    Building,
    Globe,
    Coins,
    CreditCard,
    Barcode,
    Percent,
    RefreshCw,
    FileStack,
    ReceiptIndianRupee,
    MessageCircle,
} from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import type {
    NavCollapsibleItem,
    NavItemType,
    NavLinkItem,
} from "@models/sidebar";
import type { PermissionSet } from "@models/permissions";
import BottomBar from "./layouts/BottomBar";

// --- Navigation Data Structure ---
const navItems: NavItemType[] = [
    { type: "header", title: "Main", slug: "main" },
    {
        type: "link",
        to: "/admin",
        icon: <Home size={16} />,
        title: "Dashboard",
        slug: "dashboard",
    },
    { type: "header", title: "Inventory & Sales", slug: "inventory-sales" },
    {
        type: "collapsible",
        id: "inventory-sales",
        icon: <MdInventory size={16} />,
        title: "Sales",
        slug: "inventory-sales",
        children: [
            {
                type: "link",
                to: "/admin/invoices",
                icon: <FileText size={16} />,
                title: "Invoices",
                slug: "invoices",
                addPath: "/admin/invoices/create-invoice",
            },
            {
                type: "link",
                to: "/admin/invoices/exchange",
                icon: <RefreshCw size={16} />,
                title: "Invoices Exchange",
                slug: "invoices",
                addPath: "/admin/invoices/exchange/new",
            },
            {
                type: "link",
                to: "/admin/quotations",
                icon: <FileStack size={16} />,
                title: "Quotations",
                slug: "quotations",
                addPath: "/admin/quotations/new",
            },
            {
                type: "link",
                to: "/admin/credit-notes",
                icon: <ReceiptText size={16} />,
                title: "Credit Notes",
                slug: "credit-notes",
                addPath: "/admin/credit-notes/new",
            },
        ],
    },
    {
        type: "collapsible",
        id: "products",
        icon: <Package size={16} />,
        title: "Inventory & Products",
        slug: "product-services",
        children: [
            {
                type: "link",
                to: "/admin/inventory",
                icon: <MdInventory size={16} />,
                title: "Inventory",
                slug: "inventory",
            },
            {
                type: "link",
                to: "/admin/products",
                icon: <Package size={16} />,
                title: "Products",
                slug: "product-services",
                addPath: "/admin/products/new",
            },
            {
                type: "link",
                to: "/admin/product-variants",
                icon: <Box size={16} />,
                title: "Product Variants",
                slug: "product-services",
            },
        ],
    },
    {
        type: "collapsible",
        id: "customers",
        icon: <Users size={16} />,
        title: "Customers",
        slug: "customers",
        children: [
            {
                type: "link",
                to: "/admin/customers",
                icon: <Users size={16} />,
                title: "Customers",
                slug: "customers",
                addPath: "/admin/customers/new",
            },
            {
                type: "link",
                to: "/admin/customers/activity",
                icon: <BarChart2 size={16} />,
                title: "Customer Activity",
                slug: "customer-activity",
            },
            {
                type: "link",
                to: "/admin/customers/portal-branding",
                title: "Customer Portal Branding",
                slug: "customer-activity",
            },
        ],
    },
    { type: "header", title: "Purchase & Suppliers", slug: "purchases" },
    {
        type: "collapsible",
        id: "purchases",
        icon: <ShoppingCart size={16} />,
        title: "Purchase & Suppliers",
        slug: "purchases",
        children: [
            {
                type: "link",
                to: "/admin/purchases",
                icon: <ShoppingCart size={16} />,
                title: "Purchases",
                slug: "purchase-list",
                addPath: "/admin/purchases/new",
            },
            {
                type: "link",
                to: "/admin/debit-notes",
                icon: <ReceiptText size={16} />,
                title: "Debit Notes",
                slug: "debit-notes",
                addPath: "/admin/debit-notes/new",
            },
            {
                type: "link",
                to: "/admin/suppliers",
                icon: <ShoppingBag size={16} />,
                title: "Suppliers",
                slug: "suppliers",
            },
            {
                type: "link",
                to: "/admin/supplier-payments",
                icon: <DollarSign size={16} />,
                title: "Supplier Payments",
                slug: "supplier-payments",
            },
            {
                type: "link",
                to: "/admin/purchase-expenses",
                icon: <ReceiptIndianRupee size={16} />,
                title: "Purchases Expenses",
                slug: "purchase-list",
            },
        ],
    },
    { type: "header", title: "Roles & Permissions", slug: "manage-users" },
    {
        type: "collapsible",
        id: "manage-users",
        icon: <MdSecurity size={16} />,
        title: "Roles & Permissions",
        slug: "manage-users",
        children: [
            {
                type: "link",
                to: "/admin/users",
                icon: <Users size={16} />,
                title: "Users",
                slug: "manage-users",
            },
            {
                type: "link",
                to: "/admin/staff",
                icon: <UserPlus size={16} />,
                title: "Staffs",
                slug: "manage-users",
            },
            {
                type: "link",
                to: "/admin/staff-salary",
                icon: <Coins size={16} />,
                title: "Staff Salary",
                slug: "manage-users",
            },
            {
                type: "link",
                to: "/admin/roles",
                icon: <MdSecurity size={16} />,
                title: "Roles & Permissions",
                slug: "manage-users",
            },
            {
                type: "link",
                to: "/admin/attendance",
                icon: <Calendar size={16} />,
                title: "Mark Attendance",
                slug: "manage-users",
            },
            {
                type: "link",
                to: "/admin/attendance-report",
                icon: <BarChart2 size={16} />,
                title: "Attendance Report",
                slug: "manage-users",
            },
        ],
    },
    { type: "header", title: "Reports", slug: "reports" },
    {
        type: "collapsible",
        id: "reports",
        icon: <BarChart2 size={16} />,
        title: "Reports",
        slug: "reports",
        children: [
            {
                type: "link",
                to: "/admin/reports/profit-loss",
                icon: <BarChart2 size={16} />,
                title: "Profit / Loss",
                slug: "accounting-reports",
            },
            {
                type: "link",
                to: "/admin/reports/sales",
                icon: <TrendingUp size={16} />,
                title: "Sales",
                slug: "transaction-reports",
            },
            {
                type: "link",
                to: "/admin/reports/sales-return",
                icon: <TrendingDown size={16} />,
                title: "Sales Exchange",
                slug: "transaction-reports",
            },
            {
                type: "link",
                to: "/admin/reports/hsn-gst",
                icon: <FileText size={16} />,
                title: "HSN GST Export",
                slug: "transaction-reports",
            },
            {
                type: "link",
                to: "/admin/reports/purchase",
                icon: <ShoppingCart size={16} />,
                title: "Purchase",
                slug: "transaction-reports",
            },
            {
                type: "link",
                to: "/admin/reports/purchase-return",
                icon: <TrendingDown size={16} />,
                title: "Purchase Return",
                slug: "transaction-reports",
            },
            {
                type: "link",
                to: "/admin/reports/income",
                icon: <DollarSign size={16} />,
                title: "Income",
                slug: "accounting-reports",
            },
            {
                type: "link",
                to: "/admin/reports/monthly-expenses",
                icon: <Calendar size={16} />,
                title: "Monthly Expenses",
                slug: "accounting-reports",
            },
            {
                type: "link",
                to: "/admin/reports/broker-details",
                icon: <Users size={16} />,
                title: "Broker Details",
                slug: "accounting-reports",
            },
            {
                type: "link",
                to: "/admin/reports/inventory",
                icon: <PackageOpen size={16} />,
                title: "Inventory",
                slug: "item-reports",
            },
            {
                type: "link",
                to: "/admin/reports/low-stock",
                icon: <AlertTriangle size={16} />,
                title: "Low Stock",
                slug: "item-reports",
            },
            {
                type: "link",
                to: "/admin/reports/out-of-stock",
                icon: <XCircle size={16} />,
                title: "Out of Stock",
                slug: "item-reports",
            },
        ],
    },
    { type: "header", title: "Settings & Configurations", slug: "settings" },
    {
        type: "link",
        to: "/admin/settings/profile",
        icon: <User size={16} />,
        title: "Account",
        slug: "general-settings",
    },
    {
        type: "collapsible",
        id: "website-settings",
        icon: <Globe size={16} />,
        title: "Website Settings",
        slug: "website-settings",
        children: [
            {
                type: "link",
                to: "/admin/settings/company-settings",
                title: "Company Settings",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/settings/localization",
                title: "Localization Settings",
                slug: "website-settings",
            },
        ],
    },
    {
        type: "collapsible",
        id: "whatsapp",
        icon: <MessageCircle size={16} />,
        title: "WhatsApp",
        slug: "website-settings",
        children: [
            {
                type: "link",
                to: "/admin/whatsapp",
                title: "WhatsApp Dashboard",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/settings",
                title: "WhatsApp Settings",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/templates",
                title: "WhatsApp Templates",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/messages",
                title: "WhatsApp Messages",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/delivered",
                title: "WhatsApp Delivered",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/read",
                title: "WhatsApp Read",
                slug: "website-settings",
            },
            {
                type: "link",
                to: "/admin/whatsapp/replies",
                title: "WhatsApp Reply Rate",
                slug: "website-settings",
            },
        ],
    },
    {
        type: "collapsible",
        id: "finance-settings",
        icon: <DollarSign size={16} />,
        title: "Finance Settings",
        slug: "finance-settings",
        children: [
            {
                type: "link",
                to: "/admin/settings/taxes",
                title: "Taxes",
                slug: "finance-settings",
            },
            {
                type: "link",
                to: "/admin/settings/currencies",
                title: "Currencies",
                slug: "finance-settings",
            },
            {
                type: "link",
                to: "/admin/settings/upi-settings",
                title: "UPI Settings",
                slug: "finance-settings",
            },
        ],
    },
    {
        type: "collapsible",
        id: "system-settings",
        icon: <Building size={16} />,
        title: "System Settings",
        slug: "system-settings",
        children: [
            {
                type: "link",
                to: "/admin/settings/module-settings/invoices",
                title: "Invoice Settings",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/settings/module-settings/quotations",
                title: "Quotation Settings",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/settings/module-settings/barcode-customization",
                title: "Barcode Settings",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/settings/mrp-settings",
                title: "MRP Settings",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/settings/staff-commission",
                title: "Global Commission",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/categories",
                title: "Categories",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/brands",
                title: "Brands",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/units",
                title: "Units",
                slug: "system-settings",
            },
            {
                type: "link",
                to: "/admin/settings/invoice-templates",
                title: "Invoice Templates",
                slug: "system-settings",
            },
        ],
    },
];

// --- Helper Functions for Link Styling ---
const getLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center p-2 my-1 text-sm font-medium rounded-lg transition-colors duration-200 relative overflow-hidden ${isActive
        ? "bg-third text-primary border-l-4 border-primary"
        : "text-gray-600 hover:bg-gray-100 border-l-4 border-transparent"
    }`;

const getSubLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `block py-2 px-2 text-sm font-medium rounded-md transition-colors duration-200 relative ${isActive
        ? "bg-third text-primary border-l-4 border-primary"
        : "text-gray-600 hover:bg-gray-100 border-l-4 border-transparent"
    }`;

// --- Permission Check Helpers ---
const canView = (
    slug: string,
    permissions: PermissionSet[],
    user: any
): boolean => {
    if (user && user.user_type === 1) return true; // Super admin can view all
    const perm = permissions.find((p) => p.moduleSlug === slug);
    if (!perm) return false;
    return perm.allowAll || perm.view;
};

const canCreate = (
    slug: string,
    permissions: PermissionSet[],
    user: any
): boolean => {
    if (user && user.user_type === 1) return true; // Super admin can create all
    const perm = permissions.find((p) => p.moduleSlug === slug);
    if (!perm) return false;
    return perm.allowAll || perm.create;
};

// --- NavItem Component (for top-level links) ---
const NavItem = ({
    item,
    isSidebarOpen,
    permissions,
    user,
    allLinkPaths,
}: {
    item: NavLinkItem;
    isSidebarOpen: boolean;
    permissions: PermissionSet[];
    user: any;
    allLinkPaths: string[];
}) => {
    const { pathname } = useLocation();
    const { to, icon, title, slug, addPath } = item;
    // Use exact matching for attendance routes to prevent both highlighting
    const isActive = (() => {
        if (to === "/admin") return pathname === to;
        if (to.includes('/attendance')) return pathname === to;
        const exactOrChild = pathname === to || pathname.startsWith(`${to}/`);
        if (!exactOrChild) return false;
        const hasMoreSpecific = allLinkPaths.some((p) =>
            p !== to &&
            (pathname === p || pathname.startsWith(`${p}/`)) &&
            p.startsWith(to) &&
            p.length > to.length
        );
        return !hasMoreSpecific;
    })();

    return (
        <div className="relative group">
            <NavLink to={to} className={getLinkClasses({ isActive })}>
                <div className="flex items-center">
                    {icon}
                    <span
                        className={`ml-2 transition-opacity font-medium duration-300 whitespace-nowrap ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                            }`}
                    >
                        {title}
                    </span>
                </div>
            </NavLink>
            {!isSidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:flex items-center z-50">
                    <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
                        {title}
                    </div>
                </div>
            )}
            {isSidebarOpen && addPath && canCreate(slug, permissions, user) && (
                <Link
                    to={addPath}
                    className="absolute right-0 top-0 h-full w-8 flex items-center justify-center bg-primary text-white rounded-r-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Plus size={18} />
                </Link>
            )}
        </div>
    );
};

const SubNavLinkItem = ({
    item,
    permissions,
    user,
    allLinkPaths,
}: {
    item: NavLinkItem;
    permissions: PermissionSet[];
    user: any;
    allLinkPaths: string[];
}) => {
    const { to, title, slug, addPath } = item;
    const { pathname } = useLocation();

    // Use exact matching for attendance routes to prevent both highlighting
    const isActive = (() => {
        if (to.includes('/attendance')) return pathname === to;
        const exactOrChild = pathname === to || pathname.startsWith(`${to}/`);
        if (!exactOrChild) return false;
        const hasMoreSpecific = allLinkPaths.some((p) =>
            p !== to &&
            (pathname === p || pathname.startsWith(`${p}/`)) &&
            p.startsWith(to) &&
            p.length > to.length
        );
        return !hasMoreSpecific;
    })();

    return (
        <div className="relative group/subitem">
            <NavLink to={to} className={getSubLinkClasses({ isActive })}>
                <span>{title}</span>
            </NavLink>

            {addPath && canCreate(slug, permissions, user) && (
                <Link
                    to={addPath}
                    className="absolute right-0 top-0 h-full w-8 flex items-center justify-center bg-primary text-white rounded-r-lg opacity-0 group-hover/subitem:opacity-100 transition-opacity"
                >
                    <Plus size={18} />
                </Link>
            )}
        </div>
    );
};

// --- CollapsibleNavItem Component ---
interface CollapsibleNavItemProps {
    item: NavCollapsibleItem;
    isSidebarOpen: boolean;
    openMenus: Record<string, boolean>;
    activePath: string[];
    onToggle: (id: string) => void;
    level: number;
    permissions: PermissionSet[];
    user: any;
    allLinkPaths: string[];
}

// This is the updated CollapsibleNavItem component
const CollapsibleNavItem = ({
    item,
    isSidebarOpen,
    openMenus,
    activePath,
    onToggle,
    level,
    permissions,
    user,
    allLinkPaths,
}: CollapsibleNavItemProps) => {
    const { id, icon, title, children, slug, addPath } = item;
    const isOpen = openMenus[id] || false;
    const isChildActive = activePath.includes(id);

    const paddingClass = "p-2 my-1";
    const activeClass =
        isChildActive && isSidebarOpen
            ? "bg-gray-100 text-gray-800"
            : "text-gray-600 hover:bg-gray-100";

    return (
        <div className="relative group">
            <button
                onClick={() => onToggle(id)}
                className={`ml-1 flex items-center justify-between w-full text-sm font-medium rounded-lg transition-colors duration-300 text-left overflow-hidden ${paddingClass} ${activeClass}`}
            >
                <div className="flex items-center">
                    {icon}
                    <span
                        className={`ml-2 transition-opacity duration-300 whitespace-nowrap font-medium ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                            }`}
                    >
                        {title}
                    </span>
                </div>
                {isSidebarOpen && (
                    <ChevronDown
                        size={16}
                        className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""
                            }`}
                    />
                )}
            </button>

            {isSidebarOpen && addPath && canCreate(slug, permissions, user) && (
                <Link
                    to={addPath}
                    className="absolute right-0 top-0 h-full w-8 flex items-center justify-center bg-primary text-white rounded-r-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Plus size={18} />
                </Link>
            )}

            <div
                className={
                    isSidebarOpen
                    ? `overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-screen" : "max-h-0"}`
                    : `absolute left-full top-0 ml-2 w-56 bg-white shadow-xl border border-gray-100 rounded-xl z-[9999] overflow-visible max-h-none ${isOpen ? 'block' : 'hidden'}`
                }
            >
                {!isSidebarOpen && (
                    <div className="p-3 text-sm font-bold text-gray-800 border-b border-gray-100 mb-1">
                        {title}
                    </div>
                )}
                <div
                    className="space-y-1"
                    style={{
                        paddingLeft: isSidebarOpen ? (level <= 1 ? level * 1.5 + "rem" : level - 0.5 + "rem") : "0.5rem",
                        paddingRight: isSidebarOpen ? "0" : "0.5rem",
                        paddingBottom: isSidebarOpen ? "0" : "0.5rem",
                    }}
                >
                    {children.map((subItem) => {
                        switch (subItem.type) {
                            case "link":
                                return (
                                    <SubNavLinkItem
                                        key={subItem.to}
                                        item={subItem}
                                        permissions={permissions}
                                        user={user}
                                        allLinkPaths={allLinkPaths}
                                    />
                                );
                            case "collapsible":
                                return (
                                    <CollapsibleNavItem
                                        key={subItem.id}
                                        item={subItem}
                                        isSidebarOpen={isSidebarOpen}
                                        openMenus={openMenus}
                                        activePath={activePath}
                                        onToggle={onToggle}
                                        level={level + 1}
                                        permissions={permissions}
                                        user={user}
                                        allLinkPaths={allLinkPaths}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Helper to find the full path of the active menu ---
const findActiveMenuPath = (
    items: NavItemType[],
    pathname: string
): string[] => {
    for (const item of items) {
        if (item.type === "collapsible") {
            if (
                item.children.some(
                    (child) => child.type === "link" && pathname.startsWith(child.to)
                )
            ) {
                return [item.id];
            }
            const pathInChild = findActiveMenuPath(item.children, pathname);
            if (pathInChild.length > 0) {
                return [item.id, ...pathInChild];
            }
        }
    }
    return [];
};

const findPathToId = (items: NavItemType[], targetId: string): string[] => {
    for (const item of items) {
        if (item.type === "collapsible") {
            // Check if the current item is the one we're looking for
            if (item.id === targetId) {
                return [item.id];
            }
            // If not, search in its children
            const pathInChild = findPathToId(item.children, targetId);
            // If found in a child, prepend the current item's ID to the path
            if (pathInChild.length > 0) {
                return [item.id, ...pathInChild];
            }
        }
    }
    // Return an empty array if not found
    return [];
};

// --- Main Sidebar Component ---
const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const { user } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector(
        (state: RootState) => state.systemSettings
    );
    const permissions = systemSettings?.permissions || [];


    const activePath = useMemo(
        () => findActiveMenuPath(navItems, pathname),
        [pathname]
    );
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
    const sidebarRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setOpenMenus({});
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        const newOpenState: Record<string, boolean> = {};
        activePath.forEach((id) => {
            newOpenState[id] = true;
        });
        setOpenMenus(newOpenState);
    }, [activePath]);

    const handleToggle = (id: string) => {
        setOpenMenus((prev) => {
            const isCurrentlyOpen = !!prev[id];

            // If the user is trying to CLOSE an already open menu...
            if (isCurrentlyOpen) {
                // Find the path to the item being closed.
                const path = findPathToId(navItems, id);
                // The new state will be its parent's path.
                const parentPath = path.slice(0, -1);
                const newOpenState: Record<string, boolean> = {};
                parentPath.forEach((pathId) => {
                    newOpenState[pathId] = true;
                });
                return newOpenState;
            }
            // If the user is trying to OPEN a menu...
            else {
                // Find the full path to the item.
                const pathToOpen = findPathToId(navItems, id);
                // The new state will be this exact path, closing all other menus.
                const newOpenState: Record<string, boolean> = {};
                pathToOpen.forEach((pathId) => {
                    newOpenState[pathId] = true;
                });
                return newOpenState;
            }
        });
    };

    const filterNavItems = useMemo(() => {
        function filter(items: NavItemType[]): NavItemType[] {
            return items
                .map((item) => {
                    if (item.type === "header") {
                        return item;
                    }

                    if (item.type === "collapsible") {
                        const visibleChildren = filter(item.children);
                        if (visibleChildren.length > 0) {
                            return { ...item, children: visibleChildren };
                        }
                        return null;
                    }
                    if (!canView(item.slug, permissions, user)) {
                        return null;
                    }
                    return item;
                })
                .filter(Boolean) as NavItemType[];
        }
        return filter(navItems);
    }, [permissions, user]);

    const allLinkPaths = useMemo(() => {
        const paths: string[] = [];
        const collect = (items: NavItemType[]) => {
            items.forEach((item) => {
                if (item.type === "link") {
                    paths.push(item.to);
                } else if (item.type === "collapsible") {
                    collect(item.children);
                }
            });
        };
        collect(filterNavItems);
        return paths;
    }, [filterNavItems]);

    return (
        <aside
            ref={sidebarRef}
            className={`bg-gray-50 text-gray-950 flex flex-col transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${isOpen ? "w-60" : "w-16"
                }`}
        >
            <div className="p-4 flex items-center h-12">
                {(() => {
                    const logoSrc =
                        resolveAssetUrl(systemSettings?.company?.favicon) ||
                        resolveAssetUrl(systemSettings?.company?.siteLogo) ||
                        logoImage;
                    return (
                        <img
                            src={logoSrc}
                            alt="Logo"
                            className={`h-6 w-6 ${isOpen ? "hidden" : ""}`}
                        />
                    );
                })()}
                <span
                    onClick={() => navigate("/admin/dashboard")}
                    className={`text-xl font-medium ml-2 text-gray-950 transition-opacity duration-200 whitespace-nowrap cursor-pointer ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                >
                    <img
                        src={
                            resolveAssetUrl(systemSettings?.company?.siteLogo) ||
                            resolveAssetUrl(systemSettings?.company?.favicon) ||
                            logoImage
                        }
                        alt="Logo"
                        className="w-32"
                    />
                </span>
            </div>
            <nav className={`flex-1 px-3 py-2 ${isOpen ? "overflow-y-auto" : "overflow-visible"}`}>
                {filterNavItems.map((item, index) => {
                    switch (item.type) {
                        case "header":
                            return (
                                <p
                                    key={index}
                                    className={`${index > 0 ? "mt-4 pt-2" : ""
                                        } mb-1 text-xs font-medium text-gray-400 uppercase ${index > 0 ? "border-t border-gray-200" : ""
                                        } tracking-wider transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100" : "hidden"
                                        }`}
                                >
                                    {item.title}
                                </p>
                            );
                        case "link":
                            return (
                                <NavItem
                                    key={item.to}
                                    item={item}
                                    isSidebarOpen={isOpen}
                                    permissions={permissions}
                                    user={user}
                                    allLinkPaths={allLinkPaths}
                                />
                            );
                        case "collapsible":
                            return (
                                <CollapsibleNavItem
                                    key={item.id}
                                    item={item}
                                    isSidebarOpen={isOpen}
                                    openMenus={openMenus}
                                    activePath={activePath}
                                    onToggle={handleToggle}
                                    level={1}
                                    permissions={permissions}
                                    user={user}
                                    allLinkPaths={allLinkPaths}
                                />
                            );
                        default:
                            return null;
                    }
                })}
            </nav>
            {isOpen && <BottomBar />}
        </aside>
    );
};

export default Sidebar;
