#!/usr/bin/env bash
# macOS development environment setup for Zattoo Desktop App
# Usage: bash scripts/setup-mac.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
err()   { echo -e "${RED}[ERR]${NC} $*"; }

# ── 1. Xcode Command Line Tools ──────────────────────────────────────
if ! xcode-select -p &>/dev/null; then
    info "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "  ⏳ Follow the GUI prompts, then re-run this script."
    exit 0
else
    info "✓ Xcode CLT already installed"
fi

# ── 2. Rust (rustup) ─────────────────────────────────────────────────
if ! command -v cargo &>/dev/null; then
    info "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    info "✓ Rust installed: $(rustc --version)"
else
    info "✓ Rust already installed: $(rustc --version)"
fi

# ── 3. Node.js dependencies ──────────────────────────────────────────
if [ ! -d node_modules ]; then
    info "Installing npm dependencies..."
    npm install
fi
info "✓ npm dependencies ready"

# ── 4. Playwright browser (for E2E tests) ────────────────────────────
if [ ! -d ~/Library/Caches/ms-playwright ]; then
    info "Downloading Playwright browsers..."
    npx playwright install chromium
fi
info "✓ Playwright chromium installed"

# ── 5. Build ─────────────────────────────────────────────────────────
info "Building the app..."
npm run tauri build

info "✅ Done! App binary at: src-tauri/target/release/zattoo-remote"
