<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface WhatsappPhoneNumber {
  id: string
  verified_name?: string
  display_phone_number?: string
  quality_rating?: string
}

interface WhatsappChannel {
  id: number
  area: string
  active: boolean
  group_id?: number
  options?: {
    business_id?: string
    phone_number_id?: string
    phone_number?: string
    verified_name?: string
    display_phone_number?: string
    access_token?: string
    app_secret?: string
    webhook_token?: string
    reminder_active?: boolean
    reminder_message?: string
    [key: string]: unknown
  }
}

interface GroupRecord {
  id: number
  name: string
  active: boolean
}

interface HttpLogRecord {
  id: number
  facility: string
  status?: number
  created_at: string
  request?: {
    method?: string
    url?: string
    content?: unknown
  }
  response?: {
    code?: number
    content?: unknown
  }
}

const router = useRouter()

// State
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const channels = ref<WhatsappChannel[]>([])
const groups = ref<GroupRecord[]>([])
const httpLogs = ref<HttpLogRecord[]>([])
const isLoadingLogs = ref(false)
const selectedLog = ref<HttpLogRecord | null>(null)
const isLogModalOpen = ref(false)

// Wizard Modal
const isWizardModalOpen = ref(false)
const wizardStep = ref<1 | 2>(1)
const editingChannelId = ref<number | null>(null)
const wizardError = ref('')

const wizardForm = ref({
  business_id: '',
  access_token: '',
  app_secret: '',
  phone_number_id: '',
  group_id: 1,
  reminder_active: true,
  reminder_message: __('Please note that we have not received a response yet. If you need further assistance, please reply to this message.'),
})

const availablePhoneNumbers = ref<WhatsappPhoneNumber[]>([])

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('WhatsApp') },
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

const getGroupName = (groupId?: number) => {
  if (!groupId) return '-'
  const g = groups.value.find((item) => item.id === groupId)
  return g ? g.name : '-'
}

const getWebhookUrl = (token?: string) => {
  const t = token || 'YOUR_WEBHOOK_TOKEN'
  return `${window.location.origin}/api/v1/channels_whatsapp_webhook/${t}`
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Copied to clipboard.'))
  } catch (err) {
    showError(__('Failed to copy to clipboard.'))
    console.error(err)
  }
}

