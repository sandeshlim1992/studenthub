<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SmsDriverConfig {
  adapter: string
  name: string
  account?: Array<{
    name: string
    display: string
    tag: string
    type?: string
    null?: boolean
    default?: string
  }>
  notification?: Array<{
    name: string
    display: string
    tag: string
    type?: string
    null?: boolean
    default?: string
  }>
}

interface SmsChannel {
  id: number
  area: string
  active: boolean
  group_id?: number
  options?: {
    adapter?: string
    webhook_token?: string
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
const isTesting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const accountChannels = ref<SmsChannel[]>([])
const notificationChannels = ref<SmsChannel[]>([])
const driversConfig = ref<SmsDriverConfig[]>([])
const groups = ref<GroupRecord[]>([])

// Modals
const isAccountModalOpen = ref(false)
const editingChannelId = ref<number | null>(null)
const selectedAdapter = ref('twilio')
const accountGroupId = ref(1)
const accountOptions = ref<Record<string, string>>({
  adapter: 'twilio',
  webhook_token: '',
})

// Test Modal
const isTestModalOpen = ref(false)
const testRecipient = ref('')
const testMessage = ref(__('Test SMS from Student Hub'))
const testResult = ref<{ success?: unknown; error_human?: string; error?: string } | null>(null)

// Notification Service Modal
const isNotificationModalOpen = ref(false)
const notificationAdapter = ref('twilio')
const notificationOptions = ref<Record<string, string>>({
  adapter: 'twilio',
})

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('SMS') },
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

const generateWebhookToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i += 1) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

const getWebhookUrl = (token?: string) => {
  if (!token) return ''
  return `${window.location.origin}/api/v1/sms_webhook/${token}`
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Copied to clipboard.'))
  } catch (e) {
    console.error(e)
  }
}

const getGroupName = (groupId?: number) => {
  if (!groupId) return '-'
  const g = groups.value.find((item) => item.id === groupId)
  return g ? g.name : `Group #${groupId}`
}

const getDriverName = (adapter?: string) => {
  if (!adapter) return 'SMS'
  const d = driversConfig.value.find((item) => item.adapter === adapter)
  return d ? d.name : adapter.toUpperCase()
}

