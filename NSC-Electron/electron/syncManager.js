// electron/syncManager.js
// Handles syncing locally-created offline data to remote MongoDB Atlas
// Uses _localId as idempotency key to prevent duplicate records

'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const SyncRegistry = require('./syncRegistry');

const DEFAULT_REMOTE_BACKEND_URL = 'https://server.nareshsareecollection.com';
const isDev = process.argv.includes('--dev');

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
    this.remoteBackendUrl = options.remoteBackendUrl || DEFAULT_REMOTE_BACKEND_URL;
    this.deviceId = options.deviceId || 'unknown-device';
    this.userDataPath = options.userDataPath || __dirname;
    this.cursorFilePath = path.join(this.userDataPath, 'sync_cursor.json');
    this.onProgress = options.onProgress || null;
    this.cachedAuthToken = null; // in-memory fallback
    this.logs = [];              // In-memory diagnostic log buffer
    
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

  _log(level, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
      timestamp,
      level, // 'info' | 'warn' | 'error' | 'success'
      message,
      details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null,
    };
    console.log(`[SyncLog ${level.toUpperCase()}] ${message}`);
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
  }

  getLogs() {
    return {
      logs: this.logs,
      localBackendUrl: this.localBackendUrl,
      remoteBackendUrl: this.remoteBackendUrl,
      deviceId: this.deviceId,
      hasToken: !!this.cachedAuthToken,
      tokenSnippet: this.cachedAuthToken ? `${this.cachedAuthToken.substring(0, 10)}...${this.cachedAuthToken.slice(-5)}` : null,
      cursor: this._getCursor(),
      state: this._state,
      lastSync: this._lastSyncAt,
    };
  }

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
    this._log('info', 'Starting periodic background sync (every 5 mins)...');
    this._periodicSyncTimer = setInterval(() => {
      this.hasAuthToken().then((has) => {
        if (has && !this._syncLock) {
          this._log('info', 'Periodic sync interval triggered.');
          this.startSync().catch(console.error);
        }
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  stopPeriodicSync() {
    if (this._periodicSyncTimer) {
      this._log('info', 'Stopping periodic background sync.');
      clearInterval(this._periodicSyncTimer);
      this._periodicSyncTimer = null;
    }
  }

  async startSync(passedToken = null) {
    if (this._syncLock) {
      this._log('warn', 'Sync already in progress, skipping request.');
      return { success: false, message: 'Sync already in progress' };
    }

    this._syncLock = true;
    this._state = 'syncing';
    this._syncedCount = 0;
    this._totalCount = 0;

    this._log('info', 'Starting synchronization sequence...');
    this._emit({ state: 'syncing', message: 'Starting sync...', pending: 0, synced: 0, total: 0 });

    try {
      const validPassedToken = typeof passedToken === 'string' && passedToken.trim().length > 10 ? passedToken.trim() : null;
      let authToken = validPassedToken || this.cachedAuthToken || await this._getLocalAuthToken();

      if (validPassedToken) {
        this.cachedAuthToken = validPassedToken;
        try {
          await axios.post(
            `${this.localBackendUrl}/api/local/sync-token`,
            { token: validPassedToken },
            { timeout: 5000 }
          );
          this._log('info', 'Updated token in local backend storage.');
        } catch (e) {
          // ignore
        }
      }

      if (!authToken) {
        this._log('warn', 'No auth token found. Waiting for user login.');
        this._state = 'idle';
        this._syncLock = false;
        this._emit({
          state: 'idle',
          pending: 0,
          synced: 0,
          total: 0,
          lastSync: this._lastSyncAt,
          message: 'Waiting for login',
        });
        return { success: true, message: 'Waiting for login' };
      }

      this.cachedAuthToken = authToken;
      this._log('info', `Using token: ${authToken.substring(0, 10)}...${authToken.slice(-5)}`);
      
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

      this._log('success', `Sync completed successfully! Processed ${this._syncedCount}/${this._totalCount} events.`);
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
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      const errMsg = serverMsg || (status ? `Request failed with status code ${status}` : err.message) || 'Sync operation failed';
      
      this._log('error', `Sync failed: ${errMsg}`, { status, data: err.response?.data, stack: err.stack });
      this._emit({ state: 'error', error: errMsg, pending: this._pendingCount });
      return { success: false, error: errMsg };
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Offline Number Replenishment
  // ─────────────────────────────────────────────

  async _checkNumberReservations(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      const localRes = await axios.get(
        `${this.localBackendUrl}/api/local/number-reservations/status`,
        { timeout: 5000 }
      );
      
      const statuses = localRes.data?.statuses || [];
      
      for (const status of statuses) {
        if (status.needsAllocation) {
          this._log('info', `Requesting 50 numbers for ${status.type} (Remaining: ${status.remaining})...`);
          
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
            await axios.post(
              `${this.localBackendUrl}/api/local/number-reservations/add-block`,
              newBlock,
              { timeout: 5000 }
            );
            this._log('success', `Reserved 50 numbers for ${status.type}.`);
          }
        }
      }
    } catch (err) {
      this._log('warn', `Failed to check number reservations: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Push Local Outbox Events to Cloud
  // ─────────────────────────────────────────────

  async _pushSync(authToken) {
    let localRes;
    try {
      localRes = await axios.get(
        `${this.localBackendUrl}/api/outbox/pending?limit=500`,
        { 
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          timeout: 10000,
        }
      );
    } catch (outboxErr) {
      this._log('warn', `Could not query local outbox: ${outboxErr.message}`);
      return;
    }

    const events = localRes.data?.data || [];
    if (events.length === 0) {
      this._log('info', 'Push: No pending local events to push to cloud.');
      return;
    }

    this._log('info', `Push: Found ${events.length} pending events to upload.`);
    this._totalCount += events.length;
    this._pendingCount += events.length;

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
            this._log('warn', `Cloud reported ${conflicts.length} conflicts during push.`);
          }

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
          if (batchErr.response && (batchErr.response.status === 401 || batchErr.response.status === 403)) {
            this._log('error', 'Sync Push: 401 Unauthorized - clearing stale token.');
            this.cachedAuthToken = null;
            try {
              await axios.post(`${this.localBackendUrl}/api/local/sync-token`, { token: null });
            } catch (e) {}
            throw new Error('Session expired or invalid token. Please log in again.');
          }
          
          retries++;
          if (retries >= 5) {
            this._log('error', `Batch sync push failed after 5 retries: ${batchErr.message}`);
            throw batchErr;
          } else {
            const backoff = Math.min(2000 * Math.pow(2, retries - 1), 60000);
            this._log('warn', `Batch push failed (${batchErr.message}). Retrying in ${backoff}ms...`);
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
      this._log('info', 'No existing sync cursor found. Initiating full Initial Bootstrap Snapshot...');
      await this._bootstrapSync(authToken);
      return;
    }

    try {
      this._log('info', `Pull: Fetching cloud events after cursor ${cursor}...`);
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
        this._log('info', 'Pull: Up to date (no new cloud events).');
        return;
      }

      this._log('info', `Pull: Applying ${events.length} cloud events to local database...`);
      
      const localRes = await axios.post(
        `${this.localBackendUrl}/api/local/sync-apply`,
        { events },
        { timeout: 30000 }
      );

      if (localRes.data?.success) {
        this._setCursor(nextCursor);
        this._log('success', `Pull: Applied successfully. Cursor updated to ${nextCursor}`);
      }

    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        this.cachedAuthToken = null;
        try {
          await axios.post(`${this.localBackendUrl}/api/local/sync-token`, { token: null });
        } catch (e) {}
        throw new Error('Session expired or invalid token. Please log in again.');
      }
      this._log('error', `Pull sync failed: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Bootstrap (Full Snapshot Sync)
  // ─────────────────────────────────────────────

  async _bootstrapSync(authToken) {
    this._emit({
      state: 'syncing',
      message: 'Downloading Initial Cloud Snapshot...',
    });

    let remoteRes = null;
    let retries = 0;
    const maxRetries = 3;

    this._log('info', `Connecting to cloud at ${this.remoteBackendUrl}/api/sync/bootstrap...`);

    while (retries < maxRetries && !remoteRes) {
      try {
        remoteRes = await axios.get(
          `${this.remoteBackendUrl}/api/sync/bootstrap`,
          { 
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 120000
          }
        );
        this._log('success', 'Cloud bootstrap snapshot downloaded successfully.');
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          this.cachedAuthToken = null;
          try {
            await axios.post(`${this.localBackendUrl}/api/local/sync-token`, { token: null });
          } catch (e) {}
          throw new Error('Session expired or invalid token. Please log in again.');
        }

        retries++;
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.response?.data?.error || err.message;
        this._log('warn', `Cloud bootstrap attempt ${retries}/${maxRetries} failed (${status || 'ERR'}): ${msg}`);

        if (retries >= maxRetries) {
          throw err;
        }

        const waitMs = retries * 3000;
        this._emit({
          state: 'syncing',
          message: `Retrying download (${retries}/${maxRetries})...`,
        });
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    const responseData = remoteRes.data?.data || remoteRes.data;
    const snapshot = responseData?.snapshot;
    const cursor = responseData?.cursor;

    if (!snapshot) {
      this._log('warn', 'Cloud returned empty snapshot.');
      return;
    }

    const collectionCount = Object.keys(snapshot).length;
    this._log('info', `Applying snapshot (${collectionCount} collections) to local database...`);
    this._emit({
      state: 'syncing',
      message: 'Applying Snapshot Locally...',
    });

    try {
      const localRes = await axios.post(
        `${this.localBackendUrl}/api/local/sync-bootstrap`,
        { snapshot },
        { timeout: 120000 }
      );

      if (localRes.data?.success) {
        this._setCursor(cursor);
        this._log('success', `Bootstrap complete! Saved all collections to nsc_local. Cursor set to ${cursor}`);
      } else {
        throw new Error(localRes.data?.message || 'Local backend rejected bootstrap');
      }
    } catch (localErr) {
      const msg = localErr.response?.data?.message || localErr.response?.data?.error || localErr.message;
      this._log('error', `Local bootstrap write failed: ${msg}`);
      throw localErr;
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Public Directory Resolution
  // ─────────────────────────────────────────────

  _getPublicDir() {
    return isDev
      ? path.join(__dirname, '../local-backend/public')
      : path.join(process.resourcesPath || '', 'local-backend/public');
  }

  // ─────────────────────────────────────────────
  // Internal: Push Binary Files (Local -> Cloud)
  // ─────────────────────────────────────────────
  
  async _pushFiles(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      const localRes = await axios.get(`${this.localBackendUrl}/api/local/file-outbox/pending`);
      const files = localRes.data?.files || [];
      
      if (files.length === 0) return;
      this._log('info', `File Sync: Found ${files.length} pending files to upload.`);

      const publicDir = this._getPublicDir();
      
      for (const fileRecord of files) {
        try {
          const absPath = path.join(publicDir, fileRecord.filePath);
          if (!fs.existsSync(absPath)) {
             await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'FAILED' });
             continue;
          }

          const { Blob } = require('node:buffer');
          const fileData = fs.readFileSync(absPath);
          const blob = new Blob([fileData]);
          
          const fd = new FormData();
          fd.append('file', blob, path.basename(absPath));
          fd.append('filePath', fileRecord.filePath);

          const response = await fetch(`${this.remoteBackendUrl}/api/sync/file-push`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: fd,
          });

          if (response.ok) {
             await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'SYNCED' });
          } else {
             const errText = await response.text();
             throw new Error(`Cloud rejected file: ${errText}`);
          }
        } catch (err) {
          this._log('warn', `Failed to push file ${fileRecord.filePath}: ${err.message}`);
          await axios.post(`${this.localBackendUrl}/api/local/file-outbox/status`, { id: fileRecord._id, status: 'FAILED', error: err.message });
        }
      }
    } catch (err) {
      this._log('warn', `File push loop error: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Internal: Pull Binary Files (Cloud -> Local)
  // ─────────────────────────────────────────────

  async _pullFiles(authToken) {
    if (!this.remoteBackendUrl || !authToken) return;

    try {
      const localRes = await axios.get(`${this.localBackendUrl}/api/local/file-pull/pending`);
      const files = localRes.data?.files || [];
      
      if (files.length === 0) return;
      this._log('info', `File Sync: Found ${files.length} pending files to download.`);

      const publicDir = this._getPublicDir();
      
      for (const fileRecord of files) {
        try {
          const response = await fetch(`${this.remoteBackendUrl}/api/sync/file-pull?path=${encodeURIComponent(fileRecord.filePath)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          if (!response.ok) {
            if (response.status === 404) {
              await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'FAILED', error: '404 Not Found' });
              continue;
            }
            throw new Error(`Cloud returned ${response.status}`);
          }

          const absPath = path.join(publicDir, fileRecord.filePath);
          fs.mkdirSync(path.dirname(absPath), { recursive: true });

          const dest = fs.createWriteStream(absPath);
          const { Readable } = require('node:stream');
          const bodyStream = Readable.fromWeb(response.body);
          
          await new Promise((resolve, reject) => {
            bodyStream.pipe(dest);
            bodyStream.on('error', reject);
            dest.on('finish', resolve);
          });

          await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'SYNCED' });

        } catch (err) {
          this._log('warn', `Failed to pull file ${fileRecord.filePath}: ${err.message}`);
          await axios.post(`${this.localBackendUrl}/api/local/file-pull/status`, { id: fileRecord._id, status: 'FAILED', error: err.message });
        }
      }
    } catch (err) {
      this._log('warn', `File pull loop error: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────

  _getCursor() {
    try {
      if (fs.existsSync(this.cursorFilePath)) {
        const data = fs.readFileSync(this.cursorFilePath, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.cursor || parsed.cursor === '000000000000000000000000') {
          return null;
        }
        return parsed.cursor;
      }
    } catch (err) {
      this._log('error', `Failed to read sync cursor: ${err.message}`);
    }
    return null;
  }

  _setCursor(cursor) {
    try {
      fs.writeFileSync(this.cursorFilePath, JSON.stringify({ cursor }), 'utf8');
    } catch (err) {
      this._log('error', `Failed to save sync cursor: ${err.message}`);
    }
  }

  async hasAuthToken() {
    if (this.cachedAuthToken) return true;
    const token = await this._getLocalAuthToken();
    return !!token;
  }

  async _getLocalAuthToken() {
    try {
      const res = await axios.get(`${this.localBackendUrl}/api/local/sync-token`, {
        timeout: 5000,
      });
      const token = res.data?.token || null;
      if (token && typeof token === 'string' && token.length > 10) {
        this.cachedAuthToken = token;
        return token;
      }
      return this.cachedAuthToken || null;
    } catch {
      return this.cachedAuthToken || null;
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
