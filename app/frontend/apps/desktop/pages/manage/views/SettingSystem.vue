<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
      name?: string
      tag?: string
      options?: Record<string, string | number>
      display?: string
      null?: boolean
    }>
  }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Settings') },
  { label: __('System') },
]

const activeTab = ref<'base' | 'services' | 'storage' | 'network' | 'frontend'>('base')
const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isSaving = ref<Record<string, boolean>>({})

const allSettings = ref<Record<string, SettingRecord>>({})

// Base Form
const systemId = ref<number>(10)
const fqdn = ref('zammad.example.com')
const httpType = ref('https')

// Services Form
const imageBackend = ref('Service::Image::Zammad')
const geoIpBackend = ref('Service::GeoIp::Zammad')
const geoLocationBackend = ref('Service::GeoLocation::Osm')
const geoCalendarBackend = ref('Service::GeoCalendar::Zammad')

// Storage Form
const storageProvider = ref('DB')

// Network Form
const proxy = ref('')
const proxyUsername = ref('')
const proxyPassword = ref('')
const proxyNo = ref('')
const isTestingProxy = ref(false)

// Frontend Form
const coreWorkflowAjaxMode = ref(false)
const datepickerShowCalendarWeeks = ref(false)

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

const fetchAllSettings = async () => {
  isLoading.value = true
  try {
    const res = await fetch('/api/v1/settings', {
      headers: { 'Accept': 'application/json' },
    })

    if (res.ok) {
      const data: SettingRecord[] = await res.json()
      const dict: Record<string, SettingRecord> = {}
      for (const item of data) {
        dict[item.name] = item
      }
      allSettings.value = dict

      // Base
      if (dict.system_id?.state_current?.value !== undefined) {
        systemId.value = Number(dict.system_id.state_current.value || 10)
      }
      if (dict.fqdn?.state_current?.value !== undefined) {
        fqdn.value = String(dict.fqdn.state_current.value || '')
      }
      if (dict.http_type?.state_current?.value !== undefined) {
        httpType.value = String(dict.http_type.state_current.value || 'https')
      }

      // Services
      if (dict.image_backend?.state_current?.value !== undefined) {
        imageBackend.value = String(dict.image_backend.state_current.value || '')
      }
      if (dict.geo_ip_backend?.state_current?.value !== undefined) {
        geoIpBackend.value = String(dict.geo_ip_backend.state_current.value || '')
      }
      if (dict.geo_location_backend?.state_current?.value !== undefined) {
        geoLocationBackend.value = String(dict.geo_location_backend.state_current.value || '')
      }
      if (dict.geo_calendar_backend?.state_current?.value !== undefined) {
        geoCalendarBackend.value = String(dict.geo_calendar_backend.state_current.value || '')
      }

      // Storage
      if (dict.storage_provider?.state_current?.value !== undefined) {
        storageProvider.value = String(dict.storage_provider.state_current.value || 'DB')
      }

      // Network
      if (dict.proxy?.state_current?.value !== undefined) {
        proxy.value = String(dict.proxy.state_current.value || '')
      }
      if (dict.proxy_username?.state_current?.value !== undefined) {
        proxyUsername.value = String(dict.proxy_username.state_current.value || '')
      }
      if (dict.proxy_password?.state_current?.value !== undefined) {
        proxyPassword.value = String(dict.proxy_password.state_current.value || '')
      }
      if (dict.proxy_no?.state_current?.value !== undefined) {
        proxyNo.value = String(dict.proxy_no.state_current.value || '')
      }

      // Frontend
      if (dict.core_workflow_ajax_mode?.state_current?.value !== undefined) {
        coreWorkflowAjaxMode.value = !!dict.core_workflow_ajax_mode.state_current.value
      }
      if (dict.datepicker_show_calendar_weeks?.state_current?.value !== undefined) {
        datepickerShowCalendarWeeks.value = !!dict.datepicker_show_calendar_weeks.state_current.value
      }
    }
  } catch {
    showError(__('Failed to load system settings.'))
  } finally {
    isLoading.value = false
  }
}

const saveSetting = async (name: string, value: unknown) => {
  const setting = allSettings.value[name]
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
      allSettings.value[name] = updated
      showSuccess(__('Setting updated successfully.'))
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update setting.'))
    }
  } catch {
    showError(__('An error occurred while saving.'))
  } finally {
    isSaving.value[name] = false
  }
}

// Proxy Test Action
const testProxyConnection = async () => {
  isTestingProxy.value = true
  try {
    const res = await fetch('/api/v1/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        proxy: proxy.value,
        proxy_username: proxyUsername.value,
        proxy_password: proxyPassword.value,
        proxy_no: proxyNo.value,
      }),
    })

    const data = await res.json()
    if (data.result === 'success') {
      showSuccess(__('Proxy connection test successful!'))
    } else {
      showError(data.message || __('Proxy connection test failed.'))
    }
  } catch {
    showError(__('Proxy test failed to connect.'))
  } finally {
    isTestingProxy.value = false
  }
}

