<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { i18n } from '#shared/i18n.ts'
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import {
  conditionFields,
  conditionStateProblems,
  conditionToState,
  emptyConditionState,
  stateRows,
  stateToCondition,
  type AutomationOptions,
  type ConditionState,
} from '#desktop/pages/manage/components/Automation/automation.ts'
import AutomationConditions from '#desktop/pages/manage/components/Automation/AutomationConditions.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

interface SlaItem {
  id: number
  name: string
  calendar_id?: number | null
  first_response_time?: number | null
  response_time?: number | null
  update_time?: number | null
  solution_time?: number | null
  condition?: Record<string, { operator: string; value?: string[]; pre_condition?: string }>
  updated_at?: string
  created_at?: string
}

interface CalendarItem {
  id: number
  name: string
  default?: boolean
}

interface MetaItem {
  id: number
  name: string
}

const router = useRouter()
const slas = ref<SlaItem[]>([])
const calendarsList = ref<CalendarItem[]>([])
const ticketStatesList = ref<MetaItem[]>([])
const ticketPrioritiesList = ref<MetaItem[]>([])
const groupsList = ref<MetaItem[]>([])

const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuId = ref<number | null>(null)

// Drawer / Form state
const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

const defaultFormState = () => ({
  id: null as number | null,
  name: '',
  calendar_id: null as number | null,
  first_response_time: '' as string | number,
  update_time: '' as string | number,
  solution_time: '' as string | number,
})

const formState = ref(defaultFormState())

// Student Hub: the ticket selector is edited with the shared editor (Automation/), which keeps what
// it doesn't know.
const options = ref<AutomationOptions | null>(null)
const conditionState = ref<ConditionState>(emptyConditionState())
const problems = ref<string[]>([])

const allowExpert = computed(() => Boolean(useApplicationStore().config.ticket_allow_expert_conditions))
const conditionFieldList = computed(() => (options.value ? conditionFields(options.value) : []))

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Service Level Agreements') },
]

const getCsrf = () => getCSRFToken() || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const getCalendarName = (calendarId?: number | null) => {
  if (!calendarId) return '-'
  const cal = calendarsList.value.find((c) => c.id === calendarId)
  return cal ? cal.name : '-'
}

const formatMinutes = (minutes?: number | null) => {
  if (!minutes || minutes <= 0) return '-'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  if (remainingMins === 0) return `${hours}h`
  return `${hours}h ${remainingMins}m`
}

