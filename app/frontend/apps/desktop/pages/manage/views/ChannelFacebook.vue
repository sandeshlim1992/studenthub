<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

// Interfaces
interface ExternalCredentialRecord {
  id?: number
  name: string
  credentials?: {
    client_id?: string
    client_secret?: string
    [key: string]: unknown
  }
}

interface FacebookPage {
  id: string
  name: string
  access_token?: string
  groupName?: string
}

interface FacebookSyncPageConfig {
  group_id?: number | string
  feed?: boolean
  message?: boolean
}

interface FacebookChannel {
  id: number
  area: string
  active: boolean
  options?: {
    user?: {
      id?: string
      name?: string
    }
    pages?: FacebookPage[]
    sync?: {
      pages?: Record<string, FacebookSyncPageConfig>
      [key: string]: unknown
    }
    [key: string]: unknown
  }
}

interface GroupRecord {
  id: number
  name: string
  active: boolean
}

const router = useRouter()

// State
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const channels = ref<FacebookChannel[]>([])
const externalCredential = ref<ExternalCredentialRecord | null>(null)
const callbackUrl = ref('')
const groups = ref<GroupRecord[]>([])

// Modals
const isAppConfigModalOpen = ref(false)
const appConfigClientId = ref('')
const appConfigClientSecret = ref('')
const isClientSecretVisible = ref(false)
const appConfigError = ref('')

const isEditAccountModalOpen = ref(false)
const editingChannel = ref<FacebookChannel | null>(null)
const pageConfigs = ref<Record<string, FacebookSyncPageConfig>>({})

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Facebook') },
]

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
  successMessage.value = ''
}

const isAppConfigured = computed(() => {
  return Boolean(externalCredential.value?.credentials?.client_id)
})

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Copied to clipboard.'))
  } catch (err) {
    showError(__('Failed to copy to clipboard.'))
    console.error(err)
  }
}

