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

interface SummaryConfig {
  open_questions?: boolean
  upcoming_events?: boolean
  customer_sentiment?: boolean
  generate_on?: 'on_ticket_detail_opening' | 'on_ticket_summary_sidebar_activation'
}

interface SelectorConditionRow {
  id: string
  attribute: string
  operator: 'is' | 'is_not'
  value: string
}

interface SelectOption {
  id: number | string
  name: string
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('AI') },
  { label: __('Ticket Summary') },
]

const getCsrf = () =>
  (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''

const isLoading = ref(true)
const isSavingMaster = ref(false)
const isSavingConfig = ref(false)
const isSavingSelector = ref(false)
const isResettingSelector = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const allSettings = ref<Record<string, SettingRecord>>({})
const priorities = ref<SelectOption[]>([])
const states = ref<SelectOption[]>([])
const groups = ref<SelectOption[]>([])

const ticketSummaryEnabled = ref(false)
const aiProviderEnabled = ref(false)

const summaryConfig = ref<SummaryConfig>({
  open_questions: false,
  upcoming_events: false,
  customer_sentiment: true,
  generate_on: 'on_ticket_detail_opening',
})

const selectorConditions = ref<SelectorConditionRow[]>([])
const isLegalModalOpen = ref(false)

const supportedAttributes = computed(() => [
  { value: 'ticket.priority_id', label: __('Priority') },
  { value: 'ticket.state_id', label: __('State') },
  { value: 'ticket.group_id', label: __('Group') },
  { value: 'ticket.type_id', label: __('Type') },
  { value: 'custom', label: __('Custom attribute...') },
])

const conditionOperators = computed(() => [
  { value: 'is', label: __('is') },
  { value: 'is_not', label: __('is not') },
])

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
    const [settingsRes, prioritiesRes, statesRes, groupsRes] = await Promise.all([
      fetch('/api/v1/settings', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/ticket_priorities', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/ticket_states', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/groups', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (settingsRes.ok) {
      const settingsList: SettingRecord[] = await settingsRes.json()
      const dict: Record<string, SettingRecord> = {}
      settingsList.forEach((s) => {
        dict[s.name] = s
      })
      allSettings.value = dict

      // Master switch
      ticketSummaryEnabled.value = !!dict.ai_assistance_ticket_summary?.state_current?.value
      // AI provider enabled
      aiProviderEnabled.value = !!dict.ai_provider?.state_current?.value

      // Config
      const currentConfig = dict.ai_assistance_ticket_summary_config?.state_current
        ?.value as SummaryConfig | null
      if (currentConfig && typeof currentConfig === 'object') {
        summaryConfig.value = {
          open_questions: !!currentConfig.open_questions,
          upcoming_events: !!currentConfig.upcoming_events,
          customer_sentiment:
            currentConfig.customer_sentiment !== undefined
              ? !!currentConfig.customer_sentiment
              : true,
          generate_on: currentConfig.generate_on || 'on_ticket_detail_opening',
        }
      }

      // Selector condition
      const currentSelector = dict.ai_assistance_ticket_summary_selector?.state_current?.value as {
        condition?: Record<string, { operator: 'is' | 'is_not'; value: string[] | string }>
      } | null

      if (currentSelector?.condition && typeof currentSelector.condition === 'object') {
        const rows: SelectorConditionRow[] = []
        Object.entries(currentSelector.condition).forEach(([attr, cond]) => {
          if (cond && typeof cond === 'object') {
            const rawVal = cond.value
            const stringVal = Array.isArray(rawVal) ? rawVal[0] || '' : String(rawVal || '')
            rows.push({
              id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              attribute: attr,
              operator: cond.operator || 'is',
              value: stringVal,
            })
          }
        })
        selectorConditions.value = rows
      } else {
        selectorConditions.value = []
      }
    }

    if (prioritiesRes.ok) {
      const pData = await prioritiesRes.json()
      priorities.value = Array.isArray(pData) ? pData : []
    }

    if (statesRes.ok) {
      const sData = await statesRes.json()
      states.value = Array.isArray(sData) ? sData : []
    }

    if (groupsRes.ok) {
      const gData = await groupsRes.json()
      groups.value = Array.isArray(gData) ? gData : []
    }
  } catch (err: unknown) {
    showToast(
      err instanceof Error ? err.message : __('Failed to load ticket summary settings.'),
      true,
    )
  } finally {
    isLoading.value = false
  }
}

const saveSettingRecord = async (name: string, value: unknown): Promise<boolean> => {
  const setting = allSettings.value[name]
  if (!setting) {
    showToast(__('Setting "%s" not found in system.', name), true)
    return false
  }

  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        state_current: { value },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || __('Failed to update setting "%s".', name), true)
      return false
    }

    const updated: SettingRecord = await res.json()
    allSettings.value[name] = updated
    return true
  } catch {
    showToast(__('An error occurred while saving "%s".', name), true)
    return false
  }
}

