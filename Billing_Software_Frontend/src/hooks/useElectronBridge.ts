// src/hooks/useElectronBridge.ts
// Hook to interact with Electron's IPC bridge from React components
// Returns null for all values when running in a regular browser (non-Electron environment)

import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { setElectronConnectionMode } from '@utils/apiBaseUrl';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface NetworkStatus {
  isOnline: boolean;
  mode: 'online' | 'offline';
  checkedAt?: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'done' | 'error';
  pending: number;
  synced: number;
  total: number;
  lastSync: string | null;
  message?: string;
  error?: string;
  collection?: string;
}

export interface SyncLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string | null;
}

export interface SyncDiagnostics {
  logs: SyncLogEntry[];
  localBackendUrl: string;
  remoteBackendUrl: string;
  deviceId: string;
  hasToken: boolean;
  tokenSnippet: string | null;
  cursor: string | null;
  state: string;
  lastSync: string | null;
}

export interface ElectronBridgeResult {
  /** Whether the app is running inside Electron */
  isElectron: boolean;
  /** Current network status */
  networkStatus: NetworkStatus;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Manually trigger a sync with Atlas */
  triggerSync: (customToken?: any) => Promise<void>;
  /** Get live sync diagnostic logs */
  getSyncLogs: () => Promise<SyncDiagnostics | null>;
  /** Open Chromium DevTools in Electron */
  openDevTools: () => Promise<void>;
  /** Local backend port (for offline API calls) */
  localBackendPort: number | null;
}

// ─────────────────────────────────────────────
// Detect Electron environment
// ─────────────────────────────────────────────
function isElectronEnv(): boolean {
  return typeof window !== 'undefined' &&
         typeof (window as any).electronAPI !== 'undefined' &&
         (window as any).electronAPI?.isElectron === true;
}

const electronAPI = () => (window as any).electronAPI;

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useElectronBridge(): ElectronBridgeResult {
  const isElectron = isElectronEnv();

  const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: initialOnline,
    mode: initialOnline ? 'online' : 'offline',
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    pending: 0,
    synced: 0,
    total: 0,
    lastSync: null,
  });

  const [localBackendPort, setLocalBackendPort] = useState<number | null>(null);

  useEffect(() => {
    if (!isElectron) return;

    // Get initial connection mode
    electronAPI().getConnectionMode().then((status: NetworkStatus) => {
      setElectronConnectionMode(status.mode, (window as any).__electronLocalBackendPort ?? 3002);
      setNetworkStatus(status);
    });

    // Get local backend port
    electronAPI().getLocalBackendPort().then((port: number) => {
      setLocalBackendPort(port);
      if (typeof window !== 'undefined') {
        (window as any).__electronLocalBackendPort = port;
      }
    });

    // Get initial sync status
    electronAPI().getSyncStatus().then((status: SyncStatus) => {
      setSyncStatus(status);
    });

    // Subscribe to IPC network changes
    const unsubNetwork = electronAPI().onNetworkChange((status: NetworkStatus) => {
      setElectronConnectionMode(status.mode, (window as any).__electronLocalBackendPort ?? 3002);
      setNetworkStatus(status);
    });

    // Native browser window events for instant offline response
    const handleBrowserOffline = () => {
      setElectronConnectionMode('offline', (window as any).__electronLocalBackendPort ?? 3002);
      setNetworkStatus({ isOnline: false, mode: 'offline', checkedAt: new Date().toISOString() });
    };
    const handleBrowserOnline = () => {
      electronAPI().getConnectionMode().then((status: NetworkStatus) => {
        setElectronConnectionMode(status.mode, (window as any).__electronLocalBackendPort ?? 3002);
        setNetworkStatus(status);
      });
    };

    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    // Subscribe to sync progress
    const unsubSync = electronAPI().onSyncStatus((progress: SyncStatus) => {
      setSyncStatus(progress);
    });

    return () => {
      if (typeof unsubNetwork === 'function') unsubNetwork();
      if (typeof unsubSync === 'function') unsubSync();
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
    };
  }, [isElectron]);

  const triggerSync = useCallback(async (customToken?: any) => {
    if (!isElectron) return;
    try {
      let token: string | null = null;
      if (typeof customToken === 'string' && customToken.trim().length > 10) {
        token = customToken.trim();
      } else {
        token = Cookies.get('authToken') || null;
      }
      if (!token && typeof localStorage !== 'undefined') {
        token = localStorage.getItem('authToken') || null;
      }
      await electronAPI().triggerSync(token);
    } catch (err) {
      console.warn('[useElectronBridge] triggerSync error:', err);
    }
  }, [isElectron]);

  const getSyncLogs = useCallback(async (): Promise<SyncDiagnostics | null> => {
    if (!isElectron || typeof electronAPI().getSyncLogs !== 'function') return null;
    try {
      return await electronAPI().getSyncLogs();
    } catch (err) {
      console.warn('[useElectronBridge] getSyncLogs error:', err);
      return null;
    }
  }, [isElectron]);

  const openDevTools = useCallback(async () => {
    if (!isElectron || typeof electronAPI().openDevTools !== 'function') return;
    try {
      await electronAPI().openDevTools();
    } catch (err) {
      console.warn('[useElectronBridge] openDevTools error:', err);
    }
  }, [isElectron]);

  return {
    isElectron,
    networkStatus,
    syncStatus,
    triggerSync,
    getSyncLogs,
    openDevTools,
    localBackendPort,
  };
}
