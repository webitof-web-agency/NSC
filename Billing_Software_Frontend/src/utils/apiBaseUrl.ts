// src/utils/apiBaseUrl.ts
// Dynamic API base URL: switches between remote Atlas backend and local offline backend
// depending on whether the app is running in Electron or Browser.
// In Electron, we now ALWAYS use the local backend (Local-First architecture).

/**
 * Returns the correct API base URL for the current context:
 * - Browser (web): uses VITE_API_BASE_URL from environment
 * - Electron: ALWAYS uses local backend on localhost:3002 (Local-First)
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  // Not in Electron → use remote URL
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    return envUrl;
  }

  // In Electron → ALWAYS use local backend
  const port = (window as any).__electronLocalBackendPort || 3002;
  const resolvedUrl = `http://localhost:${port}`;

  // Only log if the window exists to avoid terminal spam
  if (typeof window !== 'undefined' && !(window as any).__urlLogged) {
    console.log(`🔌 [API Router] Connecting to LOCAL FIRST: ${resolvedUrl}`);
    (window as any).__urlLogged = true;
  }

  return resolvedUrl;
}

/**
 * Updates the cached connection mode. Called by ElectronStatusBar when network changes.
 * Network mode now only affects the sync engine, not the app's API routing.
 */
export function setElectronConnectionMode(mode: 'online' | 'offline', port?: number): void {
  if (typeof window !== 'undefined') {
    (window as any).__electronConnectionMode = mode;
    if (port) {
      (window as any).__electronLocalBackendPort = port;
    }
  }
}

/**
 * Whether the sync engine is currently offline.
 */
export function isOfflineMode(): boolean {
  if (typeof window === 'undefined' || !(window as any).electronAPI) return false;
  return (window as any).__electronConnectionMode === 'offline';
}
