// src/utils/apiBaseUrl.ts
// Dynamic API base URL for browser and local-first Electron runtimes.

const LIVE_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://server.nareshsareecollection.com';

/**
 * Returns the correct API base URL for the current context:
 * - Browser (web):      uses VITE_API_BASE_URL from environment (live backend)
 * - Electron:           always uses the embedded local backend (localhost:3002)
 *
 * Electron synchronizes the local database with the cloud in the background. Keeping
 * one API target prevents online/offline transitions from exposing two independent
 * databases to the user.
 */
export function getApiBaseUrl(): string {
  const envUrl = LIVE_BASE_URL;

  // Not in Electron → always use live remote URL
  if (typeof window === 'undefined' || !window.electronAPI) {
    return envUrl;
  }

  const port = window.__electronLocalBackendPort || 3002;
  const localUrl = `http://localhost:${port}`;
  return localUrl;
}

/**
 * Updates the cached connection mode. Called by ElectronStatusBar when network changes.
 * Dispatches a custom window event when mode changes so active pages refetch data.
 */
export function setElectronConnectionMode(mode: 'online' | 'offline', port?: number): void {
  if (typeof window !== 'undefined') {
    const prevMode = window.__electronConnectionMode;
    window.__electronConnectionMode = mode;
    if (port) {
      window.__electronLocalBackendPort = port;
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
  if (typeof window === 'undefined' || !window.electronAPI) return false;
  return window.__electronConnectionMode !== 'online';
}
