/**
 * Zattoo Desktop App usable by a USB Remote - Electron Preload Script
 * 
 * Bridge between main process and renderer process.
 * Exposes safe APIs to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Expose version info
  getVersion: () => process.env.npm_package_version,
  
  // Platform info
  getPlatform: () => process.platform,
  
  // Widevine check
  checkWidevine: () => {
    return navigator.requestMediaKeySystemAccess('com.widevine.alpha', [])
      .then(() => true)
      .catch(() => false);
  }
});

// Also expose __zattooRemote for compatibility with existing code
contextBridge.exposeInMainWorld('__zattooRemote', {
  // This will be populated by the injected script
});
