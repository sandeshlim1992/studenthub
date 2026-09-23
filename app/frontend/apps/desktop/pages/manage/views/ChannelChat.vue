<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  title: string
  state_current?: { value?: unknown }
}

interface ChatTopic {
  id: number
  name: string
  active: boolean
  group_id?: number
  created_at?: string
  updated_at?: string
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

const isChatEnabled = ref(true)
const chatSettingRecord = ref<SettingRecord | null>(null)
const topics = ref<ChatTopic[]>([])
const groups = ref<GroupRecord[]>([])

// Designer State
const widgetTitle = ref('<strong>Chat</strong> with us!')
const widgetBgColor = ref('#0072ce')
const widgetFontSize = ref('14px')
const isFlat = ref(false)
const selectedTopicId = ref<number>(1)
const viewportMode = ref<'desktop' | 'mobile' | 'full'>('desktop')
const isChatExpanded = ref(true)
const scriptType = ref<'vanilla' | 'jquery'>('vanilla')

// Designer Palettes
const paletteColors = [
  '#0072ce',
  '#15803d',
  '#7c3aed',
  '#d97706',
  '#dc2626',
  '#0f172a',
  '#0284c7',
  '#4f46e5',
]

// Topic Modal
const isTopicModalOpen = ref(false)
const editingTopicId = ref<number | null>(null)
const topicForm = ref({
  name: '',
  active: true,
  group_id: 1,
})

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Chat') },
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
  return g ? g.name : `Group #${groupId}`
}

// Generated Embed Snippet
const generatedEmbedSnippet = computed(() => {
  const host = window.location.origin
  const tId = selectedTopicId.value || (topics.value[0]?.id ?? 1)
  const escapedTitle = widgetTitle.value.replace(/'/g, "\\'")

  const closingScript = '<' + '/script>'
  if (scriptType.value === 'jquery') {
    return `<script src="https://code.jquery.com/jquery-3.6.0.min.js">${closingScript}
<script src="${host}/assets/chat/chat.min.js">${closingScript}
<script>
$(function() {
  new ZammadChat({
    chatId: ${tId},
    host: '${host}',
    title: '${escapedTitle}',
    background: '${widgetBgColor.value}',
    fontSize: '${widgetFontSize.value}',
    flat: ${isFlat.value},
    show: true
  });
});
${closingScript}`
  }

  return `<script src="${host}/assets/chat/chat.min.js">${closingScript}
<script>
document.addEventListener('DOMContentLoaded', function() {
  new ZammadChat({
    chatId: ${tId},
    host: '${host}',
    title: '${escapedTitle}',
    background: '${widgetBgColor.value}',
    fontSize: '${widgetFontSize.value}',
    flat: ${isFlat.value},
    show: true
  });
});
${closingScript}`
})

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(generatedEmbedSnippet.value)
    showSuccess(__('Embed code copied to clipboard!'))
  } catch (e) {
    console.error(e)
  }
}

