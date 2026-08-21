type ElectronSyncResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function syncBeforeCloudAction(): Promise<void> {
  if (!window.electronAPI?.isElectron) return;

  const result = await window.electronAPI.triggerSync() as ElectronSyncResult | undefined;
  if (result?.success === false) {
    throw new Error(result.error || result.message || 'Desktop sync failed. Please try again.');
  }
}
