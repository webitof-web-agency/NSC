// electron/networkMonitor.js
// Monitors real internet connectivity (not just navigator.onLine)
// Uses DNS lookup to verify actual connectivity every N seconds

'use strict';

const dns = require('dns');
const { EventEmitter } = require('events');

class NetworkMonitor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number}   options.checkInterval   - ms between checks (default 8000)
   * @param {Function} options.onStatusChange  - callback when status changes
   * @param {string[]} options.testHosts       - hostnames to DNS-resolve
   * @param {string}   options.pingUrl         - remote URL to ping as fallback
   */
  constructor(options = {}) {
    super();
    this.checkInterval = options.checkInterval || 8000;
    this.onStatusChange = options.onStatusChange || null;
    this.testHosts = options.testHosts || ['google.com', '1.1.1.1', '8.8.8.8'];
    this.pingUrl = options.pingUrl || 'https://server.nareshsareecollection.com/api/health';

    this._isOnline = false;   // Start assuming offline
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
  // Internal: DNS-based connectivity check
  // ─────────────────────────────────────────────

  async _check() {
    if (this._checking) return; // Avoid overlapping checks
    this._checking = true;

    let newOnline = false;

    // 1. Check DNS resolution of fallback hosts
    for (const host of this.testHosts) {
      try {
        await new Promise((resolve, reject) => {
          dns.lookup(host, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        newOnline = true;
        break; // Stop checking if one succeeds
      } catch (e) {
        // Continue to next host
      }
    }

    // 2. HTTP ping fallback if DNS fails
    if (!newOnline && this.pingUrl) {
      try {
        const fetch = require('node-fetch') || global.fetch; // Node 18+ has global fetch
        const res = await fetch(this.pingUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          newOnline = true;
        }
      } catch (e) {
        // Still offline
      }
    }

    this._checking = false;

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
