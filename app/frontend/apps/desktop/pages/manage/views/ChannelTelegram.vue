<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface TelegramChannel {
  id: number
  area: string
  active: boolean
  group_id?: number
  options?: {
    api_token?: string
    welcome?: string
    goodbye?: string
    user?: {
      id?: number
      username?: string
      first_name?: string
      is_bot?: boolean
    }
    bot?: {
      id?: number
      username?: string
      first_name?: string
    }
    username?: string
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

const channels = ref<TelegramChannel[]>([])
const groups = ref<GroupRecord[]>([])

// Modals
const isBotModalOpen = ref(false)
const editingBotId = ref<number | null>(null)
const botForm = ref({
  api_token: '',
  welcome: '',
  goodbye: '',
  group_id: 1,
})
const botModalError = ref('')

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Telegram') },
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

// Load Data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [telegramRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels_telegram', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }

    if (telegramRes.ok) {
      const data = await telegramRes.json()
      const assets = data.assets || {}
      const channelMap = assets.Channel || {}
      const channelIds: number[] = data.channel_ids || []
      channels.value = channelIds.map((id) => channelMap[id] as TelegramChannel).filter(Boolean)
    }
  } catch (e) {
    showError(__('Failed to load Telegram channels.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Bot Modal Actions
const openNewBotModal = () => {
  editingBotId.value = null
  botModalError.value = ''
  botForm.value = {
    api_token: '',
    welcome: __('Welcome! Feel free to ask me a question!'),
    goodbye: __('Have a nice day.'),
    group_id: groups.value[0]?.id || 1,
  }
  isBotModalOpen.value = true
}

const openEditBotModal = (channel: TelegramChannel) => {
  editingBotId.value = channel.id
  botModalError.value = ''
  botForm.value = {
    api_token: '',
    welcome: channel.options?.welcome || __('Welcome! Feel free to ask me a question!'),
    goodbye: channel.options?.goodbye || __('Have a nice day.'),
    group_id: channel.group_id || groups.value[0]?.id || 1,
  }
  isBotModalOpen.value = true
}

const saveBot = async () => {
  if (!botForm.value.welcome || !botForm.value.goodbye) {
    botModalError.value = __('Please fill in all required fields.')
    return
  }
  if (!editingBotId.value && !botForm.value.api_token) {
    botModalError.value = __('Please enter your Telegram Bot API token.')
    return
  }

  isSaving.value = true
  botModalError.value = ''

  try {
    const isEdit = Boolean(editingBotId.value)
    const url = isEdit ? `/api/v1/channels_telegram/${editingBotId.value}` : '/api/v1/channels_telegram'
    const method = isEdit ? 'PUT' : 'POST'

    const payload: Record<string, unknown> = {
      welcome: botForm.value.welcome,
      goodbye: botForm.value.goodbye,
      group_id: botForm.value.group_id,
    }
    if (botForm.value.api_token) {
      payload.api_token = botForm.value.api_token.trim()
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
      isBotModalOpen.value = false
      showSuccess(isEdit ? __('Telegram bot updated successfully.') : __('Telegram bot added successfully.'))
      await loadData()
    } else {
      botModalError.value = data.error_human || data.error || data.message || __('Failed to save Telegram bot. Please check your API token.')
    }
  } catch (e) {
    botModalError.value = __('An unexpected error occurred.')
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Channel Status Actions
const toggleChannelActive = async (channel: TelegramChannel) => {
  isSaving.value = true
  try {
    const url = channel.active ? '/api/v1/channels_telegram_disable' : '/api/v1/channels_telegram_enable'
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
      showSuccess(channel.active ? __('Telegram bot disabled.') : __('Telegram bot enabled.'))
      await loadData()
    } else {
      showError(__('Failed to change bot status.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteChannel = async (channel: TelegramChannel) => {
  if (!confirm(__('Are you sure you want to delete this Telegram bot channel?'))) {
    return
  }
  isSaving.value = true
  try {
    const res = await fetch('/api/v1/channels_telegram', {
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
      showSuccess(__('Telegram bot deleted.'))
      await loadData()
    } else {
      showError(__('Failed to delete Telegram bot.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const getBotDisplayName = (channel: TelegramChannel) => {
  return (
    channel.options?.user?.first_name ||
    channel.options?.bot?.first_name ||
    channel.options?.user?.username ||
    channel.options?.bot?.username ||
    channel.options?.username ||
    `Telegram Bot #${channel.id}`
  )
}

const getBotUsername = (channel: TelegramChannel) => {
  const u = channel.options?.user?.username || channel.options?.bot?.username || channel.options?.username
  return u ? `@${u}` : ''
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
              <div class="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <CommonIcon name="telegram" class="w-4 h-4" />
              </div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {{ __('Telegram Channel') }}
              </h1>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Connect Telegram bots to receive customer messages and respond directly from ticket views.') }}
          </p>
        </div>

        <button
          type="button"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          @click="openNewBotModal"
        >
          <CommonIcon name="plus" class="w-3.5 h-3.5" />
          {{ __('Add Bot') }}
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
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Loading Telegram bots...') }}</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Empty State -->
        <div
          v-if="channels.length === 0"
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs"
        >
          <div class="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
            <CommonIcon name="telegram" class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            {{ __('No Telegram Bots Configured') }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            {{ __('Create a bot with @BotFather on Telegram, grab your API token, and add it here to begin chatting with customers.') }}
          </p>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            @click="openNewBotModal"
          >
            <CommonIcon name="plus" class="w-4 h-4" />
            {{ __('Add Telegram Bot') }}
          </button>
        </div>

        <!-- Bot Cards List -->
        <div
          v-for="channel in channels"
          :key="channel.id"
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-all"
          :class="{ 'opacity-80 bg-slate-50/50 dark:bg-slate-900/50': !channel.active }"
        >
          <div class="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <CommonIcon name="telegram" class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ getBotDisplayName(channel) }}
                  </h3>
                  <span v-if="getBotUsername(channel)" class="text-xs font-mono text-sky-600 dark:text-sky-400">
                    {{ getBotUsername(channel) }}
                  </span>
                </div>
                <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
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
                @click="openEditBotModal(channel)"
              >
                {{ __('Edit') }}
              </button>
            </div>
          </div>

          <!-- Messages Preview -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {{ __('Welcome Message') }}
              </span>
              <p class="text-slate-700 dark:text-slate-300 italic">
                "{{ channel.options?.welcome || '-' }}"
              </p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {{ __('Goodbye Message') }}
              </span>
              <p class="text-slate-700 dark:text-slate-300 italic">
                "{{ channel.options?.goodbye || '-' }}"
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

      </div>

      <!-- ================= MODAL: ADD / EDIT BOT ================= -->
      <div
        v-if="isBotModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CommonIcon name="telegram" class="w-5 h-5 text-sky-500" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ editingBotId ? __('Edit Telegram Bot') : __('Add Telegram Bot') }}
              </h3>
            </div>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isBotModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div
              v-if="botModalError"
              class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
            >
              {{ botModalError }}
            </div>

            <div>
              <label for="tg-api-token" class="block text-xs font-semibold mb-1">
                {{ __('Telegram API Token') }} <span v-if="!editingBotId" class="text-rose-500">*</span>
              </label>
              <input
                id="tg-api-token"
                v-model="botForm.api_token"
                type="password"
                :placeholder="editingBotId ? __('Leave blank to keep existing token') : '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
              <p class="text-[11px] text-slate-400 mt-1">
                {{ __('Generated by @BotFather when creating your Telegram bot.') }}
              </p>
            </div>

            <div>
              <label for="tg-group-select" class="block text-xs font-semibold mb-1">
                {{ __('Destination Group') }} <span class="text-rose-500">*</span>
              </label>
              <select
                id="tg-group-select"
                v-model="botForm.group_id"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="g in groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="tg-welcome-msg" class="block text-xs font-semibold mb-1">
                {{ __('Welcome Message') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="tg-welcome-msg"
                v-model="botForm.welcome"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label for="tg-goodbye-msg" class="block text-xs font-semibold mb-1">
                {{ __('Goodbye Message') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="tg-goodbye-msg"
                v-model="botForm.goodbye"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <a
              href="https://admin-docs.zammad.org/en/latest/channels/telegram.html"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              {{ __('Tutorial') }}
              <CommonIcon name="external-link" class="w-3 h-3" />
            </a>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                @click="isBotModalOpen = false"
              >
                {{ __('Cancel') }}
              </button>
              <button
                type="button"
                class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                :disabled="isSaving"
                @click="saveBot"
              >
                {{ isSaving ? __('Saving...') : (editingBotId ? __('Save Changes') : __('Add Bot')) }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
