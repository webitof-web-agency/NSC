// src/utils/apiBaseUrl.ts
// Dynamic API base URL: switches between remote Atlas backend and local offline backend
// depending on whether the app is running in Electron and whether it is online or offline.

const LIVE_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://server.nareshsareecollection.com';

/**
 * Returns the correct API base URL for the current context:
 * - Browser (web):      uses VITE_API_BASE_URL from environment (live backend)
 * - Electron + ONLINE:  uses live backend  (server.nareshsareecollection.com)
 * - Electron + OFFLINE: uses local backend (localhost:3002)
 *
 * Connection mode is set by ElectronStatusBar via setElectronConnectionMode().
 * Defaults to offline (safe fallback) if mode is not yet known.
 */
export function getApiBaseUrl(): string {
  const envUrl = LIVE_BASE_URL;

  // Not in Electron → always use live remote URL
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    return envUrl;
  }

  const mode = (window as any).__electronConnectionMode;
  const port = (window as any).__electronLocalBackendPort || 3002;
  const localUrl = `http://localhost:${port}`;

  if (mode === 'online') {
    return envUrl;   // Online: call live Atlas backend
  }

  // Offline or unknown: use local backend
  return localUrl;
}

/**
 * Updates the cached connection mode. Called by ElectronStatusBar when network changes.
 * Dispatches a custom window event when mode changes so active pages refetch data.
 */
export function setElectronConnectionMode(mode: 'online' | 'offline', port?: number): void {
  if (typeof window !== 'undefined') {
    const prevMode = (window as any).__electronConnectionMode;
    (window as any).__electronConnectionMode = mode;
    if (port) {
      (window as any).__electronLocalBackendPort = port;
    }

    if (prevMode && prevMode !== mode) {
      console.log(`🔄 [Connection Router] Switched: ${prevMode} → ${mode}`);
      window.dispatchEvent(new CustomEvent('electron:mode-change', { detail: { prevMode, mode } }));
    }
  }
}

/**
 * Whether the app is currently in offline mode.
 */
export function isOfflineMode(): boolean {
  if (typeof window === 'undefined' || !(window as any).electronAPI) return false;
  return (window as any).__electronConnectionMode !== 'online';
}
