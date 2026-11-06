# Install and build Tempo

This guide is for developers or coding agents setting up Tempo from this repository, and for creating a desktop installer for another user.

> **Current distribution status:** this repository does not publish prebuilt installers yet. Build the app on the target operating system, then share the generated bundle. Data is stored locally in each user's app profile and is not synced between devices.

## Supported build environments

Build on the operating system you intend to package for. Tauri desktop bundles are platform-specific; use separate macOS, Windows, and Linux machines or CI runners for each release target.

All platforms need:

- Git
- Node.js LTS with npm
- Rust stable installed through `rustup`

Install Rust from [rustup.rs](https://rustup.rs/), then open a fresh terminal and check:

```sh
rustc --version
cargo --version
node --version
npm --version
```

### macOS

- macOS 10.15 or later for Tauri development.
- Xcode Command Line Tools (`xcode-select --install`). Full Xcode is not required for desktop builds.

### Windows

- Microsoft C++ Build Tools with **Desktop development with C++** selected.
- Microsoft Edge WebView2 Runtime. It is already included with current Windows 10 and Windows 11 installations; install the Evergreen Runtime if missing.
- Use a current PowerShell or Windows Terminal session after installing the prerequisites.

### Linux

Tauri needs GTK and WebKitGTK development libraries. For Ubuntu/Debian, install the packages before building:

```sh
sudo apt update
sudo apt install -y build-essential curl wget file libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev
```

Other distributions need their equivalent packages. Follow the official [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for Fedora, Arch, openSUSE, and other Linux distributions. For Linux desktop fonts, install a system font package if the environment has none.

## Get the source and run Tempo

```sh
git clone https://github.com/arunmp25/time-tracker.git
cd time-tracker
npm ci
npm run desktop:dev
```

The first desktop run compiles Rust dependencies and may take a few minutes. The Vite web interface can also be run in a browser with `npm run dev`, but the operating-system profile name is available only in the Tauri desktop app.

## Build a desktop installer

From the repository root, run:

```sh
npm ci
npm run desktop:build
```

The command runs the frontend build and then Tauri's release build and bundler. Look under `src-tauri/target/release/bundle/` for the output for your operating system. Typical formats include:

- **macOS:** `.dmg` and/or `.app` under `macos/`.
- **Windows:** `.msi` or `-setup.exe` under `msi/` or `nsis/`.
- **Linux:** `.deb`, `.rpm`, or `.AppImage` under the corresponding bundle folders, depending on the build machine and installed packaging tools.

Share the generated installer for the target OS and architecture, not the repository's `target` directory. Linux packages still require their documented runtime libraries on the recipient's distribution; an AppImage is more portable, but should be built on a suitably old supported Linux baseline. See the [Tauri distribution guide](https://v2.tauri.app/distribute/) for packaging details.

### Installing the generated bundle

- **macOS:** open the `.dmg`, drag Tempo to Applications, then launch it. Builds without Apple Developer signing and notarization can produce Gatekeeper warnings. For broad distribution, configure signing and notarization as described in [Tauri's macOS distribution guide](https://v2.tauri.app/distribute/sign/macos/).
- **Windows:** run the generated `.msi` or setup executable and follow its prompts. Unsigned installers may show a Windows SmartScreen warning. Configure code signing before distributing broadly.
- **Ubuntu/Debian:** install the `.deb` with `sudo apt install ./path/to/tempo_*.deb` (replace the path with the generated filename). The package manager will report any missing runtime dependencies.
- **AppImage:** make it executable and launch it: `chmod +x ./Tempo*.AppImage && ./Tempo*.AppImage`.
- **RPM distributions:** install the generated `.rpm` with the distribution's package manager, for example `sudo dnf install ./path/to/tempo-*.rpm` on Fedora.

## Troubleshooting

- **`cargo metadata` not found:** Rust/Cargo is missing or not on `PATH`. Install Rust using rustup, reopen the terminal, and confirm `cargo --version` works.
- **Missing GTK/WebKit/WebView or linker errors on Linux:** install the Tauri system dependencies for your distribution and rerun the build.
- **Missing C++ linker or Windows SDK errors:** modify Visual Studio Build Tools and select **Desktop development with C++**, including the Windows SDK.
- **macOS developer tools errors:** run `xcode-select --install` and finish any first-launch setup requested by macOS.
- **A desktop build fails after changing frontend dependencies:** run `npm ci` from the repository root, then retry `npm run desktop:build`.

## Implementation notes

Tempo currently saves tasks, sessions, settings, calendar events, and mind map notes in browser local storage inside the app's local webview profile. Uninstalling or resetting the app profile can remove that data, so back up the device profile before doing so. There is no account, cloud backup, or device-to-device sync yet.
