import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { webUiHome } from './paths'

export interface DesktopSettings {
  launchAtLogin: boolean
  closeToBackground: boolean
  autoUpdateEnabled: boolean
}

export type DesktopSettingsPatch = Partial<DesktopSettings>

const DEFAULT_SETTINGS: DesktopSettings = {
  launchAtLogin: false,
  closeToBackground: true,
  autoUpdateEnabled: true,
}

const AUTOSTART_DESKTOP_FILE = 'hermes-studio.desktop'

let cachedSettings: DesktopSettings | null = null

function settingsPath(): string {
  return join(webUiHome(), 'desktop-settings.json')
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeSettings(value: unknown): DesktopSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    launchAtLogin: sanitizeBoolean(raw.launchAtLogin, DEFAULT_SETTINGS.launchAtLogin),
    closeToBackground: sanitizeBoolean(raw.closeToBackground, DEFAULT_SETTINGS.closeToBackground),
    autoUpdateEnabled: sanitizeBoolean(raw.autoUpdateEnabled, DEFAULT_SETTINGS.autoUpdateEnabled),
  }
}

function writeSettings(settings: DesktopSettings): void {
  const file = settingsPath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

export function getDesktopSettings(): DesktopSettings {
  if (cachedSettings) return cachedSettings
  const file = settingsPath()
  if (!existsSync(file)) {
    cachedSettings = { ...DEFAULT_SETTINGS }
    return cachedSettings
  }

  try {
    cachedSettings = sanitizeSettings(JSON.parse(readFileSync(file, 'utf-8')))
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS }
  }
  return cachedSettings
}

export function updateDesktopSettings(patch: DesktopSettingsPatch): DesktopSettings {
  const next = sanitizeSettings({ ...getDesktopSettings(), ...patch })
  cachedSettings = next
  writeSettings(next)
  return next
}

function linuxAutostartPath(): string {
  return join(process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config'), 'autostart', AUTOSTART_DESKTOP_FILE)
}

function quoteDesktopExec(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function getLinuxLaunchExecutable(): string {
  return process.env.APPIMAGE?.trim() || app.getPath('exe')
}

function setLinuxLaunchAtLogin(openAtLogin: boolean): void {
  const file = linuxAutostartPath()
  if (!openAtLogin) {
    rmSync(file, { force: true })
    return
  }

  mkdirSync(dirname(file), { recursive: true })
  const execPath = quoteDesktopExec(getLinuxLaunchExecutable())
  writeFileSync(file, [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    'Name=Hermes Studio',
    `Exec=${execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n'), { mode: 0o600 })
}

function getLinuxLaunchAtLogin(): boolean {
  return existsSync(linuxAutostartPath())
}

export function setLaunchAtLogin(openAtLogin: boolean): void {
  if (process.platform === 'linux') {
    setLinuxLaunchAtLogin(openAtLogin)
    return
  }

  app.setLoginItemSettings({
    openAtLogin,
    path: resolve(app.getPath('exe')),
  })
}

export function getLaunchAtLogin(): boolean {
  if (process.platform === 'linux') return getLinuxLaunchAtLogin()
  return app.getLoginItemSettings().openAtLogin
}

export function syncLaunchAtLogin(settings = getDesktopSettings()): DesktopSettings {
  try {
    setLaunchAtLogin(settings.launchAtLogin)
  } catch (err) {
    console.error('[desktop-settings] failed to apply launch-at-login:', err)
  }
  return {
    ...settings,
    launchAtLogin: getLaunchAtLogin(),
  }
}
