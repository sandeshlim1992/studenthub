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
  options?: Record<string, unknown>
}

interface IntegrationItem {
  key: string
  name: string
  title: string
  icon: string
  category: 'telephony' | 'development' | 'monitoring' | 'security' | 'directory' | 'enrichment'
  description: string
  switchSetting: string
  configSetting?: string
  tokenSetting?: string
  // Student Hub: set up on its own page instead of the dialog
  configRoute?: string
}

interface ConfigModalState {
  isOpen: boolean
  item: IntegrationItem | null
  sender: string
  autoClose: boolean
  endpointUrl: string
  token: string
  apiKey: string
  url: string
  verifySsl: boolean
  isVerifying: boolean
  verifyStatus: { success: boolean; message: string } | null
  autoCreateOrg: boolean
  sharedOrg: boolean
  signSystemNotifications: boolean
  customConfigJson: string
  isSaving: boolean
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Integrations') },
]

const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isToggling = ref<Record<string, boolean>>({})
const searchQuery = ref('')
const activeCategoryFilter = ref<string>('all')

const allSettings = ref<Record<string, SettingRecord>>({})

const integrationsList: IntegrationItem[] = [
  {
    key: 'cti',
    name: 'CTI',
    title: __('Generic CTI'),
    icon: 'telephone',
    category: 'telephony',
    description: __(
      'Integrate phone systems via standard Computer Telephony Integration API to pop up caller profiles and dial out.',
    ),
    switchSetting: 'cti_integration',
    tokenSetting: 'cti_token',
    configSetting: 'cti_config',
  },
  {
    key: 'sipgate',
    name: 'sipgate.io',
    title: __('sipgate.io'),
    icon: 'telephone',
    category: 'telephony',
    description: __(
      'Cloud VoIP telephony integration for real-time call notifications and automatic customer matching.',
    ),
    switchSetting: 'sipgate_integration',
    tokenSetting: 'sipgate_token',
    configSetting: 'sipgate_config',
  },
  {
    key: 'placetel',
    name: 'Placetel',
    title: __('Placetel'),
    icon: 'telephone',
    category: 'telephony',
    description: __(
      'Connect Placetel cloud PBX for inbound call popups and automated call journal records.',
    ),
    switchSetting: 'placetel_integration',
    tokenSetting: 'placetel_token',
    configSetting: 'placetel_config',
  },
  {
    key: 'github',
    name: 'GitHub',
    title: __('GitHub'),
    icon: 'github',
    category: 'development',
    description: __(
      'Link GitHub issues, pull requests, and commit references directly into ticket timelines.',
    ),
    switchSetting: 'github_integration',
    configSetting: 'github_config',
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    title: __('GitLab'),
    icon: 'code',
    category: 'development',
    description: __(
      'Link GitLab issues and repository merge requests directly to customer support tickets.',
    ),
    switchSetting: 'gitlab_integration',
    configSetting: 'gitlab_config',
  },
  {
    key: 'idoit',
    name: 'i-doit',
    title: __('i-doit'),
    icon: 'wrench',
    category: 'directory',
    description: __(
      'ITIL CMDB integration to link configuration items, assets, and infrastructure objects to tickets.',
    ),
    switchSetting: 'idoit_integration',
    configSetting: 'idoit_config',
  },
  {
    key: 'ldap',
    name: __('LDAP / Active Directory'),
    title: __('LDAP / Active Directory'),
    icon: 'people',
    category: 'directory',
    description: __(
      'Automated periodic synchronization of users, departments, and role assignments from Active Directory / OpenLDAP.',
    ),
    switchSetting: 'ldap_integration',
    configRoute: '/manage/system/integrations/ldap',
  },
  {
    key: 'exchange',
    name: 'Exchange',
    title: __('Microsoft Exchange'),
    icon: 'microsoft',
    category: 'directory',
    description: __(
      'Synchronize contacts and address book entries from Microsoft Exchange / Office 365.',
    ),
    switchSetting: 'exchange_integration',
    configSetting: 'exchange_config',
  },
  {
    key: 'check_mk',
    name: 'Checkmk',
    title: __('Checkmk'),
    icon: 'speedometer2',
    category: 'monitoring',
    description: __(
      'Receive monitoring alert webhooks from Checkmk and auto-resolve tickets on recovery.',
    ),
    switchSetting: 'check_mk_integration',
    configSetting: 'check_mk_auto_close',
  },
  {
    key: 'icinga',
    name: 'Icinga',
    title: __('Icinga'),
    icon: 'speedometer2',
    category: 'monitoring',
    description: __(
      'Automated ticket creation and status synchronization for Icinga server alerts.',
    ),
    switchSetting: 'icinga_integration',
    configSetting: 'icinga_auto_close',
  },
  {
    key: 'nagios',
    name: 'Nagios',
    title: __('Nagios'),
    icon: 'speedometer2',
    category: 'monitoring',
    description: __('Convert Nagios host/service alerts to tickets with automatic state tracking.'),
    switchSetting: 'nagios_integration',
    configSetting: 'nagios_auto_close',
  },
  {
    key: 'monit',
    name: 'Monit',
    title: __('Monit'),
    icon: 'speedometer2',
    category: 'monitoring',
    description: __(
      'Receive lightweight process and daemon alert notifications from Monit instances.',
    ),
    switchSetting: 'monit_integration',
    configSetting: 'monit_auto_close',
  },
  {
    key: 'pgp',
    name: 'PGP',
    title: __('PGP Encryption'),
    icon: 'shield-lock',
    category: 'security',
    description: __(
      'Pretty Good Privacy public/private key management for end-to-end email encryption and signing.',
    ),
    switchSetting: 'pgp_integration',
    configSetting: 'pgp_config',
  },
  {
    key: 'smime',
    name: 'S/MIME',
    title: __('S/MIME Certificates'),
    icon: 'shield-lock',
    category: 'security',
    description: __(
      'X.509 certificate handling for enterprise S/MIME email signing and decryption.',
    ),
    switchSetting: 'smime_integration',
    configSetting: 'smime_config',
  },
  {
    key: 'clearbit',
    name: 'Clearbit',
    title: __('Clearbit'),
    icon: 'globe',
    category: 'enrichment',
    description: __(
      'Automatically enrich user and organization profiles with logos and public corporate metadata.',
    ),
    switchSetting: 'clearbit_integration',
    configSetting: 'clearbit_config',
  },
]

