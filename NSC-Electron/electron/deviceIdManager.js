// electron/deviceIdManager.js
'use strict';

const { safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class DeviceIdManager {
  constructor(app) {
    this.app = app;
    this.deviceConfigPath = path.join(app.getPath('userData'), 'device_identity.enc');
    this.deviceId = null;
  }

  getDeviceId() {
    if (this.deviceId) return this.deviceId;

    if (fs.existsSync(this.deviceConfigPath)) {
      try {
        const encrypted = fs.readFileSync(this.deviceConfigPath);
        
        let decryptedStr = '';
        if (safeStorage.isEncryptionAvailable()) {
          decryptedStr = safeStorage.decryptString(encrypted);
        } else {
          // Fallback if encryption isn't available
          decryptedStr = encrypted.toString('utf8');
        }

        const data = JSON.parse(decryptedStr);
        this.deviceId = data.deviceId;
        return this.deviceId;
      } catch (err) {
        console.error('Failed to read device identity, generating a new one.', err);
      }
    }

    // Generate new if it doesn't exist or couldn't be decrypted
    this.deviceId = uuidv4();
    const dataStr = JSON.stringify({ deviceId: this.deviceId });
    
    let toSave = Buffer.from(dataStr, 'utf8');
    if (safeStorage.isEncryptionAvailable()) {
      toSave = safeStorage.encryptString(dataStr);
    }
    
    fs.writeFileSync(this.deviceConfigPath, toSave);
    console.log(`✅ Generated and securely stored permanent deviceId`);
    
    return this.deviceId;
  }
}

module.exports = DeviceIdManager;