// Load Data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [fbRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels_facebook', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }

    if (fbRes.ok) {
      const data = await fbRes.json()
      const assets = data.assets || {}
      callbackUrl.value = data.callback_url || `${window.location.origin}/api/v1/external_credentials/facebook/callback`

      const credMap = assets.ExternalCredential || {}
      const fbCred = Object.values(credMap).find((c: unknown) => {
        const item = c as ExternalCredentialRecord
        return item.name === 'facebook'
      }) as ExternalCredentialRecord | undefined

      externalCredential.value = fbCred || null
      if (fbCred?.credentials?.client_id) {
        appConfigClientId.value = fbCred.credentials.client_id
      }
      if (fbCred?.credentials?.client_secret) {
        appConfigClientSecret.value = fbCred.credentials.client_secret
      }

      const channelMap = assets.Channel || {}
      const channelIds: number[] = data.channel_ids || []
      channels.value = channelIds.map((id) => channelMap[id] as FacebookChannel).filter(Boolean)
    }
  } catch (e) {
    showError(__('Failed to load Facebook channel data.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// App Config Modal Actions
const openAppConfigModal = () => {
  appConfigError.value = ''
  if (externalCredential.value?.credentials) {
    appConfigClientId.value = externalCredential.value.credentials.client_id || ''
    appConfigClientSecret.value = externalCredential.value.credentials.client_secret || ''
  }
  isAppConfigModalOpen.value = true
}

const saveAppConfig = async () => {
  if (!appConfigClientId.value || !appConfigClientSecret.value) {
    appConfigError.value = __('Please provide both App ID and App Secret.')
    return
  }

  isSaving.value = true
  appConfigError.value = ''

  try {
    const verifyRes = await fetch('/api/v1/external_credentials/facebook/app_verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        client_id: appConfigClientId.value.trim(),
        client_secret: appConfigClientSecret.value.trim(),
      }),
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || !verifyData.attributes) {
      appConfigError.value = verifyData.error_human || verifyData.error || __('Facebook App could not be verified. Please check App ID and Secret.')
      return
    }

    const isEdit = Boolean(externalCredential.value?.id)
    const credUrl = isEdit ? `/api/v1/external_credentials/${externalCredential.value?.id}` : '/api/v1/external_credentials'
    const credMethod = isEdit ? 'PUT' : 'POST'

    const saveRes = await fetch(credUrl, {
      method: credMethod,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        name: 'facebook',
        credentials: verifyData.attributes,
      }),
    })

    if (!saveRes.ok) {
      const errData = await saveRes.json()
      appConfigError.value = errData.error_human || errData.error || __('Failed to save Facebook App credentials.')
      return
    }

    isAppConfigModalOpen.value = false
    showSuccess(__('Facebook App credentials saved successfully.'))
    await loadData()
  } catch (e) {
    appConfigError.value = __('An unexpected error occurred.')
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Account Actions
const linkAccount = () => {
  window.location.href = '/api/v1/external_credentials/facebook/link_account'
}

const toggleChannelActive = async (channel: FacebookChannel) => {
  isSaving.value = true
  try {
    const url = channel.active ? '/api/v1/channels_facebook_disable' : '/api/v1/channels_facebook_enable'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ id: channel.id }),
    })
    if (res.ok) {
      showSuccess(channel.active ? __('Facebook channel disabled.') : __('Facebook channel enabled.'))
      await loadData()
    } else {
      showError(__('Failed to toggle channel status.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteChannel = async (channel: FacebookChannel) => {
  if (!confirm(__('Are you sure you want to delete this Facebook account and its page sync configurations?'))) {
    return
  }
  isSaving.value = true
  try {
    const res = await fetch('/api/v1/channels_facebook', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ id: channel.id }),
    })
    if (res.ok) {
      showSuccess(__('Facebook channel deleted.'))
      await loadData()
    } else {
      showError(__('Failed to delete channel.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Edit Pages Modal
const openEditAccountModal = (channel: FacebookChannel) => {
  editingChannel.value = channel
  const existingSyncPages = channel.options?.sync?.pages || {}
  const configs: Record<string, FacebookSyncPageConfig> = {}

  channel.options?.pages?.forEach((page) => {
    const existing = existingSyncPages[page.id]
    configs[page.id] = {
      group_id: existing?.group_id || groups.value[0]?.id || 1,
      feed: existing?.feed !== false,
      message: existing?.message !== false,
    }
  })
  pageConfigs.value = configs
  isEditAccountModalOpen.value = true
}

const saveAccountPages = async () => {
  if (!editingChannel.value) return
  isSaving.value = true
  try {
    const updatedChannel = {
      ...editingChannel.value,
      options: {
        ...editingChannel.value.options,
        sync: {
          ...editingChannel.value.options?.sync,
          pages: pageConfigs.value,
        },
      },
    }

    const res = await fetch(`/api/v1/channels_facebook/${editingChannel.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(updatedChannel),
    })

    if (res.ok) {
      isEditAccountModalOpen.value = false
      showSuccess(__('Facebook page routing settings saved.'))
      await loadData()
    } else {
      showError(__('Failed to save Facebook page routing settings.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const getGroupName = (groupId?: number | string) => {
  if (!groupId) return '-'
  const g = groups.value.find((item) => String(item.id) === String(groupId))
  return g ? g.name : '-'
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-5xl mx-auto">
      
      <!-- Top Navigation & Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <button
              type="button"
              class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              :title="__('Back to Administration')"
              :aria-label="__('Back to Administration')"
              @click="router.push('/manage')"
            >
              <CommonIcon name="arrow-left" class="w-4 h-4" />
            </button>
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CommonIcon name="facebook" class="w-4 h-4" />
              </div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {{ __('Facebook Channel') }}
              </h1>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Connect your Facebook Pages to automatically receive wall posts, comments, and direct messages as tickets.') }}
          </p>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center gap-2">
          <button
            v-if="isAppConfigured"
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="openAppConfigModal"
          >
            {{ __('Configure App') }}
          </button>
          <button
            v-if="isAppConfigured"
            type="button"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            @click="linkAccount"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            {{ __('Add Account') }}
          </button>
        </div>
      </div>

      <!-- Feedback Alerts -->
      <div v-if="successMessage" class="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="check-circle" class="w-4 h-4 shrink-0 text-emerald-500" />
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="alert-triangle" class="w-4 h-4 shrink-0 text-rose-500" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Loading Facebook Channel...') }}</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Zero-state Onboarding when App is NOT configured -->
        <div v-if="!isAppConfigured" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xs text-center max-w-3xl mx-auto">
          <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-900/60 shadow-xs">
            <CommonIcon name="facebook" class="w-8 h-8" />
          </div>
          
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {{ __('Connect Facebook with Student Hub') }}
          </h2>
          <p class="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
            {{ __('Connect your Facebook Pages to turn customer posts and direct messages into tickets. First, connect your Student Hub instance with a Meta for Developers App.') }}
          </p>

          <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2 mb-8"
            @click="openAppConfigModal"
          >
            <CommonIcon name="settings" class="w-4 h-4" />
            {{ __('Connect Facebook App') }}
          </button>

          <!-- Guide Box -->
          <div class="text-left bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 space-y-4">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
              <CommonIcon name="info" class="w-4 h-4 text-blue-500" />
              {{ __('Meta for Developers Setup Guide') }}
            </div>
            <ol class="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
              <li>
                {{ __('In Meta for Developers (developers.facebook.com), create an App with type "Business".') }}
              </li>
              <li>
                <div class="inline">{{ __('Add the Facebook Login product and configure this Valid OAuth Redirect URI:') }}</div>
                <div class="mt-1.5 flex items-center gap-2">
                  <input
                    id="fb_guide_callback_url"
                    type="text"
                    readonly
                    :value="callbackUrl"
                    :aria-label="__('Valid OAuth Redirect URI')"
                    class="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    @click="copyToClipboard(callbackUrl)"
                  >
                    {{ __('Copy') }}
                  </button>
                </div>
              </li>
              <li>
                {{ __('Request permissions for pages_show_list, pages_messaging, and pages_read_engagement.') }}
              </li>
              <li>
                {{ __('Copy your App ID and App Secret from App settings > Basic.') }}
              </li>
              <li>
                {{ __('Click "Connect Facebook App" above to enter and verify your credentials.') }}
              </li>
            </ol>
          </div>
        </div>

        <!-- App is configured: Show connected accounts & pages -->
        <div v-else class="space-y-6">

          <!-- Empty State -->
          <div
            v-if="channels.length === 0"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs"
          >
            <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <CommonIcon name="facebook" class="w-6 h-6" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              {{ __('No Facebook Accounts Connected') }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
              {{ __('Click "Add Account" to link your Facebook profile and authorize your business pages.') }}
            </p>
            <button
              type="button"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              @click="linkAccount"
            >
              <CommonIcon name="plus" class="w-4 h-4" />
              {{ __('Add Account') }}
            </button>
          </div>

          <!-- Channels List -->
          <div
            v-for="channel in channels"
            :key="channel.id"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-all"
            :class="{ 'opacity-80 bg-slate-50/50 dark:bg-slate-900/50': !channel.active }"
          >
            <!-- Account Header -->
            <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <CommonIcon name="facebook" class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ channel.options?.user?.name || __('Facebook Account') }}
                  </h3>
                  <span class="text-xs text-slate-400">
                    User ID: {{ channel.options?.user?.id || channel.id }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="channel.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'"
                >
                  {{ channel.active ? __('Active') : __('Inactive') }}
                </span>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-semibold rounded-xl text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                  @click="openEditAccountModal(channel)"
                >
                  {{ __('Configure Pages') }}
                </button>
              </div>
            </div>

            <!-- Pages List -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {{ __('Connected Pages') }} ({{ channel.options?.pages?.length || 0 }})
              </h4>

              <div v-if="!channel.options?.pages || channel.options.pages.length === 0" class="text-xs text-slate-400 italic">
                {{ __('No pages authorized for this account.') }}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="page in channel.options?.pages"
                  :key="page.id"
                  class="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between"
                >
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                      {{ page.name }}
                    </div>
                    <div class="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{{ __('Group:') }} {{ getGroupName(channel.options?.sync?.pages?.[page.id]?.group_id) }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 text-[10px]">
                    <span
                      v-if="channel.options?.sync?.pages?.[page.id]?.feed !== false"
                      class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                    >
                      {{ __('Feed') }}
                    </span>
                    <span
                      v-if="channel.options?.sync?.pages?.[page.id]?.message !== false"
                      class="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold"
                    >
                      {{ __('Messages') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Controls -->
            <div class="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer"
                :class="channel.active ? 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'"
                @click="toggleChannelActive(channel)"
              >
                {{ channel.active ? __('Disable') : __('Enable') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                @click="deleteChannel(channel)"
              >
                {{ __('Delete') }}
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- ================= MODAL: CONNECT FACEBOOK APP ================= -->
      <div
        v-if="isAppConfigModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CommonIcon name="facebook" class="w-5 h-5 text-blue-600" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Connect Facebook App') }}</h3>
            </div>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isAppConfigModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div
              v-if="appConfigError"
              class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
            >
              {{ appConfigError }}
            </div>

            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {{ __('Provide your Meta for Developers App ID and App Secret.') }}
            </p>

            <div>
              <label for="fb-client-id" class="block text-xs font-semibold mb-1">
                {{ __('App ID') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="fb-client-id"
                v-model="appConfigClientId"
                type="text"
                placeholder="123456789012345"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label for="fb-client-secret" class="block text-xs font-semibold mb-1">
                {{ __('App Secret') }} <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="fb-client-secret"
                  v-model="appConfigClientSecret"
                  :type="isClientSecretVisible ? 'text' : 'password'"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono ltr:pr-10 rtl:pl-10"
                />
                <button
                  type="button"
                  class="absolute ltr:right-2.5 rtl:left-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  :aria-label="__('Toggle visibility')"
                  @click="isClientSecretVisible = !isClientSecretVisible"
                >
                  <CommonIcon :name="isClientSecretVisible ? 'eye-off' : 'eye'" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label for="fb-callback-url" class="block text-xs font-semibold mb-1">{{ __('Valid OAuth Redirect URI') }}</label>
              <div class="flex items-center gap-2">
                <input
                  id="fb-callback-url"
                  type="text"
                  readonly
                  :value="callbackUrl"
                  :aria-label="__('Valid OAuth Redirect URI')"
                  class="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                  @click="copyToClipboard(callbackUrl)"
                >
                  {{ __('Copy') }}
                </button>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isAppConfigModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveAppConfig"
            >
              {{ isSaving ? __('Verifying...') : __('Connect') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: CONFIGURE PAGES ================= -->
      <div
        v-if="isEditAccountModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Configure Facebook Pages') }}</h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isEditAccountModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <p class="text-xs text-slate-600 dark:text-slate-400">
              {{ __('Select which Facebook Pages should be synchronized and assign tickets from each page to a destination group.') }}
            </p>

            <div
              v-for="page in editingChannel?.options?.pages"
              :key="page.id"
              class="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ page.name }}</span>
                <span class="text-[11px] font-mono text-slate-400">{{ page.id }}</span>
              </div>

              <div>
                <label :for="`group-${page.id}`" class="block text-xs font-semibold mb-1">{{ __('Destination Group') }}</label>
                <select
                  :id="`group-${page.id}`"
                  v-model="pageConfigs[page.id].group_id"
                  class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option v-for="g in groups" :key="g.id" :value="g.id">
                    {{ g.name }}
                  </option>
                </select>
              </div>

              <div class="flex items-center gap-6 pt-1">
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    v-model="pageConfigs[page.id].feed"
                    type="checkbox"
                    class="w-4 h-4 rounded text-blue-600"
                  />
                  <span>{{ __('Sync Wall Posts & Comments') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    v-model="pageConfigs[page.id].message"
                    type="checkbox"
                    class="w-4 h-4 rounded text-blue-600"
                  />
                  <span>{{ __('Sync Direct Messages') }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isEditAccountModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveAccountPages"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
