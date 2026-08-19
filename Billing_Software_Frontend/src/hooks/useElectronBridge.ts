// src/hooks/useElectronBridge.ts
// Hook to interact with Electron's IPC bridge from React components
// Returns null for all values when running in a regular browser (non-Electron environment)

import { useState, useEffect, useCallback } from 'react';

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

export interface ElectronBridgeResult {
  /** Whether the app is running inside Electron */
  isElectron: boolean;
  /** Current network status */
  networkStatus: NetworkStatus;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Manually trigger a sync with Atlas */
  triggerSync: () => Promise<void>;
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

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true, // Assume online until first check
    mode: 'online',
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
      setNetworkStatus(status);
    });

    // Get local backend port
    electronAPI().getLocalBackendPort().then((port: number) => {
      setLocalBackendPort(port);
    });

    // Get initial sync status
    electronAPI().getSyncStatus().then((status: SyncStatus) => {
      setSyncStatus(status);
    });

    // Subscribe to IPC network changes
    const unsubNetwork = electronAPI().onNetworkChange((status: NetworkStatus) => {
      setNetworkStatus(status);
    });

    // Native browser window events for instant offline response
    const handleBrowserOffline = () => {
      setNetworkStatus({ isOnline: false, mode: 'offline', checkedAt: new Date().toISOString() });
    };
    const handleBrowserOnline = () => {
      electronAPI().getConnectionMode().then((status: NetworkStatus) => {
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

  const triggerSync = useCallback(async () => {
    if (!isElectron) return;
    await electronAPI().triggerSync();
  }, [isElectron]);

  return {
    isElectron,
    networkStatus,
    syncStatus,
    triggerSync,
    localBackendPort,
  };
}
