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

/**
 * Waits for ElectronStatusBar to set window.__electronConnectionMode (set via IPC),
 * then returns the correct app-version URL:
 *   - online  → live backend (https://server.nareshsareecollection.com)
 *   - offline → local backend (http://localhost:3002)
 *
 * We poll for up to 2 seconds because ElectronStatusBar calls getConnectionMode()
 * asynchronously and may not have resolved by the time this runs on mount.
 * If the mode never arrives (e.g. non-Electron browser), we fall back to the
 * standard Constants URL.
 */
async function getAppVersionUrl(): Promise<string> {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
    if (!isElectron) {
        return Constants.APP_VERSION_URL;
    }

    const localPort = (window as any).__electronLocalBackendPort || 3002;
    const localUrl  = `http://localhost:${localPort}/api/admin/app-version`;
    const liveUrl   = Constants.APP_VERSION_URL; // uses live backend base URL

    // Poll for __electronConnectionMode — set by ElectronStatusBar after IPC resolves
    const maxWaitMs = 2000;
    const intervalMs = 100;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
        const mode = (window as any).__electronConnectionMode;
        if (mode === 'online') {
            console.log('[SetupStatus] Mode=online → using live backend');
            return liveUrl;
        }
        if (mode === 'offline') {
            console.log('[SetupStatus] Mode=offline → using local backend');
            return localUrl;
        }
        // Not set yet — wait and retry
        await new Promise(res => setTimeout(res, intervalMs));
        elapsed += intervalMs;
    }

    // Timeout: default to local backend (safe fallback — avoids broken live call)
    console.warn('[SetupStatus] Timed out waiting for connection mode — falling back to local backend');
    return localUrl;
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
                    const url = await getAppVersionUrl();
                    console.log('[SetupStatus] Checking setup at:', url);
                    const response = await axios.get(url);
                    setStatus(response.data.data);
                    sessionStorage.setItem("setupStatus", JSON.stringify(response.data.data));
                }
            } catch (e) {
                console.error("Failed to load setup status", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadStatus();
    }, []);

    // Keep sessionStorage synced with state
    useEffect(() => {
        if (status) sessionStorage.setItem("setupStatus", JSON.stringify(status));
    }, [status]);

    return (
        <SetupStatusContext.Provider value={{ status: status || { new_register: true, company_settings: true }, setStatus: status => setStatus(status), isLoading }}>
            {children}
        </SetupStatusContext.Provider>
    );
};

export const useSetupStatus = () => {
    const context = useContext(SetupStatusContext);
    if (!context) throw new Error("useSetupStatus must be used within SetupStatusProvider");
    return context;
};
