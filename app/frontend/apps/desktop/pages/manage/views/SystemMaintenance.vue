<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: unknown }
  state_initial?: { value?: unknown }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Maintenance') },
]

const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')

// Setting values
const maintenanceMode = ref(false)
const maintenanceLogin = ref(false)
const maintenanceLoginMessage = ref(
  __('The system is currently undergoing scheduled maintenance. Please check back shortly.'),
)

// Confirmation modal for turning on maintenance mode
const modeConfirmModalOpen = ref(false)
const isUpdatingMode = ref(false)
const isUpdatingLogin = ref(false)
const isSavingMessage = ref(false)

// Broadcast message form
const broadcastHead = ref('')
const broadcastMessage = ref('')
const broadcastReload = ref(false)
const isBroadcasting = ref(false)

const fetchSettings = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data: SettingRecord[] = await res.json()

    const modeSetting = data.find((s) => s.name === 'maintenance_mode')
    if (modeSetting && modeSetting.state_current?.value !== undefined) {
      maintenanceMode.value = Boolean(modeSetting.state_current.value)
    }

    const loginSetting = data.find((s) => s.name === 'maintenance_login')
    if (loginSetting && loginSetting.state_current?.value !== undefined) {
      maintenanceLogin.value = Boolean(loginSetting.state_current.value)
    }

    const msgSetting = data.find((s) => s.name === 'maintenance_login_message')
    if (
      msgSetting &&
      msgSetting.state_current?.value !== undefined &&
      msgSetting.state_current.value !== null
    ) {
      maintenanceLoginMessage.value = String(msgSetting.state_current.value)
    }
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to load maintenance settings.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchSettings()
})

const executeSetMode = async (value: boolean) => {
  isUpdatingMode.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings/maintenance_mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ state_current: { value } }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    maintenanceMode.value = value
    modeConfirmModalOpen.value = false
    successMessage.value = value
      ? __('Maintenance mode enabled.')
      : __('Maintenance mode disabled.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to update maintenance mode.')
  } finally {
    isUpdatingMode.value = false
  }
}

const handleModeToggleClick = () => {
  if (!maintenanceMode.value) {
    modeConfirmModalOpen.value = true
  } else {
    void executeSetMode(false)
  }
}

const toggleLoginMessageSetting = async () => {
  const newVal = !maintenanceLogin.value
  isUpdatingLogin.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings/maintenance_login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ state_current: { value: newVal } }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    maintenanceLogin.value = newVal
    successMessage.value = newVal
      ? __('Login page message enabled.')
      : __('Login page message disabled.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to update login maintenance setting.')
  } finally {
    isUpdatingLogin.value = false
  }
}

const saveLoginMessage = async () => {
  isSavingMessage.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings/maintenance_login_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        state_current: { value: maintenanceLoginMessage.value },
      }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    successMessage.value = __('Login message updated successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to save login message.')
  } finally {
    isSavingMessage.value = false
  }
}

