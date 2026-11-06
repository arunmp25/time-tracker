# Install and run Tempo

This guide is for contributors or coding agents who want to run Tempo from source. Each person runs the Electron desktop app on their own operating system. No installer is created.

## Prerequisites

Install only: **Git** and **Node.js 22.12 or later** (Node.js LTS is recommended). npm is included with Node.js. No Rust, Python, Visual Studio, or C++ compiler is required for the current app.

Electron and the frontend tools are npm development dependencies. `npm ci` installs them from the lockfile; there is no separate global Electron installation. The first install downloads the Electron runtime, so an internet connection is needed.

## Get the source and run Tempo

```sh
git clone https://github.com/arunmp25/time-tracker.git
cd time-tracker
npm ci
npm run desktop:run
```

`desktop:run` builds the React interface and opens the built app in Electron. To work with the Vite live-reload server instead, run:

```sh
npm run desktop:dev
```

To open the interface in a browser without the desktop shell, use `npm run dev`. The operating-system username is available only in the Electron app.

## Troubleshooting

- **`npm` or `node` not found:** install Node.js LTS and reopen the terminal.
- **Dependency download fails:** check the network/proxy and rerun `npm ci`. Electron's runtime is downloaded during setup.
- **The desktop window is blank after a source change:** run `npm run desktop:run` to rebuild the frontend, or use `npm run desktop:dev` while developing.

## Data and storage

Tasks, sessions, settings, calendar events, and mind map notes are stored locally in the Electron app profile. They are not synced between devices. Removing the application profile can remove this data, so back it up before resetting the app.
