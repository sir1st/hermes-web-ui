import { app, BrowserWindow, Menu, Tray } from 'electron'
import { desktopIcon } from './paths'
import type { DesktopSettings } from './settings'

let tray: Tray | null = null

export interface TrayHandlers {
  showWindow: () => void
  quitApp: () => void
  checkForUpdates: () => void
  updateSetting: (patch: Partial<DesktopSettings>) => void
  getSettings: () => DesktopSettings
}

export function createOrUpdateTray(handlers: TrayHandlers): void {
  if (!tray) {
    tray = new Tray(desktopIcon())
    tray.setToolTip('Hermes Studio')
    tray.on('click', handlers.showWindow)
  }

  const settings = handlers.getSettings()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Hermes Studio', click: handlers.showWindow },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: settings.launchAtLogin,
      click: item => handlers.updateSetting({ launchAtLogin: item.checked }),
    },
    {
      label: 'Close Window to Background',
      type: 'checkbox',
      checked: settings.closeToBackground,
      click: item => handlers.updateSetting({ closeToBackground: item.checked }),
    },
    {
      label: 'Automatic Updates',
      type: 'checkbox',
      checked: settings.autoUpdateEnabled,
      click: item => handlers.updateSetting({ autoUpdateEnabled: item.checked }),
    },
    { label: 'Check for Updates', click: handlers.checkForUpdates },
    { type: 'separator' },
    { label: `Quit ${app.name}`, click: handlers.quitApp },
  ]))
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

export function showWindow(window: BrowserWindow | null): void {
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
