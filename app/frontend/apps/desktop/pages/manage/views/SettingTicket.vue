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
      name?: string
      tag?: string
      options?: Record<string, string>
      display?: string
      null?: boolean
    }>
  }
}

interface UserRecord {
  id: number
  firstname: string
  lastname: string
  email: string
  active?: boolean
}

interface RoleRecord {
  id: number
  name: string
  active?: boolean
}

interface TicketStateRecord {
  id: number
  name: string
  state_type?: { name: string }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Settings') },
  { label: __('Ticket') },
]

const activeTab = ref<'base' | 'number' | 'auto_assignment' | 'language_detection' | 'notifications' | 'duplicate_detection'>('base')
const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isSaving = ref<Record<string, boolean>>({})

const allSettings = ref<Record<string, SettingRecord>>({})
const usersList = ref<UserRecord[]>([])
const rolesList = ref<RoleRecord[]>([])
const ticketStatesList = ref<TicketStateRecord[]>([])
const autoAssignmentConditionStates = ref<number[]>([])

// Base Settings Form
const ticketHook = ref('Ticket#')
const ticketHookPosition = ref('right')
const ticketLastContactBehaviour = ref('check_if_agent_already_replied')
const ticketOrganizationReassignment = ref(true)

// Number Format Form
const ticketNumberFormat = ref('Ticket::Number::Increment')
const incrementMinSize = ref(5)
const incrementChecksum = ref(false)
const dateChecksum = ref(false)

// Auto Assignment Form
const autoAssignmentEnabled = ref(false)
const autoAssignmentIgnoredUserIds = ref<number[]>([])

// Language Detection Form
const languageDetection = ref('')

// Notifications Matrix Form
const notificationMatrix = ref<Record<string, {
  criteria: Record<string, boolean>
  channel: Record<string, boolean>
}>>({
  create: { criteria: { owned_by_me: true, owned_by_nobody: true, subscribed: true }, channel: { email: true, online: true } },
  update: { criteria: { owned_by_me: true, owned_by_nobody: true, subscribed: true }, channel: { email: true, online: true } },
  reminder_reached: { criteria: { owned_by_me: true, owned_by_nobody: false, subscribed: false }, channel: { email: true, online: true } },
  escalation: { criteria: { owned_by_me: true, owned_by_nobody: false, subscribed: false }, channel: { email: true, online: true } },
})
const isApplyingNotificationsToAll = ref(false)

// Duplicate Detection Form
const duplicateDetectionEnabled = ref(false)
const duplicateDetectionAttributes = ref<string[]>([])
const duplicateDetectionTitle = ref('')
const duplicateDetectionBody = ref('')
const duplicateDetectionRoleIds = ref<number[]>([])
const duplicateDetectionShowTickets = ref(true)
const duplicateDetectionPermissionLevel = ref('user')
const duplicateDetectionSearch = ref('all')

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

