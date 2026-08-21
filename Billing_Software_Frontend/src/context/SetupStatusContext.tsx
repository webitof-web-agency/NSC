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
 * Browser uses the configured live API. Electron is local-first and therefore
 * reads setup status from the embedded backend in both online and offline modes.
 */
async function fetchSetupStatus(): Promise<SetupStatus> {
    const res = await axios.get(Constants.APP_VERSION_URL, { timeout: 10000 });
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
