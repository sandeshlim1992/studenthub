<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('System Report') },
]

const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const copied = ref(false)

const descriptions = ref<string[]>([])
const reportData = ref<Record<string, unknown> | null>(null)

const formattedJson = computed(() => {
  if (!reportData.value) return ''
  return JSON.stringify(reportData.value, null, 2)
})

const filteredDescriptions = computed(() => {
  return [...descriptions.value].sort()
})

const fetchReport = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/system_report', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HTTP error ${res.status}`)
    }
    const data = await res.json()
    descriptions.value = Array.isArray(data.descriptions) ? data.descriptions : []
    reportData.value = data.fetch || {}
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to fetch system report.')
  } finally {
    isLoading.value = false
  }
}

const copyToClipboard = async () => {
  if (!formattedJson.value) return
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    copied.value = true
    successMessage.value = __('System report JSON copied to clipboard.')
    setTimeout(() => {
      copied.value = false
      successMessage.value = ''
    }, 3000)
  } catch {
    errorMessage.value = __('Failed to copy to clipboard.')
  }
}

const downloadReport = () => {
  if (!formattedJson.value) return
  const blob = new Blob([formattedJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zammad_system_report_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  successMessage.value = __('System report downloaded successfully.')
  setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

onMounted(() => {
  void fetchReport()
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Unboxed Open Header -->
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                <CommonIcon name="file-text" class="h-4 w-4" />
              </div>
              <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {{ __('System Report') }}
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
                'The system report provides a summarized version of the system state and configuration for support and analysis purposes.',
              )
            }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-200 dark:hover:bg-slate-800"
            :disabled="isLoading"
            :aria-label="__('Refresh Report')"
            @click="fetchReport"
          >
            <CommonIcon
              name="arrow-repeat"
              class="size-3.5 ltr:mr-1.5 rtl:ml-1.5"
              :class="{ 'animate-spin': isLoading }"
            />
            {{ __('Refresh') }}
          </button>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
            :disabled="isLoading || !reportData"
            :aria-label="__('Download Report')"
            @click="downloadReport"
          >
            <CommonIcon name="download" class="size-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {{ __('Download JSON') }}
          </button>
        </div>
      </div>

      <!-- Feedback Alerts -->
      <div
        v-if="errorMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="exclamation-triangle"
            class="size-4 shrink-0 text-red-600 dark:text-red-400"
          />
          <span>{{ errorMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-red-700 hover:text-red-900 dark:text-red-300"
          :aria-label="__('Dismiss error')"
          @click="errorMessage = ''"
        >
          &times;
        </button>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="check2"
            class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span>{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          :aria-label="__('Dismiss notification')"
          @click="successMessage = ''"
        >
          &times;
        </button>
      </div>

      <!-- Privacy & Security Callout -->
      <div
        class="mb-6 flex items-start space-x-3.5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 shadow-2xs rtl:space-x-reverse dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200"
      >
        <CommonIcon
          name="shield-lock"
          class="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400"
        />
        <div class="space-y-1">
          <p class="font-semibold">
            {{ __('Privacy & Data Security Notice') }}
          </p>
          <p class="text-blue-800/90 dark:text-blue-300/80">
            {{
              __(
                'Zammad never transmits this diagnostic report automatically. Personal account passwords, API tokens, and secrets are sanitized and omitted. You can safely share this file when requesting assistance from Zammad support.',
              )
            }}
          </p>
        </div>
      </div>

      <!-- Loading Spinner -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <CommonIcon name="loading" class="size-8 animate-spin text-blue-600" />
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {{ __('Compiling system diagnostic report...') }}
        </p>
      </div>

      <div v-else class="space-y-6">
        <!-- Card 1: Report Contents Checklist -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Collected Diagnostic Sections') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('The following diagnostics and system metrics are included in this report:') }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(desc, idx) in filteredDescriptions"
              :key="idx"
              class="flex items-center space-x-2.5 rounded-xl border border-slate-200/70 bg-slate-50/50 p-2.5 text-xs text-slate-700 rtl:space-x-reverse dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300"
            >
              <CommonIcon name="check2" class="size-4 shrink-0 text-emerald-500" />
              <span class="truncate">{{ __(desc) }}</span>
            </div>
          </div>
        </div>

        <!-- Card 2: JSON Code Preview -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
          >
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Report Preview') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Structured JSON snapshot of system health, dependencies, and settings.') }}
              </p>
            </div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                :aria-label="__('Copy JSON content')"
                @click="copyToClipboard"
              >
                <CommonIcon
                  :name="copied ? 'check2' : 'clipboard2'"
                  class="size-3.5 text-slate-500 ltr:mr-1 rtl:ml-1"
                />
                {{ copied ? __('Copied!') : __('Copy JSON') }}
              </button>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                :aria-label="__('Download report')"
                @click="downloadReport"
              >
                <CommonIcon name="download" class="size-3.5 ltr:mr-1 rtl:ml-1" />
                {{ __('Download') }}
              </button>
            </div>
          </div>

          <!-- JSON Viewer -->
          <div
            class="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow-inner"
          >
            <div
              class="text-2xs flex items-center justify-between border-b border-slate-800 bg-[#1e293b] px-4 py-2 text-slate-400"
            >
              <span>system_report.json</span>
              <span>{{
                reportData ? Object.keys(reportData).length + ' top-level keys' : ''
              }}</span>
            </div>
            <pre
              class="max-h-[550px] overflow-auto p-4 font-mono text-xs leading-relaxed text-emerald-400 selection:bg-blue-900 selection:text-white"
            ><code>{{ formattedJson }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