// HTTP Logs Actions
const loadHttpLogs = async () => {
  isLoadingLogs.value = true
  try {
    const res = await fetch('/api/v1/http_logs/WhatsApp::Business?limit=25', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      httpLogs.value = await res.json()
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingLogs.value = false
  }
}

const openLogDetails = (log: HttpLogRecord) => {
  selectedLog.value = log
  isLogModalOpen.value = true
}

const formatContent = (content: unknown) => {
  if (!content) return '-'
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

// Load Data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [waRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels/admin/whatsapp', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }

    if (waRes.ok) {
      const data = await waRes.json()
      const assets = data.assets || {}
      const channelMap = assets.Channel || {}
      const channelIds: number[] = data.channel_ids || []
      channels.value = channelIds.map((id) => channelMap[id] as WhatsappChannel).filter(Boolean)
    }

    await loadHttpLogs()
  } catch (e) {
    showError(__('Failed to load WhatsApp channels.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Wizard Actions
const openNewAccountModal = () => {
  editingChannelId.value = null
  wizardStep.value = 1
  wizardError.value = ''
  availablePhoneNumbers.value = []
  wizardForm.value = {
    business_id: '',
    access_token: '',
    app_secret: '',
    phone_number_id: '',
    group_id: groups.value[0]?.id || 1,
    reminder_active: true,
    reminder_message: __('Please note that we have not received a response yet. If you need further assistance, please reply to this message.'),
  }
  isWizardModalOpen.value = true
}

const openEditAccountModal = (channel: WhatsappChannel) => {
  editingChannelId.value = channel.id
  wizardStep.value = 2
  wizardError.value = ''
  availablePhoneNumbers.value = [
    {
      id: channel.options?.phone_number_id || '',
      display_phone_number: channel.options?.display_phone_number || channel.options?.phone_number || '',
      verified_name: channel.options?.verified_name || '',
    },
  ]
  wizardForm.value = {
    business_id: channel.options?.business_id || '',
    access_token: '',
    app_secret: '',
    phone_number_id: channel.options?.phone_number_id || '',
    group_id: channel.group_id || groups.value[0]?.id || 1,
    reminder_active: channel.options?.reminder_active !== false,
    reminder_message: channel.options?.reminder_message || __('Please note that we have not received a response yet. If you need further assistance, please reply to this message.'),
  }
  isWizardModalOpen.value = true
}

const handleStep1Next = async () => {
  if (!wizardForm.value.business_id || !wizardForm.value.access_token) {
    wizardError.value = __('Please provide your Business Account ID and Access Token.')
    return
  }

  isSaving.value = true
  wizardError.value = ''

  try {
    const res = await fetch('/api/v1/channels/admin/whatsapp/preload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        business_id: wizardForm.value.business_id.trim(),
        access_token: wizardForm.value.access_token.trim(),
      }),
    })

    const data = await res.json()

    if (res.ok && data.data?.phone_numbers) {
      availablePhoneNumbers.value = data.data.phone_numbers
      if (availablePhoneNumbers.value.length > 0) {
        wizardForm.value.phone_number_id = availablePhoneNumbers.value[0].id
      }
      wizardStep.value = 2
    } else {
      wizardError.value = data.error_human || data.error || __('Could not fetch phone numbers for this WhatsApp Business Account. Check credentials.')
    }
  } catch (e) {
    wizardError.value = __('An unexpected error occurred contacting WhatsApp Cloud API.')
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const saveAccount = async () => {
  if (!wizardForm.value.phone_number_id) {
    wizardError.value = __('Please select a phone number.')
    return
  }

  isSaving.value = true
  wizardError.value = ''

  try {
    const isEdit = Boolean(editingChannelId.value)
    const url = isEdit ? `/api/v1/channels/admin/whatsapp/${editingChannelId.value}` : '/api/v1/channels/admin/whatsapp'
    const method = isEdit ? 'PUT' : 'POST'

    const selectedPhone = availablePhoneNumbers.value.find((p) => p.id === wizardForm.value.phone_number_id)

    const payload: Record<string, unknown> = {
      business_id: wizardForm.value.business_id,
      phone_number_id: wizardForm.value.phone_number_id,
      phone_number: selectedPhone?.display_phone_number,
      verified_name: selectedPhone?.verified_name,
      group_id: wizardForm.value.group_id,
      reminder_active: wizardForm.value.reminder_active,
      reminder_message: wizardForm.value.reminder_message,
    }
    if (wizardForm.value.access_token) {
      payload.access_token = wizardForm.value.access_token.trim()
    }
    if (wizardForm.value.app_secret) {
      payload.app_secret = wizardForm.value.app_secret.trim()
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

    const data = await res.json()

    if (res.ok) {
      isWizardModalOpen.value = false
      showSuccess(isEdit ? __('WhatsApp account updated.') : __('WhatsApp account added.'))
      await loadData()
    } else {
      wizardError.value = data.error_human || data.error || __('Failed to save WhatsApp account.')
    }
  } catch (e) {
    wizardError.value = __('An unexpected error occurred.')
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Channel Status Actions
const toggleChannelActive = async (channel: WhatsappChannel) => {
  isSaving.value = true
  try {
    const url = channel.active ? `/api/v1/channels/admin/whatsapp/${channel.id}/disable` : `/api/v1/channels/admin/whatsapp/${channel.id}/enable`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      showSuccess(channel.active ? __('WhatsApp channel disabled.') : __('WhatsApp channel enabled.'))
      await loadData()
    } else {
      showError(__('Failed to change WhatsApp channel status.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteChannel = async (channel: WhatsappChannel) => {
  if (!confirm(__('Are you sure you want to delete this WhatsApp Business channel?'))) {
    return
  }
  isSaving.value = true
  try {
    const res = await fetch(`/api/v1/channels/admin/whatsapp/${channel.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      showSuccess(__('WhatsApp channel deleted.'))
      await loadData()
    } else {
      showError(__('Failed to delete WhatsApp channel.'))
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
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CommonIcon name="whatsapp" class="w-4 h-4" />
              </div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {{ __('WhatsApp Channel') }}
              </h1>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Connect WhatsApp Business Cloud API to receive customer messages and respond within 24-hour service windows.') }}
          </p>
        </div>

        <button
          type="button"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          @click="openNewAccountModal"
        >
          <CommonIcon name="plus" class="w-3.5 h-3.5" />
          {{ __('Add Account') }}
        </button>
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
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Loading WhatsApp channels...') }}</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Empty State -->
        <div
          v-if="channels.length === 0"
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs"
        >
          <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CommonIcon name="whatsapp" class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            {{ __('No WhatsApp Accounts Connected') }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            {{ __('Connect your Meta WhatsApp Business Cloud API account to receive and reply to WhatsApp messages from customers.') }}
          </p>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            @click="openNewAccountModal"
          >
            <CommonIcon name="plus" class="w-4 h-4" />
            {{ __('Add WhatsApp Account') }}
          </button>
        </div>

        <!-- Channels List -->
        <div
          v-for="channel in channels"
          :key="channel.id"
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-all"
          :class="{ 'opacity-80 bg-slate-50/50 dark:bg-slate-900/50': !channel.active }"
        >
          <div class="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CommonIcon name="whatsapp" class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ channel.options?.verified_name || channel.options?.display_phone_number || __('WhatsApp Number') }}
                  </h3>
                  <span class="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {{ channel.options?.display_phone_number || channel.options?.phone_number || '-' }}
                  </span>
                </div>
                <div class="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                  <span>{{ __('WABA ID:') }} <strong class="font-mono text-slate-700 dark:text-slate-300">{{ channel.options?.business_id || '-' }}</strong></span>
                  <span>·</span>
                  <span>{{ __('Destination Group:') }} <strong class="text-slate-700 dark:text-slate-300">{{ getGroupName(channel.group_id) }}</strong></span>
                </div>
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
                class="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                @click="openEditAccountModal(channel)"
              >
                {{ __('Edit') }}
              </button>
            </div>
          </div>

          <!-- Webhook Info & Reminder Setting -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {{ __('Webhook Callback URL') }}
              </span>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="getWebhookUrl(channel.options?.webhook_token)"
                  :aria-label="__('Webhook Callback URL')"
                  class="flex-1 px-2.5 py-1 text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                />
                <button
                  type="button"
                  class="px-2 py-1 text-[11px] border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  @click="copyToClipboard(getWebhookUrl(channel.options?.webhook_token))"
                >
                  {{ __('Copy') }}
                </button>
              </div>
            </div>

            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {{ __('Service Window Reminder') }}
              </span>
              <p class="text-slate-600 dark:text-slate-400 text-xs">
                {{ channel.options?.reminder_active ? __('Automatic customer reminder active before 24-hour window expires.') : __('Automatic reminders disabled.') }}
              </p>
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

        <!-- Communication Log Panel (WhatsApp::Business) -->
        <div class="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CommonIcon name="card-list" class="w-4 h-4 text-slate-500" />
                {{ __('Communication Log (WhatsApp::Business)') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ __('Recent inbound webhook calls and delivery receipts from Meta Graph API.') }}
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              :disabled="isLoadingLogs"
              @click="loadHttpLogs"
            >
              <CommonIcon name="arrow-clockwise" class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingLogs }" />
              {{ __('Refresh') }}
            </button>
          </div>

          <div v-if="httpLogs.length === 0" class="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            {{ __('No webhook events recorded yet. Webhook calls from Meta will appear here in real time.') }}
          </div>

          <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th class="px-3.5 py-2 font-semibold">{{ __('Timestamp') }}</th>
                  <th class="px-3.5 py-2 font-semibold">{{ __('Status') }}</th>
                  <th class="px-3.5 py-2 font-semibold">{{ __('Method') }}</th>
                  <th class="px-3.5 py-2 font-semibold">{{ __('URL') }}</th>
                  <th class="px-3.5 py-2 font-semibold text-right">{{ __('Action') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                <tr v-for="log in httpLogs" :key="log.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                  <td class="px-3.5 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {{ new Date(log.created_at).toLocaleString() }}
                  </td>
                  <td class="px-3.5 py-2 whitespace-nowrap">
                    <span
                      class="px-2 py-0.5 rounded-md font-bold text-[10px]"
                      :class="(log.status || log.response?.code || 200) < 400 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'"
                    >
                      {{ log.status || log.response?.code || 200 }}
                    </span>
                  </td>
                  <td class="px-3.5 py-2 text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap">
                    {{ log.request?.method || 'POST' }}
                  </td>
                  <td class="px-3.5 py-2 text-slate-500 max-w-xs truncate" :title="log.request?.url">
                    {{ log.request?.url || '/api/v1/whatsapp_webhook' }}
                  </td>
                  <td class="px-3.5 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      class="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-sans font-medium cursor-pointer"
                      @click="openLogDetails(log)"
                    >
                      {{ __('Inspect') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- ================= MODAL: WHATSAPP WIZARD ================= -->
      <div
        v-if="isWizardModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CommonIcon name="whatsapp" class="w-5 h-5 text-emerald-500" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ editingChannelId ? __('Edit WhatsApp Account') : (wizardStep === 1 ? __('Connect WhatsApp Cloud API (Step 1/2)') : __('Configure WhatsApp Number (Step 2/2)')) }}
              </h3>
            </div>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isWizardModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div
              v-if="wizardError"
              class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
            >
              {{ wizardError }}
            </div>

            <!-- Step 1: Cloud API Credentials -->
            <div v-if="wizardStep === 1" class="space-y-4">
              <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {{ __('Enter your WhatsApp Business Account ID (WABA ID) and Permanent System User Access Token from Meta Business Suite.') }}
              </p>

              <div>
                <label for="wa-waba-id" class="block text-xs font-semibold mb-1">
                  {{ __('WhatsApp Business Account ID (WABA ID)') }} <span class="text-rose-500">*</span>
                </label>
                <input
                  id="wa-waba-id"
                  v-model="wizardForm.business_id"
                  type="text"
                  placeholder="123456789012345"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label for="wa-access-token" class="block text-xs font-semibold mb-1">
                  {{ __('System User Access Token') }} <span class="text-rose-500">*</span>
                </label>
                <textarea
                  id="wa-access-token"
                  v-model="wizardForm.access_token"
                  rows="3"
                  placeholder="EAA..."
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                ></textarea>
              </div>

              <div>
                <label for="wa-app-secret" class="block text-xs font-semibold mb-1">
                  {{ __('App Secret') }}
                </label>
                <input
                  id="wa-app-secret"
                  v-model="wizardForm.app_secret"
                  type="password"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <!-- Step 2: Phone Number & Routing -->
            <div v-if="wizardStep === 2" class="space-y-4">
              <div v-if="!editingChannelId">
                <label for="wa-phone-select" class="block text-xs font-semibold mb-1">
                  {{ __('Select Phone Number') }} <span class="text-rose-500">*</span>
                </label>
                <select
                  id="wa-phone-select"
                  v-model="wizardForm.phone_number_id"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option v-for="p in availablePhoneNumbers" :key="p.id" :value="p.id">
                    {{ p.display_phone_number || p.id }} ({{ p.verified_name || __('Verified Name') }})
                  </option>
                </select>
              </div>

              <div>
                <label for="wa-group-select" class="block text-xs font-semibold mb-1">
                  {{ __('Destination Group') }} <span class="text-rose-500">*</span>
                </label>
                <select
                  id="wa-group-select"
                  v-model="wizardForm.group_id"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option v-for="g in groups" :key="g.id" :value="g.id">
                    {{ g.name }}
                  </option>
                </select>
              </div>

              <div class="flex items-center gap-3 pt-1">
                <input
                  id="wa-reminder-active"
                  v-model="wizardForm.reminder_active"
                  type="checkbox"
                  class="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label for="wa-reminder-active" class="text-xs font-medium cursor-pointer">
                  {{ __('Send automatic reminder before 24h customer window closes') }}
                </label>
              </div>

              <div v-if="wizardForm.reminder_active">
                <label for="wa-reminder-msg" class="block text-xs font-semibold mb-1">
                  {{ __('Reminder Message') }}
                </label>
                <textarea
                  id="wa-reminder-msg"
                  v-model="wizardForm.reminder_message"
                  rows="3"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <a
              href="https://admin-docs.zammad.org/en/latest/channels/whatsapp.html"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              {{ __('Documentation') }}
              <CommonIcon name="external-link" class="w-3 h-3" />
            </a>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                @click="isWizardModalOpen = false"
              >
                {{ __('Cancel') }}
              </button>

              <button
                v-if="wizardStep === 1 && !editingChannelId"
                type="button"
                class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                :disabled="isSaving"
                @click="handleStep1Next"
              >
                {{ isSaving ? __('Fetching Numbers...') : __('Next') }}
              </button>

              <button
                v-if="wizardStep === 2 || editingChannelId"
                type="button"
                class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                :disabled="isSaving"
                @click="saveAccount"
              >
                {{ isSaving ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>
        </div>
      <!-- ================= MODAL: LOG INSPECT ================= -->
      <div
        v-if="isLogModalOpen && selectedLog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CommonIcon name="card-list" class="w-5 h-5 text-blue-500" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ __('HTTP Log Detail #') }}{{ selectedLog.id }}
              </h3>
            </div>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isLogModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{{ __('Method') }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300 font-mono">{{ selectedLog.request?.method || 'POST' }}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{{ __('Status') }}</span>
                <span class="font-bold font-mono" :class="(selectedLog.status || selectedLog.response?.code || 200) < 400 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ selectedLog.status || selectedLog.response?.code || 200 }}
                </span>
              </div>
              <div class="col-span-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{{ __('Timestamp') }}</span>
                <span class="text-slate-600 dark:text-slate-400">{{ new Date(selectedLog.created_at).toLocaleString() }}</span>
              </div>
            </div>

            <div>
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{{ __('Request Payload') }}</span>
              <pre class="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">{{ formatContent(selectedLog.request?.content) }}</pre>
            </div>

            <div>
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{{ __('Response Payload') }}</span>
              <pre class="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">{{ formatContent(selectedLog.response?.content) }}</pre>
            </div>
          </div>

          <div class="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
              @click="isLogModalOpen = false"
            >
              {{ __('Close') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
