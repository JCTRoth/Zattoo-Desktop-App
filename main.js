/**
 * Zattoo Desktop App usable by a USB Remote - Electron Main Process
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

// Channel mapping for digit keys (from zattoo_inject.js)
const CHANNEL_MAP = {
  "0": { name: "arte", search: "arte", slug: "arte" },
  "1": { name: "Das Erste", search: "Das Erste", slug: "daserste" },
  "2": { name: "ZDF", search: "ZDF", slug: "zdf" },
  "3": { name: "RTL", search: "RTL", slug: "rtl_deutschland" },
  "4": { name: "Sat.1", search: "Sat.1", slug: "sat1_deutschland" },
  "5": { name: "ProSieben", search: "ProSieben", slug: "pro7_deutschland" },
  "6": { name: "VOX", search: "VOX", slug: "vox_deutschland" },
  "7": { name: "kabel eins", search: "kabel eins", slug: "kabel1_deutschland" },
  "8": { name: "RTL Zwei", search: "RTL Zwei", slug: "rtl2_deutschland" },
  "9": { name: "3sat", search: "3sat", slug: "3sat" },
  "11": { name: "ZDFneo", search: "ZDFneo", slug: "zdfneo" },
  "22": { name: "ZDFinfo", search: "ZDFinfo", slug: "zdfinfo" },
  "33": { name: "sixx", search: "sixx", slug: "sixx_deutschland" },
  "44": { name: "DMAX", search: "DMAX", slug: "dmax_deutschland" },
  "55": { name: "Tele 5", search: "Tele 5", slug: "tele5_deutschland" },
  "66": { name: "N24 Doku", search: "N24 Doku", slug: "welt_deutschland" },
  "77": { name: "Comedy Central", search: "Comedy Central", slug: "comedycentral_deutschland" },
  "88": { name: "Nitro", search: "Nitro", slug: "nitro_deutschland" },
  "99": { name: "Super RTL", search: "Super RTL", slug: "superrtl_deutschland" },
};

// Action descriptions for logging
const ACTION_DESCRIPTIONS = {
  // Digit keys - will be resolved to channel names
  'digit_0': () => `→ ${CHANNEL_MAP["0"].name}`,
  'digit_1': () => `→ ${CHANNEL_MAP["1"].name}`,
  'digit_2': () => `→ ${CHANNEL_MAP["2"].name}`,
  'digit_3': () => `→ ${CHANNEL_MAP["3"].name}`,
  'digit_4': () => `→ ${CHANNEL_MAP["4"].name}`,
  'digit_5': () => `→ ${CHANNEL_MAP["5"].name}`,
  'digit_6': () => `→ ${CHANNEL_MAP["6"].name}`,
  'digit_7': () => `→ ${CHANNEL_MAP["7"].name}`,
  'digit_8': () => `→ ${CHANNEL_MAP["8"].name}`,
  'digit_9': () => `→ ${CHANNEL_MAP["9"].name}`,
  
  // Navigation
  'up': () => 'Navigate Up',
  'down': () => 'Navigate Down',
  'left': () => 'Navigate Left',
  'right': () => 'Navigate Right',
  
  // Channel navigation
  'channel_up': () => 'Channel Up',
  'channel_down': () => 'Channel Down',
  
  // OK/Back
  'ok': () => 'Select',
  'back': () => 'Go Back',
  
  // Playback
  'play_pause': () => 'Play/Pause',
  'rewind': () => 'Rewind -15s',
  'fast_forward': () => 'Fast Forward +15s',
  'stop': () => 'Stop',
  'restart': () => 'Restart',
  'next_program': () => 'Next Program',
  
  // Volume
  'volume_up': () => 'Volume Up',
  'volume_down': () => 'Volume Down',
  'mute': () => 'Toggle Mute',
  
  // Colored buttons
  'color_red': () => 'Red Button',
  'color_green': () => 'Green Button',
  'color_yellow': () => 'Yellow Button',
  'color_blue': () => 'Blue Button',
  
  // Menu/Guide
  'guide': () => 'Open EPG Guide',
  'menu': () => 'Open Menu',
  'home': () => 'Go Home',
  'settings': () => 'Open Settings',
  'account': () => 'Open Account',
  'recordings': () => 'Open Recordings',
  'search': () => 'Open Search',
  'context_menu': () => 'Open Context Menu',
  
  // Other
  'record': () => 'Record',
  'www': () => 'Open Web',
  'mail': () => 'Open Mail',
  'zoom_in': () => 'Zoom In',
  'zoom_out': () => 'Zoom Out',
  'mouse_mode': () => 'Toggle Mouse Mode',
  'power': () => 'Power',
  
  // MXIII specific
  'next_track': () => 'Next Track',
  'previous_track': () => 'Previous Track',
};

function getActionDescription(action, key) {
  // For digit keys, check if we have a specific channel mapping
  if (action && action.startsWith('digit_')) {
    const digit = action.split('_')[1];
    if (CHANNEL_MAP[digit]) {
      return `→ ${CHANNEL_MAP[digit].name}`;
    }
    return `→ Channel ${digit}`;
  }
  
  // Look up in action descriptions
  if (ACTION_DESCRIPTIONS[action]) {
    return ACTION_DESCRIPTIONS[action]();
  }
  
  // Fallback to label from KEY_MAP or MXIII_KEY_MAP
  if (KEY_MAP[key]?.label) {
    return KEY_MAP[key].label;
  }
  if (MXIII_KEY_MAP[key]?.label) {
    return MXIII_KEY_MAP[key].label;
  }
  
  return action || 'Unknown';
}

// MXIII RF Remote key mappings (raw keycodes)
const MXIII_KEY_MAP = {
  // Power
  '10081': { action: 'power', label: '🔄 Power' },
  
  // Playback controls (mouse device - c0xxx)
  'c00cd': { action: 'play_pause', label: '⏯ Play/Pause' },
  'c00b4': { action: 'rewind', label: '⏪ Rewind' },
  'c00b3': { action: 'fast_forward', label: '⏩ FF' },
  'c00b6': { action: 'restart', label: '⏮ Restart' },
  'c00b5': { action: 'next_program', label: '⏭ Next' },
  
  // Zoom/Aspect
  'c022d': { action: 'zoom_in', label: '🔍+ Zoom In' },
  'c022e': { action: 'zoom_out', label: '🔍- Zoom Out' },
  
  // Volume (mouse device)
  'c00e9': { action: 'volume_up', label: '🔊+ Vol Up' },
  'c00ea': { action: 'volume_down', label: '🔊- Vol Down' },
  'c00e2': { action: 'mute', label: '🔇 Mute' },
  
  // Navigation (keyboard device - 700xx)
  '70052': { action: 'up', label: '▲ Up' },
  '70051': { action: 'down', label: '▼ Down' },
  '70050': { action: 'left', label: '← Left' },
  '7004f': { action: 'right', label: '→ Right' },
  '70028': { action: 'ok', label: '✓ OK' },
  
  // Page navigation (keyboard device)
  '7004b': { action: 'channel_up', label: 'CH+' },
  '7004e': { action: 'channel_down', label: 'CH-' },
  
  // Home & Menu
  'c0223': { action: 'home', label: '🏠 Home' },
  '90002': { action: 'context_menu', label: '⋮ Menu' },
  
  // Digit keys (keyboard device)
  '7001e': { action: 'digit_1', label: '1' },
  '7001f': { action: 'digit_2', label: '2' },
  '70020': { action: 'digit_3', label: '3' },
  '70021': { action: 'digit_4', label: '4' },
  '70022': { action: 'digit_5', label: '5' },
  '70023': { action: 'digit_6', label: '6' },
  '70024': { action: 'digit_7', label: '7' },
  '70025': { action: 'digit_8', label: '8' },
  '70026': { action: 'digit_9', label: '9' },
  '70027': { action: 'digit_0', label: '0' },
  
  // Special keys (keyboard device)
  '7002a': { action: 'back', label: '⬅ Back' },
  '7003c': { action: 'color_yellow', label: '🟡 Yellow' },
  '7003b': { action: 'color_green', label: '🟢 Green' },
  '7003d': { action: 'color_blue', label: '🔵 Blue' },
  '7003e': { action: 'color_red', label: '🔴 Red' },
  '7003f': { action: 'guide', label: '📋 EPG' },
  '70040': { action: 'recordings', label: '📼 Recordings' },
  '70065': { action: 'search', label: '🔍 Search' },
  
  // Other keys
  'c0183': { action: 'settings', label: '⚙ Config' },
  'c018a': { action: 'mail', label: '📧 Mail' },
  'c008a': { action: 'www', label: '🌐 Web' }
};

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
  'ArrowUp': { action: 'up', label: '▲ Up' },
  'ArrowDown': { action: 'down', label: '▼ Down' },
  'ArrowLeft': { action: 'left', label: '← Left' },
  'ArrowRight': { action: 'right', label: '→ Right' },
  
  // Navigation keys
  'Return': { action: 'ok', label: 'OK' },
  'Enter': { action: 'ok', label: 'OK' },
  'NumpadEnter': { action: 'ok', label: 'OK' },
  'Escape': { action: 'back', label: '⬅ Back' },
  'Backspace': { action: 'back', label: '⬅ Back' },
  'Delete': { action: 'back', label: '⬅ Back' },
  
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

// Track injection state to prevent duplicates
let scriptInjected = false;
let keyboardListenerInjected = false;

function checkAuthAndRedirect() {
  // Common Zattoo auth key names to check in localStorage
  const authKeys = [
    'access_token',
    'auth_token',
    'zattoo_token',
    'jwt_token',
    'session_token',
    'auth',
    'session',
    'user',
    'credentials'
  ];
  
  let hasRedirected = false;
  let checkCount = 0;
  const MAX_CHECKS = 20; // Check for 10 seconds (500ms * 20)
  
  // Check for auth keys after page loads
  const checkAuth = setInterval(() => {
    checkCount++;
    
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(checkAuth);
      return;
    }
    
    // Stop if we've already redirected or max checks reached
    if (hasRedirected || checkCount >= MAX_CHECKS) {
      clearInterval(checkAuth);
      return;
    }
    
    console.log('[ZR Electron] checkAuth: checking auth keys (attempt', checkCount + ')');
    mainWindow.webContents.executeJavaScript(`
      (() => {
        // Don't redirect if already on login page
        if (window.location.href.indexOf('/login') >= 0) {
          console.log('[ZR checkAuth] Already on login page, stopping redirect');
          return true;
        }
        const authKeys = ${JSON.stringify(authKeys)};
        for (const key of authKeys) {
          if (localStorage.getItem(key)) {
            console.log('[ZR checkAuth] Found auth key:', key);
            return true;
          }
        }
        console.log('[ZR checkAuth] No auth keys found in localStorage');
        return false;
      })()
    `).then(hasAuth => {
      if (!hasAuth && !hasRedirected) {
        hasRedirected = true;
        console.log('[ZR Electron] No auth key found, redirecting to login page');
        mainWindow.loadURL('https://zattoo.com/login');
        clearInterval(checkAuth);
      } else if (hasAuth) {
        console.log('[ZR Electron] Auth key found, staying on main page');
        clearInterval(checkAuth);
      }
    }).catch(e => {
      console.error('[ZR Electron] Error checking auth:', e);
      if (checkCount >= MAX_CHECKS) {
        clearInterval(checkAuth);
      }
    });
  }, 500);
}

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
  
  // Check for auth key and redirect to login if not present
  checkAuthAndRedirect();

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
    // Note: DOM keyboard listener disabled to avoid duplicate events with window listener
  });

  // Also inject on navigation
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[ZR Electron] Navigated to:', url);
    resetInjectionState();
    setTimeout(() => {
      injectScript();
      // Note: DOM keyboard listener disabled to avoid duplicate events with window listener
    }, 100);
  });

  // Re-inject if page changes (SPA navigation)
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('[ZR Electron] Navigated in-page to:', url);
    setTimeout(() => {
      if (!scriptInjected) {
        injectScript();
      }
      // Note: DOM keyboard listener disabled to avoid duplicate events with window listener
    }, 100);
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function injectScript() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log('[ZR Electron] injectScript: window not available');
    return;
  }
  if (scriptInjected) {
    console.log('[ZR Electron] injectScript: already injected');
    return;
  }

  console.log('[ZR Electron] injectScript: attempting to inject...');
  const injectPath = path.join(__dirname, 'src/zattoo_inject.js');
  console.log('[ZR Electron] injectScript: path =', injectPath);
  
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
      console.log('[ZR Electron] Script injection completed');
      scriptInjected = true;
    }).catch(e => {
      console.error('[ZR Electron] Failed to inject script:', e);
    });
  } catch (e) {
    console.error('[ZR Electron] Failed to read inject script:', e);
    console.error('[ZR Electron] Error details:', e.stack);
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
    `).then(() => {
      scriptInjected = true;
    }).catch(e2 => {
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
    var hasHandler = window.__zattooRemote && window.__zattooRemote.handleKeyEvent;
    if (hasHandler) {
      window.__zattooRemote.handleKeyEvent('${escapedJson}');
    }
    hasHandler;
  `).then(hasHandler => {
    if (!hasHandler) {
      console.log('[ZR Electron] Warning: handleKeyEvent not available in renderer');
    }
  }).catch(e => {
    console.error('[ZR Electron] Failed to send key event:', e);
  });
  
  const actionDesc = getActionDescription(action, null);
  console.log(`[ZR Electron] Sent key event: ${action} (${label}) [${actionDesc}]`);
}

function setupWindowKeyboardListener() {
  // Primary keyboard input method: intercept before input reaches the page
  // This only works when the window has focus (which is what we want)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Only handle keyDown events
      if (input.type !== 'keyDown') return;
      
      const key = input.key;
      const code = input.code;
      // Note: Electron's Input object does NOT have keyCode property
      // We use 'code' for MXIII RF Remote key matching
      const keyCode = input.keyCode ? input.keyCode.toString(16) : null;
      
      let mapping = null;
      
      // First try to match by standard key name
      mapping = KEY_MAP[key];
      
      // Then try matching by code for some keys
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
      
      // Try MXIII raw keycodes - match against the 'code' property
      // MXIII RF Remote sends custom codes like 'c00cd', '70052', etc.
      if (!mapping && code) {
        const mxiiiKey = code.toLowerCase();
        mapping = MXIII_KEY_MAP[mxiiiKey];
      }
      
      // Also try keyCode as fallback (for compatibility)
      if (!mapping && keyCode) {
        mapping = MXIII_KEY_MAP[keyCode.toLowerCase()];
      }
      
      if (mapping) {
        // For standard browser keys (Backspace, Enter, Escape), let them pass through to the page
        // This allows Zattoo's built-in keyboard handling to work naturally
        const standardKeys = ['Backspace', 'Enter', 'NumpadEnter', 'Delete', 'Escape', 'Return'];
        const isStandardKey = standardKeys.includes(key) || standardKeys.includes(code);
        
        // For MXIII keys, always prevent default since they're custom keycodes
        const isMxiiiKey = (code && MXIII_KEY_MAP[code.toLowerCase()]) || 
                       (keyCode && MXIII_KEY_MAP[keyCode.toLowerCase()]);
        
        if (!isStandardKey || isMxiiiKey) {
          // For special remote keys, prevent default and send via our handler
          event.preventDefault();
        }
        
        // Send the event to our handler for OSD display and other processing
        // Check if script is loaded before sending events
        const actionDesc = getActionDescription(mapping.action, key);
        mainWindow.webContents.executeJavaScript(`window.__zrScriptInjected`).then(scriptLoaded => {
          if (scriptLoaded) {
            sendKeyEventToRenderer(mapping.action, mapping.label);
            const logSuffix = isStandardKey ? '(passed through)' : isMxiiiKey ? '(MXIII handled)' : '(handled)';
            console.log(`[ZR Electron] Window listener: ${key} (${code}) [${actionDesc}] -> ${mapping.action} ${logSuffix}`);
          } else {
            console.log(`[ZR Electron] Window listener: ${key} (${code}) [${actionDesc}] -> ${mapping.action} (script not loaded yet)`);
            // Retry after a short delay
            setTimeout(() => sendKeyEventToRenderer(mapping.action, mapping.label), 100);
          }
        }).catch(() => {
          // If we can't check, try sending anyway
          sendKeyEventToRenderer(mapping.action, mapping.label);
          console.log(`[ZR Electron] Window listener: ${key} (${code}) [${actionDesc}] -> ${mapping.action} (could not check script status)`);
        });
      }
    });
    
    console.log('[ZR Electron] Window keyboard listener installed (primary)');
    console.log('[ZR Electron] MXIII RF Remote support enabled');
  }
}

function injectKeyboardListener() {
  if (!mainWindow || mainWindow.isDestroyed() || keyboardListenerInjected) return;
  
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
        
        // Enhanced key matching function
        function getKeyMapping(key, code) {
          // Direct key match
          if (KEY_MAP[key]) return KEY_MAP[key];
          
          // Code match (for special keys like NumpadEnter, Delete, etc.)
          if (KEY_MAP[code]) return KEY_MAP[code];
          
          // Additional code mappings for cross-platform compatibility
          const codeMap = {
            'NumpadEnter': 'Enter',
            'Delete': 'Backspace',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right'
          };
          
          if (codeMap[code] && KEY_MAP[codeMap[code]]) {
            return KEY_MAP[codeMap[code]];
          }
          
          return null;
        }
        
        // Listen for keydown events at the document level
        document.addEventListener('keydown', function(e) {
          const key = e.key;
          const code = e.code;
          const mapping = getKeyMapping(key, code);
          
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
    
    mainWindow.webContents.executeJavaScript(script).then(() => {
      console.log('[ZR Electron] DOM keyboard listener installation completed');
      keyboardListenerInjected = true;
    }).catch(e => {
      console.error('[ZR Electron] Failed to inject keyboard listener:', e);
    });
  }).catch(e => {
    console.error('[ZR Electron] Error checking script injection:', e);
  });
}

function resetInjectionState() {
  // Reset injection flags when navigating to a new page
  scriptInjected = false;
  keyboardListenerInjected = false;
  console.log('[ZR Electron] Injection state reset for new page');
}

function registerKeyboardShortcuts() {
  // Unregister all global shortcuts to avoid interference with system keys
  // We only use window-based keyboard listener (before-input-event)
  // which only captures keys when the app window has focus
  globalShortcut.unregisterAll();
  
  // Setup the primary window-based keyboard listener
  setupWindowKeyboardListener();
  
  console.log('[ZR Electron] Keyboard input ready (window-focused only)');
  console.log('[ZR Electron] Standard keys (Backspace, Enter, Escape) will pass through to the page');
  console.log('[ZR Electron] Special remote keys will be handled by the app');
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
