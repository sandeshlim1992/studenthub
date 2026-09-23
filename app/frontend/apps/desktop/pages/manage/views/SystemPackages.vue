<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface PackageRecord {
  id: number
  name: string
  version: string
  vendor: string
  license?: string
  state?: string
  description?: string
  changelog?: string
}

interface ApiPackageMeta {
  name: string
  version: string
  vendor: string
  license?: string
  description?: string
  id?: number
}

interface PackagesApiResponse {
  packages: PackageRecord[]
  package_installation: boolean
  local_gemfiles: boolean
  token_setting_id: number
  token_present: boolean
  api_package_metas?: Record<string, ApiPackageMeta>
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Packages') },
]

const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isActionLoading = ref<Record<string, boolean>>({})

const installedPackages = ref<PackageRecord[]>([])
const apiPackageMetas = ref<Record<string, ApiPackageMeta>>({})
const tokenSettingId = ref<number | null>(null)
const tokenPresent = ref(false)

// Token Settings Modal
const tokenModal = ref<{
  isOpen: boolean
  token: string
  isSaving: boolean
}>({
  isOpen: false,
  token: '',
  isSaving: false,
})

// Uninstall confirmation modal
const uninstallModal = ref<{
  isOpen: boolean
  pkg: PackageRecord | null
  confirmText: string
  isUninstalling: boolean
}>({
  isOpen: false,
  pkg: null,
  confirmText: '',
  isUninstalling: false,
})

// Local file upload
const selectedFile = ref<File | null>(null)
const isUploading = ref(false)

const isNewerVersion = (localVer: string, remoteVer: string): boolean => {
  const localParts = localVer.split('.').map((n) => parseInt(n, 10) || 0)
  const remoteParts = remoteVer.split('.').map((n) => parseInt(n, 10) || 0)
  const localVal =
    (localParts[0] || 0) * 1000000 + (localParts[1] || 0) * 1000 + (localParts[2] || 0)
  const remoteVal =
    (remoteParts[0] || 0) * 1000000 + (remoteParts[1] || 0) * 1000 + (remoteParts[2] || 0)
  return localVal < remoteVal
}

const fetchPackages = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/packages', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data: PackagesApiResponse = await res.json()

    installedPackages.value = Array.isArray(data.packages) ? data.packages : []
    apiPackageMetas.value = data.api_package_metas || {}
    tokenSettingId.value = data.token_setting_id || null
    tokenPresent.value = Boolean(data.token_present)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to load packages.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchPackages()
})

const availableToInstall = computed(() => {
  const installedNames = new Set(installedPackages.value.map((p) => p.name))
  return Object.values(apiPackageMetas.value).filter((meta) => !installedNames.has(meta.name))
})

const hasUpdate = (pkg: PackageRecord): boolean => {
  const remote = apiPackageMetas.value[pkg.name]
  if (!remote) return false
  return isNewerVersion(pkg.version, remote.version)
}

const getRemoteVersion = (pkg: PackageRecord): string | null => {
  const remote = apiPackageMetas.value[pkg.name]
  return remote ? remote.version : null
}

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  } else {
    selectedFile.value = null
  }
}