// Load Data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [settingsRes, chatsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/settings', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/chats', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (settingsRes.ok) {
      const allSettings: SettingRecord[] = await settingsRes.json()
      const chatSet = allSettings.find((s) => s.name === 'chat')
      if (chatSet) {
        chatSettingRecord.value = chatSet
        isChatEnabled.value = Boolean(chatSet.state_current?.value ?? true)
      }
    }

    if (chatsRes.ok) {
      const data = await chatsRes.json()
      topics.value = Array.isArray(data) ? data : []
      if (topics.value.length > 0 && !selectedTopicId.value) {
        selectedTopicId.value = topics.value[0].id
      }
    }

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }
  } catch (e) {
    showError(__('An error occurred while loading chat settings.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Toggle Master Chat Switch
const toggleMasterChat = async () => {
  if (!chatSettingRecord.value) return
  const nextVal = !isChatEnabled.value
  try {
    const res = await fetch(`/api/v1/settings/${chatSettingRecord.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ state_current: { value: nextVal } }),
    })
    if (res.ok) {
      isChatEnabled.value = nextVal
      showSuccess(nextVal ? __('Chat service enabled.') : __('Chat service disabled.'))
    } else {
      showError(__('Failed to update chat setting.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  }
}

// Topic Actions
const openNewTopicModal = () => {
  editingTopicId.value = null
  topicForm.value = {
    name: '',
    active: true,
    group_id: groups.value[0]?.id ?? 1,
  }
  isTopicModalOpen.value = true
}

const openEditTopicModal = (topic: ChatTopic) => {
  editingTopicId.value = topic.id
  topicForm.value = {
    name: topic.name,
    active: topic.active,
    group_id: topic.group_id ?? (groups.value[0]?.id ?? 1),
  }
  isTopicModalOpen.value = true
}

const saveTopic = async () => {
  if (!topicForm.value.name) {
    showError(__('Please enter a topic name.'))
    return
  }
  isSaving.value = true
  try {
    const isEdit = Boolean(editingTopicId.value)
    const url = isEdit ? `/api/v1/chats/${editingTopicId.value}` : '/api/v1/chats'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(topicForm.value),
    })

    if (res.ok) {
      isTopicModalOpen.value = false
      showSuccess(__('Chat topic saved successfully.'))
      const cRes = await fetch('/api/v1/chats', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
      if (cRes.ok) topics.value = await cRes.json()
    } else {
      showError(__('Failed to save chat topic.'))
    }
  } catch (e) {
    showError(__('An error occurred saving chat topic.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteTopic = async (topic: ChatTopic) => {
  if (!confirm(__('Are you sure you want to delete this chat topic?'))) return
  try {
    const res = await fetch(`/api/v1/chats/${topic.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      topics.value = topics.value.filter((t) => t.id !== topic.id)
      showSuccess(__('Chat topic deleted.'))
    } else {
      showError(__('Failed to delete chat topic.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred deleting chat topic.'))
    console.error(e)
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto">
      
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
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ __('Chat Channel') }}</h1>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {{ __('Channels') }}
            </span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Embed live web chat widgets on your website, assign topics to groups, and chat directly with customers.') }}
          </p>
        </div>

        <!-- Master Switch -->
        <div class="flex items-center gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl shadow-xs">
          <div class="ltr:text-right rtl:text-left">
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 block">{{ __('Chat Service') }}</span>
            <span class="text-[11px] text-slate-500">{{ isChatEnabled ? __('Enabled') : __('Disabled') }}</span>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden"
            :class="isChatEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            :aria-label="__('Toggle chat service')"
            :aria-pressed="isChatEnabled"
            @click="toggleMasterChat"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
              :class="isChatEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
            ></span>
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
        <p class="text-sm font-medium">{{ __('Loading chat settings...') }}</p>
      </div>

      <div v-else class="space-y-8">

        <!-- ======================================================= -->
        <!-- SECTION 1: CHAT TOPICS                                  -->
        <!-- ======================================================= -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Chat Topics') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Topics define the subject area of incoming chats and determine which agent group receives chat requests.') }}
              </p>
            </div>
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              @click="openNewTopicModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('New Topic') }}</span>
            </button>
          </div>

          <div v-if="topics.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
            <div
              v-for="topic in topics"
              :key="topic.id"
              class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :class="topic.active ? 'bg-green-500' : 'bg-slate-400'"
                ></span>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ topic.name }}</span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      :class="topic.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                    >
                      {{ topic.active ? __('Active') : __('Inactive') }}
                    </span>
                  </div>
                  <span class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <CommonIcon name="people" class="w-3 h-3 text-blue-500" />
                    {{ __('Assigned Group:') }} {{ getGroupName(topic.group_id) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  @click="openEditTopicModal(topic)"
                >
                  {{ __('Edit') }}
                </button>
                <button
                  type="button"
                  class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                  :title="__('Delete Topic')"
                  @click="deleteTopic(topic)"
                >
                  <CommonIcon name="trash" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30">
            <p class="text-xs text-slate-500 mb-2">{{ __('No chat topics defined. Create a topic to enable chat routing.') }}</p>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- SECTION 2: LIVE WIDGET DESIGNER & PREVIEW              -->
        <!-- ======================================================= -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Chat Widget Designer') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Customize styling, inspect the live widget preview, and copy the ready-to-use embed snippet for your website.') }}
              </p>
            </div>

            <!-- Viewport Switcher -->
            <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                class="px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                :class="viewportMode === 'desktop' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'"
                @click="viewportMode = 'desktop'"
              >
                {{ __('Desktop') }}
              </button>
              <button
                type="button"
                class="px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                :class="viewportMode === 'mobile' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'"
                @click="viewportMode = 'mobile'"
              >
                {{ __('Mobile') }}
              </button>
              <button
                type="button"
                class="px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                :class="viewportMode === 'full' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'"
                @click="viewportMode = 'full'"
              >
                {{ __('1:1 Scale') }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <!-- Designer Controls (Left Column) -->
            <div class="lg:col-span-5 space-y-4">
              <div>
                <label for="w-title" class="block text-xs font-semibold mb-1">{{ __('Welcome Title (HTML supported)') }}</label>
                <input
                  id="w-title"
                  v-model="widgetTitle"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <!-- Color Palette -->
              <div>
                <label for="w-color-input" class="block text-xs font-semibold mb-1">{{ __('Theme Color') }}</label>
                <div class="flex items-center gap-2 mb-2">
                  <input
                    id="w-color-input"
                    v-model="widgetBgColor"
                    type="color"
                    class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-600 p-0.5 bg-white"
                  />
                  <input
                    id="w-color-text"
                    v-model="widgetBgColor"
                    type="text"
                    :aria-label="__('Theme Color Hex Code')"
                    class="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="c in paletteColors"
                    :key="c"
                    type="button"
                    class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                    :class="widgetBgColor === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'"
                    :style="{ backgroundColor: c }"
                    @click="widgetBgColor = c"
                  ></button>
                </div>
              </div>

              <!-- Typography & Styles -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="w-font" class="block text-xs font-semibold mb-1">{{ __('Font Size') }}</label>
                  <select
                    id="w-font"
                    v-model="widgetFontSize"
                    class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="12px">12px</option>
                    <option value="14px">14px (Standard)</option>
                    <option value="16px">16px</option>
                  </select>
                </div>
                <div class="flex items-center pt-5">
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input v-model="isFlat" type="checkbox" class="rounded border-slate-300 text-blue-600" />
                    <span>{{ __('Flat Style (No Shadow)') }}</span>
                  </label>
                </div>
              </div>

              <div>
                <label for="w-topic" class="block text-xs font-semibold mb-1">{{ __('Default Topic') }}</label>
                <select
                  id="w-topic"
                  v-model="selectedTopicId"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option v-for="t in topics" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
            </div>

            <!-- Simulated Browser & Live Preview (Right Column) -->
            <div class="lg:col-span-7">
              <div
                class="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col transition-all shadow-inner"
                :class="viewportMode === 'mobile' ? 'max-w-xs mx-auto h-[480px]' : 'w-full h-[480px]'"
              >
                <!-- Browser Bar -->
                <div class="px-4 py-2 bg-slate-200 dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-700 flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span class="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                  <div class="flex-1 ltr:ml-2 rtl:mr-2 px-3 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 font-mono truncate">
                    https://example.com/support
                  </div>
                </div>

                <!-- Web Content Simulation -->
                <div class="flex-1 p-6 relative flex flex-col justify-between overflow-hidden bg-slate-50 dark:bg-slate-900">
                  <div class="space-y-3 opacity-60">
                    <div class="h-6 bg-slate-300 dark:bg-slate-700 rounded-md w-3/4"></div>
                    <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-full"></div>
                    <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6"></div>
                    <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-2/3"></div>
                  </div>

                  <!-- Live Interactive Chat Widget -->
                  <div
                    class="absolute bottom-4 ltr:right-4 rtl:left-4 z-20 flex flex-col items-end transition-all"
                    :style="{ fontSize: widgetFontSize }"
                  >
                    <!-- Expanded Chat Window -->
                    <div
                      v-if="isChatExpanded"
                      class="w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-3 transition-all"
                      :class="isFlat ? '' : 'shadow-2xl ring-1 ring-black/5'"
                    >
                      <!-- Chat Header -->
                      <div
                        class="p-3 text-white flex items-center justify-between"
                        :style="{ backgroundColor: widgetBgColor }"
                      >
                        <div class="flex items-center gap-2">
                          <CommonIcon name="chat" class="w-4 h-4" />
                          <!-- eslint-disable-next-line vue/no-v-html -->
                          <span class="text-xs font-semibold" v-html="widgetTitle"></span>
                        </div>
                        <button
                          type="button"
                          class="text-white/80 hover:text-white cursor-pointer"
                          :title="__('Collapse chat')"
                          @click="isChatExpanded = false"
                        >
                          <CommonIcon name="dash" class="w-4 h-4" />
                        </button>
                      </div>

                      <!-- Simulated Messages Body -->
                      <div class="p-3 space-y-2 h-44 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40 text-xs">
                        <div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs">
                          {{ __('Welcome! How can we help you today?') }}
                        </div>
                        <div class="text-[10px] text-slate-400 text-center py-1">
                          {{ __('Agents are online and ready to assist.') }}
                        </div>
                      </div>

                      <!-- Chat Input -->
                      <div class="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5">
                        <input
                          id="chat-preview-input"
                          type="text"
                          :placeholder="__('Type your message...')"
                          :aria-label="__('Type your message...')"
                          class="flex-1 px-2.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:outline-hidden"
                        />
                        <button
                          type="button"
                          class="p-1.5 rounded-lg text-white"
                          :style="{ backgroundColor: widgetBgColor }"
                        >
                          <CommonIcon name="arrow-right" class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <!-- Chat Launcher Button -->
                    <button
                      type="button"
                      class="px-4 py-2.5 rounded-full text-white font-semibold flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
                      :class="isFlat ? '' : 'shadow-lg'"
                      :style="{ backgroundColor: widgetBgColor }"
                      @click="isChatExpanded = !isChatExpanded"
                    >
                      <CommonIcon :name="isChatExpanded ? 'x' : 'chat'" class="w-4 h-4" />
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <span v-if="!isChatExpanded" class="text-xs" v-html="widgetTitle"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Embed Code Generator Card -->
          <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Website Embed Code') }}</h3>
                <p class="text-xs text-slate-500">
                  {{ __('Paste this code snippet right before the closing </body> tag of your website.') }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    :class="scriptType === 'vanilla' ? 'bg-white dark:bg-slate-700 text-blue-600 font-semibold shadow-2xs' : 'text-slate-600 dark:text-slate-400'"
                    @click="scriptType = 'vanilla'"
                  >
                    Vanilla JS
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    :class="scriptType === 'jquery' ? 'bg-white dark:bg-slate-700 text-blue-600 font-semibold shadow-2xs' : 'text-slate-600 dark:text-slate-400'"
                    @click="scriptType = 'jquery'"
                  >
                    jQuery
                  </button>
                </div>

                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer inline-flex items-center gap-1.5"
                  @click="copySnippet"
                >
                  <CommonIcon name="clipboard" class="w-3.5 h-3.5" />
                  <span>{{ __('Copy Code') }}</span>
                </button>
              </div>
            </div>

            <!-- Code Block Preview -->
            <pre class="p-4 rounded-xl bg-slate-900 text-blue-200 font-mono text-xs overflow-x-auto select-all leading-relaxed">{{ generatedEmbedSnippet }}</pre>
          </div>
        </div>

      </div>

      <!-- ======================================================= -->
      <!-- MODAL: ADD / EDIT CHAT TOPIC                            -->
      <!-- ======================================================= -->
      <div
        v-if="isTopicModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Chat Topic Configuration')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {{ editingTopicId ? __('Edit Topic') : __('New Topic') }}
            </h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isTopicModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="top-name" class="block text-xs font-semibold mb-1">{{ __('Topic Name') }}</label>
              <input id="top-name" v-model="topicForm.name" type="text" placeholder="e.g. Sales Inquiries" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
            </div>

            <div>
              <label for="top-group" class="block text-xs font-semibold mb-1">{{ __('Destination Group') }}</label>
              <select id="top-group" v-model="topicForm.group_id" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>

            <div class="pt-2">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input v-model="topicForm.active" type="checkbox" class="rounded border-slate-300 text-blue-600" />
                <span>{{ __('Active') }}</span>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isTopicModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              :disabled="isSaving"
              @click="saveTopic"
            >
              {{ isSaving ? __('Saving...') : __('Save Topic') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
