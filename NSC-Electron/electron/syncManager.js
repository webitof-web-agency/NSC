// electron/syncManager.js
// Handles syncing locally-created offline data to remote MongoDB Atlas
// Uses _localId as idempotency key to prevent duplicate records

'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const SyncRegistry = require('./syncRegistry');

// Remote backend URL fallback (used if main.js doesn't pass remoteBackendUrl)
// main.js reads this from local-backend/.env.local and passes it as a constructor option
const DEFAULT_REMOTE_BACKEND_URL = 'https://server.nareshsareecollection.com';

class SyncManager {
  /**
   * @param {Object} options
   * @param {string}   options.localBackendUrl  - URL of embedded local backend
   * @param {string}   options.remoteBackendUrl - URL of cloud backend
   * @param {string}   options.deviceId         - Unique permanent device ID
   * @param {string}   options.userDataPath     - Path to app user data
   * @param {Function} options.onProgress       - callback for sync progress events
   */
  constructor(options = {}) {
    this.localBackendUrl = options.localBackendUrl || 'http://localhost:3002';
    // remoteBackendUrl is passed from main.js, which reads it from local-backend/.env.local
    // This way .env.local is the single source of truth for the remote URL
    this.remoteBackendUrl = options.remoteBackendUrl || DEFAULT_REMOTE_BACKEND_URL;
    this.deviceId = options.deviceId || 'unknown-device';
    this.userDataPath = options.userDataPath || __dirname; // Fallback
    this.cursorFilePath = path.join(this.userDataPath, 'sync_cursor.json');
    this.onProgress = options.onProgress || null;
    
    this._state = 'idle';       // 'idle' | 'syncing' | 'done' | 'error'
    this._pendingCount = 0;
    this._syncedCount = 0;
    this._totalCount = 0;
    this._lastSyncAt = null;
    this._syncLock = false;     // Prevent concurrent syncs
    this._periodicSyncTimer = null;
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  getStatus() {
    return {
      state: this._state,
      pending: this._pendingCount,
      synced: this._syncedCount,
      total: this._totalCount,
      lastSync: this._lastSyncAt,
    };
  }

  startPeriodicSync() {
    if (this._periodicSyncTimer) return;
    console.log('⏱️ Starting periodic background sync (every 5 mins)...');
    this._periodicSyncTimer = setInterval(() => {
      this.hasAuthToken().then((has) => {
        if (has && !this._syncLock) {
          console.log('⏱️ Periodic sync triggered.');
          this.startSync().catch(console.error);
        }
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  stopPeriodicSync() {
    if (this._periodicSyncTimer) {
      console.log('⏱️ Stopping periodic background sync.');
      clearInterval(this._periodicSyncTimer);
      this._periodicSyncTimer = null;
    }
  }

  async startSync() {
    if (this._syncLock) {
      console.log('🔄 Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this._syncLock = true;
    this._state = 'syncing';
    this._syncedCount = 0;
    this._totalCount = 0;

    console.log('🔄 SyncManager: Starting sync to Atlas...');
    this._emit({ state: 'syncing', message: 'Starting sync...', pending: 0, synced: 0, total: 0 });

    try {
      // Get auth token from local backend
      const authToken = await this._getLocalAuthToken();
      
      // === PUSH PHASE (Local -> Cloud) ===
      await this._pushSync(authToken);

      // === PULL PHASE (Cloud -> Local) ===
      await this._pullSync(authToken);

      // === FILE SYNC PHASE (Binary Assets) ===
      await this._pushFiles(authToken);
      await this._pullFiles(authToken);

      // === RESERVATION REPLENISHMENT ===
      await this._checkNumberReservations(authToken);

      this._state = 'done';
      this._lastSyncAt = new Date().toISOString();
      this._syncLock = false;

      console.log(`✅ Sync complete! Synced ${this._syncedCount}/${this._totalCount} events`);
      this._emit({
        state: 'done',
        pending: 0,
        synced: this._syncedCount,
        total: this._totalCount,
        lastSync: this._lastSyncAt,
        message: `Synced ${this._syncedCount} events successfully`,
      });

      return { success: true, synced: this._syncedCount };

    } catch (err) {
      this._state = 'error';
      this._syncLock = false;
      console.error('❌ Sync failed:', err.message);
      this._emit({ state: 'error', error: err.message, pending: this._pendingCount });
      return { success: false, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Offline Number Replenishment
  // ─────────────────────────────────────────────

  async _checkNumberReservations(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      // 1. Check local status
      const localRes = await axios.get(
        `${this.localBackendUrl}/api/local/number-reservations/status`,
        { timeout: 5000 }
      );
      
      const statuses = localRes.data?.statuses || [];
      
      for (const status of statuses) {
        if (status.needsAllocation) {
          console.log(`🔢 Requesting new number block for ${status.type} (Remaining: ${status.remaining})...`);
          
          // 2. Fetch from cloud
          const cloudRes = await axios.post(
            `${this.remoteBackendUrl}/api/sync/allocate-numbers`,
            { type: status.type, count: 50 },
            { 
              headers: { Authorization: `Bearer ${authToken}` },
              timeout: 10000 
            }
          );

          const newBlock = cloudRes.data?.data;
          if (newBlock) {
            // 3. Save to local
            await axios.post(
              `${this.localBackendUrl}/api/local/number-reservations/add-block`,
              newBlock,
              { timeout: 5000 }
            );
            console.log(`✅ Reserved 50 new numbers for ${status.type}.`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to check/replenish number reservations:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Push Local Outbox Events to Cloud
  // ─────────────────────────────────────────────

  async _pushSync(authToken) {
    // 1. Fetch ALL pending Outbox events from local backend
    // (Local ObjectIds are already translated to global syncIds by the local backend)
    const localRes = await axios.get(
      `${this.localBackendUrl}/api/outbox/pending?limit=500`,
      { 
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        timeout: 10000,
      }
    );

    const events = localRes.data?.data || [];
    if (events.length === 0) {
      console.log(`📤 Push Sync: No pending outbox events.`);
      return;
    }

    console.log(`📤 Found ${events.length} pending events to push...`);
    this._totalCount += events.length;
    this._pendingCount += events.length;

    // 2. Send to unified remote backend push endpoint in batches of 50
    const batches = this._chunk(events, 50);

    for (const batch of batches) {
      let retries = 0;
      let success = false;
      
      while (retries < 5 && !success) {
        try {
          const remoteRes = await axios.post(
            `${this.remoteBackendUrl}/api/sync/push`,
            { events: batch },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-device-id': this.deviceId,
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              timeout: 30000,
            }
          );

          const { processedEvents, conflicts } = remoteRes.data;
          
          if (conflicts && conflicts.length > 0) {
            console.warn(`⚠️  Cloud reported ${conflicts.length} conflicts during push.`);
          }

          // 3. Mark events as synced locally
          if (processedEvents && processedEvents.length > 0) {
            await axios.post(
              `${this.localBackendUrl}/api/outbox/mark-synced`,
              { eventIds: processedEvents },
              { timeout: 10000 }
            );
            this._syncedCount += processedEvents.length;
            this._pendingCount -= processedEvents.length;
          }

          this._emit({
            state: 'syncing',
            message: `Pushed ${processedEvents?.length || 0} events to cloud`,
            synced: this._syncedCount,
            total: this._totalCount,
            pending: this._pendingCount,
          });

          success = true;

        } catch (batchErr) {
          if (batchErr.response && batchErr.response.status === 401) {
            console.error('❌ Sync Push: Unauthorized (401). Clearing stale token.');
            try {
              await axios.post(`${this.localBackendUrl}/api/local/sync-token`, { token: null });
            } catch (e) {}
            throw new Error('Unauthorized - Stale Token'); // Abort entire sync
          }
          
          retries++;
          if (retries >= 5) {
            console.error(`❌ Batch sync push failed after 5 retries:`, batchErr.message);
          } else {
            // Exponential backoff: 2s, 4s, 8s, 16s... max 60s
            const backoff = Math.min(2000 * Math.pow(2, retries - 1), 60000);
            console.log(`⚠️ Batch push failed (${batchErr.message}). Retrying ${retries}/5 in ${backoff}ms...`);
            await new Promise(res => setTimeout(res, backoff));
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Pull Cloud Events to Local
  // ─────────────────────────────────────────────

  async _pullSync(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    let cursor = this._getCursor();

    if (!cursor) {
      console.log('🔄 No pull cursor found. Initiating Bootstrap Sync...');
      await this._bootstrapSync(authToken);
      return;
    }

    try {
      console.log(`📥 Pull Sync: Fetching events after cursor ${cursor}...`);
      const remoteRes = await axios.get(
        `${this.remoteBackendUrl}/api/sync/pull?cursor=${cursor}&deviceId=${this.deviceId}`,
        { 
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 30000 
        }
      );

      const responseData = remoteRes.data?.data || remoteRes.data;
      const events = responseData?.events || [];
      const nextCursor = responseData?.nextCursor || cursor;

      if (!events || events.length === 0) {
        console.log('📥 Pull Sync: No new events from cloud.');
        return;
      }

      console.log(`📥 Applying ${events.length} cloud events to local backend...`);
      
      const localRes = await axios.post(
        `${this.localBackendUrl}/api/local/sync-apply`,
        { events },
        { timeout: 30000 }
      );

      if (localRes.data?.success) {
        this._setCursor(nextCursor);
        console.log(`✅ Pull Sync complete. Cursor updated to ${nextCursor}`);
      }

    } catch (err) {
      console.error('❌ Pull Sync failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Bootstrap (Full Snapshot Sync)
  // ─────────────────────────────────────────────

  async _bootstrapSync(authToken) {
    try {
      this._emit({
        state: 'syncing',
        message: 'Downloading Initial Cloud Snapshot...',
      });

      const remoteRes = await axios.get(
        `${this.remoteBackendUrl}/api/sync/bootstrap`,
        { 
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 120000 // 2 minutes for full snapshot
        }
      );

      const responseData = remoteRes.data?.data || remoteRes.data;
      const snapshot = responseData?.snapshot;
      const cursor = responseData?.cursor;

      if (!snapshot) {
        console.warn('⚠️  Cloud returned empty snapshot.');
        return;
      }

      console.log(`📥 Bootstrap: Applying full snapshot to local backend...`);
      this._emit({
        state: 'syncing',
        message: 'Applying Snapshot Locally...',
      });

      const localRes = await axios.post(
        `${this.localBackendUrl}/api/local/sync-bootstrap`,
        { snapshot },
        { timeout: 120000 }
      );

      if (localRes.data?.success) {
        this._setCursor(cursor);
        console.log(`✅ Bootstrap complete! Cursor set to ${cursor}`);
      }
    } catch (err) {
      console.error('❌ Bootstrap Sync failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Push Binary Files (Local -> Cloud)
  // ─────────────────────────────────────────────
  
  async _pushFiles(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      // 1. Get pending file uploads from local FileOutbox
      const localRes = await axios.get(`${this.localBackendUrl}/api/local/file-outbox/pending`);
      const files = localRes.data?.files || [];
      
      if (files.length === 0) return;
      console.log(`📤 File Sync: Found ${files.length} pending files to push...`);

      const fs = require('fs');
      const path = require('path');
      
      // Node 22 native FormData is globally available!
      // But Axios sometimes prefers native node stream if not using form-data package.
      // Wait, native FormData in Node 22 works natively with fetch, but Axios 1.7+ also supports it!
      for (const fileRecord of files) {
        try {
          const absPath = path.join(__dirname, '../local-backend/public', fileRecord.filePath);
          if (!fs.existsSync(absPath)) {
             console.warn(`⚠️ File ${fileRecord.filePath} not found locally, marking failed.`);
             await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'FAILED' });
             continue;
          }

          // Use native fetch to easily handle native FormData in Node 22
          const { Blob } = require('node:buffer');
          const fileData = fs.readFileSync(absPath);
          const blob = new Blob([fileData]);
          
          const fd = new FormData();
          fd.append('file', blob, path.basename(absPath));
          fd.append('filePath', fileRecord.filePath); // tell the cloud where to save it

          const response = await fetch(`${this.remoteBackendUrl}/api/sync/file-push`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: fd,
            // timeout is natively supported via AbortController in fetch, but this is simple enough.
          });

          if (response.ok) {
             await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'SYNCED' });
          } else {
             const errText = await response.text();
             throw new Error(`Cloud rejected file: ${errText}`);
          }
        } catch (err) {
          console.error(`❌ Failed to push file ${fileRecord.filePath}:`, err.message);
          await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'FAILED', error: err.message });
        }
      }
    } catch (err) {
      console.error('❌ File push loop failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Pull Binary Files (Cloud -> Local)
  // ─────────────────────────────────────────────

  async _pullFiles(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      // 1. Get pending file pull requests
      const localRes = await axios.get(`${this.localBackendUrl}/api/local/file-pull/pending`);
      const files = localRes.data?.files || [];
      
      if (files.length === 0) return;
      console.log(`📥 File Sync: Found ${files.length} pending files to pull...`);

      const fs = require('fs');
      const path = require('path');
      
      for (const fileRecord of files) {
        try {
          // Download file stream from Cloud
          const response = await fetch(`${this.remoteBackendUrl}/api/sync/file-pull?path=${encodeURIComponent(fileRecord.filePath)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          if (!response.ok) {
            if (response.status === 404) {
              console.warn(`⚠️ Cloud does not have file ${fileRecord.filePath}, ignoring.`);
              await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'FAILED', error: '404 Not Found' });
              continue;
            }
            throw new Error(`Cloud returned ${response.status}`);
          }

          const absPath = path.join(__dirname, '../local-backend/public', fileRecord.filePath);
          fs.mkdirSync(path.dirname(absPath), { recursive: true });

          // Stream to file
          const dest = fs.createWriteStream(absPath);
          const { Readable } = require('node:stream');
          // Node 22 fetch body is a Web stream. We can use Readable.fromWeb
          const bodyStream = Readable.fromWeb(response.body);
          
          await new Promise((resolve, reject) => {
            bodyStream.pipe(dest);
            bodyStream.on('error', reject);
            dest.on('finish', resolve);
          });

          // Mark as SYNCED
          await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'SYNCED' });

        } catch (err) {
          console.error(`❌ Failed to pull file ${fileRecord.filePath}:`, err.message);
          await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'FAILED', error: err.message });
        }
      }
    } catch (err) {
      console.error('❌ File pull loop failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────

  _getCursor() {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.cursorFilePath)) {
        const data = fs.readFileSync(this.cursorFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.cursor || null;
      }
    } catch (err) {
      console.error('❌ Failed to read sync cursor:', err.message);
    }
    return null;
  }

  _setCursor(cursor) {
    try {
      const fs = require('fs');
      fs.writeFileSync(this.cursorFilePath, JSON.stringify({ cursor }), 'utf8');
    } catch (err) {
      console.error('❌ Failed to save sync cursor:', err.message);
    }
  }

  async hasAuthToken() {
    const token = await this._getLocalAuthToken();
    return !!token;
  }

  async _getLocalAuthToken() {
    try {
      // Try to get the stored JWT from local backend's active session store
      const res = await axios.get(`${this.localBackendUrl}/api/local/sync-token`, {
        timeout: 5000,
      });
      return res.data?.token || null;
    } catch {
      return null; // No token — sync will proceed without auth (handled by sync endpoint)
    }
  }

  _chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  _emit(progress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

module.exports = SyncManager;
