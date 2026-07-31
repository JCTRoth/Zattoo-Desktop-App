# Zattoo Remote

A **full-featured Electron-based remote control** for [Zattoo](https://zattoo.com) that solves the DRM problem. Built with Electron to ensure Widevine DRM support for all channels including RTL, Sat.1, ProSieben, and VOX.

## Features

| Feature | Status |
|---------|--------|
| Full DRM Support | Widevine via Electron Chromium |
| Keyboard Remote Control | 40+ configurable shortcuts |
| Channel Navigation | Direct URL navigation + DOM fallback |
| OSD Display | Visual feedback for all actions |
| Auto Fullscreen | Automatic fullscreen on channel pages |
| Toast Auto-dismiss | Automatically dismisses Zattoo error popups |
| Login/Search Protection | Keys ignored on login and search pages |
| SPA Navigation | Handles single-page app navigation |
| Cross-platform | macOS, Windows, Linux |

### Supported Channels

| Key | Channel | DRM Required |
|-----|---------|--------------|
| 0 | arte | No |
| 1 | Das Erste (ARD) | No |
| 2 | ZDF | No |
| 3 | RTL | Yes (Works with Electron!) |
| 4 | Sat.1 | Yes (Works with Electron!) |
| 5 | ProSieben | Yes (Works with Electron!) |
| 6 | VOX | Yes (Works with Electron!) |
| 7 | kabel eins | Yes |
| 8 | RTL Zwei | Yes |
| 9 | 3sat | No |

All DRM-protected channels work because Electron bundles Chromium with Widevine support!

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 0-9 | Channel digit input |
| Up/Down/Left/Right | Navigation |
| PageUp/PageDown | Channel up/down |
| Return/Enter | OK/Select |
| Escape/Backspace | Back |
| F1-F4 | Colored buttons (Red, Green, Yellow, Blue) |
| F5-F6 | Rewind / Fast Forward |
| F7 | Stop |
| F9 | EPG Guide |
| F10 | Settings |
| F11 | Account |
| F12 | Recordings |
| Space | Play/Pause |
| Alt | Home |
| Shift+Right | EPG |
| Ctrl+Right | Search |

**Note:** Hardware volume keys may not work on all platforms due to Electron limitations.

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/your-repo/zattoo-desktop-app.git
cd zattoo-desktop-app
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

---

## Running Tests

```bash
npm test
npm run test:watch
npm run test:ui
npm run test:e2e
```

---

## Configuration

### Channel Mapping

Edit `src/zattoo_inject.js`:

```javascript
var channelMap = {
  "0": { name: "arte", search: "arte", slug: "arte" },
  "1": { name: "Das Erste", search: "Das Erste", slug: "daserste" },
};
```

### Key Mapping

Edit `main.js`:

```javascript
const KEY_MAP = {
  '0': { action: 'digit_0', label: '0' },
  '1': { action: 'digit_1', label: '1' },
};
```

---

## Troubleshooting

### DRM Not Working

Run in DevTools console:
```javascript
navigator.requestMediaKeySystemAccess('com.widevine.alpha', [])
  .then(() => console.log("Widevine available"))
  .catch(() => console.log("Widevine NOT available"))
```

### Keyboard Shortcuts Not Working

Check console for: `[ZR Electron] Registered N keyboard shortcuts`

### App Not Starting

```bash
rm -rf node_modules && npm install
```

---

## Architecture

```
Electron
├── Main Process (main.js)
│   ├── globalShortcut (keyboard)
│   ├── Window Management
│   └── Script Injection
└── Renderer Process (Zattoo webview)
    ├── zattoo_inject.js
    ├── handleKeyEvent
    ├── OSD Display
    └── Channel Navigation
        Chromium + Widevine
```

---

## Why Electron?

### Tauri Limitations

- Uses system webviews (WKWebView/WebKitGTK)
- No Widevine DRM support on macOS/Linux
- DRM channels don't work

### Electron Advantages

- Bundles complete Chromium with Widevine
- Full DRM support on all platforms
- All channels work
- Mature framework

### Trade-offs

| Aspect | Tauri | Electron |
|--------|-------|----------|
| App Size | ~5-10 MB | ~200 MB |
| Memory | ~50-100 MB | ~150-300 MB |
| DRM Support | No | Yes |

**For TV remote with DRM, Electron is the better choice.**

---

## License

MIT License - see [LICENSE](LICENSE)
