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
   * @param {string}   options.testHost        - hostname to DNS-resolve (default 'google.com')
   */
  constructor(options = {}) {
    super();
    this.checkInterval = options.checkInterval || 8000;
    this.onStatusChange = options.onStatusChange || null;
    this.testHost = options.testHost || 'google.com';

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

  _check() {
    if (this._checking) return; // Avoid overlapping checks
    this._checking = true;

    dns.lookup(this.testHost, (err) => {
      this._checking = false;
      const newOnline = !err;

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
    });
  }
}

module.exports = NetworkMonitor;
