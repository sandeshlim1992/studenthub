<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  title: string
  description: string
  area: string
  state_current?: { value?: unknown }
  state_initial?: { value?: unknown }
  options?: {
    form?: Array<{
      name: string
      tag?: string
      options?: Record<string, string>
      display?: string
      null?: boolean
    }>
  }
}

interface LocaleRecord {
  id: number
  locale: string
  name: string
  active?: boolean
}

interface TimezoneOption {
  value: string
  name: string
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Settings') },
  { label: __('Branding') },
]

const isLoading = ref(true)
const isSaving = ref<Record<string, boolean>>({})
const successMessage = ref('')
const errorMessage = ref('')

const settings = ref<Record<string, SettingRecord>>({})
const localesList = ref<LocaleRecord[]>([])
const timezonesList = ref<TimezoneOption[]>([])

// Form model values
const productName = ref('')
const organization = ref('')
const defaultLocale = ref('en-us')
const defaultTimezone = ref('UTC')
const prettyDateFormat = ref('relative')
const userNameFormat = ref('first_last')

// Logo upload state
const logoPreviewUrl = ref('')
const pendingLogoFile = ref<File | null>(null)
const isUploadingLogo = ref(false)

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => { successMessage.value = '' }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  setTimeout(() => { errorMessage.value = '' }, 6000)
}

const fetchSettings = async () => {
  isLoading.value = true
  try {
    const [settingsRes, localesRes, timezonesRes] = await Promise.all([
      fetch('/api/v1/settings', {
        headers: { 'Accept': 'application/json' },
      }),
      fetch('/api/v1/locales', {
        headers: { 'Accept': 'application/json' },
      }),
      fetch('/api/v1/calendars/timezones', {
        headers: { 'Accept': 'application/json' },
      }),
    ])

    if (settingsRes.ok) {
      const data: SettingRecord[] = await settingsRes.json()
      const brandingSettings: Record<string, SettingRecord> = {}
      for (const item of data) {
        if (item.area === 'System::Branding') {
          brandingSettings[item.name] = item
        }
      }
      settings.value = brandingSettings

      if (brandingSettings.product_name?.state_current?.value !== undefined) {
        productName.value = String(brandingSettings.product_name.state_current.value || '')
      }
      if (brandingSettings.organization?.state_current?.value !== undefined) {
        organization.value = String(brandingSettings.organization.state_current.value || '')
      }
      if (brandingSettings.locale_default?.state_current?.value !== undefined) {
        defaultLocale.value = String(brandingSettings.locale_default.state_current.value || 'en-us')
      }
      if (brandingSettings.timezone_default?.state_current?.value !== undefined) {
        defaultTimezone.value = String(brandingSettings.timezone_default.state_current.value || 'UTC')
      }
      if (brandingSettings.pretty_date_format?.state_current?.value !== undefined) {
        prettyDateFormat.value = String(brandingSettings.pretty_date_format.state_current.value || 'relative')
      }
      if (brandingSettings.user_name_format?.state_current?.value !== undefined) {
        userNameFormat.value = String(brandingSettings.user_name_format.state_current.value || 'first_last')
      }
      if (brandingSettings.product_logo?.state_current?.value) {
        logoPreviewUrl.value = `/api/v1/system_asset/product_logo/${brandingSettings.product_logo.state_current.value}?${Date.now()}`
      }
    }

    if (localesRes.ok) {
      const localesData: LocaleRecord[] = await localesRes.json()
      localesList.value = localesData.filter(l => l.active !== false)
    }

    if (timezonesRes.ok) {
      const tzData = await timezonesRes.json()
      if (tzData.timezones) {
        if (Array.isArray(tzData.timezones)) {
          timezonesList.value = tzData.timezones.map((tz: string | TimezoneOption) =>
            typeof tz === 'string' ? { value: tz, name: tz } : tz
          )
        } else if (typeof tzData.timezones === 'object') {
          timezonesList.value = Object.entries(tzData.timezones).map(([val, name]) => ({
            value: val,
            name: String(name),
          }))
        }
      }
    }
  } catch {
    showError(__('Failed to load branding settings.'))
  } finally {
    isLoading.value = false
  }
}

