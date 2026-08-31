// src/components/ElectronStatusBar.tsx
// Shows online/offline status and sync progress at the top of the app
// Provides an interactive "Inspect" diagnostic modal to view all sync events and errors in real-time

import React, { useEffect, useRef, useState } from 'react';
import { useElectronBridge, type SyncDiagnostics } from '@hooks/useElectronBridge';
import { setElectronConnectionMode } from '@utils/apiBaseUrl';

const ElectronStatusBar: React.FC = () => {
  const {
    isElectron,
    networkStatus,
    syncStatus,
    triggerSync,
    syncOfflineData,
    getSyncLogs,
    openDevTools,
    localBackendPort
  } = useElectronBridge();

  const prevModeRef = useRef<string | null>(null);
  const [showInspect, setShowInspect] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPushingOffline, setIsPushingOffline] = useState<boolean>(false);

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

  const loadLogs = async () => {
    const data = await getSyncLogs();
    if (data) setDiagnostics(data);
  };

  const handleToggleInspect = () => {
    const nextState = !showInspect;
    setShowInspect(nextState);
    if (nextState) {
      loadLogs();
    }
  };

  const handleCopyLogs = () => {
    if (!diagnostics) return;
    const text = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSyncOfflineData = async () => {
    if (isPushingOffline || syncStatus.state === 'syncing') return;
    try {
      setIsPushingOffline(true);
      await syncOfflineData();
    } finally {
      setIsPushingOffline(false);
    }
  };

  // Don't render in browser
  if (!isElectron) return null;

  const isOnline = networkStatus.isOnline;
  const isSyncing = syncStatus.state === 'syncing';
  const hasPending = syncStatus.pending > 0 || (!isOnline && syncStatus.total > 0);
  const syncDone = syncStatus.state === 'done';
  const syncError = syncStatus.state === 'error';

  return (
    <>
      <div id="electron-status-bar" className="w-full flex-shrink-0 h-8 flex items-center justify-between px-3 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-indigo-500/30 shadow-lg select-none text-[11px] font-sans z-50">

        <div className="flex items-center gap-3">
          {/* ── Connection Mode Badge ── */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-semibold text-[10px] tracking-wide ${
              isOnline
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                : 'bg-slate-500/10 border-slate-500/40 text-slate-400'
            }`}
          >
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
          <div className="flex items-center gap-2">
            {/* Syncing in progress */}
            {isSyncing && (
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-400 text-xs animate-spin inline-block">⟳</span>
                <span className="text-slate-300 text-[10px]">
                  Syncing {syncStatus.collection ? `${syncStatus.collection}...` : (syncStatus.message || '...')}
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
                <span className="text-slate-300 text-[10px]">
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
                <span className="text-slate-300 text-[10px]">
                  {syncStatus.total || '?'} record{syncStatus.total !== 1 ? 's' : ''} will sync when online
                </span>
              </div>
            )}

            {/* Sync done / Idle state */}
            {!isSyncing && !hasPending && !syncError && (
              <div className="flex items-center gap-1.5">
                {syncDone && (
                  <span className="text-emerald-400 text-[10px] font-medium">
                    ✓ All synced {syncStatus.synced > 0 ? `• ${syncStatus.synced} records` : ''}
                    {syncStatus.lastSync && (
                      <span className="text-slate-400 ml-1">
                        • {new Date(syncStatus.lastSync).toLocaleTimeString()}
                      </span>
                    )}
                  </span>
                )}
                {!syncDone && (
                  <span className="text-slate-300 text-[10px]">
                    {syncStatus.message || 'Offline database active'}
                  </span>
                )}
                {isOnline && (
                  <button
                    onClick={triggerSync}
                    className="ml-1 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 rounded px-2 py-0.5 text-[9px] font-semibold cursor-pointer transition-colors"
                  >
                    Sync Now
                  </button>
                )}
              </div>
            )}

            {/* Sync error */}
            {syncError && (
              <div className="flex items-center gap-1.5">
                <span className="text-rose-400 text-[10px]">✗</span>
                <span className="text-rose-300 text-[10px] font-medium">
                  Sync: {syncStatus.error || 'Operation failed'}
                </span>
                <button
                  onClick={triggerSync}
                  className="ml-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded px-2 py-0.5 text-[9px] font-semibold cursor-pointer transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ── Inspect Button ── */}
            <button
              onClick={handleToggleInspect}
              title="View live sync diagnostics & logs"
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-medium border cursor-pointer transition-all ${
                showInspect
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-600'
              }`}
            >
              <span>🔍 Inspect</span>
            </button>

            {/* ── Sync Offline Data Button (Manual Offline to Online Push) ── */}
            {isOnline && (
              <button
                onClick={handleSyncOfflineData}
                disabled={isSyncing || isPushingOffline}
                title="Manually push all offline created & modified data into Online DB"
                className="flex items-center gap-1 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-600 rounded px-2 py-0.5 text-[9px] font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <span>{isPushingOffline ? '⬆️ Syncing...' : '⬆️ Sync Offline Data'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── App Label ── */}
        <span className="text-slate-500 text-[9px] font-semibold tracking-wider uppercase">
          NSC Desktop
        </span>
      </div>

      {/* ── Live Inspect Diagnostics Dropdown Modal ── */}
      {showInspect && (
        <div className="fixed inset-x-4 top-10 z-[9999] max-w-4xl mx-auto bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 rounded-lg shadow-2xl overflow-hidden text-slate-200 text-xs font-sans animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-sm">🛠️</span>
              <span className="font-bold text-slate-100 text-[13px]">Sync Engine Diagnostics & Live Logs</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadLogs}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px] cursor-pointer"
              >
                🔄 Refresh
              </button>
              <button
                onClick={handleCopyLogs}
                className="px-2 py-1 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 rounded border border-indigo-700 text-[11px] cursor-pointer"
              >
                {copied ? '✓ Copied' : '📋 Copy Logs'}
              </button>
              <button
                onClick={openDevTools}
                className="px-2 py-1 bg-purple-900/70 hover:bg-purple-800 text-purple-200 rounded border border-purple-700 text-[11px] cursor-pointer"
              >
                ⚡ DevTools
              </button>
              <button
                onClick={() => setShowInspect(false)}
                className="px-2 py-1 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 rounded border border-slate-700 text-[11px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Diagnostics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-950/50 border-b border-slate-800 text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px]">Cloud Endpoint</div>
              <div className="font-semibold text-slate-200 truncate" title={diagnostics?.remoteBackendUrl || 'Loading...'}>
                {diagnostics?.remoteBackendUrl || 'https://server.nareshsareecollection.com'}
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px]">Local Backend</div>
              <div className="font-semibold text-emerald-400 truncate">
                {diagnostics?.localBackendUrl || 'http://localhost:3002'} (Port {localBackendPort || 3002})
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px]">Auth Token</div>
              <div className="font-semibold truncate">
                {diagnostics?.hasToken ? (
                  <span className="text-emerald-400">✓ Present ({diagnostics.tokenSnippet})</span>
                ) : (
                  <span className="text-rose-400">✗ Missing (Login Required)</span>
                )}
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px]">Sync Cursor</div>
              <div className="font-semibold text-slate-300 truncate" title={diagnostics?.cursor || 'None (Snapshot Required)'}>
                {diagnostics?.cursor || 'None (Initial Snapshot)'}
              </div>
            </div>
          </div>

          {/* Terminal / Log Output */}
          <div className="p-3 bg-slate-950 max-h-72 overflow-y-auto font-mono text-[11px] space-y-1.5">
            {(!diagnostics?.logs || diagnostics.logs.length === 0) && (
              <div className="text-slate-500 py-4 text-center">No sync logs recorded yet. Click "Sync Now" to start.</div>
            )}
            {diagnostics?.logs?.map((entry, idx) => (
              <div key={idx} className="flex flex-col gap-0.5 border-b border-slate-900 pb-1">
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 text-[10px] flex-shrink-0 select-none">[{entry.timestamp}]</span>
                  <span className={`font-bold text-[10px] flex-shrink-0 ${
                    entry.level === 'error' ? 'text-rose-400' :
                    entry.level === 'warn' ? 'text-amber-400' :
                    entry.level === 'success' ? 'text-emerald-400' : 'text-sky-400'
                  }`}>
                    {entry.level.toUpperCase()}
                  </span>
                  <span className="text-slate-200 break-all">{entry.message}</span>
                </div>
                {entry.details && (
                  <pre className="text-[10px] text-rose-300/80 bg-rose-950/20 p-1.5 rounded border border-rose-900/30 overflow-x-auto whitespace-pre-wrap ml-6">
                    {entry.details}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-400">
            <span>Device ID: <code className="text-indigo-300">{diagnostics?.deviceId || 'Loading...'}</code></span>
            <span>Target DB: <code className="text-emerald-300">mongodb://localhost:27017/nsc_local</code></span>
          </div>

        </div>
      )}
    </>
  );
};

export default ElectronStatusBar;