const fetchSlas = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/slas', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        slas.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage SLAs.')
    } else {
      errorText.value = `Failed to load SLAs (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch SLAs:', e)
    errorText.value = __('Error fetching SLAs. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchMetadata = async () => {
  try {
    const [calendarsRes, statesRes, prioritiesRes, groupsRes] = await Promise.all([
      fetch('/api/v1/calendars', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_states', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_priorities', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])
    if (calendarsRes.ok) calendarsList.value = await calendarsRes.json()
    if (statesRes.ok) ticketStatesList.value = await statesRes.json()
    if (prioritiesRes.ok) ticketPrioritiesList.value = await prioritiesRes.json()
    if (groupsRes.ok) groupsList.value = await groupsRes.json()
  } catch (e) {
    console.error('Failed to fetch SLA metadata:', e)
  }
}

const fetchOptions = async () => {
  try {
    options.value = await studenthubApi<AutomationOptions>('/api/v1/studenthub/automation/options')
  } catch (e) {
    console.error('Failed to fetch the condition choices:', e)
  }
}

const filteredSlas = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return slas.value
  return slas.value.filter((s) => s.name.toLowerCase().includes(query))
})

// Opening waits for the choices, so the SLA is read with all fields known.
const openDrawer = async (title: string, sla?: SlaItem, copy = false) => {
  if (!options.value) await fetchOptions()
  if (sla) {
    formState.value = {
      id: copy ? null : sla.id,
      name: copy ? i18n.t('%s (Copy)', sla.name || __('SLA')) : sla.name || '',
      calendar_id: sla.calendar_id || null,
      first_response_time: sla.first_response_time || sla.response_time || '',
      update_time: sla.update_time || '',
      solution_time: sla.solution_time || '',
    }
  } else {
    formState.value = defaultFormState()
    const defaultCal = calendarsList.value.find((c) => c.default) || calendarsList.value[0]
    if (defaultCal) formState.value.calendar_id = defaultCal.id
  }
  conditionState.value = sla ? conditionToState(sla.condition, conditionFieldList.value) : emptyConditionState()
  problems.value = []
  drawerTitle.value = title
  showDrawer.value = true
}

const handleNewSla = () => openDrawer(__('New SLA'))

const handleEditSla = (sla: SlaItem) => openDrawer(__('Edit SLA'), sla)

const handleCloneSla = (sla: SlaItem) => openDrawer(__('Clone SLA'), sla, true)

const getSlaRuleSummary = (sla: SlaItem) => {
  if (!sla.condition || Object.keys(sla.condition).length === 0) return []
  const rules: string[] = []
  for (const [key, rawVal] of Object.entries(sla.condition)) {
    const obj = rawVal as { operator?: string; value?: string[] }
    const op = obj.operator || 'is'
    let fieldLabel = ''
    let valNames: string[] = []

    if (key === 'ticket.state_id') {
      fieldLabel = __('State')
      valNames = (obj.value || []).map((id) => ticketStatesList.value.find((s) => String(s.id) === String(id))?.name || `#${id}`)
    } else if (key === 'ticket.priority_id') {
      fieldLabel = __('Priority')
      valNames = (obj.value || []).map((id) => ticketPrioritiesList.value.find((p) => String(p.id) === String(id))?.name || `#${id}`)
    } else if (key === 'ticket.group_id') {
      fieldLabel = __('Group')
      valNames = (obj.value || []).map((id) => groupsList.value.find((g) => String(g.id) === String(id))?.name || `#${id}`)
    } else {
      fieldLabel = key.replace('ticket.', '')
      valNames = obj.value || []
    }

    if (valNames.length > 0) {
      rules.push(`${fieldLabel} ${op} ${valNames.join(', ')}`)
    }
  }
  return rules
}

const checkProblems = () => {
  const found: string[] = []
  if (!formState.value.name.trim()) found.push(__('Name is required.'))
  if (!stateRows(conditionState.value).length) found.push(__('Add at least one condition.'))
  found.push(...conditionStateProblems(conditionState.value, conditionFieldList.value))
  problems.value = found
  return found.length === 0
}

const saveSla = async () => {
  if (!checkProblems()) return

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      calendar_id: formState.value.calendar_id,
      first_response_time: formState.value.first_response_time ? Number(formState.value.first_response_time) : null,
      update_time: formState.value.update_time ? Number(formState.value.update_time) : null,
      solution_time: formState.value.solution_time ? Number(formState.value.solution_time) : null,
      condition: stateToCondition(conditionState.value, conditionFieldList.value),
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/slas/${formState.value.id}` : '/api/v1/slas'
    const method = isEdit ? 'PUT' : 'POST'

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
      showDrawer.value = false
      fetchSlas()
    } else {
      const data = await res.json()
      problems.value = [data.error_human || data.error || __('Failed to save SLA.')]
    }
  } catch (e) {
    console.error('Failed to save SLA:', e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteSla = async (id: number, name: string) => {
  if (!confirm(i18n.t('Are you sure you want to delete SLA "%s"?', name))) return
  try {
    const res = await fetch(`/api/v1/slas/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchSlas()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete SLA.'))
    }
  } catch (e) {
    console.error('Failed to delete SLA:', e)
  }
}

