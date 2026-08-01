/**
 * Zattoo Remote - Electron Main Process
 * 
 * Handles:
 * - Window creation with Widevine-enabled Chromium
 * - Global keyboard input capture (replacing rdev input_handler)
 * - Injection of zattoo_inject.js into the webview
 */

const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Key mappings (matching input_handler.rs actions)
const KEY_MAP = {
  // Digit keys
  '0': { action: 'digit_0', label: '0' },
  '1': { action: 'digit_1', label: '1' },
  '2': { action: 'digit_2', label: '2' },
  '3': { action: 'digit_3', label: '3' },
  '4': { action: 'digit_4', label: '4' },
  '5': { action: 'digit_5', label: '5' },
  '6': { action: 'digit_6', label: '6' },
  '7': { action: 'digit_7', label: '7' },
  '8': { action: 'digit_8', label: '8' },
  '9': { action: 'digit_9', label: '9' },
  
  // Arrow keys
  'Up': { action: 'up', label: '▲ Up' },
  'Down': { action: 'down', label: '▼ Down' },
  'Left': { action: 'left', label: '← Left' },
  'Right': { action: 'right', label: '→ Right' },
  
  // Navigation keys
  'Return': { action: 'ok', label: 'OK' },
  'Enter': { action: 'ok', label: 'OK' },
  'Escape': { action: 'back', label: '⬅ Back' },
  'Backspace': { action: 'back', label: '⬅ Back' },
  
  // Channel navigation
  'PageUp': { action: 'channel_up', label: 'CH+' },
  'PageDown': { action: 'channel_down', label: 'CH-' },
  
  // Volume keys
  'VolumeUp': { action: 'volume_up', label: '🔊+' },
  'VolumeDown': { action: 'volume_down', label: '🔊-' },
  'Mute': { action: 'mute', label: '🔇 Mute' },
  
  // Function keys for colored buttons
  'F1': { action: 'color_red', label: '🔴 Red' },
  'F2': { action: 'color_green', label: '🟢 Green' },
  'F3': { action: 'color_yellow', label: '🟡 Yellow' },
  'F4': { action: 'color_blue', label: '🔵 Blue' },
  
  // Media keys
  'F5': { action: 'rewind', label: '⏪ Rewind' },
  'F6': { action: 'fast_forward', label: '⏩ FF' },
  'F7': { action: 'stop', label: '⏹ Stop' },
  'F8': { action: 'record', label: '⏺ Record' },
  'F9': { action: 'guide', label: '📋 EPG' },
  'F10': { action: 'settings', label: '⚙ Settings' },
  'F11': { action: 'account', label: '👤 Account' },
  'F12': { action: 'recordings', label: '📼 Recordings' },
  
  // Special keys
  'Alt': { action: 'home', label: '🏠 Home' },
  'ShiftRight': { action: 'menu', label: '📋 EPG' },
  'ControlRight': { action: 'search', label: '🔍 Search' },
  'Space': { action: 'play_pause', label: '▶ Play/Pause' },
  'Insert': { action: 'mouse_mode', label: '🖱 Mouse Mode' }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    
    // Ensure window is visible
    show: true,
    backgroundColor: '#000000',
    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      
      // Enable Widevine DRM
      webgl: true,
      plugins: true,
      allowRunningInsecureContent: false,
      
      // Required for DRM-protected content
      experimentalFeatures: true,
      
      // Allow loading external URLs
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Load Zattoo
  mainWindow.loadURL('https://zattoo.com');

  // Set user agent to avoid mobile detection
  mainWindow.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Show window when ready and focus it
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Inject zattoo_inject.js when page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[ZR Electron] Page finished loading, injecting scripts...');
    injectScript();
    setTimeout(injectKeyboardListener, 500); // Small delay to ensure zattoo_inject.js is loaded
  });

  // Also inject on navigation
  mainWindow.webContents.on('did-navigate', () => {
    setTimeout(() => {
      injectScript();
      injectKeyboardListener();
    }, 1000);
  });

  // Re-inject if page changes (SPA navigation)
  mainWindow.webContents.on('did-navigate-in-page', () => {
    setTimeout(() => {
      injectScript();
      injectKeyboardListener();
    }, 500);
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function injectScript() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const injectPath = path.join(__dirname, 'src/zattoo_inject.js');
  
  try {
    const scriptContent = fs.readFileSync(injectPath, 'utf8');
    
    // Override Tauri-specific functions before injecting
    const electronScript = `
      // Override Tauri-specific functions for Electron
      window.invokeRust = function(cmd, args) {
        console.log('[ZR Electron] Rust command (NO-OP):', cmd, args);
        // Volume/mute commands are handled by OS in Electron
        if (cmd === 'set_system_volume' || cmd === 'toggle_system_mute') {
          console.log('[ZR Electron] Volume control: using OS-level controls');
        }
      };
      
      // Inject original script content
      ${scriptContent}
      
      // Log successful injection
      console.log('[ZR Electron] Script injected with Widevine support');
      window.__zrScriptInjected = true;
    `;
    
    mainWindow.webContents.executeJavaScript(electronScript).then(() => {
      console.log('[ZR Electron] Script injection initiated');
    }).catch(e => {
      console.error('[ZR Electron] Failed to inject script:', e);
    });
  } catch (e) {
    console.error('[ZR Electron] Failed to read inject script:', e);
    console.log('[ZR Electron] Trying fallback injection...');
    
    // Fallback: inject a minimal version
    mainWindow.webContents.executeJavaScript(`
      if (!window.__zattooRemote) {
        window.__zattooRemote = {
          handleKeyEvent: function(jsonStr) {
            try {
              var event = JSON.parse(jsonStr);
              console.log('[ZR Electron] Key event:', event.action, event.label);
            } catch(e) {
              console.error('[ZR Electron] Error handling key:', e);
            }
          },
          drm: { available: true, found: 1, total: 8, timestamp: Date.now() },
          version: '3.0 (Electron Fallback)'
        };
      }
      window.__zrScriptInjected = true;
      console.log('[ZR Electron] Fallback overlay initialized');
    `).catch(e2 => {
      console.error('[ZR Electron] Fallback injection failed:', e2);
    });
  }
}

function sendKeyEventToRenderer(action, label) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const eventJson = JSON.stringify({
    action: action,
    label: label,
    is_press: true,
    scan_code: 0
  });

  // Escape special characters for JavaScript string
  const escapedJson = eventJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  
  mainWindow.webContents.executeJavaScript(`
    if (window.__zattooRemote && window.__zattooRemote.handleKeyEvent) {
      window.__zattooRemote.handleKeyEvent('${escapedJson}');
    }
  `).catch(e => {
    console.error('[ZR Electron] Failed to send key event:', e);
  });
}

