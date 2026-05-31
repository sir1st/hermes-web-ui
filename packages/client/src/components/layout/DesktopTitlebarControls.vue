<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { NButton, NDivider, NPopover, NSwitch, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

interface DesktopSettings {
  launchAtLogin: boolean
  closeToBackground: boolean
  autoUpdateEnabled: boolean
}

const { t } = useI18n()
const message = useMessage()

const visible = ref(false)
const loading = reactive({
  launchAtLogin: false,
  closeToBackground: false,
  autoUpdateEnabled: false,
  updateCheck: false,
  quit: false,
})
const settings = reactive<DesktopSettings>({
  launchAtLogin: false,
  closeToBackground: true,
  autoUpdateEnabled: true,
})

const desktop = computed(() => window.hermesDesktop)

function applySettings(next: Partial<DesktopSettings>) {
  Object.assign(settings, next)
}

async function loadSettings() {
  const api = desktop.value
  if (!api?.getSettings) return
  try {
    applySettings(await api.getSettings())
  } catch {
    message.error(t('desktop.settingsLoadFailed'))
  }
}

async function updateSetting<K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) {
  const api = desktop.value
  if (!api?.updateSettings) return
  loading[key] = true
  try {
    applySettings(await api.updateSettings({ [key]: value }))
    message.success(t('desktop.settingsSaved'))
  } catch {
    message.error(t('desktop.settingsSaveFailed'))
  } finally {
    loading[key] = false
  }
}

async function checkForUpdates() {
  const api = desktop.value
  if (!api?.checkForUpdates) return
  loading.updateCheck = true
  try {
    await api.checkForUpdates()
    message.success(t('desktop.updateCheckStarted'))
  } catch {
    message.error(t('desktop.updateCheckFailed'))
  } finally {
    loading.updateCheck = false
  }
}

async function quitApp() {
  const api = desktop.value
  if (!api?.quit) return
  loading.quit = true
  try {
    await api.quit()
  } finally {
    loading.quit = false
  }
}

let removeSettingsListener: (() => void) | undefined

onMounted(() => {
  void loadSettings()
  removeSettingsListener = desktop.value?.onSettingsChanged?.((next) => {
    applySettings(next)
  })
})

onUnmounted(() => {
  removeSettingsListener?.()
})
</script>

<template>
  <div class="desktop-titlebar">
    <div class="desktop-titlebar-drag-region" />
    <NPopover
      v-model:show="visible"
      trigger="click"
      placement="bottom-end"
      :show-arrow="false"
      style="padding: 0;"
    >
      <template #trigger>
        <NButton
          quaternary
          circle
          size="small"
          class="desktop-settings-trigger"
          :title="t('desktop.settings')"
          aria-label="Desktop settings"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
          </svg>
        </NButton>
      </template>

      <div class="desktop-settings-panel">
        <div class="desktop-settings-title">{{ t('desktop.settings') }}</div>
        <div class="desktop-setting-row">
          <span>{{ t('desktop.launchAtLogin') }}</span>
          <NSwitch
            size="small"
            :value="settings.launchAtLogin"
            :loading="loading.launchAtLogin"
            @update:value="value => updateSetting('launchAtLogin', value)"
          />
        </div>
        <div class="desktop-setting-row">
          <span>{{ t('desktop.closeToBackground') }}</span>
          <NSwitch
            size="small"
            :value="settings.closeToBackground"
            :loading="loading.closeToBackground"
            @update:value="value => updateSetting('closeToBackground', value)"
          />
        </div>
        <div class="desktop-setting-row">
          <span>{{ t('desktop.autoUpdates') }}</span>
          <NSwitch
            size="small"
            :value="settings.autoUpdateEnabled"
            :loading="loading.autoUpdateEnabled"
            @update:value="value => updateSetting('autoUpdateEnabled', value)"
          />
        </div>
        <NDivider />
        <div class="desktop-actions">
          <NButton size="small" secondary :loading="loading.updateCheck" @click="checkForUpdates">
            {{ t('desktop.checkForUpdates') }}
          </NButton>
          <NButton size="small" tertiary type="error" :loading="loading.quit" @click="quitApp">
            {{ t('desktop.quit') }}
          </NButton>
        </div>
      </div>
    </NPopover>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.desktop-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  z-index: 1200;
  background: #1a1a1a;
}

.desktop-titlebar-drag-region {
  position: absolute;
  inset: 0;
  -webkit-app-region: drag;
}

.desktop-settings-trigger {
  position: absolute;
  top: 4px;
  right: 142px;
  width: 28px;
  height: 28px;
  -webkit-app-region: no-drag;
  color: #cfcfcf;

  &:hover {
    color: #ffffff;
  }
}

.desktop-settings-panel {
  width: 260px;
  padding: 12px;
}

.desktop-settings-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 8px;
}

.desktop-setting-row {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: $text-secondary;
}

.desktop-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

@media (max-width: $breakpoint-mobile) {
  .desktop-settings-trigger {
    right: 128px;
  }
}
</style>