const configModal = ref<ConfigModalState>({
  isOpen: false,
  item: null,
  sender: '',
  autoClose: true,
  endpointUrl: '',
  token: '',
  apiKey: '',
  customConfigJson: '',
  isSaving: false,
})

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => {
    successMessage.value = ''
  }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  setTimeout(() => {
    errorMessage.value = ''
  }, 6000)
}

const fetchSettings = async () => {
  isLoading.value = true
  try {
    const res = await fetch('/api/v1/settings', {
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const data: SettingRecord[] = await res.json()
      const dict: Record<string, SettingRecord> = {}
      for (const s of data) {
        dict[s.name] = s
      }
      allSettings.value = dict
    }
  } catch {
    showError(__('Failed to load integrations.'))
  } finally {
    isLoading.value = false
  }
}

const isIntegrationEnabled = (item: IntegrationItem) => {
  return !!allSettings.value[item.switchSetting]?.state_current?.value
}

const toggleIntegration = async (item: IntegrationItem) => {
  const current = isIntegrationEnabled(item)
  const setting = allSettings.value[item.switchSetting]
  if (!setting) return

  isToggling.value[item.key] = true
  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        state_current: { value: !current },
      }),
    })

    if (res.ok) {
      const updated: SettingRecord = await res.json()
      allSettings.value[item.switchSetting] = updated
      showSuccess(
        !current
          ? __('Enabled %s integration.', item.title)
          : __('Disabled %s integration.', item.title),
      )
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update integration state.'))
    }
  } catch {
    showError(__('An error occurred while toggling integration.'))
  } finally {
    isToggling.value[item.key] = false
  }
}