function setupWindowKeyboardListener() {
  // Fallback keyboard input method: intercept before input reaches the page
  // This only works when the window has focus (which is what we want)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Only handle keyDown events
      if (input.type !== 'keyDown') return;
      
      const key = input.key;
      const code = input.code;
      
      let mapping = KEY_MAP[key];
      
      // Also try matching by code for some keys
      if (!mapping) {
        const codeMap = {
          'Backspace': 'Backspace',
          'Enter': 'Enter',
          'NumpadEnter': 'Enter',
          'Escape': 'Escape',
          'Delete': 'Backspace',  // On macOS, Backspace has code 'Delete'
          'ArrowUp': 'Up',
          'ArrowDown': 'Down',
          'ArrowLeft': 'Left',
          'ArrowRight': 'Right',
          'PageUp': 'PageUp',
          'PageDown': 'PageDown',
          'VolumeUp': 'VolumeUp',
          'VolumeDown': 'VolumeDown',
        };
        const codeKey = codeMap[code];
        if (codeKey) {
          mapping = KEY_MAP[codeKey];
        }
      }
      
      if (mapping) {
        // Prevent the key from reaching the page
        event.preventDefault();
        sendKeyEventToRenderer(mapping.action, mapping.label);
      }
    });
    
    console.log('[ZR Electron] Window keyboard listener installed (fallback)');
  }
}

function injectKeyboardListener() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  // Check if script is already injected
  mainWindow.webContents.executeJavaScript(`window.__zrScriptInjected`).then(result => {
    if (!result) {
      // Script not injected yet, wait and retry
      console.log('[ZR Electron] Waiting for script injection before installing keyboard listener...');
      setTimeout(injectKeyboardListener, 200);
      return;
    }
    
    // Build a mapping object as a JavaScript string
    const keyMapStr = Object.entries(KEY_MAP)
      .map(([key, mapping]) => `  '${key}': { action: '${mapping.action}', label: '${mapping.label.replace(/'/g, "\\'")}' }`)
      .join(',\n');
    
    const script = `
      (function() {
        const KEY_MAP = {
          ${keyMapStr}
        };
        
        // Listen for keydown events at the document level
        document.addEventListener('keydown', function(e) {
          const key = e.key;
          const code = e.code;
          const mapping = KEY_MAP[key] || KEY_MAP[code];
          
          if (mapping && window.__zattooRemote && window.__zattooRemote.handleKeyEvent) {
            e.preventDefault();
            e.stopPropagation();
            
            const eventJson = JSON.stringify({
              action: mapping.action,
              label: mapping.label,
              is_press: true,
              scan_code: 0
            });
            
            window.__zattooRemote.handleKeyEvent(eventJson);
          }
        }, true); // Use capture phase
        
        console.log('[ZR Electron] DOM keyboard listener installed');
      })();
    `;
    
    mainWindow.webContents.executeJavaScript(script).catch(e => {
      console.error('[ZR Electron] Failed to inject keyboard listener:', e);
    });
  }).catch(e => {
    console.error('[ZR Electron] Error checking script injection:', e);
  });
}

function registerKeyboardShortcuts() {
  // Unregister all global shortcuts to avoid interference with system keys
  // We only use window-based keyboard listener (before-input-event)
  // which only captures keys when the app window has focus
  globalShortcut.unregisterAll();
  
  // Setup the primary window-based keyboard listener
  setupWindowKeyboardListener();
  
  console.log('[ZR Electron] Keyboard input ready (window-focused only)');
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  registerKeyboardShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      registerKeyboardShortcuts();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Quit when all windows are closed
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