const uploadPackage = async () => {
  if (!selectedFile.value) return
  isUploading.value = true
  errorMessage.value = ''
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const res = await fetch('/api/v1/packages', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${res.status}`)
    }

    selectedFile.value = null
    successMessage.value = __('Package uploaded and installed successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchPackages()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to upload package.')
  } finally {
    isUploading.value = false
  }
}

const installFromApi = async (meta: ApiPackageMeta) => {
  const actionKey = `install-${meta.name}`
  isActionLoading.value[actionKey] = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/packages/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id: meta.id || meta.name }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    successMessage.value = __('Package "%s" installed successfully.', meta.name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchPackages()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to install package.')
  } finally {
    isActionLoading.value[actionKey] = false
  }
}

const updatePackage = async (pkg: PackageRecord) => {
  const actionKey = `update-${pkg.id}`
  isActionLoading.value[actionKey] = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/packages/api', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id: pkg.id }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    successMessage.value = __('Package "%s" updated successfully.', pkg.name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchPackages()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to update package.')
  } finally {
    isActionLoading.value[actionKey] = false
  }
}

const confirmUninstall = (pkg: PackageRecord) => {
  uninstallModal.value = {
    isOpen: true,
    pkg,
    confirmText: '',
    isUninstalling: false,
  }
}

const executeUninstall = async () => {
  const { pkg } = uninstallModal.value
  if (!pkg) return
  uninstallModal.value.isUninstalling = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/packages', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id: pkg.id }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    uninstallModal.value.isOpen = false
    successMessage.value = __('Package "%s" uninstalled.', pkg.name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchPackages()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to uninstall package.')
  } finally {
    uninstallModal.value.isUninstalling = false
  }
}

const openTokenModal = () => {
  tokenModal.value = {
    isOpen: true,
    token: '',
    isSaving: false,
  }
}

const saveToken = async () => {
  if (!tokenSettingId.value) return
  tokenModal.value.isSaving = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/settings/${tokenSettingId.value}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        state_current: { value: tokenModal.value.token.trim() },
      }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    tokenModal.value.isOpen = false
    successMessage.value = __('API token updated successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchPackages()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to save API token.')
  } finally {
    tokenModal.value.isSaving = false
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
                  <CommonIcon name="download" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Package Manager') }}
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
                  'Install, update, and manage third-party extensions and official Zammad feature packages.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              :aria-label="__('Configure Repository Token')"
              @click="openTokenModal"
            >
              <CommonIcon name="key" class="h-4 w-4 text-slate-400" />
              {{ __('Repository Token') }}
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
        <!-- Upload Package Card -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-1 flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="download" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Upload & Install Package (.szpm)') }}
            </h2>
          </div>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {{
              __(
                'Upload custom or downloaded Zammad package files (.szpm format) directly to install them into your instance.',
              )
            }}
          </p>

          <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <input
              id="package-file-upload"
              type="file"
              accept=".szpm,.tar.gz"
              class="block w-full max-w-md text-xs text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
              @change="onFileChange"
            />
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              :disabled="!selectedFile || isUploading"
              :aria-label="__('Install Package File')"
              @click="uploadPackage"
            >
              <CommonIcon
                v-if="isUploading"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Install Package File') }}
            </button>
          </div>
        </div>

        <!-- Installed Packages Table -->
        <div
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">
              {{ __('Installed Packages (%s)', installedPackages.length) }}
            </h2>
          </div>

          <div v-if="isLoading" class="p-12 text-center">
            <CommonIcon name="loading" class="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ __('Loading installed packages...') }}
            </p>
          </div>

          <div v-else-if="installedPackages.length === 0" class="p-12 text-center">
            <div
              class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            >
              <CommonIcon name="box" class="h-6 w-6" />
            </div>
            <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
              {{ __('No packages installed') }}
            </h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ __('You have not installed any add-ons or extension packages.') }}
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-start text-sm text-slate-600 dark:text-slate-300">
              <thead
                class="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
              >
                <tr>
                  <th scope="col" class="px-6 py-3.5 text-start">
                    {{ __('Package Name') }}
                  </th>
                  <th scope="col" class="px-6 py-3.5 text-start">
                    {{ __('Version') }}
                  </th>
                  <th scope="col" class="px-6 py-3.5 text-start">
                    {{ __('Vendor') }}
                  </th>
                  <th scope="col" class="px-6 py-3.5 text-start">
                    {{ __('License') }}
                  </th>
                  <th scope="col" class="px-6 py-3.5 text-end">
                    {{ __('Actions') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                <tr
                  v-for="pkg in installedPackages"
                  :key="pkg.id"
                  class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <!-- Name -->
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-900 dark:text-white">
                      {{ pkg.name }}
                    </div>
                    <p
                      v-if="pkg.description"
                      class="line-clamp-1 text-xs text-slate-500 dark:text-slate-400"
                    >
                      {{ pkg.description }}
                    </p>
                  </td>

                  <!-- Version -->
                  <td class="px-6 py-4 font-mono text-xs whitespace-nowrap">
                    <span>{{ pkg.version }}</span>
                    <span
                      v-if="hasUpdate(pkg)"
                      class="text-2xs rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 ltr:ml-2 rtl:mr-2 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      {{ __('v%s available', getRemoteVersion(pkg)) }}
                    </span>
                  </td>

                  <!-- Vendor -->
                  <td
                    class="px-6 py-4 text-xs whitespace-nowrap text-slate-600 dark:text-slate-400"
                  >
                    {{ pkg.vendor || '—' }}
                  </td>

                  <!-- License -->
                  <td
                    class="px-6 py-4 text-xs whitespace-nowrap text-slate-600 dark:text-slate-400"
                  >
                    {{ pkg.license || '—' }}
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 text-end whitespace-nowrap">
                    <div class="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                      <button
                        v-if="hasUpdate(pkg)"
                        type="button"
                        class="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                        :disabled="isActionLoading[`update-${pkg.id}`]"
                        :aria-label="__('Update %s', pkg.name)"
                        @click="updatePackage(pkg)"
                      >
                        <CommonIcon
                          v-if="isActionLoading[`update-${pkg.id}`]"
                          name="loading"
                          class="h-3 w-3 animate-spin ltr:mr-1 rtl:ml-1"
                        />
                        {{ __('Update') }}
                      </button>
                      <button
                        type="button"
                        class="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        :title="__('Uninstall')"
                        :aria-label="__('Uninstall %s', pkg.name)"
                        @click="confirmUninstall(pkg)"
                      >
                        <CommonIcon name="trash" class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Available from Repository -->
        <div
          v-if="availableToInstall.length > 0"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">
              {{ __('Available from Zammad Repository (%s)', availableToInstall.length) }}
            </h2>
          </div>
          <div class="divide-y divide-slate-200 dark:divide-slate-800">
            <div
              v-for="item in availableToInstall"
              :key="item.name"
              class="flex items-center justify-between p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
            >
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <span class="font-bold text-slate-900 dark:text-white">
                    {{ item.name }}
                  </span>
                  <span
                    class="text-2xs rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    v{{ item.version }}
                  </span>
                </div>
                <p class="mt-1 max-w-xl text-xs text-slate-500 dark:text-slate-400">
                  {{ item.description || __('No description provided.') }}
                </p>
              </div>
              <button
                type="button"
                class="inline-flex shrink-0 items-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 ltr:ml-4 rtl:mr-4"
                :disabled="isActionLoading[`install-${item.name}`]"
                :aria-label="__('Install %s', item.name)"
                @click="installFromApi(item)"
              >
                <CommonIcon
                  v-if="isActionLoading[`install-${item.name}`]"
                  name="loading"
                  class="h-3 w-3 animate-spin ltr:mr-1 rtl:ml-1"
                />
                {{ __('Install') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Uninstall Confirmation Modal -->
      <div
        v-if="uninstallModal.isOpen && uninstallModal.pkg"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Uninstall Package Confirmation')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              <CommonIcon name="trash" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Uninstall Package?') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Are you sure you want to uninstall "%s"? All package data and configured assets will be permanently removed.',
                    uninstallModal.pkg.name,
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
              @click="uninstallModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
              :disabled="uninstallModal.isUninstalling"
              :aria-label="__('Uninstall Now')"
              @click="executeUninstall"
            >
              <CommonIcon
                v-if="uninstallModal.isUninstalling"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Uninstall Now') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Token Modal -->
      <div
        v-if="tokenModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Package Repository API Token')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800"
          >
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Package Repository API Token') }}
            </h3>
            <button
              type="button"
              class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              :aria-label="__('Close')"
              @click="tokenModal.isOpen = false"
            >
              <CommonIcon name="close" class="h-4 w-4" />
            </button>
          </div>

          <div class="mt-4 space-y-3">
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Enter the license or API token provided by Zammad to access premium extensions and vendor packages.',
                )
              }}
            </p>
            <div>
              <label
                for="pkg-token-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('API Token') }}
              </label>
              <input
                id="pkg-token-input"
                v-model="tokenModal.token"
                type="password"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                :placeholder="tokenPresent ? '••••••••••••••••' : __('Enter API Token')"
              />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="tokenModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              :disabled="tokenModal.isSaving"
              :aria-label="__('Save Token')"
              @click="saveToken"
            >
              <CommonIcon
                v-if="tokenModal.isSaving"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Save Token') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
