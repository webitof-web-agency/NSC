import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import Constants from "@constants/api";

interface SetupStatus {
    new_register: boolean;
    company_settings: boolean;
}

interface SetupContextProps {
    status: SetupStatus;
    setStatus: (status: SetupStatus) => void;
    isLoading: boolean;
}

const SetupStatusContext = createContext<SetupContextProps | undefined>(undefined);

// Live backend URL — injected by Vite at build time from .env
const LIVE_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://server.nareshsareecollection.com';
const LIVE_VERSION_URL = `${LIVE_BASE_URL}/api/admin/app-version`;

/**
 * fetchSetupStatus — Self-detecting online/offline, no race conditions.
 *
 * Browser:  calls Constants.APP_VERSION_URL (standard flow, unchanged)
 * Electron: tries live backend with 3s timeout
 *             responds  -> ONLINE  -> returns live backend result (Login page)
 *             times out -> OFFLINE -> falls back to local backend
 *
 * Eliminates all race conditions with NetworkMonitor / ElectronStatusBar timing.
 */
async function fetchSetupStatus(): Promise<SetupStatus> {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    if (!isElectron) {
        const res = await axios.get(Constants.APP_VERSION_URL, { timeout: 10000 });
        return res.data.data;
    }

    // Electron: try live backend first (3s timeout)
    try {
        console.log('[SetupStatus] Trying live backend ->', LIVE_VERSION_URL);
        const res = await axios.get(LIVE_VERSION_URL, { timeout: 3000 });
        console.log('[SetupStatus] Live backend OK -> ONLINE');
        return res.data.data;
    } catch {
        console.log('[SetupStatus] Live backend unreachable -> OFFLINE, using local backend');
    }

    // Fallback: local backend (offline mode)
    const localPort = (window as any).__electronLocalBackendPort || 3002;
    const localUrl = `http://localhost:${localPort}/api/admin/app-version`;
    console.log('[SetupStatus] Calling local backend ->', localUrl);
    const res = await axios.get(localUrl, { timeout: 5000 });
    return res.data.data;
}

export const SetupStatusProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStatus = async () => {
            try {
                const stored = sessionStorage.getItem("setupStatus");
                if (stored) {
                    setStatus(JSON.parse(stored));
                } else {
                    const data = await fetchSetupStatus();
                    setStatus(data);
                    sessionStorage.setItem("setupStatus", JSON.stringify(data));
                }
            } catch (e) {
                console.error("[SetupStatus] Failed to load setup status:", e);
                setStatus({ new_register: true, company_settings: true });
            } finally {
                setIsLoading(false);
            }
        };
        loadStatus();
    }, []);

    useEffect(() => {
        if (status) sessionStorage.setItem("setupStatus", JSON.stringify(status));
    }, [status]);

    return (
        <SetupStatusContext.Provider
            value={{
                status: status || { new_register: true, company_settings: true },
                setStatus: (s) => setStatus(s),
                isLoading,
            }}
        >
            {children}
        </SetupStatusContext.Provider>
    );
};

export const useSetupStatus = () => {
    const context = useContext(SetupStatusContext);
    if (!context) throw new Error("useSetupStatus must be used within SetupStatusProvider");
    return context;
};