const saveSingleSetting = async (name: string, value: unknown) => {
  const setting = settings.value[name]
  if (!setting) return

  isSaving.value[name] = true
  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        state_current: { value },
      }),
    })

    if (res.ok) {
      const updated: SettingRecord = await res.json()
      settings.value[name] = updated
      showSuccess(__('Setting updated successfully.'))
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update setting.'))
    }
  } catch {
    showError(__('An unexpected error occurred while saving.'))
  } finally {
    isSaving.value[name] = false
  }
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (file.size > 8 * 1024 * 1024) {
    showError(__('File is too big. Maximum allowed size is 8 MB.'))
    return
  }

  pendingLogoFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => {
    logoPreviewUrl.value = String(e.target?.result || '')
  }
  reader.readAsDataURL(file)
}

const uploadLogo = async () => {
  const logoSetting = settings.value.product_logo
  if (!logoSetting || !logoPreviewUrl.value.startsWith('data:image')) {
    return
  }

  isUploadingLogo.value = true
  try {
    const res = await fetch(`/api/v1/settings/image/${logoSetting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        logo: logoPreviewUrl.value,
        logo_resize: logoPreviewUrl.value,
      }),
    })

    if (res.ok) {
      pendingLogoFile.value = null
      showSuccess(__('Logo updated successfully.'))
      await fetchSettings()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update logo.'))
    }
  } catch {
    showError(__('An error occurred while uploading logo.'))
  } finally {
    isUploadingLogo.value = false
  }
}

const resetLogo = async () => {
  const logoSetting = settings.value.product_logo
  if (!logoSetting) return

  isUploadingLogo.value = true
  try {
    const res = await fetch(`/api/v1/settings/reset/${logoSetting.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
    })

    if (res.ok) {
      pendingLogoFile.value = null
      showSuccess(__('Logo reset to default.'))
      await fetchSettings()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to reset logo.'))
    }
  } catch {
    showError(__('Failed to reset logo.'))
  } finally {
    isUploadingLogo.value = false
  }
}

const prettyDateOptions = computed(() => {
  const s = settings.value.pretty_date_format
  if (s?.options?.form?.[0]?.options) {
    return Object.entries(s.options.form[0].options).map(([val, label]) => ({
      value: val,
      label,
    }))
  }
  return [
    { value: 'relative', label: __('relative - e. g. "2 hours ago" or "2 days and 15 minutes ago"') },
    { value: 'absolute', label: __('absolute - e. g. "Monday 09:30" or "Tuesday 23. Feb 14:20"') },
    { value: 'timestamp', label: __('timestamp - e. g. "2026-09-18 10:30"') },
  ]
})

