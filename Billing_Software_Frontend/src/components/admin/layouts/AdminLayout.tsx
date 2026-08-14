import Header from '../layouts/AdminHeader';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ProductSidebar from '../ProductSidebar';
import SidebarToggleButton from '../SidebarToggleButton';
import ElectronStatusBar from '../../ElectronStatusBar';

interface AdminLayoutProps {
  children?: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
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
    // don't force handleResize() on load if we want to respect localStorage for desktop,
    // but we still want to force close on mobile load
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-open", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
  const layoutHeightClass = isElectron ? "h-[calc(100vh-32px)]" : "h-screen";

  return (
    <>
      <ElectronStatusBar />
      <div className={`flex bg-white font-sans ${layoutHeightClass}`}>
        <Sidebar isOpen={isSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header toggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white-50 p-4">
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
