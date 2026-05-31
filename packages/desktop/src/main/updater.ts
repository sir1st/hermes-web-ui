import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

let initialized = false
let enabled = false
let timer: ReturnType<typeof setInterval> | null = null
let installDownloadedUpdate: (() => Promise<void>) | null = null

export interface AutoUpdaterOptions {
  enabled: boolean
  onBeforeInstall?: () => Promise<void>
}

export function initAutoUpdater(options: AutoUpdaterOptions) {
  enabled = options.enabled
  installDownloadedUpdate = options.onBeforeInstall || null
  if (initialized) {
    configureAutoUpdater(enabled)
    return
  }

  if (!app.isPackaged) return // dev mode: skip
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', info => {
    console.log(`[updater] update available: ${info.version}`)
  })
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] up to date')
  })
  autoUpdater.on('error', err => {
    console.error('[updater] error:', err)
  })
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Hermes Studio ${info.version} is ready to install.`,
      detail: 'Restart now to apply the update, or it will be installed on next quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) {
      await installDownloadedUpdate?.().catch(() => undefined)
      autoUpdater.quitAndInstall()
    }
  })

  configureAutoUpdater(enabled)
}

export function configureAutoUpdater(nextEnabled: boolean) {
  enabled = nextEnabled
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (!app.isPackaged || !initialized || !enabled) return

  checkForDesktopUpdates().catch(err => {
    console.error('[updater] initial check failed:', err)
  })

  // Recheck every 6h while app is running
  timer = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => undefined)
  }, 6 * 60 * 60 * 1000)
}

export async function checkForDesktopUpdates(options: { force?: boolean } = {}) {
  if (!app.isPackaged) {
    console.log('[updater] skipped update check in dev mode')
    return null
  }
  if (!enabled && !options.force) {
    console.log('[updater] skipped update check while disabled')
    return null
  }
  return autoUpdater.checkForUpdates()
}