// Load SMS data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [smsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels_sms', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/groups', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (smsRes.ok) {
      const data = await smsRes.json()
      driversConfig.value = data.config || []
      const assets = data.assets || {}

      const accList: SmsChannel[] = []
      if (Array.isArray(data.account_channel_ids)) {
        for (const id of data.account_channel_ids) {
          const ch = assets.Channel?.[id]
          if (ch) accList.push(ch)
        }
      }
      accountChannels.value = accList

      const notifList: SmsChannel[] = []
      if (Array.isArray(data.notification_channel_ids)) {
        for (const id of data.notification_channel_ids) {
          const ch = assets.Channel?.[id]
          if (ch) notifList.push(ch)
        }
      }
      notificationChannels.value = notifList
    }

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }
  } catch (e) {
    showError(__('Failed to load SMS channel data.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Enable / Disable SMS Channel
const toggleChannel = async (channel: SmsChannel) => {
  const url = channel.active ? '/api/v1/channels_sms_disable' : '/api/v1/channels_sms_enable'
  try {
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
      channel.active = !channel.active
      showSuccess(channel.active ? __('SMS channel enabled.') : __('SMS channel disabled.'))
    } else {
      showError(__('Failed to update SMS channel status.'))
    }
  } catch (e) {
    showError(__('An error occurred updating channel status.'))
    console.error(e)
  }
}

// Delete SMS Channel
const deleteChannel = async (channel: SmsChannel) => {
  if (!confirm(__('Are you sure you want to delete this SMS channel?'))) return
  try {
    const res = await fetch(`/api/v1/channels_sms/${channel.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      accountChannels.value = accountChannels.value.filter((c) => c.id !== channel.id)
      notificationChannels.value = notificationChannels.value.filter((c) => c.id !== channel.id)
      showSuccess(__('SMS channel deleted.'))
    } else {
      showError(__('Failed to delete SMS channel.'))
    }
  } catch (e) {
    showError(__('An error occurred deleting SMS channel.'))
    console.error(e)
  }
}

// Open New Account Modal
const openNewAccountModal = () => {
  editingChannelId.value = null
  selectedAdapter.value = driversConfig.value[0]?.adapter || 'twilio'
  accountGroupId.value = groups.value[0]?.id ?? 1
  accountOptions.value = {
    adapter: selectedAdapter.value,
    webhook_token: generateWebhookToken(),
  }
  isAccountModalOpen.value = true
}

// Open Edit Account Modal
const openEditAccountModal = (channel: SmsChannel) => {
  editingChannelId.value = channel.id
  selectedAdapter.value = channel.options?.adapter || 'twilio'
  accountGroupId.value = channel.group_id || (groups.value[0]?.id ?? 1)
  
  const opts: Record<string, string> = {
    adapter: selectedAdapter.value,
    webhook_token: channel.options?.webhook_token || generateWebhookToken(),
  }
  if (channel.options) {
    for (const [k, v] of Object.entries(channel.options)) {
      if (k !== 'adapter' && k !== 'webhook_token' && typeof v === 'string') {
        opts[k] = v
      }
    }
  }
  accountOptions.value = opts
  isAccountModalOpen.value = true
}

// Save Account Channel
const saveAccountChannel = async () => {
  isSaving.value = true
  try {
    const isEdit = Boolean(editingChannelId.value)
    const url = isEdit ? `/api/v1/channels_sms/${editingChannelId.value}` : '/api/v1/channels_sms'
    const method = isEdit ? 'PUT' : 'POST'

    const payload = {
      area: 'Sms::Account',
      group_id: accountGroupId.value,
      options: {
        ...accountOptions.value,
        adapter: selectedAdapter.value,
      },
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      isAccountModalOpen.value = false
      showSuccess(__('SMS account saved successfully.'))
      await loadData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to save SMS account.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving SMS account.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Test Modal
const openTestModal = (channel: SmsChannel) => {
  testResult.value = null
  testRecipient.value = ''
  testMessage.value = __('Test SMS message from Student Hub.')
  accountOptions.value = {
    ...(channel.options as Record<string, string>),
    adapter: channel.options?.adapter || 'twilio',
  }
  isTestModalOpen.value = true
}

const sendTestSms = async () => {
  if (!testRecipient.value) {
    showError(__('Please enter a recipient phone number in international format (+1...).'))
    return
  }
  isTesting.value = true
  testResult.value = null
  try {
    const res = await fetch('/api/v1/channels_sms/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        options: accountOptions.value,
        recipient: testRecipient.value,
        message: testMessage.value,
      }),
    })
    const data = await res.json()
    testResult.value = data
  } catch (e) {
    testResult.value = { error_human: String(e) }
  } finally {
    isTesting.value = false
  }
}

// Notification Service Modal
const openNotificationModal = () => {
  const notifCh = notificationChannels.value[0]
  notificationAdapter.value = notifCh?.options?.adapter || driversConfig.value[0]?.adapter || 'twilio'
  const opts: Record<string, string> = {
    adapter: notificationAdapter.value,
  }
  if (notifCh?.options) {
    for (const [k, v] of Object.entries(notifCh.options)) {
      if (typeof v === 'string') opts[k] = v
    }
  }
  notificationOptions.value = opts
  isNotificationModalOpen.value = true
}

const saveNotificationService = async () => {
  isSaving.value = true
  try {
    const notifCh = notificationChannels.value[0]
    const isEdit = Boolean(notifCh?.id)
    const url = isEdit ? `/api/v1/channels_sms/${notifCh.id}` : '/api/v1/channels_sms'
    const method = isEdit ? 'PUT' : 'POST'

    const payload = {
      area: 'Sms::Notification',
      options: {
        ...notificationOptions.value,
        adapter: notificationAdapter.value,
      },
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      isNotificationModalOpen.value = false
      showSuccess(__('SMS notification service saved.'))
      await loadData()
    } else {
      showError(__('Failed to save SMS notification service.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
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
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                <CommonIcon name="chat" class="w-5 h-5" />
              </span>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ __('SMS Channel') }}</h1>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {{ __('Channels') }}
            </span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Configure two-way SMS providers (Twilio, MessageBird, massenversand.de) for customer support and automated system notifications.') }}
          </p>
        </div>

        <!-- Add Account Action -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2"
            @click="openNewAccountModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            <span>{{ __('Add SMS Account') }}</span>
          </button>
        </div>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="mb-6 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-2xl flex items-center gap-2.5 shadow-sm">
        <CommonIcon name="check2-circle" class="w-5 h-5 shrink-0 text-green-600 dark:text-green-400" />
        <span class="font-medium">{{ successMessage }}</span>
      </div>
      <div v-if="errorMessage" class="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-2xl flex items-center gap-2.5 shadow-sm">
        <CommonIcon name="exclamation-triangle" class="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
        <span class="font-medium">{{ errorMessage }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-20 text-center text-slate-400">
        <CommonIcon name="arrow-repeat" class="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p class="text-sm font-medium">{{ __('Loading SMS channels...') }}</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Notification Service Card -->
        <div class="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/60 dark:to-slate-900/60 border border-blue-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <span class="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <CommonIcon name="bell" class="w-5 h-5" />
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('SMS Notification Service') }}</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {{ notificationChannels.length > 0 ? getDriverName(notificationChannels[0]?.options?.adapter) : __('Not Configured') }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ __('Used to dispatch automated SMS alert notifications to agents when urgent tickets are updated.') }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-blue-300 dark:border-slate-700 text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            @click="openNotificationModal"
          >
            {{ notificationChannels.length > 0 ? __('Edit Service') : __('Configure Service') }}
          </button>
        </div>

        <!-- SMS Accounts Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Configured SMS Accounts') }}</h2>
            <span class="text-xs text-slate-500">{{ accountChannels.length }} {{ __('accounts') }}</span>
          </div>

          <div v-if="accountChannels.length > 0" class="grid grid-cols-1 gap-4">
            <div
              v-for="channel in accountChannels"
              :key="channel.id"
              class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex items-center gap-3">
                  <span
                    class="w-3 h-3 rounded-full shrink-0"
                    :class="channel.active ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-950/40' : 'bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800'"
                  ></span>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {{ getDriverName(channel.options?.adapter) }}
                      </h3>
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        :class="channel.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                      >
                        {{ channel.active ? __('Active') : __('Inactive') }}
                      </span>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                        {{ __('Group:') }} {{ getGroupName(channel.group_id) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Account Actions -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    @click="openTestModal(channel)"
                  >
                    {{ __('Test') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    @click="openEditAccountModal(channel)"
                  >
                    {{ __('Edit') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    @click="toggleChannel(channel)"
                  >
                    {{ channel.active ? __('Disable') : __('Enable') }}
                  </button>
                  <button
                    type="button"
                    class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                    :title="__('Delete SMS Account')"
                    @click="deleteChannel(channel)"
                  >
                    <CommonIcon name="trash" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Inbound Webhook URL Display -->
              <div v-if="channel.options?.webhook_token" class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {{ __('Provider Inbound Webhook URL') }}
                  </span>
                  <button
                    type="button"
                    class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                    @click="copyToClipboard(getWebhookUrl(channel.options.webhook_token))"
                  >
                    <CommonIcon name="clipboard" class="w-3.5 h-3.5" />
                    {{ __('Copy Webhook URL') }}
                  </button>
                </div>
                <div class="font-mono text-xs text-slate-700 dark:text-slate-300 truncate select-all">
                  {{ getWebhookUrl(channel.options.webhook_token) }}
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  {{ __('Configure this URL in your SMS provider console (e.g. Twilio Phone Number webhook) to forward incoming customer SMS messages into Student Hub.') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Zero State SMS -->
          <div v-else class="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
            <CommonIcon name="chat" class="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{{ __('No SMS accounts configured') }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              {{ __('Connect your Twilio, MessageBird, or massenversand.de account to send and receive text messages.') }}
            </p>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-2"
              @click="openNewAccountModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('Add SMS Account') }}</span>
            </button>
          </div>
        </div>

      </div>

      <!-- ======================================================= -->
      <!-- MODAL: ADD / EDIT SMS ACCOUNT                           -->
      <!-- ======================================================= -->
      <div
        v-if="isAccountModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('SMS Account Setup')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {{ editingChannelId ? __('Edit SMS Account') : __('New SMS Account') }}
            </h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isAccountModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Provider Selector -->
            <div>
              <label for="sms-provider" class="block text-xs font-semibold mb-1">{{ __('Provider') }}</label>
              <select
                id="sms-provider"
                v-model="selectedAdapter"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="d in driversConfig" :key="d.adapter" :value="d.adapter">{{ d.name }}</option>
              </select>
            </div>

            <!-- Destination Group -->
            <div>
              <label for="sms-group" class="block text-xs font-semibold mb-1">{{ __('Destination Group') }}</label>
              <select
                id="sms-group"
                v-model="accountGroupId"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>

            <!-- Webhook Preview -->
            <div>
              <label for="account_webhook_url" class="block text-xs font-semibold mb-1">{{ __('Webhook URL for Provider') }}</label>
              <div class="flex items-center gap-2">
                <input
                  id="account_webhook_url"
                  type="text"
                  readonly
                  :aria-label="__('Webhook URL for Provider')"
                  :value="getWebhookUrl(accountOptions.webhook_token)"
                  class="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                  @click="copyToClipboard(getWebhookUrl(accountOptions.webhook_token))"
                >
                  {{ __('Copy') }}
                </button>
              </div>
            </div>

            <!-- Dynamic Provider Credentials Fields -->
            <div v-if="selectedAdapter === 'twilio'" class="space-y-3">
              <div>
                <label for="tw-sid" class="block text-xs font-semibold mb-1">{{ __('Account SID') }}</label>
                <input id="tw-sid" v-model="accountOptions.account_sid" type="text" placeholder="AC..." class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="tw-token" class="block text-xs font-semibold mb-1">{{ __('Auth Token') }}</label>
                <input id="tw-token" v-model="accountOptions.auth_token" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="tw-number" class="block text-xs font-semibold mb-1">{{ __('Twilio Phone Number / Sender ID') }}</label>
                <input id="tw-number" v-model="accountOptions.from" type="text" placeholder="+1..." class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
            </div>

            <div v-else-if="selectedAdapter === 'message_bird'" class="space-y-3">
              <div>
                <label for="mb-key" class="block text-xs font-semibold mb-1">{{ __('Access Key') }}</label>
                <input id="mb-key" v-model="accountOptions.access_key" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="mb-originator" class="block text-xs font-semibold mb-1">{{ __('Originator / Sender ID') }}</label>
                <input id="mb-originator" v-model="accountOptions.originator" type="text" placeholder="Student Hub" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
            </div>

            <div v-else-if="selectedAdapter === 'massenversand'" class="space-y-3">
              <div>
                <label for="mv-user" class="block text-xs font-semibold mb-1">{{ __('Username') }}</label>
                <input id="mv-user" v-model="accountOptions.user" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div>
                <label for="mv-pass" class="block text-xs font-semibold mb-1">{{ __('Password') }}</label>
                <input id="mv-pass" v-model="accountOptions.password" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div>
                <label for="mv-sender" class="block text-xs font-semibold mb-1">{{ __('Sender ID') }}</label>
                <input id="mv-sender" v-model="accountOptions.sender" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isAccountModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 disabled:opacity-50"
              :disabled="isSaving"
              @click="saveAccountChannel"
            >
              <CommonIcon v-if="isSaving" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isSaving ? __('Saving...') : __('Save SMS Account') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: TEST SMS DELIVERY                                -->
      <!-- ======================================================= -->
      <div
        v-if="isTestModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Test SMS Delivery')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Test SMS Delivery') }}</h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isTestModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="test-phone" class="block text-xs font-semibold mb-1">{{ __('Recipient Mobile Number') }}</label>
              <input id="test-phone" v-model="testRecipient" type="tel" placeholder="+1234567890" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              <span class="text-[11px] text-slate-400 mt-0.5 block">{{ __('Use full E.164 international format (+country code).') }}</span>
            </div>
            <div>
              <label for="test-msg" class="block text-xs font-semibold mb-1">{{ __('Message') }}</label>
              <input id="test-msg" v-model="testMessage" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
            </div>

            <!-- Test Result Banner -->
            <div v-if="testResult" class="p-3 rounded-xl text-xs" :class="testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
              {{ testResult.success ? __('Test SMS sent successfully!') : (testResult.error_human || testResult.error || __('Test failed.')) }}
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isTestModalOpen = false"
            >
              {{ __('Close') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 disabled:opacity-50"
              :disabled="isTesting || !testRecipient"
              @click="sendTestSms"
            >
              <CommonIcon v-if="isTesting" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isTesting ? __('Sending...') : __('Send Test SMS') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: NOTIFICATION SERVICE SETUP                       -->
      <!-- ======================================================= -->
      <div
        v-if="isNotificationModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('SMS Notification Service Setup')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('SMS Notification Service') }}</h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isNotificationModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="notif-provider" class="block text-xs font-semibold mb-1">{{ __('Provider') }}</label>
              <select
                id="notif-provider"
                v-model="notificationAdapter"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="d in driversConfig" :key="d.adapter" :value="d.adapter">{{ d.name }}</option>
              </select>
            </div>

            <!-- Twilio Credentials -->
            <div v-if="notificationAdapter === 'twilio'" class="space-y-3">
              <div>
                <label for="ntw-sid" class="block text-xs font-semibold mb-1">{{ __('Account SID') }}</label>
                <input id="ntw-sid" v-model="notificationOptions.account_sid" type="text" placeholder="AC..." class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="ntw-token" class="block text-xs font-semibold mb-1">{{ __('Auth Token') }}</label>
                <input id="ntw-token" v-model="notificationOptions.auth_token" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="ntw-number" class="block text-xs font-semibold mb-1">{{ __('Sender Phone Number') }}</label>
                <input id="ntw-number" v-model="notificationOptions.from" type="text" placeholder="+1..." class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
            </div>

            <!-- MessageBird Credentials -->
            <div v-else-if="notificationAdapter === 'message_bird'" class="space-y-3">
              <div>
                <label for="nmb-key" class="block text-xs font-semibold mb-1">{{ __('Access Key') }}</label>
                <input id="nmb-key" v-model="notificationOptions.access_key" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="nmb-originator" class="block text-xs font-semibold mb-1">{{ __('Originator') }}</label>
                <input id="nmb-originator" v-model="notificationOptions.originator" type="text" placeholder="Student Hub" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isNotificationModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              :disabled="isSaving"
              @click="saveNotificationService"
            >
              {{ isSaving ? __('Saving...') : __('Save Notification Service') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
