/// <reference types="vite/client" />

interface ElectronBridgeAPI {
  isElectron: true;
  platform: string;
  triggerSync: () => Promise<unknown>;
  getConnectionMode: () => Promise<unknown>;
  getSyncStatus: () => Promise<unknown>;
  getLocalBackendPort: () => Promise<number>;
  printPage: () => Promise<unknown>;
  onNetworkChange: (callback: (status: unknown) => void) => () => void;
  onSyncStatus: (callback: (status: unknown) => void) => () => void;
}

interface Window {
  electronAPI?: ElectronBridgeAPI;
  __electronConnectionMode?: 'online' | 'offline';
  __electronLocalBackendPort?: number;
}
