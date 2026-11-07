# Install and run Tempo

This guide is for contributors or coding agents who want to run Tempo from source. Each person runs the Electron desktop app on their own operating system. No installer is created.

## Prerequisites

Install only: **Git** and **Node.js 22.12 or later** (Node.js LTS is recommended). npm is included with Node.js. No Rust, Python, Visual Studio, or C++ compiler is required for the current app.

Electron, SQLite compiled to WebAssembly, and the frontend tools are npm development dependencies. `npm ci` installs them from the lockfile; there is no separate global Electron, SQLite, or native compiler installation. The first install downloads the Electron runtime, so an internet connection is needed.

## Get the source and run Tempo

```sh
git clone https://github.com/arunmp25/time-tracker.git
cd time-tracker
npm ci --cache .npm-cache
npm run desktop:run
```

`desktop:run` builds the React interface and opens the built app in Electron. To work with the Vite live-reload server instead, run:

```sh
npm run desktop:dev
```

To open the interface in a browser without the desktop shell, use `npm run dev`. The operating-system username is available only in the Electron app.

## Troubleshooting

- **`npm` or `node` not found:** install Node.js LTS and reopen the terminal.
- **Dependency download fails:** check the network/proxy and rerun `npm ci --cache .npm-cache`. Electron's runtime is downloaded during setup.
- **The desktop window is blank after a source change:** run `npm run desktop:run` to rebuild the frontend, or use `npm run desktop:dev` while developing.

## Data and storage

Tempo writes its SQLite database to `.tempo-data/tempo.sqlite` in the project directory. Electron profile, session, cache, and crash files also stay under `.tempo-data/`; that folder is ignored by Git. npm downloads can be kept project-local with the `--cache .npm-cache` option shown above. Copy `.tempo-data/` to back up a project, or use **Settings → Local data → Open folder**. **Delete all data** in Settings clears the database and resets the app. On first launch, browser-stored Tempo data available to the app is migrated to SQLite. The previous Electron profile is copied into the project folder before its old app-specific profile is removed. Data from the older Tauri/WebView profile is separate and is not automatically imported. The folder can also be removed with Tempo closed to clear the local database and Electron profile together.
