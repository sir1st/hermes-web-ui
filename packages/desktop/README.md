# @hermes-web-ui/desktop

Desktop packaging for [Hermes Web UI](../../README.md). This package bundles
the Hermes Web UI as a native desktop app via Electron, alongside an embedded
Python runtime and the `hermes-agent` runtime.

## What's inside

- **Electron main process** (`src/main/`) — boots the embedded Koa server from
  `hermes-web-ui` on `127.0.0.1:8648`, manages auth tokens and auto-update.
- **Preload script** (`src/preload/`) — exposes a minimal IPC surface to the
  renderer.
- **Build resources** (`build/`) — application icons (`icon.icns`, `icon.ico`,
  `icon.png`).
- **Scripts** (`scripts/`) — fetch `python-build-standalone`, install
  `hermes-agent` into it, and apply local patches.
- **Patches** (`patches/`) — local patches against `hermes-agent` (see
  `patches/README.md`).

## Relationship to the monorepo

This package depends on the workspace root building `hermes-web-ui` first
(`packages/server`, `packages/client`). The Electron shell loads the built
output produced by the root project at runtime; it does **not** rebuild the
web UI itself.

```
hermes-web-ui (root)
├── packages/client   → Vue 3 SPA
├── packages/server   → Koa API server
├── packages/skills   → Skill plugins
├── packages/website  → Marketing site
└── packages/desktop  ← this package (Electron shell)
```

## Development

All commands are run from this package directory (or via
`npm run -w @hermes-web-ui/desktop ...` from the repo root).

```bash
# 1. Build the web UI from the repo root first
cd ../..
npm install
npm run build

# 2. Prepare the embedded Python runtime + hermes-agent
cd packages/desktop
npm run prepare:python

# 3. Run the desktop app in dev mode
npm run dev
```

## Distribution

```bash
# Build TypeScript and produce installers via electron-builder
npm run dist          # current platform
npm run dist:mac      # macOS
npm run dist:win      # Windows
npm run dist:linux    # Linux
```

`dist/` holds compiled main/preload sources; `release/` holds final installers.
Both directories are git-ignored.

## Dependencies

- [Electron](https://www.electronjs.org/) — desktop runtime
- [electron-builder](https://www.electron.build/) — installer/packager
- [electron-updater](https://www.electron.build/auto-update) — auto-update
- [`python-build-standalone`](https://github.com/astral-sh/python-build-standalone)
  — embedded Python 3.12
- [`hermes-agent`](https://pypi.org/project/hermes-agent/) — agent runtime