const toggleTicketSummaryMaster = async () => {
  const nextVal = !ticketSummaryEnabled.value
  isSavingMaster.value = true
  const success = await saveSettingRecord('ai_assistance_ticket_summary', nextVal)
  if (success) {
    ticketSummaryEnabled.value = nextVal
    showToast(
      nextVal
        ? __('Ticket Summary feature has been enabled.')
        : __('Ticket Summary feature has been disabled.'),
    )
  }
  isSavingMaster.value = false
}

const toggleServiceOption = async (
  key: 'open_questions' | 'upcoming_events' | 'customer_sentiment',
) => {
  const nextVal = !summaryConfig.value[key]
  summaryConfig.value[key] = nextVal

  const payload: SummaryConfig = {
    open_questions: summaryConfig.value.open_questions,
    upcoming_events: summaryConfig.value.upcoming_events,
    customer_sentiment: summaryConfig.value.customer_sentiment,
    generate_on: summaryConfig.value.generate_on,
  }

  isSavingConfig.value = true
  const success = await saveSettingRecord('ai_assistance_ticket_summary_config', payload)
  if (success) {
    showToast(__('Summary services configuration updated.'))
  }
  isSavingConfig.value = false
}

const selectGenerationMode = async (
  mode: 'on_ticket_detail_opening' | 'on_ticket_summary_sidebar_activation',
) => {
  if (summaryConfig.value.generate_on === mode) return
  summaryConfig.value.generate_on = mode

  const payload: SummaryConfig = {
    open_questions: summaryConfig.value.open_questions,
    upcoming_events: summaryConfig.value.upcoming_events,
    customer_sentiment: summaryConfig.value.customer_sentiment,
    generate_on: mode,
  }

  isSavingConfig.value = true
  const success = await saveSettingRecord('ai_assistance_ticket_summary_config', payload)
  if (success) {
    showToast(__('Generation timing updated successfully.'))
  }
  isSavingConfig.value = false
}

const addSelectorCondition = () => {
  selectorConditions.value.push({
    id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    attribute: 'ticket.priority_id',
    operator: 'is',
    value: priorities.value[0] ? String(priorities.value[0].id) : '',
  })
}

const removeSelectorCondition = (index: number) => {
  selectorConditions.value.splice(index, 1)
}

const saveSelector = async () => {
  isSavingSelector.value = true

  const conditionMap: Record<string, { operator: 'is' | 'is_not'; value: string[] }> = {}
  selectorConditions.value.forEach((row) => {
    const trimmedAttr = row.attribute.trim()
    if (trimmedAttr) {
      conditionMap[trimmedAttr] = {
        operator: row.operator,
        value: row.value ? [row.value] : [],
      }
    }
  })

  const payload = Object.keys(conditionMap).length > 0 ? { condition: conditionMap } : {}

  const success = await saveSettingRecord('ai_assistance_ticket_summary_selector', payload)
  if (success) {
    showToast(__('Ticket summary selector filter saved.'))
  }
  isSavingSelector.value = false
}

