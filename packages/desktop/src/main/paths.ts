import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir, platform, arch } from 'node:os'

const isWin = platform() === 'win32'
const osLabel = isWin ? 'win' : platform() === 'darwin' ? 'mac' : platform() // mac | linux | win
const archLabel = arch() // arm64 | x64

export function isPackaged() {
  return app.isPackaged
}

// Bundled web-ui directory.
// dev:  <hermes-web-ui repo root>     (this package lives at packages/desktop/)
// prod: <resources>/webui
//
// In dev, __dirname after `tsc` is `packages/desktop/dist/main/`, so going up
// four levels lands at the hermes-web-ui monorepo root, where `dist/server/`
// (built by `npm run build` at the repo root) and `node_modules/` live.
export function webuiDir(): string {
  if (app.isPackaged) return resolve(process.resourcesPath, 'webui')
  return resolve(__dirname, '..', '..', '..', '..')
}

export function webuiServerEntry(): string {
  return join(webuiDir(), 'dist', 'server', 'index.js')
}

// Bundled Python directory.
// dev:  packages/desktop/resources/python/<os>-<arch>
// prod: <resources>/python
//
// __dirname in dev is `packages/desktop/dist/main/`, so going up two levels
// lands at the desktop package root.
export function pythonDir(): string {
  if (app.isPackaged) return resolve(process.resourcesPath, 'python')
  return resolve(__dirname, '..', '..', 'resources', 'python', `${osLabel}-${archLabel}`)
}

export function hermesBin(): string {
  const dir = pythonDir()
  return isWin ? join(dir, 'Scripts', 'hermes.exe') : join(dir, 'bin', 'hermes')
}

export function hermesBinExists(): boolean {
  return existsSync(hermesBin())
}

export function webUiHome(): string {
  return process.env.HERMES_WEB_UI_HOME?.trim() || resolve(homedir(), '.hermes-web-ui')
}

export function tokenFile(): string {
  return join(webUiHome(), '.token')
}