const openConfigModal = (item: IntegrationItem) => {
  const tokenVal = item.tokenSetting
    ? String(allSettings.value[item.tokenSetting]?.state_current?.value || '')
    : ''
  const cfgVal = (item.configSetting
    ? allSettings.value[item.configSetting]?.state_current?.value
    : {}) as Record<string, unknown> || {}

  let urlVal = ''
  let verifySslVal = true
  let apiKeyVal = ''
  let autoCreateOrg = true
  let sharedOrg = false
  let signSystemNotifications = false

  if (item.key === 'github') {
    urlVal = String(cfgVal.endpoint || 'https://api.github.com/graphql')
    apiKeyVal = String(cfgVal.api_token || '')
  } else if (item.key === 'gitlab') {
    urlVal = String(cfgVal.endpoint || 'https://gitlab.com/api/v4')
    apiKeyVal = String(cfgVal.api_token || '')
    verifySslVal = cfgVal.verify_ssl !== false
  } else if (item.key === 'idoit') {
    urlVal = String(cfgVal.endpoint || '')
    apiKeyVal = String(cfgVal.api_token || '')
    verifySslVal = cfgVal.verify_ssl !== false
  } else if (item.key === 'clearbit') {
    apiKeyVal = String(cfgVal.api_key || '')
    autoCreateOrg = cfgVal.organization_autocreate !== false
    sharedOrg = !!cfgVal.organization_shared
  } else if (item.key === 'smime' || item.key === 'pgp') {
    signSystemNotifications = !!cfgVal.sign_system_notifications
  }

  configModal.value = {
    isOpen: true,
    item,
    sender: String(allSettings.value[`${item.key}_sender`]?.state_current?.value || ''),
    autoClose: !!allSettings.value[`${item.key}_auto_close`]?.state_current?.value,
    endpointUrl: `${window.location.origin}/api/v1/integrations/${item.key}`,
    token: tokenVal,
    apiKey: apiKeyVal,
    url: urlVal,
    verifySsl: verifySslVal,
    isVerifying: false,
    verifyStatus: null,
    autoCreateOrg,
    sharedOrg,
    signSystemNotifications,
    customConfigJson: cfgVal ? JSON.stringify(cfgVal, null, 2) : '',
    isSaving: false,
  }
}