const resetSelector = async () => {
  isResettingSelector.value = true
  const success = await saveSettingRecord('ai_assistance_ticket_summary_selector', {})
  if (success) {
    selectorConditions.value = []
    showToast(__('Ticket summary selector filter reset. All tickets will be eligible.'))
  }
  isResettingSelector.value = false
}

const getValueOptionsForAttribute = (attribute: string): SelectOption[] | null => {
  if (attribute === 'ticket.priority_id') return priorities.value
  if (attribute === 'ticket.state_id') return states.value
  if (attribute === 'ticket.group_id') return groups.value
  return null
}

onMounted(() => {
  fetchAllData()
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Unboxed Header -->
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
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
          >
            <CommonIcon name="magic" class="size-4" />
          </div>
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
                {{ __('Ticket Summary') }}
              </h1>
              <span
                class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
              >
                {{ __('AI Assistance') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Ticket Summary provides the functionality to summarize the current ticket state. It will provide a new sidebar which contains information to reduce reading time in the ticket with a summarized version of the problem, open questions and upcoming events.',
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
              class="size-3.5 text-purple-600 ltr:mr-1.5 rtl:ml-1.5 dark:text-purple-400"
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
                ticketSummaryEnabled
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-500 dark:text-slate-400'
              "
            >
              {{ ticketSummaryEnabled ? __('Enabled') : __('Disabled') }}
            </span>
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
              :class="ticketSummaryEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'"
              :disabled="isSavingMaster"
              :aria-label="__('Toggle Ticket Summary feature')"
              @click="toggleTicketSummaryMaster"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="
                  ticketSummaryEnabled
                    ? 'ltr:translate-x-4 rtl:-translate-x-4'
                    : 'ltr:translate-x-0 rtl:translate-x-0'
                "
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Toast Feedback Notifications -->
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
          class="cursor-pointer text-xs font-bold text-red-700 hover:text-red-900 dark:text-red-300"
          :aria-label="__('Dismiss error')"
          @click="errorMessage = ''"
        >
          &times;
        </button>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon name="check" class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          :aria-label="__('Dismiss notification')"
          @click="successMessage = ''"
        >
          &times;
        </button>
      </div>

      <!-- Missing Provider Warning Alert -->
      <div
        v-if="ticketSummaryEnabled && !aiProviderEnabled"
        class="mb-6 flex items-start space-x-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
      >
        <CommonIcon
          name="alert-triangle"
          class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div class="space-y-1 text-xs">
          <p class="font-semibold">
            {{ __('AI Provider Configuration Disabled or Missing') }}
          </p>
          <p>
            {{
              __(
                'The provider configuration is disabled. Please set up the provider before proceeding in AI > Providers.',
              )
            }}
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <CommonIcon name="loading" class="size-8 animate-spin text-purple-600" />
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {{ __('Loading Ticket Summary settings...') }}
        </p>
      </div>

      <!-- Main Settings Grid -->
      <div v-else class="space-y-6">
        <!-- Card 1: Summary Services -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800"
          >
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Summary Services') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Select which analytical sections should be synthesized by the AI when generating summaries.',
                  )
                }}
              </p>
            </div>
            <span
              v-if="isSavingConfig"
              class="inline-flex items-center text-xs text-purple-600 dark:text-purple-400"
            >
              <CommonIcon name="loading" class="size-3.5 animate-spin ltr:mr-1 rtl:ml-1" />
              {{ __('Saving...') }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Customer Intent (Mandatory Core) -->
            <div
              class="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Customer Intent') }}
                  </span>
                  <span
                    class="text-3xs rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {{ __('Core Service') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Provide a summary of the problem the customer needs to get resolved.') }}
                </p>
              </div>
              <div class="text-2xs mt-4 flex items-center justify-between text-slate-400">
                <span>{{ __('Always active') }}</span>
                <CommonIcon name="check" class="size-4 text-emerald-500" />
              </div>
            </div>

            <!-- Conversation Summary (Mandatory Core) -->
            <div
              class="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Conversation Summary') }}
                  </span>
                  <span
                    class="text-3xs rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {{ __('Core Service') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __('Provide a summary of the conversation between customer and support agent.')
                  }}
                </p>
              </div>
              <div class="text-2xs mt-4 flex items-center justify-between text-slate-400">
                <span>{{ __('Always active') }}</span>
                <CommonIcon name="check" class="size-4 text-emerald-500" />
              </div>
            </div>

            <!-- Open Questions -->
            <div
              class="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-300 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-purple-700"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Open Questions') }}
                  </span>
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
                    :class="
                      summaryConfig.open_questions
                        ? 'bg-purple-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    "
                    :disabled="isSavingConfig"
                    :aria-label="__('Toggle Open Questions summary')"
                    @click="toggleServiceOption('open_questions')"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      :class="
                        summaryConfig.open_questions
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Provide a summary of the questions raised in the conversation.') }}
                </p>
              </div>
              <div class="text-2xs mt-4">
                <span
                  :class="
                    summaryConfig.open_questions
                      ? 'font-semibold text-purple-600 dark:text-purple-400'
                      : 'text-slate-400'
                  "
                >
                  {{ summaryConfig.open_questions ? __('Enabled') : __('Disabled') }}
                </span>
              </div>
            </div>

            <!-- Upcoming Events -->
            <div
              class="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-300 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-purple-700"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Upcoming Events') }}
                  </span>
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
                    :class="
                      summaryConfig.upcoming_events
                        ? 'bg-purple-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    "
                    :disabled="isSavingConfig"
                    :aria-label="__('Toggle Upcoming Events summary')"
                    @click="toggleServiceOption('upcoming_events')"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      :class="
                        summaryConfig.upcoming_events
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Provide a summary of the upcoming events based on the conversation.') }}
                </p>
              </div>
              <div class="text-2xs mt-4">
                <span
                  :class="
                    summaryConfig.upcoming_events
                      ? 'font-semibold text-purple-600 dark:text-purple-400'
                      : 'text-slate-400'
                  "
                >
                  {{ summaryConfig.upcoming_events ? __('Enabled') : __('Disabled') }}
                </span>
              </div>
            </div>

            <!-- Customer Sentiment -->
            <div
              class="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-300 md:col-span-2 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-purple-700"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Customer Sentiment') }}
                  </span>
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
                    :class="
                      summaryConfig.customer_sentiment
                        ? 'bg-purple-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    "
                    :disabled="isSavingConfig"
                    :aria-label="__('Toggle Customer Sentiment assessment')"
                    @click="toggleServiceOption('customer_sentiment')"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      :class="
                        summaryConfig.customer_sentiment
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __('Provide an assessment of the customer sentiment based on the conversation.')
                  }}
                </p>
              </div>
              <div class="text-2xs mt-4">
                <span
                  :class="
                    summaryConfig.customer_sentiment
                      ? 'font-semibold text-purple-600 dark:text-purple-400'
                      : 'text-slate-400'
                  "
                >
                  {{ summaryConfig.customer_sentiment ? __('Enabled') : __('Disabled') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Summary Selector -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
          >
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Summary Selector') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Defines which tickets can use the ticket summary sidebar.') }}
              </p>
            </div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                :aria-label="__('Add Condition')"
                @click="addSelectorCondition"
              >
                <CommonIcon name="plus" class="size-3.5 ltr:mr-1 rtl:ml-1" />
                {{ __('Add Condition') }}
              </button>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-2xs hover:bg-red-50 focus:outline-hidden disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                :disabled="isResettingSelector || selectorConditions.length === 0"
                :aria-label="__('Reset Conditions')"
                @click="resetSelector"
              >
                <CommonIcon
                  v-if="isResettingSelector"
                  name="loading"
                  class="size-3.5 animate-spin ltr:mr-1 rtl:ml-1"
                />
                {{ __('Reset') }}
              </button>
            </div>
          </div>

          <!-- Empty state when no conditions -->
          <div
            v-if="selectorConditions.length === 0"
            class="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700"
          >
            <CommonIcon name="check" class="mx-auto size-6 text-emerald-500" />
            <p class="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              {{ __('Enabled for All Tickets') }}
            </p>
            <p class="text-2xs mt-1 text-slate-500 dark:text-slate-400">
              {{
                __(
                  'No conditions are currently applied. The AI ticket summary sidebar is available across all tickets in the system.',
                )
              }}
            </p>
            <button
              type="button"
              class="mt-3 inline-flex cursor-pointer items-center text-xs font-medium text-purple-600 hover:underline dark:text-purple-400"
              @click="addSelectorCondition"
            >
              {{ __('+ Restrict to specific tickets') }}
            </button>
          </div>

          <!-- Conditions List -->
          <div v-else class="space-y-3">
            <div
              v-for="(cond, index) in selectorConditions"
              :key="cond.id"
              class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-900/40"
            >
              <!-- Attribute -->
              <div class="flex-1">
                <select
                  v-model="cond.attribute"
                  :aria-label="__('Ticket Attribute')"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option v-for="attr in supportedAttributes" :key="attr.value" :value="attr.value">
                    {{ attr.label }}
                  </option>
                </select>
              </div>

              <!-- Operator -->
              <div class="w-full sm:w-32">
                <select
                  v-model="cond.operator"
                  :aria-label="__('Condition Operator')"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option v-for="op in conditionOperators" :key="op.value" :value="op.value">
                    {{ op.label }}
                  </option>
                </select>
              </div>

              <!-- Value -->
              <div class="flex-1">
                <!-- Dropdown when known attribute options are available -->
                <select
                  v-if="getValueOptionsForAttribute(cond.attribute)"
                  v-model="cond.value"
                  :aria-label="__('Target Value')"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option
                    v-for="opt in getValueOptionsForAttribute(cond.attribute)"
                    :key="opt.id"
                    :value="String(opt.id)"
                  >
                    {{ opt.name }}
                  </option>
                </select>

                <!-- Free text input for custom attributes -->
                <input
                  v-else
                  v-model="cond.value"
                  type="text"
                  :aria-label="__('Target Value')"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  :placeholder="__('Enter target value')"
                />
              </div>

              <!-- Remove -->
              <button
                type="button"
                class="cursor-pointer self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 sm:self-auto dark:hover:bg-red-950/30 dark:hover:text-red-400"
                :aria-label="__('Remove condition')"
                @click="removeSelectorCondition(index)"
              >
                <CommonIcon name="trash" class="size-4" />
              </button>
            </div>

            <!-- Save Selector Button -->
            <div class="mt-4 flex items-center justify-end space-x-2 rtl:space-x-reverse">
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-hidden disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
                :disabled="isSavingSelector"
                :aria-label="__('Save Selector')"
                @click="saveSelector"
              >
                <CommonIcon
                  v-if="isSavingSelector"
                  name="loading"
                  class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ __('Save Selector') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Card 3: Summary Generation Mode -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-5 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Summary Generation') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Defines global configuration when the summary will be generated in the ticket zoom.',
                )
              }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Option 1: On ticket detail opening -->
            <div
              class="flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all"
              :class="
                summaryConfig.generate_on === 'on_ticket_detail_opening'
                  ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20 dark:border-purple-500 dark:bg-purple-950/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-[#1e293b] dark:hover:border-slate-600'
              "
              role="button"
              tabindex="0"
              @click="selectGenerationMode('on_ticket_detail_opening')"
              @keydown.enter="selectGenerationMode('on_ticket_detail_opening')"
              @keydown.space.prevent="selectGenerationMode('on_ticket_detail_opening')"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('On ticket detail opening') }}
                  </span>
                  <div
                    class="flex size-4 items-center justify-center rounded-full border"
                    :class="
                      summaryConfig.generate_on === 'on_ticket_detail_opening'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-800'
                    "
                  >
                    <div
                      v-if="summaryConfig.generate_on === 'on_ticket_detail_opening'"
                      class="size-1.5 rounded-full bg-white"
                    />
                  </div>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'Generates the summary in the background as soon as an agent opens the ticket zoom page.',
                    )
                  }}
                </p>
              </div>
              <div class="text-2xs mt-4 text-slate-400">
                <span>{{ __('Immediate preparation') }}</span>
              </div>
            </div>

            <!-- Option 2: On ticket summary sidebar activation -->
            <div
              class="flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all"
              :class="
                summaryConfig.generate_on === 'on_ticket_summary_sidebar_activation'
                  ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20 dark:border-purple-500 dark:bg-purple-950/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-[#1e293b] dark:hover:border-slate-600'
              "
              role="button"
              tabindex="0"
              @click="selectGenerationMode('on_ticket_summary_sidebar_activation')"
              @keydown.enter="selectGenerationMode('on_ticket_summary_sidebar_activation')"
              @keydown.space.prevent="selectGenerationMode('on_ticket_summary_sidebar_activation')"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('On ticket summary sidebar activation') }}
                  </span>
                  <div
                    class="flex size-4 items-center justify-center rounded-full border"
                    :class="
                      summaryConfig.generate_on === 'on_ticket_summary_sidebar_activation'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-800'
                    "
                  >
                    <div
                      v-if="summaryConfig.generate_on === 'on_ticket_summary_sidebar_activation'"
                      class="size-1.5 rounded-full bg-white"
                    />
                  </div>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'Generates the summary only when an agent actively opens the Ticket Summary sidebar tab. Saves API token quota.',
                    )
                  }}
                </p>
              </div>
              <div class="text-2xs mt-4 text-slate-400">
                <span>{{ __('On-demand quota saving') }}</span>
              </div>
            </div>
          </div>

          <div
            class="mt-5 flex items-center space-x-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 rtl:space-x-reverse dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          >
            <CommonIcon
              name="info-circle"
              class="size-4 shrink-0 text-purple-600 dark:text-purple-400"
            />
            <span>
              {{ __('You can overwrite this setting for specific groups in the') }}
              <router-link
                to="/manage/groups"
                class="font-semibold text-purple-600 hover:underline dark:text-purple-400"
              >
                {{ __('Group Manager') }} </router-link
              >.
            </span>
          </div>
        </div>
      </div>

      <!-- Legal Information Modal -->
      <div
        v-if="isLegalModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Legal Information')"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2.5 rtl:space-x-reverse">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400"
              >
                <CommonIcon name="info-circle" class="size-5" />
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white">
                  {{ __('Legal Information') }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ __('Important considerations for AI Assistance features') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              :aria-label="__('Close dialog')"
              @click="isLegalModalOpen = false"
            >
              <CommonIcon name="close" class="size-5" />
            </button>
          </div>

          <div class="mt-4 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
            <p>
              {{
                __(
                  'This feature leverages artificial intelligence (AI) to generate or support outputs, recommendations, or automated processes. AI systems are probabilistic and may produce results that are incomplete, biased, or contextually inappropriate.',
                )
              }}
            </p>

            <div
              class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/50"
            >
              <h4 class="font-bold text-slate-800 dark:text-white">
                {{ __('Important Considerations for Admins') }}
              </h4>
              <ul class="mt-2 list-disc space-y-2 ltr:pl-4 rtl:pr-4">
                <li>
                  <strong class="text-slate-800 dark:text-slate-200"
                    >{{ __('User Awareness') }}:</strong
                  >
                  {{
                    __(
                      'Ensure end users understand that AI outputs require human review, especially for critical decisions (e.g., legal, financial, health, or safety-related).',
                    )
                  }}
                </li>
                <li>
                  <strong class="text-slate-800 dark:text-slate-200"
                    >{{ __('Configuration Responsibility') }}:</strong
                  >
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
              class="cursor-pointer rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 focus:outline-hidden dark:bg-purple-600 dark:hover:bg-purple-500"
              :aria-label="__('Close')"
              @click="isLegalModalOpen = false"
            >
              {{ __('Understood') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
