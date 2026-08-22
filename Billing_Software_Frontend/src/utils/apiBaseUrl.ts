// src/utils/apiBaseUrl.ts
// Dynamic API base URL for browser and local-first Electron runtimes.

const LIVE_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://server.nareshsareecollection.com';

/**
 * Returns the correct API base URL for the current context:
 *
 * - Browser (web):       always uses VITE_API_BASE_URL (live backend)
 * - Electron — online:  talks directly to the live cloud backend
 * - Electron — offline: uses the embedded local backend (localhost:3002)
 *
 * The window.__electronConnectionMode cache is set by setElectronConnectionMode()
 * which is called as soon as the IPC connection-mode is known (useElectronBridge)
 * and on every subsequent network change (ElectronStatusBar).
 */
export function getApiBaseUrl(): string {
  // Not in Electron → always use live remote URL
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    return LIVE_BASE_URL;
  }

  const mode = (window as any).__electronConnectionMode as string | undefined;

  // Explicitly offline
  if (mode === 'offline') {
    const port = (window as any).__electronLocalBackendPort || 3002;
    return `http://localhost:${port}`;
  }

  // Explicitly online
  if (mode === 'online') {
    return LIVE_BASE_URL;
  }

  // Mode not yet determined from IPC: check browser navigator.onLine
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const port = (window as any).__electronLocalBackendPort || 3002;
    return `http://localhost:${port}`;
  }

  // Default to live cloud backend
  return LIVE_BASE_URL;
}

/**
 * Always returns the local backend URL regardless of mode.
 * Use for calls that must always go to the local backend
 * (e.g. syncing the auth token, local health checks).
 */
export function getLocalBackendUrl(): string {
  const port = (typeof window !== 'undefined' && (window as any).__electronLocalBackendPort) || 3002;
  return `http://localhost:${port}`;
}

/**
 * Updates the cached connection mode. Called immediately when the IPC
 * connection-mode resolves (useElectronBridge) and on every network change
 * (ElectronStatusBar). Dispatches a custom event so active pages refetch data.
 */
export function setElectronConnectionMode(mode: 'online' | 'offline', port?: number): void {
  if (typeof window !== 'undefined') {
    const prevMode = (window as any).__electronConnectionMode as string | undefined;
    (window as any).__electronConnectionMode = mode;
    if (port) {
      (window as any).__electronLocalBackendPort = port;
    }

    if (prevMode !== undefined && prevMode !== mode) {
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
  const mode = (window as any).__electronConnectionMode as string | undefined;
  if (mode === 'offline') return true;
  if (mode === 'online') return false;
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
