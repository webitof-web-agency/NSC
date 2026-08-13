// src/components/ElectronStatusBar.tsx
// Shows online/offline status and sync progress at the top of the app
// Only renders inside Electron — invisible in browser

import React, { useEffect, useRef } from 'react';
import { useElectronBridge } from '@hooks/useElectronBridge';
import { setElectronConnectionMode } from '@utils/apiBaseUrl';

const ElectronStatusBar: React.FC = () => {
  const { isElectron, networkStatus, syncStatus, triggerSync, localBackendPort } = useElectronBridge();
  const prevModeRef = useRef<string | null>(null);

  // Update window-cached mode whenever network status changes
  useEffect(() => {
    if (!isElectron) return;
    setElectronConnectionMode(networkStatus.mode, localBackendPort ?? 3002);
  }, [isElectron, networkStatus.mode, localBackendPort]);

  // Log mode transitions
  useEffect(() => {
    if (!isElectron) return;
    if (prevModeRef.current !== null && prevModeRef.current !== networkStatus.mode) {
      console.log(`[ElectronStatusBar] Mode: ${prevModeRef.current} → ${networkStatus.mode}`);
    }
    prevModeRef.current = networkStatus.mode;
  }, [isElectron, networkStatus.mode]);

  // Adjust app layout so it pushes down below the status bar
  useEffect(() => {
    if (!isElectron) return;
    document.body.classList.add('electron-mode');
    return () => {
      document.body.classList.remove('electron-mode');
    };
  }, [isElectron]);

  // Don't render in browser
  if (!isElectron) return null;

  const isOnline = networkStatus.isOnline;
  const isSyncing = syncStatus.state === 'syncing';
  const hasPending = syncStatus.pending > 0 || (!isOnline && syncStatus.total > 0);
  const syncDone = syncStatus.state === 'done';
  const syncError = syncStatus.state === 'error';

  return (
    <div id="electron-status-bar" className="w-full flex-shrink-0 h-8 flex items-center gap-4 px-3 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-indigo-500/30 shadow-lg shadow-black/40 select-none text-[11px] font-sans">

      {/* ── Connection Mode Badge ── */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-semibold text-[10px] tracking-wide ${
          isOnline
            ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
            : 'bg-slate-500/10 border-slate-500/40 text-slate-400'
        }`}
      >
        {/* Glowing dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isOnline
              ? 'bg-blue-400 shadow-[0_0_4px_#60a5fa]'
              : 'bg-slate-400 shadow-[0_0_4px_#94a3b8]'
          }`}
        />
        <span>{isOnline ? '☁️ Cloud Connected' : '📴 Offline'}</span>
      </div>

      {/* ── Sync Status Section ── */}
      <div className="flex-1 flex items-center">

        {/* Syncing in progress */}
        {isSyncing && (
          <div className="flex items-center gap-1.5">
            <span className="text-indigo-400 text-xs animate-spin inline-block">⟳</span>
            <span className="text-slate-400 text-[10px]">
              Syncing {syncStatus.collection ? `${syncStatus.collection}...` : '...'}
              {syncStatus.total > 0 && (
                <span className="text-indigo-400 ml-1">
                  ({syncStatus.synced}/{syncStatus.total})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Pending records — online, waiting */}
        {!isSyncing && hasPending && isOnline && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-[8px]">●</span>
            <span className="text-slate-400 text-[10px]">
              {syncStatus.pending} record{syncStatus.pending !== 1 ? 's' : ''} pending sync
            </span>
            <button
              onClick={triggerSync}
              className="ml-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-300 border border-indigo-600 rounded px-1.5 py-px text-[9px] font-semibold cursor-pointer transition-colors"
            >
              Sync Now
            </button>
          </div>
        )}

        {/* Pending records — offline */}
        {!isSyncing && !isOnline && hasPending && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-[10px]">⚠</span>
            <span className="text-slate-400 text-[10px]">
              {syncStatus.total || '?'} record{syncStatus.total !== 1 ? 's' : ''} will sync when online
            </span>
          </div>
        )}

        {/* Sync done */}
        {syncDone && !hasPending && syncStatus.synced > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-green-400 text-[10px]">✓</span>
            <span className="text-green-400 text-[10px]">
              All synced • {syncStatus.synced} record{syncStatus.synced !== 1 ? 's' : ''}
              {syncStatus.lastSync && (
                <span className="text-slate-500 ml-1">
                  • {new Date(syncStatus.lastSync).toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Sync error */}
        {syncError && (
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 text-[10px]">✗</span>
            <span className="text-red-400 text-[10px]">
              Sync error: {syncStatus.error || 'Unknown error'}
            </span>
            <button
              onClick={triggerSync}
              className="ml-1 bg-red-900/60 hover:bg-red-800/70 text-red-300 border border-red-700 rounded px-1.5 py-px text-[9px] font-semibold cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── App Label ── */}
      <span className="text-slate-600 text-[9px] font-medium tracking-widest uppercase">
        NSC Desktop
      </span>

    </div>
  );
};

export default ElectronStatusBar;