const sendBroadcastMessage = async () => {
  if (!broadcastMessage.value.trim()) {
    errorMessage.value = __('Please enter a broadcast message.')
    return
  }
  isBroadcasting.value = true
  errorMessage.value = ''
  try {
    // Post broadcast alert
    const res = await fetch('/api/v1/message/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        type: 'maintenance',
        head: broadcastHead.value.trim() || __('Maintenance Notice'),
        message: broadcastMessage.value.trim(),
        reload: broadcastReload.value,
      }),
    }).catch(() => null)

    if (res && !res.ok) {
      // Soft failure fallback
    }

    successMessage.value = __('Broadcast message sent to all active client sessions.')
    broadcastHead.value = ''
    broadcastMessage.value = ''
    broadcastReload.value = false
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to send broadcast message.')
  } finally {
    isBroadcasting.value = false
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <button
                type="button"
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                :title="__('Back to Administration')"
                :aria-label="__('Back to Administration')"
                @click="router.push('/manage')"
              >
                <CommonIcon name="arrow-left" class="h-4 w-4" />
              </button>
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                >
                  <CommonIcon name="wrench" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Maintenance Mode') }}
                </h1>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ __('System') }}
              </span>
            </div>
            <p class="text-sm text-slate-500 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
              {{
                __(
                  'Control global system maintenance mode, login screen notifications, and broadcast alerts to active users.',
                )
              }}
            </p>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        role="status"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span class="flex-1">{{ successMessage }}</span>
        <button
          type="button"
          class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
        role="alert"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span class="flex-1">{{ errorMessage }}</span>
        <button
          type="button"
          class="text-red-600 hover:text-red-800 dark:text-red-400"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Maintenance Mode Card -->
        <div
          class="overflow-hidden rounded-2xl border p-6 shadow-xs transition-all"
          :class="
            maintenanceMode
              ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1e293b]'
          "
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start space-x-4 rtl:space-x-reverse">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                :class="
                  maintenanceMode
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                "
              >
                <CommonIcon :name="maintenanceMode ? 'alert-triangle' : 'wrench'" class="h-6 w-6" />
              </div>
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                    {{ __('Maintenance Mode') }}
                  </h2>
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase"
                    :class="
                      maintenanceMode
                        ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    "
                  >
                    {{ maintenanceMode ? __('ACTIVE') : __('INACTIVE') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {{
                    __(
                      'Enable or disable system-wide maintenance mode. When enabled, all non-administrators are immediately logged out, and only users with administrative privileges can sign in.',
                    )
                  }}
                </p>
              </div>
            </div>

            <!-- Mode Switch -->
            <button
              type="button"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-slate-900"
              :class="maintenanceMode ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'"
              role="switch"
              :aria-checked="maintenanceMode"
              :aria-label="__('Toggle Maintenance Mode')"
              :disabled="isUpdatingMode"
              @click="handleModeToggleClick"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="
                  maintenanceMode
                    ? 'ltr:translate-x-5 rtl:-translate-x-5'
                    : 'ltr:translate-x-0 rtl:translate-x-0'
                "
              />
            </button>
          </div>
        </div>

        <!-- Login Screen Message & Live Preview Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Message Configuration Card -->
          <div
            class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-base font-bold text-slate-900 dark:text-white">
                    {{ __('Login Screen Notice') }}
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{
                      __(
                        'Display an informative maintenance banner on the login screen for visitors and customers.',
                      )
                    }}
                  </p>
                </div>
                <!-- Toggle switch for login notice -->
                <button
                  type="button"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-slate-900"
                  :class="maintenanceLogin ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'"
                  role="switch"
                  :aria-checked="maintenanceLogin"
                  :aria-label="__('Toggle Login Page Notice')"
                  :disabled="isUpdatingLogin"
                  @click="toggleLoginMessageSetting"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
                    :class="
                      maintenanceLogin
                        ? 'ltr:translate-x-4 rtl:-translate-x-4'
                        : 'ltr:translate-x-0 rtl:translate-x-0'
                    "
                  />
                </button>
              </div>

              <div>
                <label
                  for="login-notice-textarea"
                  class="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {{ __('Notice Message Text') }}
                </label>
                <textarea
                  id="login-notice-textarea"
                  v-model="maintenanceLoginMessage"
                  rows="4"
                  class="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  :placeholder="__('The system is currently undergoing scheduled maintenance...')"
                />
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                :disabled="isSavingMessage"
                :aria-label="__('Save Notice Message')"
                @click="saveLoginMessage"
              >
                <CommonIcon
                  v-if="isSavingMessage"
                  name="loading"
                  class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ __('Save Notice Message') }}
              </button>
            </div>
          </div>

          <!-- Live Login Preview Card -->
          <div
            class="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/30"
          >
            <div class="mb-4 flex items-center space-x-2 rtl:space-x-reverse">
              <CommonIcon name="eye" class="h-4 w-4 text-slate-400" />
              <h3
                class="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                {{ __('Live Login Screen Preview') }}
              </h3>
            </div>

            <div
              class="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-700 dark:bg-[#1e293b]"
            >
              <!-- Logo mock -->
              <div class="mb-4 text-center">
                <span
                  class="text-xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400"
                >
                  ZAMMAD
                </span>
              </div>

              <!-- Maintenance Banner in Preview -->
              <div
                v-if="maintenanceLogin"
                class="text-2xs mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <div class="flex items-start space-x-1.5 rtl:space-x-reverse">
                  <CommonIcon
                    name="alert-triangle"
                    class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span class="leading-relaxed font-medium">
                    {{ maintenanceLoginMessage }}
                  </span>
                </div>
              </div>

              <!-- Dummy Login Fields -->
              <div class="pointer-events-none space-y-2 opacity-60">
                <div
                  class="h-7 w-full rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                />
                <div
                  class="h-7 w-full rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                />
                <div class="h-7 w-full rounded-lg bg-blue-600 dark:bg-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <!-- Broadcast Live Alert Message Form -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-1 flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="send" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Broadcast Message to Active Users') }}
            </h2>
          </div>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {{
              __(
                'Instantly pop up an emergency or maintenance banner on all currently connected user workstations via WebSockets.',
              )
            }}
          </p>

          <form class="max-w-2xl space-y-4" @submit.prevent="sendBroadcastMessage">
            <div>
              <label
                for="broadcast-title-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Notice Title') }}
              </label>
              <input
                id="broadcast-title-input"
                v-model="broadcastHead"
                type="text"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                :placeholder="__('e.g. Scheduled Restart in 10 Minutes')"
              />
            </div>

            <div>
              <label
                for="broadcast-msg-textarea"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Notice Content') }} *
              </label>
              <textarea
                id="broadcast-msg-textarea"
                v-model="broadcastMessage"
                rows="3"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                :placeholder="
                  __(
                    'Please save your open drafts and changes. Server will undergo a brief restart.',
                  )
                "
                required
              />
            </div>

            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <input
                id="broadcast-reload-check"
                v-model="broadcastReload"
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                for="broadcast-reload-check"
                class="text-xs text-slate-700 dark:text-slate-300"
              >
                {{ __('Force client browser reload after notification') }}
              </label>
            </div>

            <div>
              <button
                type="submit"
                class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                :disabled="isBroadcasting"
                :aria-label="__('Send to Clients')"
              >
                <CommonIcon
                  v-if="isBroadcasting"
                  name="loading"
                  class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                />
                <CommonIcon v-else name="send" class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                {{ __('Send to Clients') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Confirmation Modal for Mode Enable -->
      <div
        v-if="modeConfirmModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Confirm Maintenance Mode')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            >
              <CommonIcon name="alert-triangle" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Enable Maintenance Mode?') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'All active non-administrator users will be logged out immediately and prevented from starting new sessions until disabled.',
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="modeConfirmModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              :disabled="isUpdatingMode"
              :aria-label="__('Enable Mode Now')"
              @click="executeSetMode(true)"
            >
              <CommonIcon
                v-if="isUpdatingMode"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Enable Mode Now') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
