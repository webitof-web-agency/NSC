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
 * Fetches setup status from current API URL (cloud if online, local if offline).
 */
async function fetchSetupStatus(): Promise<SetupStatus> {
    const res = await axios.get(Constants.APP_VERSION_URL, { timeout: 10000 });
    return res.data.data;
}

export const SetupStatusProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadStatus = async (forceRefresh = false) => {
        try {
            const stored = sessionStorage.getItem("setupStatus");
            if (stored && !forceRefresh) {
                setStatus(JSON.parse(stored));
            } else {
                const data = await fetchSetupStatus();
                setStatus(data);
                sessionStorage.setItem("setupStatus", JSON.stringify(data));
            }
        } catch (e) {
            console.error("[SetupStatus] Failed to load setup status:", e);
            // Default to false for both so offline/error mode does not force registration
            const fallback = { new_register: false, company_settings: false };
            setStatus(fallback);
            sessionStorage.setItem("setupStatus", JSON.stringify(fallback));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();

        // Listen for mode changes in Electron so setup status is refreshed
        const handleModeChange = () => {
            console.log("[SetupStatus] Mode changed, refreshing setup status from current target...");
            loadStatus(true);
        };

        window.addEventListener("electron:mode-change", handleModeChange);
        return () => {
            window.removeEventListener("electron:mode-change", handleModeChange);
        };
    }, []);

    useEffect(() => {
        if (status) sessionStorage.setItem("setupStatus", JSON.stringify(status));
    }, [status]);

    return (
        <SetupStatusContext.Provider
            value={{
                status: status || { new_register: false, company_settings: false },
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