const verifyIntegrationConnection = async () => {
  const { item } = configModal.value
  if (!item) return
  configModal.value.isVerifying = true
  configModal.value.verifyStatus = null
  try {
    let url = ''
    let payload: Record<string, unknown> = {}
    if (item.key === 'github') {
      url = '/api/v1/integration/github/verify'
      payload = {
        api_token: configModal.value.apiKey || configModal.value.token,
        endpoint: configModal.value.url || 'https://api.github.com/graphql',
      }
    } else if (item.key === 'gitlab') {
      url = '/api/v1/integration/gitlab/verify'
      payload = {
        api_token: configModal.value.apiKey || configModal.value.token,
        endpoint: configModal.value.url || 'https://gitlab.com/api/v4',
        verify_ssl: configModal.value.verifySsl,
      }
    } else if (item.key === 'idoit') {
      url = '/api/v1/integration/idoit/verify'
      payload = {
        method: 'cmdb.object_types',
        api_token: configModal.value.apiKey || configModal.value.token,
        endpoint: configModal.value.url,
        verify_ssl: configModal.value.verifySsl,
      }
    }

    if (!url) return

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.result === 'ok' || (res.ok && data.result !== 'failed')) {
      configModal.value.verifyStatus = {
        success: true,
        message: __('Connection verified successfully!'),
      }
    } else {
      configModal.value.verifyStatus = {
        success: false,
        message: data.message || data.error || __('Verification failed. Please check credentials.'),
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    configModal.value.verifyStatus = {
      success: false,
      message: errorMsg || __('Error testing connection.'),
    }
  } finally {
    configModal.value.isVerifying = false
  }
}

const saveConfigModal = async () => {
  const { item } = configModal.value
  if (!item) return

  configModal.value.isSaving = true
  try {
    const promises: Promise<Response>[] = []

    if (item.tokenSetting && allSettings.value[item.tokenSetting]) {
      promises.push(
        fetch(`/api/v1/settings/${allSettings.value[item.tokenSetting].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
          body: JSON.stringify({ state_current: { value: configModal.value.token } }),
        }),
      )
    }

    if (item.configSetting && allSettings.value[item.configSetting]) {
      let cfgPayload: Record<string, unknown> = (allSettings.value[item.configSetting].state_current?.value as Record<string, unknown>) || {}
      if (item.key === 'github') {
        cfgPayload = {
          ...cfgPayload,
          endpoint: configModal.value.url,
          api_token: configModal.value.apiKey,
        }
      } else if (item.key === 'gitlab') {
        cfgPayload = {
          ...cfgPayload,
          endpoint: configModal.value.url,
          api_token: configModal.value.apiKey,
          verify_ssl: configModal.value.verifySsl,
        }
      } else if (item.key === 'idoit') {
        cfgPayload = {
          ...cfgPayload,
          endpoint: configModal.value.url,
          api_token: configModal.value.apiKey,
          verify_ssl: configModal.value.verifySsl,
        }
      } else if (item.key === 'clearbit') {
        cfgPayload = {
          ...cfgPayload,
          api_key: configModal.value.apiKey,
          organization_autocreate: configModal.value.autoCreateOrg,
          organization_shared: configModal.value.sharedOrg,
        }
      } else if (item.key === 'smime' || item.key === 'pgp') {
        cfgPayload = {
          ...cfgPayload,
          sign_system_notifications: configModal.value.signSystemNotifications,
        }
      }

      promises.push(
        fetch(`/api/v1/settings/${allSettings.value[item.configSetting].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
          body: JSON.stringify({ state_current: { value: cfgPayload } }),
        }),
      )
    }

    if (allSettings.value[`${item.key}_sender`]) {
      promises.push(
        fetch(`/api/v1/settings/${allSettings.value[`${item.key}_sender`].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
          body: JSON.stringify({ state_current: { value: configModal.value.sender } }),
        }),
      )
    }

    if (allSettings.value[`${item.key}_auto_close`]) {
      promises.push(
        fetch(`/api/v1/settings/${allSettings.value[`${item.key}_auto_close`].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
          body: JSON.stringify({ state_current: { value: configModal.value.autoClose } }),
        }),
      )
    }

    await Promise.all(promises)
    showSuccess(__('Configuration saved successfully.'))
    configModal.value.isOpen = false
    await fetchSettings()
  } catch {
    showError(__('Failed to save configuration.'))
  } finally {
    configModal.value.isSaving = false
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Copied to clipboard.'))
  } catch {
    showError(__('Failed to copy to clipboard.'))
  }
}

const filteredIntegrations = computed(() => {
  let list = integrationsList

  if (activeCategoryFilter.value !== 'all') {
    list = list.filter((item) => item.category === activeCategoryFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(
      (item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    )
  }

  return list
})

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="mb-2 flex items-center gap-3">
          <button
            type="button"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            :title="__('Back')"
            @click="router.back()"
          >
            <CommonIcon name="arrow-left" class="h-4 w-4" />
          </button>
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-400"
            >
              <CommonIcon name="code" class="h-4 w-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {{ __('Integrations') }}
            </h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{
            __(
              'Connect your helpdesk with external monitoring, telephony, directory services, and developer tools.',
            )
          }}
        </p>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>{{ successMessage }}</span>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Search & Category Filters -->
      <div
        class="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center"
      >
        <!-- Search bar -->
        <div class="relative w-full max-w-sm">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search integrations...')"
            :aria-label="__('Search integrations...')"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden ltr:pr-4 ltr:pl-9 rtl:pr-9 rtl:pl-4 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
          />
          <div class="absolute top-1/2 -translate-y-1/2 text-slate-400 ltr:left-3 rtl:right-3">
            <CommonIcon name="search" class="h-3.5 w-3.5" />
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'all'"
          >
            {{ __('All') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'telephony'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'telephony'"
          >
            {{ __('Telephony') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'monitoring'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'monitoring'"
          >
            {{ __('Monitoring') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'development'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'development'"
          >
            {{ __('Developer') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'security'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'security'"
          >
            {{ __('Security') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            :class="
              activeCategoryFilter === 'directory'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="activeCategoryFilter = 'directory'"
          >
            {{ __('Directory') }}
          </button>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="i in 6"
          :key="i"
          class="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#1e293b]"
        />
      </div>

      <!-- Integrations Grid -->
      <div
        v-else-if="filteredIntegrations.length > 0"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="item in filteredIntegrations"
          :key="item.key"
          class="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 dark:border-[#1e293b] dark:bg-[#0f172a]/40 dark:hover:border-slate-700"
        >
          <!-- Card Header -->
          <div>
            <div class="mb-3 flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#1e293b] dark:text-slate-200"
                >
                  <CommonIcon :name="item.icon" class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ item.name }}
                  </h3>
                  <span
                    class="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    :class="
                      isIntegrationEnabled(item)
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    "
                  >
                    {{ isIntegrationEnabled(item) ? __('Active') : __('Inactive') }}
                  </span>
                </div>
              </div>

              <!-- Switch -->
              <input
                :id="'switch-' + item.key"
                type="checkbox"
                :checked="isIntegrationEnabled(item)"
                :disabled="isToggling[item.key]"
                :aria-label="item.name"
                class="mt-1 h-4 w-4 cursor-pointer accent-blue-600"
                @change="toggleIntegration(item)"
              />
            </div>

            <p class="line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
              {{ item.description }}
            </p>
          </div>

          <!-- Card Footer -->
          <div
            class="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"
          >
            <span class="text-[11px] font-medium text-slate-400 capitalize">
              {{ item.category }}
            </span>
            <button
              type="button"
              class="cursor-pointer rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              @click="item.configRoute ? $router.push(item.configRoute) : openConfigModal(item)"
            >
              {{ __('Configure') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-[#1e293b] dark:bg-[#0f172a]/40"
      >
        <CommonIcon name="search" class="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
        <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {{ __('No integrations found') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ __('Try adjusting your search keyword or category filter.') }}
        </p>
      </div>
    </div>

    <!-- Modal: Configure Integration -->
    <div
      v-if="configModal.isOpen && configModal.item"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1e293b] dark:bg-[#0f172a]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <CommonIcon
              :name="configModal.item.icon"
              class="h-5 w-5 text-blue-600 dark:text-blue-400"
            />
            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
              {{ __('Configure %s', configModal.item.name) }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="configModal.isOpen = false"
          >
            <CommonIcon name="x-lg" class="h-4 w-4" />
          </button>
        </div>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-xs">
          <!-- Webhook Endpoint URL if applicable -->
          <div
            v-if="['cti', 'sipgate', 'check_mk', 'icinga', 'nagios', 'monit'].includes(configModal.item.key)"
            class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#1e293b]/70"
          >
            <p class="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {{ __('Webhook / Endpoint URL') }}
            </p>
            <div class="flex items-center justify-between gap-2">
              <code class="font-mono text-[11px] break-all text-slate-700 dark:text-slate-300">{{
                configModal.endpointUrl
              }}</code>
              <button
                type="button"
                class="shrink-0 cursor-pointer p-1.5 text-slate-400 hover:text-blue-600"
                :title="__('Copy URL')"
                @click="copyToClipboard(configModal.endpointUrl)"
              >
                <CommonIcon name="copy" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- GitHub & GitLab & i-doit Configuration -->
          <div
            v-if="['github', 'gitlab', 'idoit'].includes(configModal.item.key)"
            class="space-y-3"
          >
            <div class="space-y-1.5">
              <label
                for="integration-endpoint-url"
                class="block font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Endpoint URL') }}
              </label>
              <input
                id="integration-endpoint-url"
                v-model="configModal.url"
                type="text"
                placeholder="https://..."
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>

            <div class="space-y-1.5">
              <label
                for="integration-api-key"
                class="block font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('API Token') }}
              </label>
              <input
                id="integration-api-key"
                v-model="configModal.apiKey"
                type="password"
                placeholder="••••••••••••••••"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>

            <div
              v-if="configModal.item.key !== 'github'"
              class="flex items-center justify-between pt-1"
            >
              <div>
                <p class="font-semibold text-slate-700 dark:text-slate-300">
                  {{ __('Verify SSL Certificate') }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ __('Disable only for self-signed development certificates.') }}
                </p>
              </div>
              <input
                id="integration-verify-ssl"
                v-model="configModal.verifySsl"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>

            <!-- Test Connection Button & Status -->
            <div class="border-t border-slate-100 pt-2 dark:border-slate-800">
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  :disabled="configModal.isVerifying"
                  @click="verifyIntegrationConnection"
                >
                  <CommonIcon
                    v-if="configModal.isVerifying"
                    name="arrow-clockwise"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                  <CommonIcon v-else name="plug" class="h-3.5 w-3.5" />
                  <span>{{ configModal.isVerifying ? __('Testing...') : __('Test Connection') }}</span>
                </button>
              </div>

              <div
                v-if="configModal.verifyStatus"
                class="mt-2 rounded-xl p-2.5 text-[11px] font-medium"
                :class="
                  configModal.verifyStatus.success
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                "
              >
                {{ configModal.verifyStatus.message }}
              </div>
            </div>
          </div>

          <!-- Clearbit Configuration -->
          <div
            v-if="configModal.item.key === 'clearbit'"
            class="space-y-3"
          >
            <div class="space-y-1.5">
              <label
                for="clearbit-api-key"
                class="block font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Clearbit API Key') }}
              </label>
              <input
                id="clearbit-api-key"
                v-model="configModal.apiKey"
                type="password"
                placeholder="sk_..."
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>

            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="font-semibold text-slate-700 dark:text-slate-300">
                  {{ __('Auto Create Organizations') }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ __('Create organizations automatically if customer record has one.') }}
                </p>
              </div>
              <input
                id="clearbit-autocreate-org"
                v-model="configModal.autoCreateOrg"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>

            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="font-semibold text-slate-700 dark:text-slate-300">
                  {{ __('Shared Organizations') }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ __('New organizations created from Clearbit are marked as shared.') }}
                </p>
              </div>
              <input
                id="clearbit-shared-org"
                v-model="configModal.sharedOrg"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <!-- PGP / S/MIME Security Configuration -->
          <div
            v-if="['pgp', 'smime'].includes(configModal.item.key)"
            class="space-y-3"
          >
            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="font-semibold text-slate-700 dark:text-slate-300">
                  {{ __('Sign System Notifications') }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ __('Automatically sign outgoing automated system notification emails.') }}
                </p>
              </div>
              <input
                id="security-sign-notifications"
                v-model="configModal.signSystemNotifications"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <!-- Token if applicable -->
          <div v-if="configModal.item.tokenSetting" class="space-y-1.5">
            <label
              for="integration-token"
              class="block font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('API / Secret Token') }}
            </label>
            <div class="flex items-center gap-2">
              <input
                id="integration-token"
                v-model="configModal.token"
                type="text"
                class="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
              <button
                type="button"
                class="rounded-xl border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                @click="copyToClipboard(configModal.token)"
              >
                {{ __('Copy') }}
              </button>
            </div>
          </div>

          <!-- Monitoring specific: Sender & Auto close -->
          <div
            v-if="configModal.item.category === 'monitoring'"
            class="space-y-3 border-t border-slate-100 pt-2 dark:border-slate-800"
          >
            <div class="space-y-1.5">
              <label
                for="integration-sender"
                class="block font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Sender Filter') }}
              </label>
              <input
                id="integration-sender"
                v-model="configModal.sender"
                type="text"
                placeholder="monitoring@example.com"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>

            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="font-semibold text-slate-700 dark:text-slate-300">
                  {{ __('Auto Close on Recovery') }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{
                    __('Automatically close corresponding alert tickets when OK status received.')
                  }}
                </p>
              </div>
              <input
                id="integration-auto-close"
                v-model="configModal.autoClose"
                type="checkbox"
                :aria-label="__('Auto Close on Recovery')"
                class="h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div
          class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <button
            type="button"
            class="cursor-pointer rounded-xl px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="configModal.isOpen = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-60"
            :disabled="configModal.isSaving"
            @click="saveConfigModal"
          >
            <CommonIcon
              v-if="configModal.isSaving"
              name="arrow-clockwise"
              class="h-3.5 w-3.5 animate-spin"
            />
            <span>{{ configModal.isSaving ? __('Saving...') : __('Save Changes') }}</span>
          </button>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
