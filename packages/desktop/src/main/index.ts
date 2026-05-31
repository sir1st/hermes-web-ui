import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { join } from 'node:path'
import { startWebUiServer, stopWebUiServer, getToken } from './webui-server'
import { desktopIcon, hermesBinExists, hermesBin } from './paths'
import { checkForDesktopUpdates, configureAutoUpdater, initAutoUpdater } from './updater'
import {
  getDesktopSettings,
  syncLaunchAtLogin,
  updateDesktopSettings,
  type DesktopSettings,
  type DesktopSettingsPatch,
} from './settings'
import { createOrUpdateTray, destroyTray, showWindow } from './tray'

const PORT = Number(process.env.HERMES_DESKTOP_PORT) || 8748

let mainWindow: BrowserWindow | null = null
let serverUrl: string | null = null
let desktopSettings: DesktopSettings = getDesktopSettings()
let quitting = false
let quitPromise: Promise<void> | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'Hermes Studio',
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: process.platform !== 'darwin',
    ...(process.platform !== 'darwin' ? {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#1a1a1a',
        symbolColor: '#e5e5e5',
        height: 36,
      },
    } : {}),
    ...(process.platform === 'linux' ? { icon: desktopIcon() } : {}),
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('close', (event) => {
    if (!quitting && desktopSettings.closeToBackground) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url).catch(() => undefined)
    return { action: 'deny' }
  })

  if (serverUrl) {
    mainWindow.loadURL(serverUrl)
  } else {
    mainWindow.loadURL(splashHtml())
  }
}

function splashHtml(): string {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Hermes Studio</title>
<style>
  html,body{margin:0;height:100%;background:#1a1a1a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;}
  .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px}
  .dot{width:10px;height:10px;border-radius:50%;background:#888;animation:pulse 1.2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
  .row{display:flex;gap:8px}
  .row .dot:nth-child(2){animation-delay:.2s}.row .dot:nth-child(3){animation-delay:.4s}
  .label{font-size:14px;color:#999}
  h1{font-weight:500;margin:0;font-size:18px}
</style></head><body><div class="wrap">
<h1>Hermes Studio</h1>
<div class="row"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
<div class="label">Starting local services...</div>
</div></body></html>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

function buildApplicationMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Launch at Login',
          type: 'checkbox',
          checked: desktopSettings.launchAtLogin,
          click: item => applyDesktopSettings({ launchAtLogin: item.checked }),
        },
        {
          label: 'Close Window to Background',
          type: 'checkbox',
          checked: desktopSettings.closeToBackground,
          click: item => applyDesktopSettings({ closeToBackground: item.checked }),
        },
        {
          label: 'Automatic Updates',
          type: 'checkbox',
          checked: desktopSettings.autoUpdateEnabled,
          click: item => applyDesktopSettings({ autoUpdateEnabled: item.checked }),
        },
        { label: 'Check for Updates', click: () => void checkForDesktopUpdates({ force: true }).catch(() => undefined) },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { label: `Quit ${app.name}`, accelerator: 'Command+Q', click: () => void quitApp() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]))
}

function refreshNativeDesktopControls() {
  buildApplicationMenu()
  createOrUpdateTray({
    showWindow: () => {
      if (!mainWindow) createWindow()
      showWindow(mainWindow)
    },
    quitApp: () => void quitApp(),
    checkForUpdates: () => void checkForDesktopUpdates({ force: true }).catch(() => undefined),
    updateSetting: patch => applyDesktopSettings(patch),
    getSettings: () => desktopSettings,
  })
}

function applyDesktopSettings(patch: DesktopSettingsPatch): DesktopSettings {
  desktopSettings = syncLaunchAtLogin(updateDesktopSettings(patch))
  configureAutoUpdater(desktopSettings.autoUpdateEnabled)
  refreshNativeDesktopControls()
  mainWindow?.webContents.send('hermes-desktop:settings-changed', desktopSettings)
  return desktopSettings
}

async function quitApp(): Promise<void> {
  if (quitPromise) return quitPromise
  quitting = true
  quitPromise = (async () => {
    destroyTray()
    await stopWebUiServer().catch(() => undefined)
    app.exit(0)
  })()
  return quitPromise
}

async function bootstrap() {
  if (!hermesBinExists()) {
    console.error(`hermes binary missing at ${hermesBin()}`)
    console.error('Run: npm run prepare:python (to bundle Python + hermes-agent)')
  }

  try {
    const url = await startWebUiServer(PORT)
    serverUrl = url
    if (mainWindow) await mainWindow.loadURL(url)
  } catch (err) {
    console.error('Failed to start Web UI server:', err)
    if (mainWindow) {
      const msg = String(err instanceof Error ? err.message : err).replace(/[<>]/g, '')
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
        `<html><body style="font-family:system-ui;padding:32px;background:#1a1a1a;color:#eee">
         <h2>Failed to start local services</h2><pre style="white-space:pre-wrap;color:#f88">${msg}</pre>
         </body></html>`,
      ))
    }
  }
}

ipcMain.handle('hermes-desktop:get-token', () => getToken())
ipcMain.handle('hermes-desktop:get-settings', () => desktopSettings)
ipcMain.handle('hermes-desktop:update-settings', (_event, patch: DesktopSettingsPatch) => applyDesktopSettings(patch))
ipcMain.handle('hermes-desktop:check-for-updates', async () => {
  await checkForDesktopUpdates({ force: true })
  return { ok: true }
})
ipcMain.handle('hermes-desktop:quit', () => quitApp())

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) createWindow()
    showWindow(mainWindow)
  })

  app.whenReady().then(() => {
    desktopSettings = syncLaunchAtLogin(desktopSettings)
    refreshNativeDesktopControls()
    createWindow()
    bootstrap()
    initAutoUpdater({
      enabled: desktopSettings.autoUpdateEnabled,
      onBeforeInstall: async () => {
        quitting = true
        await stopWebUiServer().catch(() => undefined)
      },
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        showWindow(mainWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (!desktopSettings.closeToBackground) void quitApp()
  })

  app.on('before-quit', (e) => {
    if (quitting) return
    e.preventDefault()
    void quitApp()
  })
}
