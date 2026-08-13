// electron/preload.js
// Preload script: Secure bridge between Electron main and React renderer
// Runs in a special context with access to both Node and browser APIs
// exposes ONLY what the renderer needs via contextBridge

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─────────────────────────────────────────────
// Expose safe APIs to the renderer (React app) under window.electronAPI
// ─────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Network Status ──────────────────────────
  // Subscribe to network change events
  // callback receives: { isOnline: boolean, mode: 'online'|'offline' }
  onNetworkChange: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('network:status', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('network:status', handler);
  },

  // Get the current connection mode synchronously
  getConnectionMode: () => ipcRenderer.invoke('get:connection-mode'),

  // ── Sync Status ─────────────────────────────
  // Subscribe to sync progress events
  // callback receives: { state: 'idle'|'syncing'|'done'|'error', pending: number, synced: number, total: number, error?: string }
  onSyncStatus: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('sync:status', handler);
    return () => ipcRenderer.removeListener('sync:status', handler);
  },

  // Get current sync status
  getSyncStatus: () => ipcRenderer.invoke('get:sync-status'),

  // Manually trigger a sync (e.g., user clicks "Sync Now" button)
  triggerSync: () => ipcRenderer.invoke('trigger:sync'),

  // ── App Info ──────────────────────────────── 
  // Get local backend port so renderer can build API URLs
  getLocalBackendPort: () => ipcRenderer.invoke('get:local-backend-port'),

  // ── Print ─────────────────────────────────── 
  printPage: () => ipcRenderer.invoke('print:page'),

  // ── Platform Info ─────────────────────────── 
  platform: process.platform,
  isElectron: true,
});
