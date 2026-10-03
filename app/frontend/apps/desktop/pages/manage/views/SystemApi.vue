<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ApplicationRecord {
  id: number
  name: string
  uid: string
  secret: string
  redirect_uri: string
  scopes?: string
  created_at?: string
  updated_at?: string
}

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: boolean }
  state_initial?: { value?: boolean }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('API') },
]

const isLoading = ref(true)
const applications = ref<ApplicationRecord[]>([])
const searchQuery = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const copiedField = ref<string | null>(null)

// Global settings
const tokenAccessEnabled = ref(true)
const passwordAccessEnabled = ref(true)
const isUpdatingTokenAccess = ref(false)
const isUpdatingPasswordAccess = ref(false)

// New / Edit App Modal
const appModal = ref<{
  isOpen: boolean
  isEditing: boolean
  id?: number
  name: string
  redirectUri: string
  isSaving: boolean
  generatedApp?: ApplicationRecord | null
}>({
  isOpen: false,
  isEditing: false,
  name: '',
  redirectUri: '',
  isSaving: false,
  generatedApp: null,
})

// View Credentials Modal
const credentialsModal = ref<{
  isOpen: boolean
  app: ApplicationRecord | null
}>({
  isOpen: false,
  app: null,
})

// Generate Token Modal
const tokenModal = ref<{
  isOpen: boolean
  app: ApplicationRecord | null
  generatedToken: string
  isGenerating: boolean
}>({
  isOpen: false,
  app: null,
  generatedToken: '',
  isGenerating: false,
})

// Delete Modal
const deleteModal = ref<{
  isOpen: boolean
  app: ApplicationRecord | null
  isDeleting: boolean
}>({
  isOpen: false,
  app: null,
  isDeleting: false,
})

const fetchSettings = async () => {
  try {
    const res = await fetch('/api/v1/settings', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) return
    const data: SettingRecord[] = await res.json()
    const tokenSetting = data.find((s) => s.name === 'api_token_access')
    if (tokenSetting && tokenSetting.state_current?.value !== undefined) {
      tokenAccessEnabled.value = Boolean(tokenSetting.state_current.value)
    }
    const pwdSetting = data.find((s) => s.name === 'api_password_access')
    if (pwdSetting && pwdSetting.state_current?.value !== undefined) {
      passwordAccessEnabled.value = Boolean(pwdSetting.state_current.value)
    }
  } catch {
    // Fail silently on settings background fetch
  }
}

const fetchApplications = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/applications', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data = await res.json()
    applications.value = Array.isArray(data) ? data : []
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to load OAuth applications.')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchSettings(), fetchApplications()])
})

const filteredApplications = computed(() => {
  if (!searchQuery.value.trim()) return applications.value
  const q = searchQuery.value.toLowerCase()
  return applications.value.filter(
    (app) =>
      app.name.toLowerCase().includes(q) ||
      app.uid.toLowerCase().includes(q) ||
      (app.redirect_uri && app.redirect_uri.toLowerCase().includes(q)),
  )
})

const toggleTokenAccess = async () => {
  const newVal = !tokenAccessEnabled.value
  isUpdatingTokenAccess.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings/api_token_access', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ state_current: { value: newVal } }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    tokenAccessEnabled.value = newVal
    successMessage.value = newVal ? __('Token access enabled.') : __('Token access disabled.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to update token access setting.')
  } finally {
    isUpdatingTokenAccess.value = false
  }
}

const togglePasswordAccess = async () => {
  const newVal = !passwordAccessEnabled.value
  isUpdatingPasswordAccess.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings/api_password_access', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ state_current: { value: newVal } }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    passwordAccessEnabled.value = newVal
    successMessage.value = newVal ? __('Password access enabled.') : __('Password access disabled.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to update password access setting.')
  } finally {
    isUpdatingPasswordAccess.value = false
  }
}

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
    // Fallback if clipboard API restricted
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

const openNewAppModal = () => {
  appModal.value = {
    isOpen: true,
    isEditing: false,
    name: '',
    redirectUri: '',
    isSaving: false,
    generatedApp: null,
  }
}

const openEditAppModal = (app: ApplicationRecord) => {
  appModal.value = {
    isOpen: true,
    isEditing: true,
    id: app.id,
    name: app.name,
    redirectUri: app.redirect_uri || '',
    isSaving: false,
    generatedApp: null,
  }
}

