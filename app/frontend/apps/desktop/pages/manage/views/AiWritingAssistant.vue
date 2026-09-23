<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  title?: string
  description?: string
  state_current?: {
    value?: unknown
  }
}

interface AnalyticsStats {
  positive?: { count: number; percent: number }
  negative?: { count: number; percent: number }
  neutral?: { count: number; percent: number }
  total?: number
}

interface AiTextTool {
  id: number
  name: string
  instruction: string
  note?: string
  active: boolean
  analytics_stats_reset_at?: string | null
  created_at?: string
  updated_at?: string
  analytics_stats?: AnalyticsStats
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('AI') },
  { label: __('Writing Assistant') },
]

const getCsrf = () =>
  (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''

const isLoading = ref(true)
const isSavingMaster = ref(false)
const isSavingTool = ref(false)
const isDeletingId = ref<number | null>(null)
const isDownloadingId = ref<number | null>(null)
const isResettingId = ref<number | null>(null)

const errorMessage = ref('')
const successMessage = ref('')

const allSettings = ref<Record<string, SettingRecord>>({})
const textToolsEnabled = ref(false)
const aiProviderEnabled = ref(false)

const textTools = ref<AiTextTool[]>([])
const searchQuery = ref('')

const isLegalModalOpen = ref(false)
const isToolModalOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const toolForm = ref({
  name: '',
  instruction: '',
  note: '',
  active: true,
})

const showToast = (message: string, isError = false) => {
  if (isError) {
    errorMessage.value = message
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } else {
    successMessage.value = message
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  }
}

const fetchAllData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [settingsRes, toolsRes] = await Promise.all([
      fetch('/api/v1/settings', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/ai_text_tools', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (settingsRes.ok) {
      const settingsList: SettingRecord[] = await settingsRes.json()
      const map: Record<string, SettingRecord> = {}
      settingsList.forEach((s) => {
        map[s.name] = s
      })
      allSettings.value = map

      textToolsEnabled.value = Boolean(map['ai_assistance_text_tools']?.state_current?.value)
      aiProviderEnabled.value = Boolean(map['ai_provider']?.state_current?.value)
    }

    if (toolsRes.ok) {
      textTools.value = await toolsRes.json()
    } else {
      showToast(__('Failed to load writing assistant tools.'), true)
    }
  } catch {
    showToast(__('Failed to connect to the server.'), true)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchAllData()
})

const filteredTools = computed(() => {
  if (!searchQuery.value.trim()) return textTools.value
  const query = searchQuery.value.toLowerCase().trim()
  return textTools.value.filter(
    (tool) =>
      tool.name?.toLowerCase().includes(query) ||
      tool.note?.toLowerCase().includes(query) ||
      tool.instruction?.toLowerCase().includes(query),
  )
})

const toggleWritingAssistantMaster = async () => {
  const nextVal = !textToolsEnabled.value
  const setting = allSettings.value['ai_assistance_text_tools']
  if (!setting) {
    showToast(__('Setting "ai_assistance_text_tools" not found.'), true)
    return
  }

  isSavingMaster.value = true
  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        state_current: { value: nextVal },
      }),
    })

    if (res.ok) {
      const updated: SettingRecord = await res.json()
      allSettings.value['ai_assistance_text_tools'] = updated
      textToolsEnabled.value = nextVal
      showToast(
        nextVal
          ? __('Writing Assistant feature has been enabled.')
          : __('Writing Assistant feature has been disabled.'),
      )
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || __('Failed to update Writing Assistant setting.'), true)
    }
  } catch {
    showToast(__('An error occurred while saving the setting.'), true)
  } finally {
    isSavingMaster.value = false
  }
}

