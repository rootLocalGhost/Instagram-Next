# 📸 Instagram Desktop

An official Instagram web wrapper desktop client built for Windows and Linux using **Tauri v2**, **Solid.js**, **Rust**, **TypeScript**, and **Native CSS**.

![Platform](https://img.shields.io/badge/Platforms-Windows%20%7C%20Linux%20%7C%20Arch%20Linux-blue?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri-v2.0-orange?style=for-the-badge&logo=tauri)
![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2c4f7c?style=for-the-badge&logo=solid)
![Rust](https://img.shields.io/badge/Rust-1.80+-black?style=for-the-badge&logo=rust)

---

## ✨ Features

- 🔔 **Native OS Toast Notifications**: Full Windows 10/11 & Linux notification integration for new Direct Messages, likes, comments, and mentions.
- 💬 **Direct Messages Interceptor**: Injected script intercepts notifications and forwards them natively with one-click deep link routing directly into the chat thread.
- 🔴 **Live Unread Badges**: Pulsing notification badges on the titlebar and taskbar/tray.
- 🪟 **System Tray & Close-to-Tray**: Runs in the system tray in the background to ensure you never miss an alert.
- 🧭 **Quick Navigation**: Instant toolbar jumps to Home Feed, Direct Messages (`/direct/inbox`), Explore, and Activity.
- 🔍 **Zoom & Viewport Scale**: Zoom in (`Ctrl++`), Zoom out (`Ctrl+-`), Reset (`Ctrl+0`) between 80% and 150%.
- 🌙 **Fluent Acrylic / Glassmorphism**: Instagram signature gradients (`#f09433` -> `#dc2743` -> `#bc1888`) with dark/light mode synchronization.

---

## 📦 Installation & Downloads

Prebuilt installers are generated automatically on every release via GitHub Actions.

### 🪟 Windows (10 / 11)
- **Setup Installer (`.exe`)**: Download `Instagram Desktop_*_x64-setup.exe` and run the installer.
- **MSI Package (`.msi`)**: Download `Instagram Desktop_*_x64_en-US.msi`.
- **Portable Zip (`.zip`)**: Download `Instagram-Desktop-Windows-Portable.zip`, extract and run `instagram-desktop.exe`.

### 🐧 Linux (Ubuntu / Debian / Fedora / Universal)
- **Universal AppImage**:
  ```bash
  chmod +x "Instagram Desktop_1.0.0_amd64.AppImage"
  ./"Instagram Desktop_1.0.0_amd64.AppImage"
  ```
- **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo dpkg -i instagram-desktop_*_amd64.deb
  sudo apt-get install -f
  ```
- **Fedora / RHEL (`.rpm`)**:
  ```bash
  sudo dnf install instagram-desktop-*_x86_64.rpm
  ```

### 🏹 Arch Linux / Manjaro / EndeavourOS

#### ⚡ One-Command Instant Install (Zero compilation / No build tools needed):
```bash
curl -fsSL https://raw.githubusercontent.com/rootLocalGhost/Instagram-Next/main/packaging/arch/install-arch.sh | bash
```
*(Or run `./packaging/arch/install-arch.sh` from the repository)*

#### 📦 Using PKGBUILD with makepkg:
```bash
cd packaging/arch
makepkg -si
```

---

## 🚀 Development & Local Build

### Prerequisites
- Node.js (v18+) & npm
- Rust & Cargo (1.75+)
- Linux only: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`

### Install Dependencies
```bash
npm install
```

### Run Locally in Development Mode
```bash
npm run tauri dev
```

### Build Production Installers Locally
```bash
npm run tauri build
```
Built binaries and installers will be placed in:
- Windows: `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/deb/`, `appimage/`, and `rpm/`

---

## 🤖 Automated GitHub Release Workflow

Pushing a version tag automatically triggers GitHub Actions to build and publish all assets:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow:
1. Builds Windows NSIS setup (`.exe`), MSI (`.msi`), and Portable (`.zip`).
2. Builds Linux AppImage, Debian (`.deb`), and RedHat (`.rpm`).
3. Builds Arch Linux native package (`.pkg.tar.zst`).
4. Generates `SHA256SUMS.txt`.
5. Formats automated release notes with emojis and publishes the GitHub Release.
