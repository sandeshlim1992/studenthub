<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Version') },
]

const isLoading = ref(true)
const versionString = ref('')
const errorMessage = ref('')
const copiedVersion = ref(false)

const fetchVersion = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/version', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    versionString.value = data.version || '6.4.x'
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to load system version.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchVersion()
})

const copyVersionToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(versionString.value)
    copiedVersion.value = true
    setTimeout(() => {
      copiedVersion.value = false
    }, 2500)
  } catch {
    const input = document.createElement('input')
    input.value = versionString.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copiedVersion.value = true
    setTimeout(() => {
      copiedVersion.value = false
    }, 2500)
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-5xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
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
              <CommonIcon name="info-circle" class="h-4 w-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {{ __('System Version') }}
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
              'Current installed software release, runtime environment details, and security advisories.',
            )
          }}
        </p>
      </div>

      <!-- Error Alert -->
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

      <!-- Version Hero Card -->
      <div
        class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-8 text-center">
          <div
            class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          ></div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ __('Fetching version information...') }}
          </p>
        </div>

        <div v-else class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center space-x-5 rtl:space-x-reverse">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20"
            >
              <CommonIcon name="info-circle" class="h-8 w-8" />
            </div>
            <div>
              <div class="flex items-center space-x-3 rtl:space-x-reverse">
                <span class="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  {{ __('Zammad Edition') }}
                </span>
                <span
                  class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold tracking-wider text-blue-800 uppercase dark:bg-blue-900/50 dark:text-blue-300"
                >
                  {{ __('Stable') }}
                </span>
              </div>
              <div class="mt-1 flex items-center space-x-3 rtl:space-x-reverse">
                <h2
                  class="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
                >
                  {{ versionString }}
                </h2>
                <button
                  type="button"
                  class="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  :title="__('Copy version string')"
                  :aria-label="__('Copy version string')"
                  @click="copyVersionToClipboard"
                >
                  <CommonIcon :name="copiedVersion ? 'check2' : 'clipboard'" class="h-4 w-4" />
                </button>
              </div>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{
                  __('This instance is running the official Zammad open-source helpdesk platform.')
                }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <a
              href="https://github.com/zammad/zammad/releases"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <span>{{ __('Release Notes') }}</span>
              <CommonIcon name="external-link" class="h-3.5 w-3.5 ltr:ml-1.5 rtl:mr-1.5" />
            </a>
          </div>
        </div>
      </div>

      <!-- Runtime Platform & Stack Details -->
      <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span class="text-xs font-semibold text-slate-400 uppercase">
            {{ __('Core Framework') }}
          </span>
          <h3 class="mt-1 text-lg font-bold text-slate-900 dark:text-white">Ruby on Rails</h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ __('API engine, background jobs, and business logic execution.') }}
          </p>
        </div>

        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span class="text-xs font-semibold text-slate-400 uppercase">
            {{ __('User Interface') }}
          </span>
          <h3 class="mt-1 text-lg font-bold text-slate-900 dark:text-white">Vue 3 + Vite</h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ __('Modern Single-Page Application (SPA) with reactive component architecture.') }}
          </p>
        </div>

        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span class="text-xs font-semibold text-slate-400 uppercase">
            {{ __('Realtime Transport') }}
          </span>
          <h3 class="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            ActionCable WebSockets
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ __('Live bidirectional agent presence, ticket updates, and broadcasts.') }}
          </p>
        </div>
      </div>

      <!-- Helpful Links & Community Resources -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <h3 class="mb-4 text-sm font-bold text-slate-900 dark:text-white">
          {{ __('Official Resources & Support') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="https://docs.zammad.org"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-start space-x-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:bg-slate-100 rtl:space-x-reverse dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
          >
            <CommonIcon
              name="book"
              class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
            />
            <div>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Documentation') }}
              </span>
              <p class="text-2xs text-slate-500 dark:text-slate-400">
                {{ __('Complete administrator and user manuals.') }}
              </p>
            </div>
          </a>

          <a
            href="https://community.zammad.org"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-start space-x-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:bg-slate-100 rtl:space-x-reverse dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
          >
            <CommonIcon
              name="chat"
              class="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400"
            />
            <div>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Community Forum') }}
              </span>
              <p class="text-2xs text-slate-500 dark:text-slate-400">
                {{ __('Ask questions, share workflows, and discuss with users.') }}
              </p>
            </div>
          </a>

          <a
            href="https://zammad.com/en/security-advisories"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-start space-x-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:bg-slate-100 rtl:space-x-reverse dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
          >
            <CommonIcon
              name="shield-lock"
              class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <div>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Security Advisories') }}
              </span>
              <p class="text-2xs text-slate-500 dark:text-slate-400">
                {{ __('Review published CVEs and security patches.') }}
              </p>
            </div>
          </a>

          <a
            href="https://github.com/zammad/zammad"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-start space-x-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:bg-slate-100 rtl:space-x-reverse dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
          >
            <CommonIcon
              name="github"
              class="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400"
            />
            <div>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('GitHub Repository') }}
              </span>
              <p class="text-2xs text-slate-500 dark:text-slate-400">
                {{ __('Source code, issue tracker, and contributions.') }}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
