// electron/networkMonitor.js
// Monitors real internet connectivity (not just navigator.onLine)
// Uses DNS resolution and HTTP checks to verify actual connectivity

'use strict';

const dns = require('dns');
const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

class NetworkMonitor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number}   options.checkInterval   - ms between checks (default 10000)
   * @param {Function} options.onStatusChange  - callback when status changes
   * @param {string[]} options.testHosts       - domain hostnames to DNS-resolve (NO IP literals)
   * @param {string}   options.pingUrl         - remote URL to ping as verification
   * @param {number}   options.pingTimeout     - timeout for ping in ms (default 10000)
   * @param {number}   options.failuresBeforeOffline - consecutive fails before offline (default 4)
   */
  constructor(options = {}) {
    super();
    this.checkInterval = options.checkInterval || 10000;
    this.onStatusChange = options.onStatusChange || null;
    // Real domains only (never IP addresses like 1.1.1.1 because dns.lookup on IPs returns success without network)
    this.testHosts = options.testHosts || [
      'server.nareshsareecollection.com',
      'google.com',
      'cloudflare.com',
    ];
    this.pingUrl = options.pingUrl || 'https://server.nareshsareecollection.com/health';

    this.pingTimeout = options.pingTimeout || 10000;
    // Consecutive failed checks before switching to offline, so heavy DB transfers don't flip the API URL
    this.failuresBeforeOffline = options.failuresBeforeOffline || 4;

    this._isOnline = false;   // Start assuming offline until verified
    this._failures = 0;
    this._timer = null;
    this._checking = false;
    this._syncActive = false;
    this._lastActivityTime = Date.now();
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  async start() {
    console.log('🌐 NetworkMonitor: Starting...');
    await this._check(); // perform and await immediate first check
    if (!this._timer) {
      this._timer = setInterval(() => this._check(), this.checkInterval);
    }
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log('🌐 NetworkMonitor: Stopped');
  }

  /**
   * Notify monitor whether a data sync sequence is actively in progress.
   * While sync is active, we avoid intrusive pings that could congest the socket
   * or trigger false offline state while thousands of DB documents are transferring.
   */
  setSyncActive(active) {
    this._syncActive = Boolean(active);
    console.log(`🌐 NetworkMonitor: Sync active = ${this._syncActive}`);
    if (this._syncActive) {
      this._lastActivityTime = Date.now();
      this._failures = 0;
      if (!this._isOnline) {
        this._isOnline = true;
        const status = this.getStatus();
        console.log('🌐 Network: ONLINE (Sync In-Flight)');
        this.emit('change', status);
        if (this.onStatusChange) {
          this.onStatusChange(status);
        }
      }
    }
  }

  /**
   * Called whenever a successful network response is received from the cloud backend
   * (e.g. from SyncManager during bootstrap or incremental pull).
   */
  recordActivity() {
    this._lastActivityTime = Date.now();
    this._failures = 0;
    if (!this._isOnline) {
      this._isOnline = true;
      const status = this.getStatus();
      console.log('🌐 Network: ONLINE (Cloud Activity Verified)');
      this.emit('change', status);
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
    }
  }

  isSyncActive() {
    return this._syncActive;
  }

  getStatus() {
    return {
      isOnline: this._isOnline,
      mode: this._isOnline ? 'online' : 'offline',
      checkedAt: new Date().toISOString(),
      syncActive: this._syncActive,
    };
  }

  // ─────────────────────────────────────────────
  // Internal: DNS + HTTP connectivity check
  // ─────────────────────────────────────────────

  async _check() {
    if (this._checking) return; // Avoid overlapping checks
    this._checking = true;

    // When sync is actively streaming data from the cloud, the connection is actively verified.
    // Skip intrusive health checks that compete for network bandwidth.
    if (this._syncActive) {
      this._checking = false;
      this._failures = 0;
      return;
    }

    let dnsOk = false;
    let newOnline = false;

    // 1. Check DNS resolution of domain names (with 3000ms timeout per host).
    //    DNS alone proves internet access.
    for (const host of this.testHosts) {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('DNS timeout')), 3000);
          dns.lookup(host, (err, address) => {
            clearTimeout(timeout);
            if (err || !address) reject(err || new Error('No address'));
            else resolve(address);
          });
        });
        dnsOk = true;
        break; // Stop checking if one succeeds
      } catch {
        // Try next host
      }
    }

    // 2. Online verification with HTTP health check
    if (dnsOk && this.pingUrl) {
      try {
        await new Promise((resolve, reject) => {
          const client = this.pingUrl.startsWith('https') ? https : http;
          const req = client.get(this.pingUrl, { timeout: this.pingTimeout }, (res) => {
            res.resume();
            if (res.statusCode && res.statusCode < 500) {
              resolve();
            } else {
              reject(new Error(`Status ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('HTTP timeout'));
          });
        });
        newOnline = true;
      } catch (pingErr) {
        // If DNS is working and we had verified cloud activity recently (within 60s),
        // keep online state rather than flapping offline due to temporary backend latency.
        if (dnsOk && this._lastActivityTime && (Date.now() - this._lastActivityTime < 60000)) {
          newOnline = true;
        }
      }
    } else if (dnsOk) {
      newOnline = true;
    }

    this._checking = false;

    if (newOnline) {
      this._failures = 0;
      this._lastActivityTime = Date.now();
    } else if (dnsOk && this._isOnline && ++this._failures < this.failuresBeforeOffline) {
      console.log(`🌐 NetworkMonitor: Check failed (${this._failures}/${this.failuresBeforeOffline}), staying online...`);
      return; // Stay online until the cloud fails repeatedly
    }

    if (newOnline !== this._isOnline) {
      const prev = this._isOnline;
      this._isOnline = newOnline;

      const status = this.getStatus();
      console.log(`🌐 Network: ${prev ? 'ONLINE' : 'OFFLINE'} → ${newOnline ? 'ONLINE' : 'OFFLINE'}`);

      // Emit event
      this.emit('change', status);

      // Call callback
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
    }
  }
}

module.exports = NetworkMonitor;

