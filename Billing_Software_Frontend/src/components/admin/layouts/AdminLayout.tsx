import Header from '../layouts/AdminHeader';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ProductSidebar from '../ProductSidebar';
import SidebarToggleButton from '../SidebarToggleButton';

interface AdminLayoutProps {
  children?: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    const saved = localStorage.getItem("sidebar-open");
    return saved ? JSON.parse(saved) : false;
  });
  const [isProductSidebarOpen, setIsProductSidebarOpen] = useState<boolean>(false);

  // On smaller screens, the sidebar should be closed by default.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Automatically close sidebar on small screens when route changes
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  // Only persist sidebar open state on desktop screens
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      localStorage.setItem("sidebar-open", JSON.stringify(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
  const layoutHeightClass = isElectron ? "h-[calc(100vh-32px)]" : "h-screen";

  const [contentKey, setContentKey] = useState<number>(0);

  useEffect(() => {
    const handleModeChange = () => {
      // Remount the active page to trigger fresh API requests to the newly active backend
      setContentKey(k => k + 1);
    };
    window.addEventListener("electron:mode-change", handleModeChange);
    return () => window.removeEventListener("electron:mode-change", handleModeChange);
  }, []);

  return (
    <>
      {/* ElectronStatusBar is rendered once at root level in App.tsx — NOT here */}
      <div className={`flex bg-white font-sans ${layoutHeightClass}`}>

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header toggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
          <main
            key={contentKey}
            onClick={() => {
              if (window.innerWidth < 768 && isSidebarOpen) {
                setIsSidebarOpen(false);
              }
            }}
            className="flex-1 overflow-x-hidden overflow-y-auto bg-white-50 p-2.5 sm:p-4"
          >
            {children || <Outlet />}
          </main>
        </div>

        {/* Product Sidebar Components */}
        <SidebarToggleButton onClick={() => setIsProductSidebarOpen(true)} />
        <ProductSidebar
          isOpen={isProductSidebarOpen}
          onClose={() => setIsProductSidebarOpen(false)}
        />
      </div>
    </>
  );
};

export default AdminLayout;
