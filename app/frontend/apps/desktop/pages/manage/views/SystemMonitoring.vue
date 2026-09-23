<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface HealthCheckData {
  healthy: boolean
  status?: string
  token: string
  message?: string
  issues?: string[]
  actions?: string[]
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Monitoring') },
]

const isLoading = ref(true)
const isRefreshing = ref(false)
const isResettingToken = ref(false)
const isRestartingJobs = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const copiedField = ref<string | null>(null)

const healthData = ref<HealthCheckData>({
  healthy: true,
  status: 'ok',
  token: '',
  message: '',
  issues: [],
  actions: [],
})

const resetTokenModalOpen = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

const healthCheckUrl = computed(() => {
  const { origin } = window.location
  const { token } = healthData.value
  return `${origin}/api/v1/monitoring/health_check?token=${token}`
})

const curlCommand = computed(() => {
  return `curl -s "${healthCheckUrl.value}"`
})

const isHealthy = computed(() => {
  if (healthData.value.healthy === false) return false
  if (healthData.value.status && healthData.value.status !== 'ok') return false
  if (healthData.value.issues && healthData.value.issues.length > 0) return false
  return true
})

const fetchHealthCheck = async (showLoadingIndicator = false) => {
  if (showLoadingIndicator) {
    isLoading.value = true
  }
  isRefreshing.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/monitoring/health_check', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data: HealthCheckData = await res.json()
    healthData.value = {
      healthy: data.healthy ?? true,
      status: data.status || 'ok',
      token: data.token || '',
      message: data.message || '',
      issues: Array.isArray(data.issues) ? data.issues : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
    }
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to retrieve monitoring health status.')
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

onMounted(() => {
  void fetchHealthCheck(true)
  pollTimer = setInterval(() => {
    void fetchHealthCheck(false)
  }, 35000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

const copyToClipboard = async (text: string, fieldKey: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = fieldKey
    setTimeout(() => {
      if (copiedField.value === fieldKey) {
        copiedField.value = null
      }
    }, 2500)
  } catch {
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copiedField.value = fieldKey
    setTimeout(() => {
      if (copiedField.value === fieldKey) {
        copiedField.value = null
      }
    }, 2500)
  }
}

const executeResetToken = async () => {
  isResettingToken.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/monitoring/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    resetTokenModalOpen.value = false
    successMessage.value = __('Monitoring token has been reset successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchHealthCheck(false)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to reset monitoring token.')
  } finally {
    isResettingToken.value = false
  }
}

const executeRestartFailedJobs = async () => {
  isRestartingJobs.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/monitoring/restart_failed_jobs', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    successMessage.value = __('Failed jobs have been restarted.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchHealthCheck(false)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to restart jobs.')
  } finally {
    isRestartingJobs.value = false
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
                  <CommonIcon name="activity" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Monitoring') }}
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
                  'Inspect real-time system operational status, background workers, and configure external monitoring integrations.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              :disabled="isRefreshing"
              :aria-label="__('Refresh Status')"
              @click="fetchHealthCheck(false)"
            >
              <CommonIcon
                name="arrow-repeat"
                class="h-4 w-4"
                :class="{ 'animate-spin': isRefreshing }"
              />
              {{ __('Refresh Status') }}
            </button>
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
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
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

      <!-- Hero Health Status Card -->
      <div
        class="mb-6 overflow-hidden rounded-2xl border p-6 shadow-xs transition-all"
        :class="
          isHealthy
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20'
        "
      >
        <div>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center space-x-4 rtl:space-x-reverse">
              <div
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-xs"
                :class="
                  isHealthy
                    ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                    : 'bg-red-500 text-white dark:bg-red-600'
                "
              >
                <CommonIcon
                  :name="isHealthy ? 'checkmark-circle' : 'alert-triangle'"
                  class="h-8 w-8"
                />
              </div>
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <h2
                    class="text-xl font-bold"
                    :class="
                      isHealthy
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-red-900 dark:text-red-200'
                    "
                  >
                    {{ isHealthy ? __('System is Healthy') : __('System Issues Detected') }}
                  </h2>
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase"
                    :class="
                      isHealthy
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                    "
                  >
                    {{ healthData.status || (isHealthy ? 'OK' : 'ERROR') }}
                  </span>
                </div>
                <p
                  class="mt-1 text-sm"
                  :class="
                    isHealthy
                      ? 'text-emerald-700 dark:text-emerald-300/80'
                      : 'text-red-700 dark:text-red-300/80'
                  "
                >
                  {{
                    isHealthy
                      ? __(
                          'All background services, database connections, and workers are operating properly.',
                        )
                      : __(
                          'One or more background tasks, channels, or services require administrative attention.',
                        )
                  }}
                </p>
              </div>
            </div>

            <!-- Restart Failed Jobs Button -->
            <div
              v-if="healthData.actions?.includes('restart_failed_jobs') || !isHealthy"
              class="flex items-center"
            >
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-hidden disabled:opacity-50"
                :disabled="isRestartingJobs"
                :aria-label="__('Restart failed jobs')"
                @click="executeRestartFailedJobs"
              >
                <CommonIcon
                  v-if="isRestartingJobs"
                  name="loading"
                  class="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2"
                />
                <CommonIcon v-else name="arrow-repeat" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {{ __('Restart Failed Jobs') }}
              </button>
            </div>
          </div>

          <!-- Issues breakdown if any -->
          <div
            v-if="healthData.issues && healthData.issues.length > 0"
            class="mt-6 rounded-xl border border-red-200 bg-white p-4 shadow-2xs dark:border-red-900/60 dark:bg-slate-900"
          >
            <h3 class="text-xs font-bold tracking-wider text-red-800 uppercase dark:text-red-400">
              {{ __('Active Issues (%s)', healthData.issues.length) }}
            </h3>
            <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              <li
                v-for="(issue, idx) in healthData.issues"
                :key="idx"
                class="flex items-start py-2 text-sm text-slate-800 dark:text-slate-200"
              >
                <CommonIcon
                  name="close-circle"
                  class="mt-0.5 h-4 w-4 shrink-0 text-red-500 ltr:mr-2 rtl:ml-2"
                />
                <span>{{ issue }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Token & Health Check Endpoints Grid -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Monitoring Token Card -->
        <div
          class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <CommonIcon name="key" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Current Monitoring Token') }}
              </h2>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'This unique security token authenticates queries to the health check endpoint without exposing user credentials.',
                )
              }}
            </p>

            <div class="mt-4">
              <label
                for="monitoring-token-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Token String') }}
              </label>
              <div
                class="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
              >
                <input
                  id="monitoring-token-input"
                  readonly
                  type="text"
                  :value="healthData.token"
                  class="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-slate-900 focus:outline-hidden dark:text-white"
                  :aria-label="__('Monitoring Token')"
                />
                <button
                  type="button"
                  class="cursor-pointer p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  :aria-label="__('Copy Monitoring Token')"
                  @click="copyToClipboard(healthData.token, 'token')"
                >
                  <CommonIcon
                    :name="copiedField === 'token' ? 'check2' : 'clipboard'"
                    class="h-4 w-4"
                  />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Reset Monitoring Token')"
              @click="resetTokenModalOpen = true"
            >
              <CommonIcon name="arrow-repeat" class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
              {{ __('Reset Token') }}
            </button>
          </div>
        </div>

        <!-- Health Check Endpoint Card -->
        <div
          class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <CommonIcon name="link" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Health Check URL') }}
              </h2>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Health information can be retrieved as JSON using your preferred monitoring tools (Nagios, Checkmk, Icinga, or Uptime Kuma).',
                )
              }}
            </p>

            <div class="mt-4">
              <label
                for="health-url-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Endpoint URL') }}
              </label>
              <div
                class="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
              >
                <input
                  id="health-url-input"
                  readonly
                  type="text"
                  :value="healthCheckUrl"
                  class="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-slate-900 focus:outline-hidden dark:text-white"
                  :aria-label="__('Health Check URL')"
                />
                <button
                  type="button"
                  class="cursor-pointer p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  :aria-label="__('Copy Health Check URL')"
                  @click="copyToClipboard(healthCheckUrl, 'url')"
                >
                  <CommonIcon
                    :name="copiedField === 'url' ? 'check2' : 'clipboard'"
                    class="h-4 w-4"
                  />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Copy curl Command')"
              @click="copyToClipboard(curlCommand, 'curl')"
            >
              <CommonIcon
                :name="copiedField === 'curl' ? 'check2' : 'clipboard'"
                class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Copy curl Command') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Reset Token Confirmation Modal -->
      <div
        v-if="resetTokenModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Reset Token Confirmation')"
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
                {{ __('Reset Monitoring Token?') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Existing external monitoring tools and probes using the current token will fail until updated with the new token.',
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="resetTokenModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-hidden disabled:opacity-50"
              :disabled="isResettingToken"
              :aria-label="__('Reset Token Now')"
              @click="executeResetToken"
            >
              <CommonIcon
                v-if="isResettingToken"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Reset Token Now') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
