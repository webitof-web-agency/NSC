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
   * @param {number}   options.checkInterval   - ms between checks (default 5000)
   * @param {Function} options.onStatusChange  - callback when status changes
   * @param {string[]} options.testHosts       - domain hostnames to DNS-resolve (NO IP literals)
   * @param {string}   options.pingUrl         - remote URL to ping as verification
   */
  constructor(options = {}) {
    super();
    this.checkInterval = options.checkInterval || 5000;
    this.onStatusChange = options.onStatusChange || null;
    // Real domains only (never IP addresses like 1.1.1.1 because dns.lookup on IPs returns success without network)
    this.testHosts = options.testHosts || [
      'server.nareshsareecollection.com',
      'google.com',
      'cloudflare.com',
    ];
    this.pingUrl = options.pingUrl || 'https://server.nareshsareecollection.com/api/admin/app-version';

    this.pingTimeout = options.pingTimeout || 5000;
    // Consecutive failed checks before switching to offline, so one slow response doesn't flip the API URL
    this.failuresBeforeOffline = options.failuresBeforeOffline || 2;

    this._isOnline = false;   // Start assuming offline
    this._failures = 0;
    this._timer = null;
    this._checking = false;
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  start() {
    console.log('🌐 NetworkMonitor: Starting...');
    this._check(); // immediate first check
    this._timer = setInterval(() => this._check(), this.checkInterval);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log('🌐 NetworkMonitor: Stopped');
  }

  getStatus() {
    return {
      isOnline: this._isOnline,
      mode: this._isOnline ? 'online' : 'offline',
      checkedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // Internal: DNS + HTTP connectivity check
  // ─────────────────────────────────────────────

  async _check() {
    if (this._checking) return; // Avoid overlapping checks
    this._checking = true;

    let dnsOk = false;
    let newOnline = false;

    // 1. Check DNS resolution of domain names (with 2500ms timeout per host).
    //    DNS alone only proves internet access, not that the cloud backend is up.
    for (const host of this.testHosts) {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('DNS timeout')), 2500);
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

    // 2. Online only if the cloud backend actually answers; a hung server must fall back to local
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
      } catch {
        // Cloud backend unreachable or hung
      }
    } else if (dnsOk) {
      newOnline = true;
    }

    this._checking = false;

    if (newOnline) {
      this._failures = 0;
    } else if (dnsOk && this._isOnline && ++this._failures < this.failuresBeforeOffline) {
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