const userNameFormatOptions = computed(() => {
  const s = settings.value.user_name_format
  if (s?.options?.form?.[0]?.options) {
    return Object.entries(s.options.form[0].options).map(([val, label]) => ({
      value: val,
      label,
    }))
  }
  return [
    { value: 'first_last', label: __('Firstname Lastname') },
    { value: 'last_first', label: __('Lastname Firstname') },
    { value: 'last_first_comma', label: __('Lastname, Firstname') },
  ]
})

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-5xl">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back')"
            @click="router.back()"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CommonIcon name="color" class="w-4 h-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ __('Branding') }}</h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ __('Customize your product name, company logo, default language, timezone, and formatting.') }}
        </p>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3">
        <CommonIcon name="check2" class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-sm flex items-center gap-3">
        <CommonIcon name="exclamation-triangle" class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="space-y-6">
        <div class="h-44 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
        <div class="h-32 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
        <div class="h-32 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
      </div>

      <!-- Settings Cards -->
      <div v-else class="space-y-6">
        <!-- 1. Logo Management -->
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {{ __('Logo') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {{ __('Upload your company logo. Displayed on the login page and navigation header. (PNG, JPG, SVG up to 8MB)') }}
              </p>
            </div>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              :disabled="isUploadingLogo"
              @click="resetLogo"
            >
              {{ __('Reset to Default') }}
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <!-- Logo Preview Container -->
            <div class="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#1e293b]/40 min-h-[160px]">
              <div v-if="logoPreviewUrl" class="flex flex-col items-center gap-3">
                <img
                  :src="logoPreviewUrl"
                  :alt="__('Product Logo')"
                  class="max-h-20 max-w-full object-contain drop-shadow-xs"
                />
                <span class="text-[11px] text-slate-400 dark:text-slate-500">
                  {{ pendingLogoFile ? pendingLogoFile.name : __('Current Active Logo') }}
                </span>
              </div>
              <div v-else class="text-center text-slate-400 dark:text-slate-500">
                <CommonIcon name="image" class="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p class="text-xs">{{ __('No logo uploaded') }}</p>
              </div>
            </div>

            <!-- Upload Controls -->
            <div class="space-y-4">
              <div>
                <label
                  for="logo-file-input"
                  class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs cursor-pointer transition-colors"
                >
                  <CommonIcon name="upload" class="w-4 h-4 text-slate-500" />
                  <span>{{ __('Select Image...') }}</span>
                  <input
                    id="logo-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    class="sr-only"
                    @change="handleFileSelect"
                  />
                </label>
              </div>

              <div v-if="pendingLogoFile" class="flex items-center gap-3">
                <button
                  type="button"
                  class="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  :disabled="isUploadingLogo"
                  @click="uploadLogo"
                >
                  <CommonIcon v-if="isUploadingLogo" name="arrow-clockwise" class="w-3.5 h-3.5 animate-spin" />
                  <span>{{ isUploadingLogo ? __('Saving...') : __('Save New Logo') }}</span>
                </button>
                <button
                  type="button"
                  class="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  @click="pendingLogoFile = null; fetchSettings()"
                >
                  {{ __('Cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Product Identity (Product Name & Organization) -->
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
          <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
            {{ __('Identity') }}
          </h2>

          <!-- Product Name -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label for="setting-product-name" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {{ __('Product Name') }}
              </label>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Name of this installation shown in emails, titles, and login screens.') }}
            </p>
            <div class="flex items-center gap-3">
              <input
                id="setting-product-name"
                v-model="productName"
                type="text"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.product_name"
                @click="saveSingleSetting('product_name', productName)"
              >
                {{ isSaving.product_name ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
            <div class="flex items-center justify-between">
              <label for="setting-organization" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {{ __('Organization') }}
              </label>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Name of your company or organization.') }}
            </p>
            <div class="flex items-center gap-3">
              <input
                id="setting-organization"
                v-model="organization"
                type="text"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.organization"
                @click="saveSingleSetting('organization', organization)"
              >
                {{ isSaving.organization ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Regional Settings (Locale & Timezone) -->
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
          <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
            {{ __('Regional & Timezone') }}
          </h2>

          <!-- Default Locale -->
          <div class="space-y-2">
            <label for="setting-default-locale" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {{ __('Default Language') }}
            </label>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Standard language for new users, public customer forms, and automated notifications.') }}
            </p>
            <div class="flex items-center gap-3">
              <select
                id="setting-default-locale"
                v-model="defaultLocale"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option v-for="l in localesList" :key="l.locale" :value="l.locale">
                  {{ l.name }} ({{ l.locale }})
                </option>
              </select>
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.locale_default"
                @click="saveSingleSetting('locale_default', defaultLocale)"
              >
                {{ isSaving.locale_default ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>

          <!-- Default Timezone -->
          <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
            <label for="setting-default-timezone" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {{ __('Default Timezone') }}
            </label>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Standard timezone used for SLA calculations and timestamps.') }}
            </p>
            <div class="flex items-center gap-3">
              <select
                id="setting-default-timezone"
                v-model="defaultTimezone"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option v-for="tz in timezonesList" :key="tz.value" :value="tz.value">
                  {{ tz.name }}
                </option>
              </select>
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.timezone_default"
                @click="saveSingleSetting('timezone_default', defaultTimezone)"
              >
                {{ isSaving.timezone_default ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 4. Formatting Standards (Pretty Date & User Name Format) -->
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
          <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
            {{ __('Formatting') }}
          </h2>

          <!-- Pretty Date Format -->
          <div class="space-y-2">
            <label for="setting-pretty-date" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {{ __('Pretty Date Format') }}
            </label>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Determines how timestamps are formatted across ticket overviews and detail views.') }}
            </p>
            <div class="flex items-center gap-3">
              <select
                id="setting-pretty-date"
                v-model="prettyDateFormat"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option v-for="opt in prettyDateOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.pretty_date_format"
                @click="saveSingleSetting('pretty_date_format', prettyDateFormat)"
              >
                {{ isSaving.pretty_date_format ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>

          <!-- User Name Format -->
          <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
            <label for="setting-user-name-format" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {{ __('User Name Format') }}
            </label>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Order of first and last names displayed throughout the UI.') }}
            </p>
            <div class="flex items-center gap-3">
              <select
                id="setting-user-name-format"
                v-model="userNameFormat"
                class="flex-1 max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option v-for="opt in userNameFormatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.user_name_format"
                @click="saveSingleSetting('user_name_format', userNameFormat)"
              >
                {{ isSaving.user_name_format ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
