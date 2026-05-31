/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface HermesDesktopSettings {
  launchAtLogin: boolean
  closeToBackground: boolean
  autoUpdateEnabled: boolean
}

interface HermesDesktopBridge {
  getToken: () => Promise<string>
  getSettings: () => Promise<HermesDesktopSettings>
  updateSettings: (patch: Partial<HermesDesktopSettings>) => Promise<HermesDesktopSettings>
  checkForUpdates: () => Promise<unknown>
  quit: () => Promise<void>
  onSettingsChanged: (callback: (settings: HermesDesktopSettings) => void) => () => void
  platform: NodeJS.Platform
  isDesktop: true
}

interface Window {
  hermesDesktop?: HermesDesktopBridge
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