onMounted(() => {
  fetchSlas()
  fetchMetadata()
  fetchOptions()
  window.addEventListener('click', closeActionMenu)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100" @click="closeActionMenu">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <button
            @click="router.push('/manage')"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Service Level Agreements') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewSla"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New SLA') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for SLAs')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Calendar') }}</th>
              <th class="py-4 px-6">{{ __('First Response') }}</th>
              <th class="py-4 px-6">{{ __('Update Time') }}</th>
              <th class="py-4 px-6">{{ __('Solution Time') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="6" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredSlas.length === 0">
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="clock" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No SLAs found') }}</h3>
                <p class="text-xs">{{ __('No SLAs matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="sla in filteredSlas"
              :key="sla.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditSla(sla)"
            >
              <!-- Name & Conditions -->
              <td class="py-4 px-6">
                <div class="font-medium text-slate-900 dark:text-slate-100">
                  {{ sla.name }}
                </div>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  <span
                    v-for="(rule, rIdx) in getSlaRuleSummary(sla)"
                    :key="rIdx"
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  >
                    {{ rule }}
                  </span>
                  <span
                    v-if="getSlaRuleSummary(sla).length === 0"
                    class="text-[11px] text-slate-400 italic"
                  >
                    {{ __('Applies to all tickets') }}
                  </span>
                </div>
              </td>
              <!-- Calendar -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                {{ getCalendarName(sla.calendar_id) }}
              </td>
              <!-- First Response -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                {{ formatMinutes(sla.first_response_time || sla.response_time) }}
              </td>
              <!-- Update Time -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                {{ formatMinutes(sla.update_time) }}
              </td>
              <!-- Solution Time -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                {{ formatMinutes(sla.solution_time) }}
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(sla.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === sla.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="() => { closeActionMenu(); handleEditSla(sla) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <button
                      @click="() => { closeActionMenu(); handleCloneSla(sla) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="files" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="() => { closeActionMenu(); handleDeleteSla(sla.id, sla.name) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <CommonIcon name="trash3" class="w-3.5 h-3.5 mr-2.5 text-red-400" />{{ __('Delete') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>

  <!-- Drawer -->
  <Teleport to="body">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end"
      @click="showDrawer = false"
    >
      <div
        class="w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="clock" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button
            @click="showDrawer = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Description Box -->
          <div class="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ __('Service Level Agreements help you to meet specific response times for your customers\' requests.') }}
          </div>

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="100"
              :placeholder="__('Name of the SLA')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Ticket Selector Conditions -->
          <section aria-labelledby="sla-conditions-title">
            <h3 id="sla-conditions-title" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Ticket Selector') }} <span class="text-red-500">*</span>
            </h3>
            <p v-if="!options" class="text-sm text-slate-500">{{ __('Loading…') }}</p>
            <AutomationConditions
              v-else
              v-model="conditionState"
              :fields="conditionFieldList"
              id-prefix="sla-condition"
              :allow-expert="allowExpert"
            />
          </section>

          <!-- Calendar -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Calendar') }} <span class="text-red-500">*</span>
            </label>
            <select
              v-model="formState.calendar_id"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option v-for="cal in calendarsList" :key="cal.id" :value="cal.id">
                {{ cal.name }}
              </option>
            </select>
          </div>

          <!-- SLA Times -->
          <div class="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {{ __('SLA Target Times (Minutes)') }}
            </h3>

            <!-- First Response Time -->
            <div class="grid grid-cols-2 gap-3 items-center">
              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">{{ __('First Response Time') }}</label>
                <p class="text-[11px] text-slate-400">{{ __('Max minutes to first response') }}</p>
              </div>
              <input
                v-model="formState.first_response_time"
                type="number"
                min="0"
                :placeholder="__('Minutes (optional)')"
                class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>

            <!-- Update Time -->
            <div class="grid grid-cols-2 gap-3 items-center">
              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">{{ __('Update Time') }}</label>
                <p class="text-[11px] text-slate-400">{{ __('Max minutes between customer replies') }}</p>
              </div>
              <input
                v-model="formState.update_time"
                type="number"
                min="0"
                :placeholder="__('Minutes (optional)')"
                class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>

            <!-- Solution Time -->
            <div class="grid grid-cols-2 gap-3 items-center">
              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">{{ __('Solution Time') }}</label>
                <p class="text-[11px] text-slate-400">{{ __('Max minutes to close ticket') }}</p>
              </div>
              <input
                v-model="formState.solution_time"
                type="number"
                min="0"
                :placeholder="__('Minutes (optional)')"
                class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>
          <CommonAlert v-if="problems.length" variant="danger" role="alert">
            <ul class="list-disc ps-4">
              <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
            </ul>
          </CommonAlert>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            @click="showDrawer = false"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
          >
            {{ __('Cancel') }}
          </button>
          <button
            @click="saveSla"
            :disabled="submitting"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