const saveProxySettings = async () => {
  isSaving.value.proxy = true
  try {
    await Promise.all([
      saveSetting('proxy', proxy.value),
      saveSetting('proxy_username', proxyUsername.value),
      saveSetting('proxy_password', proxyPassword.value),
      saveSetting('proxy_no', proxyNo.value),
    ])
    showSuccess(__('Proxy configuration saved.'))
  } finally {
    isSaving.value.proxy = false
  }
}

onMounted(() => {
  fetchAllSettings()
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
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <CommonIcon name="gear" class="w-4 h-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ __('System Settings') }}</h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ __('Configure system identifier, domain names, network proxy, external backends, storage providers, and UI behavior.') }}
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

      <!-- Tab Navigation -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-[#1e293b] mb-6 overflow-x-auto">
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'base' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'base'"
        >
          {{ __('Base') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'services' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'services'"
        >
          {{ __('Services') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'storage' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'storage'"
        >
          {{ __('Storage') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'network' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'network'"
        >
          {{ __('Network') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'frontend' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'frontend'"
        >
          {{ __('Frontend') }}
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="space-y-6">
        <div class="h-36 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
        <div class="h-36 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
      </div>

      <div v-else>
        <!-- TAB 1: Base -->
        <div v-if="activeTab === 'base'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('System Identification & Domain') }}</h2>

            <!-- System ID -->
            <div class="space-y-2">
              <label for="setting-system-id" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('System ID') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Numeric system ID embedded in generated ticket numbers (10 - 99).') }}
              </p>
              <div class="flex items-center gap-3">
                <input
                  id="setting-system-id"
                  v-model.number="systemId"
                  type="number"
                  min="10"
                  max="99"
                  class="w-32 px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 text-center font-mono"
                />
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.system_id"
                  @click="saveSetting('system_id', systemId)"
                >
                  {{ isSaving.system_id ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- FQDN -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-fqdn" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Fully Qualified Domain Name (FQDN)') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Hostname of your helpdesk server used in notification links and webhooks.') }}
              </p>
              <div class="flex items-center gap-3">
                <input
                  id="setting-fqdn"
                  v-model="fqdn"
                  type="text"
                  placeholder="zammad.example.com"
                  class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.fqdn"
                  @click="saveSetting('fqdn', fqdn)"
                >
                  {{ isSaving.fqdn ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- HTTP Type -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-http-type" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('HTTP Protocol') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Protocol used when building URLs for email notifications and redirects.') }}
              </p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-http-type"
                  v-model="httpType"
                  class="w-44 px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer font-mono"
                >
                  <option value="https">https://</option>
                  <option value="http">http://</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.http_type"
                  @click="saveSetting('http_type', httpType)"
                >
                  {{ isSaving.http_type ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: Services -->
        <div v-if="activeTab === 'services'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('System Backends & Integration Services') }}</h2>

            <!-- Image Service -->
            <div class="space-y-2">
              <label for="setting-image-backend" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Image Service') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Service used for image resizing and thumbnail generation.') }}</p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-image-backend"
                  v-model="imageBackend"
                  class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">{{ __('- Disabled -') }}</option>
                  <option value="Service::Image::Zammad">{{ __('Zammad Image Service') }}</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.image_backend"
                  @click="saveSetting('image_backend', imageBackend)"
                >
                  {{ isSaving.image_backend ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- GeoIP Service -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-geo-ip-backend" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('GeoIP Service') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('IP lookup backend to determine customer location and country flag.') }}</p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-geo-ip-backend"
                  v-model="geoIpBackend"
                  class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">{{ __('- Disabled -') }}</option>
                  <option value="Service::GeoIp::Zammad">{{ __('Zammad GeoIP Service') }}</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.geo_ip_backend"
                  @click="saveSetting('geo_ip_backend', geoIpBackend)"
                >
                  {{ isSaving.geo_ip_backend ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- GeoLocation Service -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-geo-location-backend" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('GeoLocation Service') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Map tiles and geographic coordinate resolution.') }}</p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-geo-location-backend"
                  v-model="geoLocationBackend"
                  class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">{{ __('- Disabled -') }}</option>
                  <option value="Service::GeoLocation::Osm">{{ __('OpenStreetMap') }}</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.geo_location_backend"
                  @click="saveSetting('geo_location_backend', geoLocationBackend)"
                >
                  {{ isSaving.geo_location_backend ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- GeoCalendar Service -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-geo-calendar-backend" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('GeoCalendar Service') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Regional holiday calendar feed for working hours & SLAs.') }}</p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-geo-calendar-backend"
                  v-model="geoCalendarBackend"
                  class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">{{ __('- Disabled -') }}</option>
                  <option value="Service::GeoCalendar::Zammad">{{ __('Zammad GeoCalendar Service') }}</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.geo_calendar_backend"
                  @click="saveSetting('geo_calendar_backend', geoCalendarBackend)"
                >
                  {{ isSaving.geo_calendar_backend ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: Storage -->
        <div v-if="activeTab === 'storage'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Attachment Storage Provider') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Location where ticket attachments and uploaded assets are permanently stored.') }}
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <label
                class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3"
                :class="storageProvider === 'DB' ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ __('Database') }}</span>
                  <input
                    type="radio"
                    name="storage_provider"
                    value="DB"
                    :checked="storageProvider === 'DB'"
                    :aria-label="__('Database')"
                    class="w-4 h-4 accent-blue-600"
                    @change="storageProvider = 'DB'"
                  />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Stores all files directly inside the relational database. Easiest for single-node backup and restore.') }}
                </p>
              </label>

              <label
                class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3"
                :class="storageProvider === 'File' ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ __('Filesystem') }}</span>
                  <input
                    type="radio"
                    name="storage_provider"
                    value="File"
                    :checked="storageProvider === 'File'"
                    :aria-label="__('Filesystem')"
                    class="w-4 h-4 accent-blue-600"
                    @change="storageProvider = 'File'"
                  />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Stores attachments on the server local disk / SAN / NAS. Keeps database backups lean and compact.') }}
                </p>
              </label>

              <label
                class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3"
                :class="storageProvider === 'S3' ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ __('Simple Storage (S3)') }}</span>
                  <input
                    type="radio"
                    name="storage_provider"
                    value="S3"
                    :checked="storageProvider === 'S3'"
                    :aria-label="__('Simple Storage (S3)')"
                    class="w-4 h-4 accent-blue-600"
                    @change="storageProvider = 'S3'"
                  />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Cloud object storage bucket compatible with AWS S3, MinIO, or Ceph.') }}
                </p>
              </label>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.storage_provider"
                @click="saveSetting('storage_provider', storageProvider)"
              >
                {{ isSaving.storage_provider ? __('Saving...') : __('Save Storage Method') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 4: Network (Proxy) -->
        <div v-if="activeTab === 'network'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Outbound HTTP/HTTPS Proxy') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Route all outbound API requests (webhooks, email OAuth, GeoIP, integrations) through a corporate proxy.') }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Proxy Host:Port -->
              <div class="space-y-1.5 md:col-span-2">
                <label for="setting-proxy-host" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Proxy Server (Host:Port)') }}
                </label>
                <input
                  id="setting-proxy-host"
                  v-model="proxy"
                  type="text"
                  placeholder="proxy.example.com:3128"
                  class="w-full max-w-md px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <!-- Proxy Username -->
              <div class="space-y-1.5">
                <label for="setting-proxy-user" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Proxy Username') }}
                </label>
                <input
                  id="setting-proxy-user"
                  v-model="proxyUsername"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <!-- Proxy Password -->
              <div class="space-y-1.5">
                <label for="setting-proxy-pass" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Proxy Password') }}
                </label>
                <input
                  id="setting-proxy-pass"
                  v-model="proxyPassword"
                  type="password"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <!-- No Proxy Exclusions -->
              <div class="space-y-1.5 md:col-span-2">
                <label for="setting-proxy-no" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('No Proxy (Exclusions)') }}
                </label>
                <p class="text-[11px] text-slate-400">{{ __('Comma-separated list of domains or IP addresses that bypass the proxy.') }}</p>
                <input
                  id="setting-proxy-no"
                  v-model="proxyNo"
                  type="text"
                  placeholder="localhost, 127.0.0.1, *.internal.company"
                  class="w-full max-w-lg px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div class="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
                :disabled="isTestingProxy || !proxy"
                @click="testProxyConnection"
              >
                <CommonIcon v-if="isTestingProxy" name="arrow-clockwise" class="w-3.5 h-3.5 animate-spin" />
                <span>{{ isTestingProxy ? __('Testing...') : __('Test Connection') }}</span>
              </button>

              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.proxy"
                @click="saveProxySettings"
              >
                {{ isSaving.proxy ? __('Saving...') : __('Save Network Settings') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 5: Frontend -->
        <div v-if="activeTab === 'frontend'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('User Interface Behavior') }}</h2>

            <!-- Core Workflow AJAX Mode -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Core Workflow AJAX Mode') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Execute dynamic core workflow field logic via background AJAX requests.') }}
                </p>
              </div>
              <input
                id="setting-core-workflow-ajax"
                type="checkbox"
                :checked="coreWorkflowAjaxMode"
                :aria-label="__('Core Workflow AJAX Mode')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="saveSetting('core_workflow_ajax_mode', !coreWorkflowAjaxMode); coreWorkflowAjaxMode = !coreWorkflowAjaxMode"
              />
            </div>

            <!-- Datepicker Show Calendar Weeks -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Show Calendar Weeks in Datepicker') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Display ISO week numbers along the left margin of date and time selection calendars.') }}
                </p>
              </div>
              <input
                id="setting-datepicker-calendar-weeks"
                type="checkbox"
                :checked="datepickerShowCalendarWeeks"
                :aria-label="__('Show Calendar Weeks in Datepicker')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="saveSetting('datepicker_show_calendar_weeks', !datepickerShowCalendarWeeks); datepickerShowCalendarWeeks = !datepickerShowCalendarWeeks"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