const fetchAllData = async () => {
  isLoading.value = true
  try {
    const [settingsRes, usersRes, rolesRes, statesRes] = await Promise.all([
      fetch('/api/v1/settings', { headers: { 'Accept': 'application/json' } }),
      fetch('/api/v1/users?per_page=100', { headers: { 'Accept': 'application/json' } }),
      fetch('/api/v1/roles', { headers: { 'Accept': 'application/json' } }),
      fetch('/api/v1/ticket_states', { headers: { 'Accept': 'application/json' } }),
    ])

    if (settingsRes.ok) {
      const data: SettingRecord[] = await settingsRes.json()
      const dict: Record<string, SettingRecord> = {}
      for (const item of data) {
        dict[item.name] = item
      }
      allSettings.value = dict

      // Populate Base
      if (dict.ticket_hook?.state_current?.value !== undefined) {
        ticketHook.value = String(dict.ticket_hook.state_current.value || 'Ticket#')
      }
      if (dict.ticket_hook_position?.state_current?.value !== undefined) {
        ticketHookPosition.value = String(dict.ticket_hook_position.state_current.value || 'right')
      }
      if (dict.ticket_last_contact_behaviour?.state_current?.value !== undefined) {
        ticketLastContactBehaviour.value = String(dict.ticket_last_contact_behaviour.state_current.value || 'check_if_agent_already_replied')
      }
      if (dict.ticket_organization_reassignment?.state_current?.value !== undefined) {
        ticketOrganizationReassignment.value = !!dict.ticket_organization_reassignment.state_current.value
      }

      // Populate Number
      if (dict.ticket_number?.state_current?.value !== undefined) {
        ticketNumberFormat.value = String(dict.ticket_number.state_current.value || 'Ticket::Number::Increment')
      }
      const incVal = dict.ticket_number_increment?.state_current?.value as { min_size?: number; checksum?: boolean } | undefined
      if (incVal) {
        incrementMinSize.value = Number(incVal.min_size || 5)
        incrementChecksum.value = !!incVal.checksum
      }
      const dateVal = dict.ticket_number_date?.state_current?.value as { checksum?: boolean } | undefined
      if (dateVal) {
        dateChecksum.value = !!dateVal.checksum
      }

      // Populate Auto Assignment
      if (dict.ticket_auto_assignment?.state_current?.value !== undefined) {
        autoAssignmentEnabled.value = !!dict.ticket_auto_assignment.state_current.value
      }
      if (Array.isArray(dict.ticket_auto_assignment_user_ids_ignore?.state_current?.value)) {
        autoAssignmentIgnoredUserIds.value = dict.ticket_auto_assignment_user_ids_ignore.state_current.value as number[]
      }
      const selectorVal = dict.ticket_auto_assignment_selector?.state_current?.value as { condition?: Record<string, { operator?: string; value?: unknown }> } | undefined
      if (selectorVal?.condition && selectorVal.condition['ticket.state_id']?.value) {
        const stVal = selectorVal.condition['ticket.state_id'].value
        autoAssignmentConditionStates.value = Array.isArray(stVal) ? stVal.map(Number) : [Number(stVal)]
      }

      // Populate Language Detection
      if (dict.language_detection_article?.state_current?.value !== undefined) {
        languageDetection.value = String(dict.language_detection_article.state_current.value || '')
      }

      // Populate Notifications
      if (dict.ticket_agent_default_notifications?.state_current?.value) {
        notificationMatrix.value = JSON.parse(JSON.stringify(dict.ticket_agent_default_notifications.state_current.value))
      }

      // Populate Duplicate Detection
      if (dict.ticket_duplicate_detection?.state_current?.value !== undefined) {
        duplicateDetectionEnabled.value = !!dict.ticket_duplicate_detection.state_current.value
      }
      if (Array.isArray(dict.ticket_duplicate_detection_attributes?.state_current?.value)) {
        duplicateDetectionAttributes.value = dict.ticket_duplicate_detection_attributes.state_current.value as string[]
      }
      if (dict.ticket_duplicate_detection_title?.state_current?.value !== undefined) {
        duplicateDetectionTitle.value = String(dict.ticket_duplicate_detection_title.state_current.value || '')
      }
      if (dict.ticket_duplicate_detection_body?.state_current?.value !== undefined) {
        duplicateDetectionBody.value = String(dict.ticket_duplicate_detection_body.state_current.value || '')
      }
      if (Array.isArray(dict.ticket_duplicate_detection_role_ids?.state_current?.value)) {
        duplicateDetectionRoleIds.value = dict.ticket_duplicate_detection_role_ids.state_current.value as number[]
      }
      if (dict.ticket_duplicate_detection_show_tickets?.state_current?.value !== undefined) {
        duplicateDetectionShowTickets.value = !!dict.ticket_duplicate_detection_show_tickets.state_current.value
      }
      if (dict.ticket_duplicate_detection_permission_level?.state_current?.value !== undefined) {
        duplicateDetectionPermissionLevel.value = String(dict.ticket_duplicate_detection_permission_level.state_current.value || 'user')
      }
      if (dict.ticket_duplicate_detection_search?.state_current?.value !== undefined) {
        duplicateDetectionSearch.value = String(dict.ticket_duplicate_detection_search.state_current.value || 'all')
      }
    }

    if (usersRes.ok) {
      const uData = await usersRes.json()
      usersList.value = Array.isArray(uData) ? uData : (uData.users || [])
    }

    if (rolesRes.ok) {
      const rData = await rolesRes.json()
      rolesList.value = Array.isArray(rData) ? rData : []
    }

    if (statesRes.ok) {
      const sData = await statesRes.json()
      ticketStatesList.value = Array.isArray(sData) ? sData : []
    }
  } catch {
    showError(__('Failed to load ticket settings.'))
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

// Live Ticket Number Calculation Preview
const ticketNumberPreview = computed(() => {
  const hook = ticketHook.value || 'Ticket#'
  const systemId = String(allSettings.value.system_id?.state_current?.value || '10')

  if (ticketNumberFormat.value === 'Ticket::Number::Date') {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    let num = `${hook}${year}${month}${day}${systemId}00001`
    if (dateChecksum.value) num += '9'
    return num
  }

  // Increment
  let counter = '1'
  const minSize = Math.max(1, incrementMinSize.value - systemId.length - (incrementChecksum.value ? 1 : 0))
  if (minSize > 1) {
    counter = '0'.repeat(minSize - 1) + '1'
  }
  let num = `${hook}${systemId}${counter}`
  if (incrementChecksum.value) num += '9'
  return num
})

const saveNumberFormatSettings = async () => {
  isSaving.value.ticket_number = true
  try {
    await Promise.all([
      saveSetting('ticket_number', ticketNumberFormat.value),
      saveSetting('ticket_number_increment', {
        min_size: Number(incrementMinSize.value),
        checksum: incrementChecksum.value,
      }),
      saveSetting('ticket_number_date', {
        checksum: dateChecksum.value,
      }),
    ])
    showSuccess(__('Ticket number settings saved successfully.'))
  } finally {
    isSaving.value.ticket_number = false
  }
}

// Auto Assignment Actions
const toggleConditionState = (stateId: number) => {
  const cur = [...autoAssignmentConditionStates.value]
  const idx = cur.indexOf(stateId)
  if (idx >= 0) cur.splice(idx, 1)
  else cur.push(stateId)
  autoAssignmentConditionStates.value = cur
}

const toggleIgnoredUser = (userId: number) => {
  const current = [...autoAssignmentIgnoredUserIds.value]
  const idx = current.indexOf(userId)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(userId)
  }
  autoAssignmentIgnoredUserIds.value = current
}

const saveAutoAssignmentSettings = async () => {
  isSaving.value.ticket_auto_assignment = true
  try {
    const conditionPayload: Record<string, unknown> = {}
    if (autoAssignmentConditionStates.value.length > 0) {
      conditionPayload['ticket.state_id'] = {
        operator: 'is',
        value: autoAssignmentConditionStates.value,
      }
    }
    await Promise.all([
      saveSetting('ticket_auto_assignment', autoAssignmentEnabled.value),
      saveSetting('ticket_auto_assignment_selector', { condition: conditionPayload }),
      saveSetting('ticket_auto_assignment_user_ids_ignore', autoAssignmentIgnoredUserIds.value),
    ])
    showSuccess(__('Auto assignment settings saved successfully.'))
  } finally {
    isSaving.value.ticket_auto_assignment = false
  }
}

const resetAutoAssignmentFilter = async () => {
  if (!confirm(__('Are you sure you want to reset auto assignment filters?'))) return
  try {
    autoAssignmentConditionStates.value = []
    autoAssignmentIgnoredUserIds.value = []
    await Promise.all([
      saveSetting('ticket_auto_assignment_selector', {}),
      saveSetting('ticket_auto_assignment_user_ids_ignore', []),
    ])
    showSuccess(__('Auto assignment filters reset successfully.'))
  } catch {
    showError(__('Failed to reset filters.'))
  }
}

// Notifications Actions
const saveNotificationsMatrix = async () => {
  await saveSetting('ticket_agent_default_notifications', notificationMatrix.value)
}

const resetNotificationsToDefault = async () => {
  const setting = allSettings.value.ticket_agent_default_notifications
  if (!setting) return
  if (!confirm(__('Are you sure you want to reset notification settings to system default?'))) return

  try {
    const res = await fetch(`/api/v1/settings/reset/${setting.id}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': getCsrf() },
    })
    if (res.ok) {
      showSuccess(__('Notifications reset to default.'))
      await fetchAllData()
    } else {
      showError(__('Failed to reset notification settings.'))
    }
  } catch {
    showError(__('An error occurred while resetting settings.'))
  }
}

const applyNotificationsToAllAgents = async () => {
  if (!confirm(__('Are you sure? Default notifications settings will be applied to all active agents. This operation may take some time.'))) return

  isApplyingNotificationsToAll.value = true
  try {
    const res = await fetch('/api/v1/settings/ticket_agent_default_notifications/apply_to_all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      showSuccess(__('Default notifications successfully applied to all agents.'))
    } else {
      showError(__('Failed to apply notifications to all agents.'))
    }
  } catch {
    showError(__('An error occurred while applying notifications.'))
  } finally {
    isApplyingNotificationsToAll.value = false
  }
}

// Duplicate Detection Actions
const candidateAttributes = [
  { value: 'title', label: __('Title') },
  { value: 'customer_id', label: __('Customer') },
  { value: 'organization_id', label: __('Organization') },
  { value: 'group_id', label: __('Group') },
  { value: 'article_body', label: __('First Article Body') },
]

const toggleDuplicateAttribute = (attr: string) => {
  const cur = [...duplicateDetectionAttributes.value]
  const idx = cur.indexOf(attr)
  if (idx >= 0) cur.splice(idx, 1)
  else cur.push(attr)
  duplicateDetectionAttributes.value = cur
}

const toggleDuplicateRole = (roleId: number) => {
  const cur = [...duplicateDetectionRoleIds.value]
  const idx = cur.indexOf(roleId)
  if (idx >= 0) cur.splice(idx, 1)
  else cur.push(roleId)
  duplicateDetectionRoleIds.value = cur
}

const saveDuplicateDetectionSettings = async () => {
  isSaving.value.ticket_duplicate_detection = true
  try {
    await Promise.all([
      saveSetting('ticket_duplicate_detection', duplicateDetectionEnabled.value),
      saveSetting('ticket_duplicate_detection_attributes', duplicateDetectionAttributes.value),
      saveSetting('ticket_duplicate_detection_title', duplicateDetectionTitle.value),
      saveSetting('ticket_duplicate_detection_body', duplicateDetectionBody.value),
      saveSetting('ticket_duplicate_detection_role_ids', duplicateDetectionRoleIds.value),
      saveSetting('ticket_duplicate_detection_show_tickets', duplicateDetectionShowTickets.value),
      saveSetting('ticket_duplicate_detection_permission_level', duplicateDetectionPermissionLevel.value),
      saveSetting('ticket_duplicate_detection_search', duplicateDetectionSearch.value),
    ])
    showSuccess(__('Duplicate detection settings saved successfully.'))
  } finally {
    isSaving.value.ticket_duplicate_detection = false
  }
}

const resetDuplicateDetectionFilter = async () => {
  if (!confirm(__('Are you sure you want to reset duplicate detection attributes?'))) return
  try {
    duplicateDetectionAttributes.value = []
    await saveSetting('ticket_duplicate_detection_attributes', [])
    showSuccess(__('Duplicate detection attributes reset successfully.'))
  } catch {
    showError(__('Failed to reset attributes.'))
  }
}

onMounted(() => {
  fetchAllData()
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
            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CommonIcon name="all-tickets" class="w-4 h-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ __('Ticket Settings') }}</h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ __('Configure ticket numbering, auto assignment, duplicate detection, email hook prefixes, and agent notifications.') }}
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
          :class="activeTab === 'number' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'number'"
        >
          {{ __('Number') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'auto_assignment' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'auto_assignment'"
        >
          {{ __('Auto Assignment') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'language_detection' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'language_detection'"
        >
          {{ __('Language Detection') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'notifications' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'notifications'"
        >
          {{ __('Notifications') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'duplicate_detection' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'duplicate_detection'"
        >
          {{ __('Duplicate Detection') }}
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
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Ticket Hook & Subject Matching') }}</h2>

            <!-- Ticket Hook -->
            <div class="space-y-2">
              <label for="setting-ticket-hook" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Ticket Hook') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('The prefix identifier used in email subjects to match follow-up customer replies (e.g. Ticket#, [Case-]).') }}
              </p>
              <div class="flex items-center gap-3">
                <input
                  id="setting-ticket-hook"
                  v-model="ticketHook"
                  type="text"
                  class="w-64 px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.ticket_hook"
                  @click="saveSetting('ticket_hook', ticketHook)"
                >
                  {{ isSaving.ticket_hook ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- Hook Position -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-ticket-hook-pos" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Ticket Hook Position') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Placement of the ticket hook in email subjects.') }}
              </p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-ticket-hook-pos"
                  v-model="ticketHookPosition"
                  class="w-64 px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="right">{{ __('Right - e.g. "Order Help [Ticket#1001]"') }}</option>
                  <option value="left">{{ __('Left - e.g. "[Ticket#1001] Order Help"') }}</option>
                  <option value="none">{{ __('None') }}</option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.ticket_hook_position"
                  @click="saveSetting('ticket_hook_position', ticketHookPosition)"
                >
                  {{ isSaving.ticket_hook_position ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- Last Contact Behaviour -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-2">
              <label for="setting-last-contact" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Ticket Last Contact Behaviour') }}
              </label>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('How the last customer contact timestamp is calculated.') }}
              </p>
              <div class="flex items-center gap-3">
                <select
                  id="setting-last-contact"
                  v-model="ticketLastContactBehaviour"
                  class="max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="check_if_agent_already_replied">
                    {{ __('Use start time of last customer thread (which may consist of multiple articles).') }}
                  </option>
                  <option value="based_on_customer_reaction">
                    {{ __('Use the time of the very last customer article.') }}
                  </option>
                </select>
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isSaving.ticket_last_contact_behaviour"
                  @click="saveSetting('ticket_last_contact_behaviour', ticketLastContactBehaviour)"
                >
                  {{ isSaving.ticket_last_contact_behaviour ? __('Saving...') : __('Save') }}
                </button>
              </div>
            </div>

            <!-- Organization Reassignment -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Organization Reassignment') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Update ticket organization association when customer organization changes.') }}</p>
              </div>
              <input
                id="setting-org-reassignment"
                type="checkbox"
                :checked="ticketOrganizationReassignment"
                :aria-label="__('Organization Reassignment')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="saveSetting('ticket_organization_reassignment', !ticketOrganizationReassignment)"
              />
            </div>
          </div>
        </div>

        <!-- TAB 2: Number Format -->
        <div v-if="activeTab === 'number'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Ticket Number Generator') }}</h2>

            <!-- Live Ticket Number Preview Box -->
            <div class="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-blue-700 dark:text-blue-300">{{ __('Current Sample Output') }}</p>
                <p class="text-lg font-mono font-bold text-blue-900 dark:text-blue-100 tracking-wide mt-0.5">{{ ticketNumberPreview }}</p>
              </div>
              <span class="text-xs text-blue-600 dark:text-blue-400 font-medium px-3 py-1 bg-white/60 dark:bg-[#0f172a]/60 rounded-lg">
                {{ __('Dynamic Preview') }}
              </span>
            </div>

            <!-- Format Selector -->
            <div class="space-y-2">
              <label for="setting-ticket-number-format" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                {{ __('Number Pattern') }}
              </label>
              <select
                id="setting-ticket-number-format"
                v-model="ticketNumberFormat"
                class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="Ticket::Number::Increment">{{ __('Increment (SystemID.Counter)') }}</option>
                <option value="Ticket::Number::Date">{{ __('Date (Year.Month.Day.SystemID.Counter)') }}</option>
              </select>
            </div>

            <!-- Increment Sub-options -->
            <div v-if="ticketNumberFormat === 'Ticket::Number::Increment'" class="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center justify-between">
                <div>
                  <label for="setting-increment-min-size" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                    {{ __('Min. Size of Number') }}
                  </label>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Minimum total number of digits (padded with zeros).') }}</p>
                </div>
                <input
                  id="setting-increment-min-size"
                  v-model.number="incrementMinSize"
                  type="number"
                  min="1"
                  max="20"
                  class="w-24 px-3 py-1.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 text-center"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Checksum Digit') }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Append an algorithmic verification checksum digit to the end of the number.') }}</p>
                </div>
                <input
                  id="setting-increment-checksum"
                  v-model="incrementChecksum"
                  type="checkbox"
                  :aria-label="__('Checksum Digit')"
                  class="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <!-- Date Sub-options -->
            <div v-if="ticketNumberFormat === 'Ticket::Number::Date'" class="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Checksum Digit') }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Append a verification checksum digit.') }}</p>
                </div>
                <input
                  id="setting-date-checksum"
                  v-model="dateChecksum"
                  type="checkbox"
                  :aria-label="__('Checksum Digit')"
                  class="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.ticket_number"
                @click="saveNumberFormatSettings"
              >
                {{ isSaving.ticket_number ? __('Saving...') : __('Save Number Settings') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 3: Auto Assignment -->
        <div v-if="activeTab === 'auto_assignment'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Auto Assignment') }}</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {{ __('Automatically assign open unassigned tickets to available agents when they view or answer them.') }}
                </p>
              </div>
              <input
                id="setting-auto-assignment-toggle"
                type="checkbox"
                :checked="autoAssignmentEnabled"
                :aria-label="__('Auto Assignment')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="saveSetting('ticket_auto_assignment', !autoAssignmentEnabled); autoAssignmentEnabled = !autoAssignmentEnabled"
              />
            </div>

            <!-- Conditions for Affected Objects (ticket_auto_assignment_selector) -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Conditions for Affected Objects') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Select which ticket states allow automatic assignment. If none selected, applies to all open ticket states.') }}
              </p>

              <div class="flex flex-wrap gap-2 pt-1">
                <button
                  v-for="st in ticketStatesList"
                  :key="st.id"
                  type="button"
                  class="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                  :class="autoAssignmentConditionStates.includes(st.id) ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
                  @click="toggleConditionState(st.id)"
                >
                  <CommonIcon v-if="autoAssignmentConditionStates.includes(st.id)" name="check2" class="w-3 h-3 inline ltr:mr-1 rtl:ml-1" />
                  <span>{{ st.name }}</span>
                </button>
              </div>
            </div>

            <!-- Excepted Users -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Excepted Users') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Tickets will not be automatically assigned to the following selected users.') }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 max-h-60 overflow-y-auto">
                <label
                  v-for="user in usersList"
                  :key="user.id"
                  class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="autoAssignmentIgnoredUserIds.includes(user.id)"
                    :aria-label="`${user.firstname} ${user.lastname}`"
                    class="w-4 h-4 accent-blue-600 cursor-pointer"
                    @change="toggleIgnoredUser(user.id)"
                  />
                  <div class="text-xs truncate">
                    <p class="font-medium text-slate-800 dark:text-slate-200 truncate">{{ user.firstname }} {{ user.lastname }}</p>
                    <p class="text-[11px] text-slate-400 truncate">{{ user.email }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Auto Assignment Actions -->
            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.ticket_auto_assignment"
                @click="saveAutoAssignmentSettings"
              >
                {{ isSaving.ticket_auto_assignment ? __('Saving...') : __('Save Auto Assignment') }}
              </button>
              <button
                type="button"
                class="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                @click="resetAutoAssignmentFilter"
              >
                {{ __('Reset Filter') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 4: Language Detection -->
        <div v-if="activeTab === 'language_detection'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Article Language Detection') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Detect the language of inbound ticket articles automatically to route tickets or trigger language-specific automated workflows.') }}
            </p>

            <div class="flex items-center gap-3">
              <select
                id="setting-language-detection"
                v-model="languageDetection"
                class="w-full max-w-md px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="">{{ __('- Disabled -') }}</option>
                <option value="cld">{{ __('Compact Language Detector (CLD)') }}</option>
              </select>
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.language_detection_article"
                @click="saveSetting('language_detection_article', languageDetection)"
              >
                {{ isSaving.language_detection_article ? __('Saving...') : __('Save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 5: Notifications Matrix -->
        <div v-if="activeTab === 'notifications'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Agent Default Notifications Matrix') }}</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {{ __('Define which notification events are triggered for agents by default.') }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  @click="resetNotificationsToDefault"
                >
                  {{ __('Reset to Default') }}
                </button>
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  :disabled="isApplyingNotificationsToAll"
                  @click="applyNotificationsToAllAgents"
                >
                  {{ isApplyingNotificationsToAll ? __('Applying...') : __('Apply to All Active Agents') }}
                </button>
              </div>
            </div>

            <!-- Matrix Table -->
            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead class="bg-slate-50 dark:bg-[#1e293b]/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th class="px-4 py-3">{{ __('Event') }}</th>
                    <th class="px-4 py-3 text-center">{{ __('Owned by me') }}</th>
                    <th class="px-4 py-3 text-center">{{ __('Unassigned') }}</th>
                    <th class="px-4 py-3 text-center">{{ __('Subscribed') }}</th>
                    <th class="px-4 py-3 text-center">{{ __('Email') }}</th>
                    <th class="px-4 py-3 text-center">{{ __('Online / In-App') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr v-for="(cfg, eventKey) in notificationMatrix" :key="eventKey" class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {{ eventKey.replace('_', ' ') }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <input
                        :id="'matrix-owned-' + eventKey"
                        v-model="cfg.criteria.owned_by_me"
                        type="checkbox"
                        :aria-label="__('Owned by me')"
                        class="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <input
                        :id="'matrix-unassigned-' + eventKey"
                        v-model="cfg.criteria.owned_by_nobody"
                        type="checkbox"
                        :aria-label="__('Unassigned')"
                        class="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <input
                        :id="'matrix-subscribed-' + eventKey"
                        v-model="cfg.criteria.subscribed"
                        type="checkbox"
                        :aria-label="__('Subscribed')"
                        class="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <input
                        :id="'matrix-email-' + eventKey"
                        v-model="cfg.channel.email"
                        type="checkbox"
                        :aria-label="__('Email channel')"
                        class="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <input
                        :id="'matrix-online-' + eventKey"
                        v-model="cfg.channel.online"
                        type="checkbox"
                        :aria-label="__('Online channel')"
                        class="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.ticket_agent_default_notifications"
                @click="saveNotificationsMatrix"
              >
                {{ isSaving.ticket_agent_default_notifications ? __('Saving...') : __('Save Notifications Matrix') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 6: Duplicate Detection -->
        <div v-if="activeTab === 'duplicate_detection'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Duplicate Detection') }}</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {{ __('Warn agents when creating or working on tickets that have identical or highly similar attributes.') }}
                </p>
              </div>
              <input
                id="setting-duplicate-detection-toggle"
                v-model="duplicateDetectionEnabled"
                type="checkbox"
                :aria-label="__('Duplicate Detection')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>

            <!-- Comparison Attributes -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Attributes to Compare') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Select which ticket attributes are checked for similarity.') }}
              </p>
              <div class="flex flex-wrap gap-2 pt-1">
                <button
                  v-for="attr in candidateAttributes"
                  :key="attr.value"
                  type="button"
                  class="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                  :class="duplicateDetectionAttributes.includes(attr.value) ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
                  @click="toggleDuplicateAttribute(attr.value)"
                >
                  <CommonIcon v-if="duplicateDetectionAttributes.includes(attr.value)" name="check2" class="w-3 h-3 inline ltr:mr-1 rtl:ml-1" />
                  <span>{{ attr.label }}</span>
                </button>
              </div>
            </div>

            <!-- Warning Title & Body -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <div class="space-y-1.5">
                <label for="setting-duplicate-title" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Warning Title') }}
                </label>
                <input
                  id="setting-duplicate-title"
                  v-model="duplicateDetectionTitle"
                  type="text"
                  class="w-full max-w-md px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div class="space-y-1.5">
                <label for="setting-duplicate-body" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Warning Message') }}
                </label>
                <textarea
                  id="setting-duplicate-body"
                  v-model="duplicateDetectionBody"
                  rows="3"
                  class="w-full max-w-lg px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <!-- Roles with access -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Roles with Duplicate Warnings') }}</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="role in rolesList"
                  :key="role.id"
                  type="button"
                  class="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                  :class="duplicateDetectionRoleIds.includes(role.id) ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
                  @click="toggleDuplicateRole(role.id)"
                >
                  <CommonIcon v-if="duplicateDetectionRoleIds.includes(role.id)" name="check2" class="w-3 h-3 inline ltr:mr-1 rtl:ml-1" />
                  <span>{{ role.name }}</span>
                </button>
              </div>
            </div>

            <!-- Search scope and ticket preview -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="setting-duplicate-scope" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {{ __('Search States') }}
                </label>
                <select
                  id="setting-duplicate-scope"
                  v-model="duplicateDetectionSearch"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">{{ __('All Tickets') }}</option>
                  <option value="open">{{ __('Open Tickets Only') }}</option>
                </select>
              </div>

              <div class="flex items-center justify-between pt-4">
                <div>
                  <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">{{ __('Show Matching Tickets') }}</p>
                  <p class="text-[11px] text-slate-400">{{ __('Render list of matched tickets directly in the alert dialog.') }}</p>
                </div>
                <input
                  id="setting-duplicate-show-tickets"
                  v-model="duplicateDetectionShowTickets"
                  type="checkbox"
                  :aria-label="__('Show Matching Tickets')"
                  class="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                :disabled="isSaving.ticket_duplicate_detection"
                @click="saveDuplicateDetectionSettings"
              >
                {{ isSaving.ticket_duplicate_detection ? __('Saving...') : __('Save Duplicate Detection Settings') }}
              </button>
              <button
                type="button"
                class="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                @click="resetDuplicateDetectionFilter"
              >
                {{ __('Reset to Default') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
