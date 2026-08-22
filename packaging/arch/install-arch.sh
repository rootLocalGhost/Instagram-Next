#!/usr/bin/env bash
# Arch Linux One-Command Installer for Instagram Desktop
set -e

echo "🚀 Installing Instagram Desktop for Arch Linux..."

# Install required dependencies
echo "📦 Ensuring dependencies are installed (webkit2gtk-4.1, libayatana-appindicator)..."
sudo pacman -S --needed --noconfirm webkit2gtk-4.1 libayatana-appindicator gtk3 openssl hicolor-icon-theme

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if command -v makepkg &>/dev/null; then
    echo "🔨 Building package with makepkg..."
    makepkg -si --noconfirm
    echo "✅ Instagram Desktop installed successfully! You can now launch it from your app launcher or run 'instagram-desktop'."
else
    echo "❌ makepkg not found. Please install base-devel."
    exit 1
fi