const toggleToolActive = async (tool: AiTextTool) => {
  const nextVal = !tool.active
  try {
    const res = await fetch(`/api/v1/ai_text_tools/${tool.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ active: nextVal }),
    })

    if (res.ok) {
      tool.active = nextVal
      showToast(
        nextVal ? __('Tool "%s" activated.', tool.name) : __('Tool "%s" deactivated.', tool.name),
      )
    } else {
      showToast(__('Failed to update tool state.'), true)
    }
  } catch {
    showToast(__('An error occurred while updating the tool state.'), true)
  }
}

const openNewToolModal = () => {
  isEditing.value = false
  editingId.value = null
  toolForm.value = {
    name: '',
    instruction: '',
    note: '',
    active: true,
  }
  isToolModalOpen.value = true
}

const openEditToolModal = (tool: AiTextTool) => {
  isEditing.value = true
  editingId.value = tool.id
  toolForm.value = {
    name: tool.name || '',
    instruction: tool.instruction || '',
    note: tool.note || '',
    active: tool.active,
  }
  isToolModalOpen.value = true
}

const saveTool = async () => {
  if (!toolForm.value.name.trim()) {
    showToast(__('Tool name is required.'), true)
    return
  }
  if (!toolForm.value.instruction.trim()) {
    showToast(__('Tool instruction is required.'), true)
    return
  }

  isSavingTool.value = true
  try {
    const url = isEditing.value
      ? `/api/v1/ai_text_tools/${editingId.value}`
      : '/api/v1/ai_text_tools'
    const method = isEditing.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        name: toolForm.value.name.trim(),
        instruction: toolForm.value.instruction.trim(),
        note: toolForm.value.note.trim(),
        active: toolForm.value.active,
      }),
    })

    if (res.ok) {
      showToast(
        isEditing.value
          ? __('Writing assistant tool updated successfully.')
          : __('Writing assistant tool created successfully.'),
      )
      isToolModalOpen.value = false
      const toolsRes = await fetch('/api/v1/ai_text_tools', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (toolsRes.ok) {
        textTools.value = await toolsRes.json()
      }
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || __('Failed to save writing assistant tool.'), true)
    }
  } catch {
    showToast(__('An error occurred while saving the tool.'), true)
  } finally {
    isSavingTool.value = false
  }
}

const deleteTool = async (tool: AiTextTool) => {
  if (!confirm(__('Are you sure you want to delete the writing assistant tool "%s"?', tool.name))) {
    return
  }

  isDeletingId.value = tool.id
  try {
    const res = await fetch(`/api/v1/ai_text_tools/${tool.id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (res.ok) {
      showToast(__('Writing assistant tool deleted successfully.'))
      textTools.value = textTools.value.filter((t) => t.id !== tool.id)
    } else {
      showToast(__('Failed to delete writing assistant tool.'), true)
    }
  } catch {
    showToast(__('An error occurred while deleting the tool.'), true)
  } finally {
    isDeletingId.value = null
  }
}

const downloadFeedbackReport = async (tool: AiTextTool) => {
  isDownloadingId.value = tool.id
  try {
    let url = `/api/v1/ai/analytics/download/with_usages?filters[triggered_by_type]=AI::TextTool&filters[triggered_by_id]=${tool.id}`
    if (tool.analytics_stats_reset_at) {
      url += `&filters[created_after]=${encodeURIComponent(tool.analytics_stats_reset_at)}`
    }

    const res = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (!res.ok) {
      showToast(__('The download could not be started. Please try again later.'), true)
      return
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `ai_analytics_text_tool_${tool.id}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
    showToast(__('Feedback report downloaded.'))
  } catch {
    showToast(__('The download could not be started. Please try again later.'), true)
  } finally {
    isDownloadingId.value = null
  }
}

const resetFeedbackTimestamp = async (tool: AiTextTool) => {
  if (!confirm(__('Are you sure you want to reset feedback statistics for "%s"?', tool.name))) {
    return
  }

  isResettingId.value = tool.id
  try {
    const res = await fetch(`/api/v1/ai_text_tools/${tool.id}/reset_analytics`, {
      method: 'PUT',
      headers: {
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (res.ok) {
      showToast(__('Feedback statistics have been reset.'))
      const toolsRes = await fetch('/api/v1/ai_text_tools', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (toolsRes.ok) {
        textTools.value = await toolsRes.json()
      }
    } else {
      showToast(__('Failed to reset feedback statistics.'), true)
    }
  } catch {
    showToast(__('An error occurred while resetting feedback.'), true)
  } finally {
    isResettingId.value = null
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            class="mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-800"
            :aria-label="__('Back to Management Overview')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="size-4" />
          </button>
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
          >
            <CommonIcon name="smart-assist-elaborate" class="size-4" />
          </div>
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
                {{ __('Writing Assistant') }}
              </h1>
              <span
                class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                {{ __('AI Assistance') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'The Writing Assistant helps agents simplify, expand, summarize, and translate ticket replies or notes with customized AI prompts.',
                )
              }}
            </p>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex shrink-0 items-center space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-200 dark:hover:bg-slate-800"
            :aria-label="__('Legal Information')"
            @click="isLegalModalOpen = true"
          >
            <CommonIcon
              name="info-circle"
              class="size-3.5 text-indigo-600 ltr:mr-1.5 rtl:ml-1.5 dark:text-indigo-400"
            />
            {{ __('Legal Information') }}
          </button>

          <!-- Master Switch -->
          <div
            class="flex items-center space-x-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-2xs rtl:space-x-reverse dark:border-slate-800 dark:bg-[#1e293b]"
          >
            <span
              class="text-xs font-semibold"
              :class="
                textToolsEnabled
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
              "
            >
              {{ textToolsEnabled ? __('Enabled') : __('Disabled') }}
            </span>
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
              :class="textToolsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'"
              :disabled="isSavingMaster"
              :aria-label="__('Toggle Writing Assistant feature')"
              @click="toggleWritingAssistantMaster"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="
                  textToolsEnabled
                    ? 'ltr:translate-x-4 rtl:-translate-x-4'
                    : 'ltr:translate-x-0 rtl:translate-x-0'
                "
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback Notifications -->
      <div
        v-if="errorMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="alert-triangle"
            class="size-4 shrink-0 text-red-600 dark:text-red-400"
          />
          <span>{{ errorMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-red-500 hover:text-red-700"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="size-3.5" />
        </button>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="check-circle"
            class="size-4 shrink-0 text-green-600 dark:text-green-400"
          />
          <span>{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-green-500 hover:text-green-700"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="size-3.5" />
        </button>
      </div>

      <!-- Missing Provider Warning -->
      <div
        v-if="textToolsEnabled && !aiProviderEnabled"
        class="mb-6 flex items-start space-x-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 rtl:space-x-reverse dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <CommonIcon
          name="alert-triangle"
          class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div class="text-xs">
          <p class="font-semibold text-amber-900 dark:text-amber-200">
            {{ __('AI Provider Disabled') }}
          </p>
          <p class="mt-0.5 text-amber-700 dark:text-amber-300">
            {{
              __(
                'The provider configuration is disabled. Please set up the provider before proceeding in',
              )
            }}
            <router-link
              to="/manage/ai/provider"
              class="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
            >
              {{ __('AI > Provider') }}
            </router-link>
            .
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-500 shadow-xs dark:border-slate-800 dark:bg-[#1e293b] dark:text-slate-400"
      >
        <CommonIcon name="reload" class="mb-3 size-8 animate-spin text-indigo-600" />
        <p class="text-xs font-medium">{{ __('Loading writing assistant tools...') }}</p>
      </div>

      <!-- Main Tools Table Card -->
      <div
        v-else
        class="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <!-- Table Toolbar -->
        <div
          class="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
        >
          <div class="relative w-full max-w-sm">
            <span
              class="pointer-events-none absolute inset-y-0 flex items-center text-slate-400 ltr:left-3 rtl:right-3"
            >
              <CommonIcon name="search" class="size-4" />
            </span>
            <input
              id="search-writing-tools"
              v-model="searchQuery"
              type="text"
              :aria-label="__('Search writing assistant tools')"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden ltr:pr-3 ltr:pl-9 rtl:pr-9 rtl:pl-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-[#1e293b]"
              :placeholder="__('Search writing assistant tools...')"
            />
          </div>

          <button
            type="button"
            class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-indigo-700 focus:outline-hidden"
            @click="openNewToolModal"
          >
            <CommonIcon name="plus" class="size-4 ltr:mr-1.5 rtl:ml-1.5" />
            {{ __('New Writing Assistant Tool') }}
          </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs rtl:text-right">
            <thead
              class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5">
                  {{ __('Tool Name') }}
                </th>
                <th scope="col" class="px-6 py-3.5">
                  {{ __('Satisfaction') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Active') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-right rtl:text-left">
                  {{ __('Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-if="filteredTools.length === 0">
                <td
                  colspan="4"
                  class="px-6 py-12 text-center text-xs text-slate-400 dark:text-slate-500"
                >
                  <CommonIcon
                    name="smart-assist-elaborate"
                    class="mx-auto mb-2 size-8 text-slate-300 dark:text-slate-600"
                  />
                  <p class="font-medium">
                    {{ __('No writing assistant tools found.') }}
                  </p>
                </td>
              </tr>
              <tr
                v-for="tool in filteredTools"
                :key="tool.id"
                class="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
              >
                <!-- Tool Name & Note -->
                <td class="px-6 py-4">
                  <div class="flex items-start space-x-3 rtl:space-x-reverse">
                    <div
                      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                    >
                      <CommonIcon name="smart-assist-elaborate" class="size-3.5" />
                    </div>
                    <div>
                      <p class="font-semibold text-slate-800 dark:text-slate-100">
                        {{ tool.name }}
                      </p>
                      <p
                        v-if="tool.note"
                        class="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        {{ tool.note }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Satisfaction stats -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div
                    v-if="
                      tool.analytics_stats &&
                      tool.analytics_stats.total &&
                      tool.analytics_stats.total > 0
                    "
                    class="flex items-center space-x-3 rtl:space-x-reverse"
                  >
                    <span
                      class="inline-flex items-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                      :title="__('Positive Feedback')"
                    >
                      <CommonIcon
                        name="thumbs-up"
                        class="size-3.5 text-emerald-500 ltr:mr-1 rtl:ml-1"
                      />
                      {{ tool.analytics_stats.positive?.percent || 0 }}%
                    </span>
                    <span
                      class="inline-flex items-center text-[11px] font-medium text-rose-600 dark:text-rose-400"
                      :title="__('Negative Feedback')"
                    >
                      <CommonIcon
                        name="thumbs-down"
                        class="size-3.5 text-rose-500 ltr:mr-1 rtl:ml-1"
                      />
                      {{ tool.analytics_stats.negative?.percent || 0 }}%
                    </span>
                  </div>
                  <span v-else class="text-slate-400 dark:text-slate-500">-</span>
                </td>

                <!-- Active Toggle -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                    :class="tool.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'"
                    :aria-label="__('Toggle active state for %s', tool.name)"
                    @click="toggleToolActive(tool)"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      :class="
                        tool.active
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-right whitespace-nowrap rtl:text-left">
                  <div
                    class="flex items-center justify-end space-x-1 rtl:justify-start rtl:space-x-reverse"
                  >
                    <!-- Download Feedback Report -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                      :title="__('Download feedback report')"
                      :disabled="isDownloadingId === tool.id"
                      @click="downloadFeedbackReport(tool)"
                    >
                      <CommonIcon
                        v-if="isDownloadingId === tool.id"
                        name="reload"
                        class="size-4 animate-spin text-indigo-600"
                      />
                      <CommonIcon v-else name="download" class="size-4" />
                    </button>

                    <!-- Reset Feedback Timestamp -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-400"
                      :title="__('Reset feedback statistics')"
                      :disabled="isResettingId === tool.id"
                      @click="resetFeedbackTimestamp(tool)"
                    >
                      <CommonIcon
                        v-if="isResettingId === tool.id"
                        name="reload"
                        class="size-4 animate-spin text-amber-600"
                      />
                      <CommonIcon v-else name="reload" class="size-4" />
                    </button>

                    <!-- Edit -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      :title="__('Edit tool')"
                      @click="openEditToolModal(tool)"
                    >
                      <CommonIcon name="edit" class="size-4" />
                    </button>

                    <!-- Delete -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      :title="__('Delete tool')"
                      :disabled="isDeletingId === tool.id"
                      @click="deleteTool(tool)"
                    >
                      <CommonIcon
                        v-if="isDeletingId === tool.id"
                        name="reload"
                        class="size-4 animate-spin text-red-600"
                      />
                      <CommonIcon v-else name="trash" class="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tool Add/Edit Modal -->
    <div
      v-if="isToolModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
            >
              <CommonIcon name="smart-assist-elaborate" class="size-4" />
            </div>
            <h3 class="text-base font-bold text-slate-800 dark:text-white">
              {{ isEditing ? __('Edit Writing Assistant Tool') : __('New Writing Assistant Tool') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="__('Close dialog')"
            @click="isToolModalOpen = false"
          >
            <CommonIcon name="close" class="size-4" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="saveTool">
          <!-- Name -->
          <div>
            <label
              for="tool-form-name"
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('Tool Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="tool-form-name"
              v-model="toolForm.name"
              type="text"
              required
              class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              :placeholder="__('e.g. Expand draft into well-written section')"
            />
          </div>

          <!-- Note -->
          <div>
            <label
              for="tool-form-note"
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('Note / Description') }}
            </label>
            <input
              id="tool-form-note"
              v-model="toolForm.note"
              type="text"
              class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              :placeholder="__('Brief internal description for administrators')"
            />
          </div>

          <!-- Instruction -->
          <div>
            <label
              for="tool-form-instruction"
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('Instruction Prompt') }} <span class="text-red-500">*</span>
            </label>
            <textarea
              id="tool-form-instruction"
              v-model="toolForm.instruction"
              rows="7"
              required
              class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              :placeholder="
                __(
                  'Enter instructions for the AI model on how to process and refine the selected text...',
                )
              "
            />
            <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Standard formatting guidelines and system constraints are automatically enforced in addition to this instruction.',
                )
              }}
            </p>
          </div>

          <!-- Active Toggle -->
          <div
            class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
          >
            <div>
              <span class="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Enable Tool') }}
              </span>
              <span class="text-[11px] text-slate-500 dark:text-slate-400">
                {{ __('Make this writing assistant option selectable in ticket reply composers.') }}
              </span>
            </div>
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
              :class="toolForm.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'"
              :aria-label="__('Toggle active state')"
              @click="toolForm.active = !toolForm.active"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="
                  toolForm.active
                    ? 'ltr:translate-x-4 rtl:-translate-x-4'
                    : 'ltr:translate-x-0 rtl:translate-x-0'
                "
              />
            </button>
          </div>

          <!-- Modal Actions -->
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="isToolModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="submit"
              class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 focus:outline-hidden disabled:opacity-50"
              :disabled="isSavingTool"
            >
              <CommonIcon
                v-if="isSavingTool"
                name="reload"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ isEditing ? __('Save Changes') : __('Create Tool') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Legal Information Modal -->
    <div
      v-if="isLegalModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="info-circle" class="size-5 text-indigo-600 dark:text-indigo-400" />
            <h3 class="text-base font-bold text-slate-800 dark:text-white">
              {{ __('Legal Information') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="__('Close dialog')"
            @click="isLegalModalOpen = false"
          >
            <CommonIcon name="close" class="size-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            {{
              __(
                'This feature leverages artificial intelligence (AI) to generate or support outputs, recommendations, or automated processes. AI systems are probabilistic and may produce results that are incomplete, biased, or contextually inappropriate.',
              )
            }}
          </p>

          <div
            class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/20"
          >
            <h4 class="mb-2 font-bold text-indigo-900 dark:text-indigo-200">
              {{ __('Important Considerations for Admins') }}
            </h4>
            <ul class="list-disc space-y-2 ltr:pl-4 rtl:pr-4">
              <li>
                <strong>{{ __('User Awareness:') }}</strong>
                {{
                  __(
                    'Ensure end users understand that AI outputs require human review, especially for critical decisions (e.g., legal, financial, health, or safety-related).',
                  )
                }}
              </li>
              <li>
                <strong>{{ __('Configuration Responsibility:') }}</strong>
                {{
                  __(
                    "As an admin, you are responsible for configuring this feature in a way that aligns with your organization's policies and compliance requirements.",
                  )
                }}
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            class="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700"
            @click="isLegalModalOpen = false"
          >
            {{ __('Close') }}
          </button>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