const saveApplication = async () => {
  const { name } = appModal.value
  if (!name.trim()) {
    errorMessage.value = __('Please enter an application name.')
    return
  }
  appModal.value.isSaving = true
  errorMessage.value = ''

  try {
    const url = appModal.value.isEditing
      ? `/api/v1/applications/${appModal.value.id}`
      : '/api/v1/applications'
    const method = appModal.value.isEditing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        name: appModal.value.name.trim(),
        redirect_uri: appModal.value.redirectUri.trim(),
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${res.status}`)
    }

    const savedData: ApplicationRecord = await res.json()

    if (!appModal.value.isEditing) {
      // Keep modal open to show generated secrets
      appModal.value.generatedApp = savedData
      successMessage.value = __('Application created successfully.')
    } else {
      appModal.value.isOpen = false
      successMessage.value = __('Application updated successfully.')
    }

    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchApplications()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to save application.')
  } finally {
    appModal.value.isSaving = false
  }
}

const openCredentialsModal = (app: ApplicationRecord) => {
  credentialsModal.value = {
    isOpen: true,
    app,
  }
}

const openGenerateTokenModal = (app: ApplicationRecord) => {
  tokenModal.value = {
    isOpen: true,
    app,
    generatedToken: '',
    isGenerating: false,
  }
}

const executeGenerateToken = async () => {
  if (!tokenModal.value.app) return
  tokenModal.value.isGenerating = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/applications/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id: tokenModal.value.app.id }),
    })
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data = await res.json()
    tokenModal.value.generatedToken = data.token || ''
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to generate token.')
  } finally {
    tokenModal.value.isGenerating = false
  }
}

const confirmDeleteApp = (app: ApplicationRecord) => {
  deleteModal.value = {
    isOpen: true,
    app,
    isDeleting: false,
  }
}

const executeDeleteApp = async () => {
  if (!deleteModal.value.app) return
  deleteModal.value.isDeleting = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/applications/${deleteModal.value.app.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const { name } = deleteModal.value.app
    deleteModal.value.isOpen = false
    successMessage.value = __('Application "%s" deleted.', name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchApplications()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to delete application.')
  } finally {
    deleteModal.value.isDeleting = false
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
                  <CommonIcon name="code" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('API & Applications') }}
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
                  'Configure API authentication methods and manage third-party OAuth applications.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              :aria-label="__('New Application')"
              @click="openNewAppModal"
            >
              <CommonIcon name="plus" class="h-4 w-4" />
              {{ __('New Application') }}
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

      <!-- Global Access Cards -->
      <div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Token Access Card -->
        <div
          class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="space-y-1">
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <CommonIcon name="key" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                {{ __('Token Access') }}
              </h2>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Enables API authentication via Bearer HTTP tokens generated by users or OAuth apps.',
                )
              }}
            </p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            :class="tokenAccessEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'"
            role="switch"
            :aria-checked="tokenAccessEnabled"
            :aria-label="__('Toggle Token Access')"
            :disabled="isUpdatingTokenAccess"
            @click="toggleTokenAccess"
          >
            <span
              class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
              :class="
                tokenAccessEnabled
                  ? 'ltr:translate-x-5 rtl:-translate-x-5'
                  : 'ltr:translate-x-0 rtl:translate-x-0'
              "
            />
          </button>
        </div>

        <!-- Password Access Card -->
        <div
          class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="space-y-1">
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <CommonIcon name="lock" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">
                {{ __('Password Access') }}
              </h2>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Enables Basic Authentication via standard user credentials (username and password).',
                )
              }}
            </p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            :class="passwordAccessEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'"
            role="switch"
            :aria-checked="passwordAccessEnabled"
            :aria-label="__('Toggle Password Access')"
            :disabled="isUpdatingPasswordAccess"
            @click="togglePasswordAccess"
          >
            <span
              class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
              :class="
                passwordAccessEnabled
                  ? 'ltr:translate-x-5 rtl:-translate-x-5'
                  : 'ltr:translate-x-0 rtl:translate-x-0'
              "
            />
          </button>
        </div>
      </div>

      <!-- Applications Section Header & Search -->
      <div
        class="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon name="apps" class="h-5 w-5 text-slate-600 dark:text-slate-300" />
          <h2 class="text-base font-bold text-slate-900 dark:text-white">
            {{ __('OAuth Applications') }}
            <span
              class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-normal text-slate-600 ltr:ml-2 rtl:mr-2 dark:bg-slate-800 dark:text-slate-400"
            >
              {{ applications.length }}
            </span>
          </h2>
        </div>

        <div class="relative w-full max-w-xs">
          <input
            id="search-applications"
            v-model="searchQuery"
            type="search"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden ltr:pr-4 ltr:pl-9 rtl:pr-9 rtl:pl-4 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            :placeholder="__('Filter applications...')"
            :aria-label="__('Filter applications')"
          />
          <div class="absolute top-1/2 -translate-y-1/2 text-slate-400 ltr:left-3 rtl:right-3">
            <CommonIcon name="search" class="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <!-- Applications Table -->
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-12 text-center">
          <div
            class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          ></div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ __('Loading applications...') }}
          </p>
        </div>

        <div v-else-if="filteredApplications.length === 0" class="p-16 text-center">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          >
            <CommonIcon name="apps" class="h-6 w-6" />
          </div>
          <h3 class="mb-1 text-base font-semibold text-slate-800 dark:text-slate-100">
            {{ __('No OAuth applications found') }}
          </h3>
          <p class="mx-auto mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {{
              searchQuery
                ? __('No applications matching your search.')
                : __('Register your first OAuth application to integrate third-party services.')
            }}
          </p>
          <button
            v-if="!searchQuery"
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
            :aria-label="__('Register Application')"
            @click="openNewAppModal"
          >
            <CommonIcon name="plus" class="h-4 w-4" />
            {{ __('Register Application') }}
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-start text-sm text-slate-600 dark:text-slate-300">
            <thead
              class="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Application Name') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Client ID (App ID)') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Redirect URI') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Credentials') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Token') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-end">
                  {{ __('Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
              <tr
                v-for="app in filteredApplications"
                :key="app.id"
                class="transition hover:bg-stone-50/70 dark:hover:bg-stone-800/50"
              >
                <!-- Name -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="font-semibold text-stone-900 dark:text-white">
                    {{ app.name }}
                  </span>
                </td>

                <!-- Client ID / UID -->
                <td class="px-6 py-4 font-mono text-xs whitespace-nowrap">
                  <div class="flex items-center space-x-2 rtl:space-x-reverse">
                    <span class="text-stone-600 dark:text-stone-400">
                      {{ app.uid }}
                    </span>
                    <button
                      type="button"
                      class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                      :title="__('Copy Client ID')"
                      :aria-label="__('Copy Client ID for %s', app.name)"
                      @click="copyToClipboard(app.uid, `uid-${app.id}`)"
                    >
                      <CommonIcon
                        :name="copiedField === `uid-${app.id}` ? 'checkmark' : 'clipboard'"
                        class="size-3.5"
                      />
                    </button>
                  </div>
                </td>

                <!-- Redirect URI -->
                <td class="px-6 py-4 text-xs text-stone-500 dark:text-stone-400">
                  {{ app.redirect_uri || '—' }}
                </td>

                <!-- Credentials Button -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                    :aria-label="__('View Credentials for %s', app.name)"
                    @click="openCredentialsModal(app)"
                  >
                    <CommonIcon name="eye" class="size-3.5 text-stone-400 ltr:mr-1 rtl:ml-1" />
                    {{ __('View Credentials') }}
                  </button>
                </td>

                <!-- Generate Token Button -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    :aria-label="__('Generate Token for %s', app.name)"
                    @click="openGenerateTokenModal(app)"
                  >
                    <CommonIcon name="key" class="size-3.5 ltr:mr-1 rtl:ml-1" />
                    {{ __('Generate Token') }}
                  </button>
                </td>

                <!-- Row Actions -->
                <td class="px-6 py-4 text-end whitespace-nowrap">
                  <div class="flex items-center justify-end space-x-2 rtl:space-x-reverse">
                    <button
                      type="button"
                      class="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      :title="__('Edit')"
                      :aria-label="__('Edit %s', app.name)"
                      @click="openEditAppModal(app)"
                    >
                      <CommonIcon name="pen" class="size-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      :title="__('Delete')"
                      :aria-label="__('Delete %s', app.name)"
                      @click="confirmDeleteApp(app)"
                    >
                      <CommonIcon name="trash" class="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- New / Edit App Modal -->
      <div
        v-if="appModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="appModal.isEditing ? __('Edit Application') : __('New Application')"
      >
        <div
          class="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        >
          <div
            class="flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-800"
          >
            <div>
              <h2 class="text-lg font-bold text-stone-900 dark:text-white">
                {{ appModal.isEditing ? __('Edit Application') : __('New OAuth Application') }}
              </h2>
              <p class="text-xs text-stone-500 dark:text-stone-400">
                {{
                  appModal.isEditing
                    ? __('Update OAuth application parameters.')
                    : __('Register an application to authenticate via OAuth.')
                }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              :aria-label="__('Close')"
              @click="appModal.isOpen = false"
            >
              <CommonIcon name="close" class="size-5" />
            </button>
          </div>

          <!-- Newly generated application info box -->
          <div
            v-if="appModal.generatedApp"
            class="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/20"
          >
            <div
              class="flex items-center space-x-2 text-amber-800 rtl:space-x-reverse dark:text-amber-300"
            >
              <CommonIcon name="alert-triangle" class="size-4 shrink-0" />
              <span class="font-semibold">
                {{ __('Copy your secret now. It will not be shown in plain text again!') }}
              </span>
            </div>
            <div class="space-y-2 pt-2">
              <div>
                <span class="font-medium text-stone-700 dark:text-stone-300">
                  {{ __('App ID (Client ID):') }}
                </span>
                <div
                  class="mt-1 flex items-center justify-between rounded bg-white px-2 py-1.5 font-mono text-xs dark:bg-stone-800"
                >
                  <span class="truncate">{{ appModal.generatedApp.uid }}</span>
                  <button
                    type="button"
                    class="text-stone-400 hover:text-stone-600 ltr:ml-2 rtl:mr-2 dark:hover:text-stone-200"
                    :aria-label="__('Copy App ID')"
                    @click="copyToClipboard(appModal.generatedApp.uid, 'new-uid')"
                  >
                    <CommonIcon
                      :name="copiedField === 'new-uid' ? 'checkmark' : 'clipboard'"
                      class="size-3.5"
                    />
                  </button>
                </div>
              </div>

              <div>
                <span class="font-medium text-stone-700 dark:text-stone-300">
                  {{ __('Secret (Client Secret):') }}
                </span>
                <div
                  class="mt-1 flex items-center justify-between rounded bg-white px-2 py-1.5 font-mono text-xs dark:bg-stone-800"
                >
                  <span class="truncate">{{ appModal.generatedApp.secret }}</span>
                  <button
                    type="button"
                    class="text-stone-400 hover:text-stone-600 ltr:ml-2 rtl:mr-2 dark:hover:text-stone-200"
                    :aria-label="__('Copy Secret')"
                    @click="copyToClipboard(appModal.generatedApp.secret, 'new-secret')"
                  >
                    <CommonIcon
                      :name="copiedField === 'new-secret' ? 'checkmark' : 'clipboard'"
                      class="size-3.5"
                    />
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="mt-2 w-full rounded-lg bg-stone-900 py-2 text-center text-xs font-semibold text-white hover:bg-black dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
              :aria-label="__('I have copied the secret')"
              @click="appModal.isOpen = false"
            >
              {{ __('Done, I have copied my credentials') }}
            </button>
          </div>

          <!-- Form inputs -->
          <div v-else class="mt-4 space-y-4">
            <div>
              <label
                for="app-name-input"
                class="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                {{ __('Name') }} *
              </label>
              <input
                id="app-name-input"
                v-model="appModal.name"
                type="text"
                class="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                :placeholder="__('e.g. My Company CRM')"
                required
              />
            </div>

            <div>
              <label
                for="app-redirect-input"
                class="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                {{ __('Redirect URI') }}
              </label>
              <input
                id="app-redirect-input"
                v-model="appModal.redirectUri"
                type="url"
                class="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                :placeholder="__('https://crm.example.com/oauth/callback')"
              />
              <p class="text-2xs mt-1 text-stone-400">
                {{ __('Where the user will be returned after authorizing.') }}
              </p>
            </div>

            <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
              <button
                type="button"
                class="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                :aria-label="__('Cancel')"
                @click="appModal.isOpen = false"
              >
                {{ __('Cancel') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
                :disabled="appModal.isSaving"
                :aria-label="__('Save Application')"
                @click="saveApplication"
              >
                <CommonIcon
                  v-if="appModal.isSaving"
                  name="loading"
                  class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ appModal.isEditing ? __('Save Changes') : __('Create Application') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- View Credentials Modal -->
      <div
        v-if="credentialsModal.isOpen && credentialsModal.app"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Application Credentials')"
      >
        <div
          class="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        >
          <div
            class="flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-800"
          >
            <div>
              <h2 class="text-base font-bold text-stone-900 dark:text-white">
                {{ credentialsModal.app.name }}
              </h2>
              <p class="text-xs text-stone-500 dark:text-stone-400">
                {{ __('OAuth application keys and secrets.') }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              :aria-label="__('Close')"
              @click="credentialsModal.isOpen = false"
            >
              <CommonIcon name="close" class="size-5" />
            </button>
          </div>

          <div class="mt-4 space-y-4">
            <div>
              <label
                for="cred-appid-input"
                class="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                {{ __('App ID (Client ID)') }}
              </label>
              <div
                class="mt-1 flex items-center rounded-lg border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
              >
                <input
                  id="cred-appid-input"
                  readonly
                  type="text"
                  :value="credentialsModal.app.uid"
                  class="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-stone-900 focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  class="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  :aria-label="__('Copy App ID')"
                  @click="copyToClipboard(credentialsModal.app.uid, 'view-uid')"
                >
                  <CommonIcon
                    :name="copiedField === 'view-uid' ? 'checkmark' : 'clipboard'"
                    class="size-4"
                  />
                </button>
              </div>
            </div>

            <div>
              <label
                for="cred-secret-input"
                class="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                {{ __('Secret (Client Secret)') }}
              </label>
              <div
                class="mt-1 flex items-center rounded-lg border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
              >
                <input
                  id="cred-secret-input"
                  readonly
                  type="text"
                  :value="credentialsModal.app.secret"
                  class="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-stone-900 focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  class="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  :aria-label="__('Copy Secret')"
                  @click="copyToClipboard(credentialsModal.app.secret, 'view-secret')"
                >
                  <CommonIcon
                    :name="copiedField === 'view-secret' ? 'checkmark' : 'clipboard'"
                    class="size-4"
                  />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-black dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
              :aria-label="__('Close')"
              @click="credentialsModal.isOpen = false"
            >
              {{ __('Close') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Generate Token Modal -->
      <div
        v-if="tokenModal.isOpen && tokenModal.app"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Generate Access Token')"
      >
        <div
          class="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        >
          <div
            class="flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-800"
          >
            <div>
              <h2 class="text-base font-bold text-stone-900 dark:text-white">
                {{ __('Generate Access Token') }}
              </h2>
              <p class="text-xs text-stone-500 dark:text-stone-400">
                {{ credentialsModal.app ? credentialsModal.app.name : tokenModal.app.name }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              :aria-label="__('Close')"
              @click="tokenModal.isOpen = false"
            >
              <CommonIcon name="close" class="size-5" />
            </button>
          </div>

          <div class="mt-4 space-y-4">
            <p class="text-xs text-stone-600 dark:text-stone-300">
              {{
                __(
                  'Generate a new API access token on behalf of your current session for "%s".',
                  tokenModal.app.name,
                )
              }}
            </p>

            <div
              v-if="tokenModal.generatedToken"
              class="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            >
              <span class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {{ __('New Access Token:') }}
              </span>
              <div
                class="flex items-center rounded border border-emerald-300 bg-white dark:border-emerald-700 dark:bg-stone-800"
              >
                <input
                  readonly
                  type="text"
                  :value="tokenModal.generatedToken"
                  class="flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-stone-900 focus:outline-none dark:text-white"
                  :aria-label="__('New Access Token')"
                />
                <button
                  type="button"
                  class="p-2 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                  :aria-label="__('Copy Token')"
                  @click="copyToClipboard(tokenModal.generatedToken, 'app-token')"
                >
                  <CommonIcon
                    :name="copiedField === 'app-token' ? 'checkmark' : 'clipboard'"
                    class="size-4"
                  />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              :aria-label="__('Close')"
              @click="tokenModal.isOpen = false"
            >
              {{ __('Close') }}
            </button>
            <button
              v-if="!tokenModal.generatedToken"
              type="button"
              class="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
              :disabled="tokenModal.isGenerating"
              :aria-label="__('Generate Token')"
              @click="executeGenerateToken"
            >
              <CommonIcon
                v-if="tokenModal.isGenerating"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Generate Token') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div
        v-if="deleteModal.isOpen && deleteModal.app"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Confirm Deletion')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              <CommonIcon name="trash" class="size-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-stone-900 dark:text-white">
                {{ __('Delete OAuth Application') }}
              </h3>
              <p class="text-xs text-stone-500 dark:text-stone-400">
                {{
                  __(
                    'Are you sure you want to delete "%s"? All existing tokens for this app will be revoked.',
                    deleteModal.app.name,
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              :aria-label="__('Cancel')"
              @click="deleteModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
              :disabled="deleteModal.isDeleting"
              :aria-label="__('Delete Application')"
              @click="executeDeleteApp"
            >
              <CommonIcon
                v-if="deleteModal.isDeleting"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Delete Application') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
