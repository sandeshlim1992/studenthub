<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  state_current?: { value: unknown }
  state_initial?: { value: unknown }
}

interface ActivityTypeItem {
  id: number
  name: string
  note?: string
  active: boolean
  updated_at?: string
  created_at?: string
}

interface MetaItem {
  id: number
  name: string
}

interface ConditionRow {
  field: string
  operator: string
  values: string[]
  pre_condition?: string
}

interface ActivityLogRow {
  ticket?: { id: number; number: string; title: string; created_at: string; time_unit?: number }
  time_unit?: number
  type?: string
  customer?: string | { id: number; email: string; fullname?: string }
  organization?: string | { id: number; name: string }
  agent?: string
  created_at?: string
}

const router = useRouter()

// Tabs: 'settings' | 'types' | 'logs'
const activeTab = ref<'settings' | 'types' | 'logs'>('settings')

// Settings state
const settingsMap = ref<Record<string, SettingRecord>>({})
const isTimeAccountingEnabled = ref(true)
const unitSetting = ref<string>('')
const customUnitSetting = ref<string>('')
const areActivityTypesEnabled = ref(false)
const defaultActivityTypeId = ref<number | null>(null)
const conditions = ref<ConditionRow[]>([])

const isSavingSettings = ref(false)
const settingsSuccessMessage = ref('')
const settingsErrorMessage = ref('')

// Activity Types state
const activityTypes = ref<ActivityTypeItem[]>([])
const typesLoading = ref(false)
const typeSearchQuery = ref('')
const activeTypeMenuId = ref<number | null>(null)

// Drawer for Activity Type
const showTypeDrawer = ref(false)
const typeDrawerTitle = ref('')
const typeSubmitting = ref(false)
const typeFormState = ref({
  id: null as number | null,
  name: '',
  note: '',
  active: true,
  isDefault: false,
})

// Accounted Time Logs state
const currentYear = new Date().getFullYear()
const selectedYear = ref<number>(currentYear)
const selectedMonth = ref<number>(new Date().getMonth() + 1)
const activeLogCategory = ref<'by_activity' | 'by_ticket' | 'by_customer' | 'by_organization'>('by_activity')
const logsLoading = ref(false)
const logsData = ref<ActivityLogRow[]>([])

// Meta collections
const ticketStatesList = ref<MetaItem[]>([])
const ticketPrioritiesList = ref<MetaItem[]>([])
const groupsList = ref<MetaItem[]>([])
const usersList = ref<{ id: number; fullname: string; login: string }[]>([])

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Time Accounting') },
]

const monthNames = [
  __('Jan'), __('Feb'), __('Mar'), __('Apr'), __('May'), __('Jun'),
  __('Jul'), __('Aug'), __('Sep'), __('Oct'), __('Nov'), __('Dec')
]

const yearsRange = computed(() => [currentYear - 2, currentYear - 1, currentYear])

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const formatTimeUnit = (val?: number | null) => {
  if (val === undefined || val === null) return '0'
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return '0'
  const unit = unitSetting.value
  if (unit === 'hour') return `${num} ${__('hour(s)')}`
  if (unit === 'quarter') return `${num} ${__('quarter-hour(s)')}`
  if (unit === 'minute') return `${num} ${__('minute(s)')}`
  if (unit === 'custom' && customUnitSetting.value) return `${num} ${customUnitSetting.value}`
  return `${num}`
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// -------------------------------------------------------------
// Settings Methods
// -------------------------------------------------------------

const fetchSettings = async () => {
  try {
    const res = await fetch('/api/v1/settings', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (res.ok) {
      const data: SettingRecord[] = await res.json()
      const map: Record<string, SettingRecord> = {}
      for (const s of data) {
        map[s.name] = s
      }
      settingsMap.value = map

      // Extract values
      isTimeAccountingEnabled.value = Boolean(map['time_accounting']?.state_current?.value ?? true)
      unitSetting.value = String(map['time_accounting_unit']?.state_current?.value ?? '')
      customUnitSetting.value = String(map['time_accounting_unit_custom']?.state_current?.value ?? '')
      areActivityTypesEnabled.value = Boolean(map['time_accounting_types']?.state_current?.value ?? false)

      const defType = map['time_accounting_type_default']?.state_current?.value
      defaultActivityTypeId.value = defType ? Number(defType) : null

      // Selector condition
      const rawSelector = map['time_accounting_selector']?.state_current?.value as { condition?: Record<string, unknown> } | undefined
      if (rawSelector?.condition) {
        conditions.value = parseConditionToRows(rawSelector.condition)
      } else {
        conditions.value = []
      }
    }
  } catch (e) {
    console.error('Failed to fetch settings:', e)
  }
}

const buildConditionPayload = () => {
  const condPayload: Record<string, { operator: string; value?: string[]; pre_condition?: string }> = {}
  for (const cond of conditions.value) {
    let key = ''
    if (cond.field === 'state') key = 'ticket.state_id'
    else if (cond.field === 'priority') key = 'ticket.priority_id'
    else if (cond.field === 'group') key = 'ticket.group_id'
    else if (cond.field === 'owner') key = 'ticket.owner_id'
    else if (cond.field === 'customer') key = 'ticket.customer_id'
    else if (cond.field === 'organization') key = 'ticket.organization_id'

    if (key) {
      if (cond.pre_condition) {
        condPayload[key] = { operator: cond.operator, pre_condition: cond.pre_condition }
      } else if (cond.values && cond.values.length > 0) {
        condPayload[key] = { operator: cond.operator, value: cond.values }
      }
    }
  }
  return { condition: condPayload }
}

const parseConditionToRows = (condition?: Record<string, unknown>) => {
  const rows: ConditionRow[] = []
  if (!condition) return rows

  for (const [key, rawVal] of Object.entries(condition)) {
    let field = ''
    if (key === 'ticket.state_id') field = 'state'
    else if (key === 'ticket.priority_id') field = 'priority'
    else if (key === 'ticket.group_id') field = 'group'
    else if (key === 'ticket.owner_id') field = 'owner'
    else if (key === 'ticket.customer_id') field = 'customer'
    else if (key === 'ticket.organization_id') field = 'organization'

    if (!field) continue

    let operator = 'is'
    let values: string[] = []
    let pre_condition: string | undefined

    if (typeof rawVal === 'object' && rawVal !== null) {
      const { operator: op = 'is', pre_condition: preCond, value } = rawVal as {
        operator?: string
        value?: unknown
        pre_condition?: string
      }
      operator = op
      pre_condition = preCond
      if (Array.isArray(value)) {
        values = value.map(String)
      } else if (value !== undefined && value !== null) {
        values = [String(value)]
      }
    }

    rows.push({ field, operator, values, pre_condition })
  }
  return rows
}

const updateSettingValue = async (name: string, value: unknown) => {
  const setting = settingsMap.value[name]
  if (!setting) return false
  const res = await fetch(`/api/v1/settings/${setting.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': getCsrf(),
    },
    body: JSON.stringify({ state_current: { value } }),
  })
  if (res.ok) {
    if (!setting.state_current) setting.state_current = { value }
    else setting.state_current.value = value
  }
  return res.ok
}

const toggleTimeAccountingMaster = async () => {
  const nextVal = !isTimeAccountingEnabled.value
  const ok = await updateSettingValue('time_accounting', nextVal)
  if (ok) {
    isTimeAccountingEnabled.value = nextVal
  }
}

const saveSettings = async () => {
  isSavingSettings.value = true
  settingsSuccessMessage.value = ''
  settingsErrorMessage.value = ''
  try {
    const selectorPayload = buildConditionPayload()
    const unit = unitSetting.value
    let customUnit = customUnitSetting.value
    if (unit !== 'custom') customUnit = ''

    const [okSelector, okUnit, okCustom] = await Promise.all([
      updateSettingValue('time_accounting_selector', selectorPayload),
      updateSettingValue('time_accounting_unit', unit),
      updateSettingValue('time_accounting_unit_custom', customUnit),
    ])

    if (okSelector && okUnit && okCustom) {
      settingsSuccessMessage.value = __('Settings saved successfully.')
      setTimeout(() => { settingsSuccessMessage.value = '' }, 3000)
    } else {
      settingsErrorMessage.value = __('Failed to save all settings.')
    }
  } catch (e) {
    console.error('Failed to save settings:', e)
    settingsErrorMessage.value = __('An error occurred while saving settings.')
  } finally {
    isSavingSettings.value = false
  }
}

const resetSettings = async () => {
  if (!confirm(__('Are you sure you want to reset time accounting settings to defaults?'))) return
  isSavingSettings.value = true
  settingsSuccessMessage.value = ''
  settingsErrorMessage.value = ''
  try {
    const s1 = settingsMap.value['time_accounting_selector']
    const s2 = settingsMap.value['time_accounting_unit']
    const s3 = settingsMap.value['time_accounting_unit_custom']

    const resets = [s1, s2, s3].filter(Boolean).map((s) =>
      fetch(`/api/v1/settings/reset/${s!.id}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() },
      })
    )

    await Promise.all(resets)
    await fetchSettings()
    settingsSuccessMessage.value = __('Settings have been reset to defaults.')
    setTimeout(() => { settingsSuccessMessage.value = '' }, 3000)
  } catch (e) {
    console.error('Failed to reset settings:', e)
    settingsErrorMessage.value = __('An error occurred while resetting settings.')
  } finally {
    isSavingSettings.value = false
  }
}

// -------------------------------------------------------------
// Activity Types Methods
// -------------------------------------------------------------

const fetchActivityTypes = async () => {
  typesLoading.value = true
  try {
    const res = await fetch('/api/v1/time_accounting/types', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        activityTypes.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else if (data?.records && Array.isArray(data.records)) {
        activityTypes.value = data.records.sort((a: ActivityTypeItem, b: ActivityTypeItem) => a.name.localeCompare(b.name))
      }
    }
  } catch (e) {
    console.error('Failed to fetch activity types:', e)
  } finally {
    typesLoading.value = false
  }
}

const toggleActivityTypesSetting = async () => {
  const nextVal = !areActivityTypesEnabled.value
  const ok = await updateSettingValue('time_accounting_types', nextVal)
  if (ok) {
    areActivityTypesEnabled.value = nextVal
  }
}

const filteredActivityTypes = computed(() => {
  const q = typeSearchQuery.value.trim().toLowerCase()
  if (!q) return activityTypes.value
  return activityTypes.value.filter((t) =>
    t.name.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q))
  )
})

const handleNewType = () => {
  typeFormState.value = {
    id: null,
    name: '',
    note: '',
    active: true,
    isDefault: false,
  }
  typeDrawerTitle.value = __('New Activity Type')
  showTypeDrawer.value = true
}

const handleEditType = (type: ActivityTypeItem) => {
  typeFormState.value = {
    id: type.id,
    name: type.name,
    note: type.note || '',
    active: type.active,
    isDefault: defaultActivityTypeId.value === type.id,
  }
  typeDrawerTitle.value = __('Edit Activity Type')
  showTypeDrawer.value = true
}

const saveActivityType = async () => {
  if (!typeFormState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }
  typeSubmitting.value = true
  try {
    const isEdit = typeFormState.value.id !== null
    const url = isEdit ? `/api/v1/time_accounting/types/${typeFormState.value.id}` : '/api/v1/time_accounting/types'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        name: typeFormState.value.name.trim(),
        note: typeFormState.value.note.trim(),
        active: typeFormState.value.active,
      }),
    })

    if (res.ok) {
      const savedType: ActivityTypeItem = await res.json()
      // Default setting
      if (typeFormState.value.isDefault && savedType.id) {
        await updateSettingValue('time_accounting_type_default', savedType.id)
        defaultActivityTypeId.value = savedType.id
      } else if (!typeFormState.value.isDefault && defaultActivityTypeId.value === savedType.id) {
        await updateSettingValue('time_accounting_type_default', '')
        defaultActivityTypeId.value = null
      }
      showTypeDrawer.value = false
      fetchActivityTypes()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save activity type.'))
    }
  } catch (e) {
    console.error('Failed to save activity type:', e)
  } finally {
    typeSubmitting.value = false
  }
}

const toggleTypeActive = async (type: ActivityTypeItem) => {
  try {
    const res = await fetch(`/api/v1/time_accounting/types/${type.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !type.active }),
    })
    if (res.ok) {
      type.active = !type.active
    }
  } catch (e) {
    console.error('Failed to toggle type active status:', e)
  }
}

const setTypeAsDefault = async (type: ActivityTypeItem) => {
  const nextId = defaultActivityTypeId.value === type.id ? '' : type.id
  const ok = await updateSettingValue('time_accounting_type_default', nextId)
  if (ok) {
    defaultActivityTypeId.value = nextId === '' ? null : type.id
  }
}

// -------------------------------------------------------------
// Accounted Time Logs Methods
// -------------------------------------------------------------

const fetchLogs = async () => {
  logsLoading.value = true
  logsData.value = []
  try {
    const res = await fetch(`/api/v1/time_accounting/log/${activeLogCategory.value}/${selectedYear.value}/${selectedMonth.value}?limit=50`, {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (res.ok) {
      const data = await res.json()
      logsData.value = Array.isArray(data) ? data : []
    }
  } catch (e) {
    console.error('Failed to fetch accounted time logs:', e)
  } finally {
    logsLoading.value = false
  }
}

const downloadLogUrl = computed(() => {
  return `/api/v1/time_accounting/log/${activeLogCategory.value}/${selectedYear.value}/${selectedMonth.value}?download=true`
})

const fetchMetadata = async () => {
  try {
    const [statesRes, prioritiesRes, groupsRes, usersRes] = await Promise.all([
      fetch('/api/v1/ticket_states', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_priorities', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/users?per_page=500', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])
    if (statesRes.ok) ticketStatesList.value = await statesRes.json()
    if (prioritiesRes.ok) ticketPrioritiesList.value = await prioritiesRes.json()
    if (groupsRes.ok) groupsList.value = await groupsRes.json()
    if (usersRes.ok) usersList.value = await usersRes.json()
  } catch (e) {
    console.error('Failed to fetch metadata:', e)
  }
}

watch([selectedYear, selectedMonth, activeLogCategory], () => {
  if (activeTab.value === 'logs') {
    fetchLogs()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'types' && activityTypes.value.length === 0) {
    fetchActivityTypes()
  } else if (tab === 'logs') {
    fetchLogs()
  }
})

onMounted(() => {
  fetchSettings()
  fetchMetadata()
  window.addEventListener('click', () => { activeTypeMenuId.value = null })
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back to Administration')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CommonIcon name="clock" class="w-6 h-6 text-blue-500" />
              {{ __('Time Accounting') }}
              <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ltr:ml-1 rtl:mr-1">{{ __('Management') }}</span>
            </h1>
          </div>
        </div>

        <!-- Master Switch -->
        <div class="flex items-center gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl shadow-sm">
          <div class="text-right">
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 block">{{ __('Time Accounting') }}</span>
            <span class="text-[11px] text-slate-500">{{ isTimeAccountingEnabled ? __('Enabled') : __('Disabled') }}</span>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="isTimeAccountingEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            @click="toggleTimeAccountingMaster"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
              :class="isTimeAccountingEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
            ></span>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'settings'"
        >
          <CommonIcon name="gear" class="w-4 h-4" />
          {{ __('Settings') }}
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'types' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'types'"
        >
          <CommonIcon name="card-list" class="w-4 h-4" />
          {{ __('Activity Types') }}
          <span v-if="activityTypes.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {{ activityTypes.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'logs' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'logs'"
        >
          <CommonIcon name="calendar-range" class="w-4 h-4" />
          {{ __('Accounted Time') }}
        </button>
      </div>

      <!-- ======================================================= -->
      <!-- TAB 1: SETTINGS                                         -->
      <!-- ======================================================= -->
      <div v-if="activeTab === 'settings'" class="max-w-3xl space-y-6">

        <!-- Alert messages -->
        <div v-if="settingsSuccessMessage" class="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs rounded-xl flex items-center gap-2">
          <CommonIcon name="check2" class="w-4 h-4" />
          {{ settingsSuccessMessage }}
        </div>
        <div v-if="settingsErrorMessage" class="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
          <CommonIcon name="exclamation-triangle" class="w-4 h-4" />
          {{ settingsErrorMessage }}
        </div>

        <!-- Selector Conditions Card -->
        <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Ticket Selector') }}</h2>
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              @click="conditions.push({ field: 'state', operator: 'is', values: [] })"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              {{ __('Add Condition') }}
            </button>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {{ __('Show time accounting prompt when agents update matching tickets. If no conditions are defined, the prompt is shown for all tickets.') }}
          </p>

          <div v-if="conditions.length === 0" class="p-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center bg-slate-50 dark:bg-slate-800/30">
            <p class="text-xs text-slate-500 mb-2">{{ __('Currently active for all tickets without restriction.') }}</p>
            <button
              type="button"
              class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
              @click="conditions.push({ field: 'state', operator: 'is', values: [] })"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5 text-blue-500" />
              {{ __('Restrict to Specific Tickets') }}
            </button>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(cond, idx) in conditions"
              :key="idx"
              class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl relative"
            >
              <button
                type="button"
                class="absolute top-3 ltr:right-3 rtl:left-3 text-slate-400 hover:text-red-500 cursor-pointer"
                :title="__('Remove')"
                @click="conditions.splice(idx, 1)"
              >
                <CommonIcon name="trash3" class="w-4 h-4" />
              </button>

              <div class="grid grid-cols-2 gap-3 mb-3 ltr:pr-8 rtl:pl-8">
                <div>
                  <label :for="`cond-field-${idx}`" class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Field') }}</label>
                  <select
                    :id="`cond-field-${idx}`"
                    v-model="cond.field"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    @change="() => { cond.values = []; delete cond.pre_condition }"
                  >
                    <option value="state">{{ __('State') }}</option>
                    <option value="priority">{{ __('Priority') }}</option>
                    <option value="group">{{ __('Group') }}</option>
                    <option value="owner">{{ __('Owner') }}</option>
                    <option value="customer">{{ __('Customer') }}</option>
                    <option value="organization">{{ __('Organization') }}</option>
                  </select>
                </div>
                <div>
                  <label :for="`cond-operator-${idx}`" class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Operator') }}</label>
                  <select
                    :id="`cond-operator-${idx}`"
                    v-model="cond.operator"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="is">{{ __('is') }}</option>
                    <option value="is not">{{ __('is not') }}</option>
                  </select>
                </div>
              </div>

              <!-- Values -->
              <div>
                <span class="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">{{ __('Value') }}</span>
                <!-- State -->
                <div v-if="cond.field === 'state'" class="flex flex-wrap gap-1.5">
                  <label
                    v-for="state in ticketStatesList" :key="state.id"
                    class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                    :class="cond.values.includes(String(state.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                  >
                    <input v-model="cond.values" type="checkbox" :value="String(state.id)" class="rounded text-blue-600 focus:ring-0" />
                    <span>{{ state.name }}</span>
                  </label>
                </div>
                <!-- Priority -->
                <div v-else-if="cond.field === 'priority'" class="flex flex-wrap gap-1.5">
                  <label
                    v-for="prio in ticketPrioritiesList" :key="prio.id"
                    class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                    :class="cond.values.includes(String(prio.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                  >
                    <input v-model="cond.values" type="checkbox" :value="String(prio.id)" class="rounded text-blue-600 focus:ring-0" />
                    <span>{{ prio.name }}</span>
                  </label>
                </div>
                <!-- Group -->
                <div v-else-if="cond.field === 'group'" class="flex flex-wrap gap-1.5">
                  <label
                    v-for="grp in groupsList" :key="grp.id"
                    class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                    :class="cond.values.includes(String(grp.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                  >
                    <input v-model="cond.values" type="checkbox" :value="String(grp.id)" class="rounded text-blue-600 focus:ring-0" />
                    <span>{{ grp.name }}</span>
                  </label>
                </div>
                <!-- Owner -->
                <div v-else-if="cond.field === 'owner'" class="space-y-2">
                  <label
                    class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                    :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'"
                  >
                    <input type="radio" :checked="cond.pre_condition === 'current_user.id'" class="text-blue-600 focus:ring-0" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" />
                    <span>{{ __('Current User') }}</span>
                  </label>
                  <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    <label
                      v-for="user in usersList.slice(0, 30)" :key="user.id"
                      class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.values.includes(String(user.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input v-model="cond.values" type="checkbox" :value="String(user.id)" class="rounded text-blue-600 focus:ring-0" @change="() => { if (cond.values.length > 0) delete cond.pre_condition }" />
                      <span>{{ user.fullname || user.login }}</span>
                    </label>
                  </div>
                </div>
                <!-- Customer -->
                <div v-else-if="cond.field === 'customer'">
                  <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'">
                    <input type="radio" :checked="cond.pre_condition === 'current_user.id'" class="text-blue-600 focus:ring-0" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" />
                    <span>{{ __('Current User') }}</span>
                  </label>
                </div>
                <!-- Organization -->
                <div v-else-if="cond.field === 'organization'">
                  <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.organization_id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'">
                    <input type="radio" :checked="cond.pre_condition === 'current_user.organization_id'" class="text-blue-600 focus:ring-0" @change="() => { cond.pre_condition = 'current_user.organization_id'; cond.values = [] }" />
                    <span>{{ __("Current User's Organization") }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Unit Setting Card -->
        <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{{ __('Display Unit') }}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {{ __('Defines the unit label shown alongside the time accounting input field.') }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="time-accounting-unit-select" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{{ __('Unit') }}</label>
              <select
                id="time-accounting-unit-select"
                v-model="unitSetting"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">{{ __('no unit') }}</option>
                <option value="hour">{{ __('hour(s)') }}</option>
                <option value="quarter">{{ __('quarter-hour(s)') }}</option>
                <option value="minute">{{ __('minute(s)') }}</option>
                <option value="custom">{{ __('custom unit') }}</option>
              </select>
            </div>

            <div v-if="unitSetting === 'custom'">
              <label for="time-accounting-custom-unit-input" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{{ __('Custom Unit Name') }}</label>
              <input
                id="time-accounting-custom-unit-input"
                v-model="customUnitSetting"
                type="text"
                :placeholder="__('e.g. pts, credits')"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">
            {{ __('The chosen unit is purely visual and does not affect numerical values stored in the database.') }}
          </p>
        </div>

        <!-- Settings Actions -->
        <div class="flex items-center justify-between pt-2">
          <button
            type="button"
            :disabled="isSavingSettings"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            @click="resetSettings"
          >
            {{ __('Reset to Default') }}
          </button>
          <button
            type="button"
            :disabled="isSavingSettings"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
            @click="saveSettings"
          >
            <span v-if="isSavingSettings">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save Settings') }}</span>
          </button>
        </div>

      </div>

      <!-- ======================================================= -->
      <!-- TAB 2: ACTIVITY TYPES                                   -->
      <!-- ======================================================= -->
      <div v-else-if="activeTab === 'types'" class="space-y-6">

        <!-- Enable Activity Types Toggle Card -->
        <div class="flex items-center justify-between p-5 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ __('Record Activity Types') }}</h3>
            <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">
              {{ __('When enabled, agents can categorize accounted time by selecting an activity type (e.g., Development, Support, Consultation).') }}
            </p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="areActivityTypesEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            @click="toggleActivityTypesSetting"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
              :class="areActivityTypesEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
            ></span>
          </button>
        </div>

        <!-- Activity Types Table Section -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="relative w-72">
              <input
                v-model="typeSearchQuery"
                type="text"
                :placeholder="__('Search activity types...')"
                :aria-label="__('Search activity types...')"
                class="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
              <div class="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CommonIcon name="search" class="w-3.5 h-3.5" />
              </div>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              @click="handleNewType"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              {{ __('New Activity Type') }}
            </button>
          </div>

          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th class="py-3 px-6">{{ __('Name') }}</th>
                  <th class="py-3 px-6">{{ __('Note') }}</th>
                  <th class="py-3 px-6 text-center w-28">{{ __('Default') }}</th>
                  <th class="py-3 px-6 text-center w-24">{{ __('Active') }}</th>
                  <th class="py-3 px-6 text-right w-16"></th>
                </tr>
              </thead>
              <tbody v-if="typesLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
                <tr v-for="i in 3" :key="i" class="animate-pulse">
                  <td class="py-3 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
                  <td class="py-3 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
                  <td class="py-3 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto"></div></td>
                  <td class="py-3 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
                  <td class="py-3 px-6"></td>
                </tr>
              </tbody>
              <tbody v-else-if="filteredActivityTypes.length === 0">
                <tr>
                  <td colspan="5" class="py-10 text-center text-slate-400 text-xs">
                    {{ __('No activity types found.') }}
                  </td>
                </tr>
              </tbody>
              <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                <tr
                  v-for="type in filteredActivityTypes"
                  :key="type.id"
                  class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  @click="handleEditType(type)"
                >
                  <!-- Name -->
                  <td class="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                    {{ type.name }}
                  </td>

                  <!-- Note -->
                  <td class="py-3.5 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {{ type.note || '-' }}
                  </td>

                  <!-- Default Status -->
                  <td class="py-3.5 px-6 text-center" @click.stop>
                    <span
                      v-if="defaultActivityTypeId === type.id"
                      class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      {{ __('Default') }}
                    </span>
                    <button
                      v-else
                      type="button"
                      class="text-[11px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      @click="setTypeAsDefault(type)"
                    >
                      {{ __('Set as default') }}
                    </button>
                  </td>

                  <!-- Active Toggle -->
                  <td class="py-3.5 px-6 text-center" @click.stop>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                      :class="type.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                      @click="toggleTypeActive(type)"
                    >
                      <CommonIcon name="check2" class="w-4 h-4" />
                    </button>
                  </td>

                  <!-- 3-dots actions -->
                  <td class="py-3.5 px-6 text-right relative" @click.stop>
                    <button
                      type="button"
                      class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      @click="() => { activeTypeMenuId = activeTypeMenuId === type.id ? null : type.id }"
                    >
                      <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                    </button>
                    <div
                      v-if="activeTypeMenuId === type.id"
                      class="absolute ltr:right-6 rtl:left-6 mt-1 w-40 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                    >
                      <div class="py-1">
                        <button
                          type="button"
                          class="flex w-full items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          @click="() => { activeTypeMenuId = null; handleEditType(type) }"
                        >
                          <CommonIcon name="pencil" class="w-3.5 h-3.5 ltr:mr-2 rtl:ml-2 text-slate-400" />
                          {{ __('Edit') }}
                        </button>
                        <button
                          type="button"
                          class="flex w-full items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          @click="() => { activeTypeMenuId = null; setTypeAsDefault(type) }"
                        >
                          <CommonIcon name="check2" class="w-3.5 h-3.5 ltr:mr-2 rtl:ml-2 text-slate-400" />
                          {{ defaultActivityTypeId === type.id ? __('Unset Default') : __('Set as Default') }}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- ======================================================= -->
      <!-- TAB 3: ACCOUNTED TIME LOGS                              -->
      <!-- ======================================================= -->
      <div v-else-if="activeTab === 'logs'" class="space-y-6">

        <!-- Filter Controls Bar -->
        <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <!-- Year Selector -->
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-slate-400 uppercase w-16">{{ __('Year') }}:</span>
            <div class="flex items-center gap-1.5">
              <button
                v-for="y in yearsRange"
                :key="y"
                type="button"
                class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                :class="selectedYear === y ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
                @click="selectedYear = y"
              >
                {{ y }}
              </button>
            </div>
          </div>

          <!-- Month Selector -->
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-slate-400 uppercase w-16">{{ __('Month') }}:</span>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="(mName, mIdx) in monthNames"
                :key="mIdx"
                type="button"
                class="px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                :class="selectedMonth === mIdx + 1 ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
                @click="selectedMonth = mIdx + 1"
              >
                {{ mName }}
              </button>
            </div>
          </div>
        </div>

        <!-- Log Category Nav & Download Button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              :class="activeLogCategory === 'by_activity' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
              @click="activeLogCategory = 'by_activity'"
            >
              {{ __('By Activity') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              :class="activeLogCategory === 'by_ticket' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
              @click="activeLogCategory = 'by_ticket'"
            >
              {{ __('By Ticket') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              :class="activeLogCategory === 'by_customer' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
              @click="activeLogCategory = 'by_customer'"
            >
              {{ __('By Customer') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              :class="activeLogCategory === 'by_organization' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
              @click="activeLogCategory = 'by_organization'"
            >
              {{ __('By Organization') }}
            </button>
          </div>

          <!-- Download Excel Button -->
          <a
            :href="downloadLogUrl"
            class="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            target="_blank"
          >
            <CommonIcon name="download" class="w-3.5 h-3.5" />
            {{ __('Download Records (Excel)') }}
          </a>
        </div>

        <!-- Logs Table -->
        <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">

          <div v-if="logsLoading" class="py-16 flex items-center justify-center gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-xs text-slate-500">{{ __('Loading accounted time records...') }}</span>
          </div>

          <div v-else-if="logsData.length === 0" class="py-16 text-center text-slate-400">
            <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <CommonIcon name="clock" class="w-6 h-6 text-slate-400" />
            </div>
            <p class="text-sm font-semibold mb-0.5">{{ __('No Accounted Time Records') }}</p>
            <p class="text-xs text-slate-400">{{ __('No entries found for') }} {{ monthNames[selectedMonth - 1] }} {{ selectedYear }}.</p>
          </div>

          <!-- By Activity Table -->
          <table v-else-if="activeLogCategory === 'by_activity'" class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th class="py-3 px-6 w-24">#</th>
                <th class="py-3 px-6">{{ __('Title') }}</th>
                <th class="py-3 px-6">{{ __('Customer') }}</th>
                <th class="py-3 px-6">{{ __('Organization') }}</th>
                <th class="py-3 px-6">{{ __('Agent') }}</th>
                <th class="py-3 px-6 text-right">{{ __('Time Units') }}</th>
                <th v-if="areActivityTypesEnabled" class="py-3 px-6">{{ __('Activity Type') }}</th>
                <th class="py-3 px-6 text-right">{{ __('Created At') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <tr v-for="(row, rIdx) in logsData" :key="rIdx" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td class="py-3 px-6 font-mono font-semibold text-blue-600 dark:text-blue-400">
                  <router-link v-if="row.ticket?.id" :to="`/ticket/zoom/${row.ticket.id}`" class="hover:underline">
                    {{ row.ticket.number }}
                  </router-link>
                  <span v-else>-</span>
                </td>
                <td class="py-3 px-6 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" :title="row.ticket?.title">
                  {{ row.ticket?.title || '-' }}
                </td>
                <td class="py-3 px-6">{{ typeof row.customer === 'string' ? row.customer : row.customer?.fullname || '-' }}</td>
                <td class="py-3 px-6 text-slate-500">{{ typeof row.organization === 'string' ? row.organization : row.organization?.name || '-' }}</td>
                <td class="py-3 px-6 font-medium">{{ row.agent || '-' }}</td>
                <td class="py-3 px-6 text-right font-semibold text-blue-600 dark:text-blue-400">
                  {{ formatTimeUnit(row.time_unit) }}
                </td>
                <td v-if="areActivityTypesEnabled" class="py-3 px-6">
                  <span v-if="row.type" class="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {{ row.type }}
                  </span>
                  <span v-else class="text-slate-400">-</span>
                </td>
                <td class="py-3 px-6 text-right text-slate-400 whitespace-nowrap">
                  {{ formatDate(row.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- By Ticket Table -->
          <table v-else-if="activeLogCategory === 'by_ticket'" class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th class="py-3 px-6 w-24">#</th>
                <th class="py-3 px-6">{{ __('Title') }}</th>
                <th class="py-3 px-6">{{ __('Customer') }}</th>
                <th class="py-3 px-6">{{ __('Organization') }}</th>
                <th class="py-3 px-6">{{ __('Agent') }}</th>
                <th class="py-3 px-6 text-right">{{ __('Time Units') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <tr v-for="(row, rIdx) in logsData" :key="rIdx" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td class="py-3 px-6 font-mono font-semibold text-blue-600 dark:text-blue-400">
                  <router-link v-if="row.ticket?.id" :to="`/ticket/zoom/${row.ticket.id}`" class="hover:underline">
                    {{ row.ticket.number }}
                  </router-link>
                  <span v-else>-</span>
                </td>
                <td class="py-3 px-6 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[240px]" :title="row.ticket?.title">
                  {{ row.ticket?.title || '-' }}
                </td>
                <td class="py-3 px-6">{{ typeof row.customer === 'string' ? row.customer : row.customer?.fullname || '-' }}</td>
                <td class="py-3 px-6 text-slate-500">{{ typeof row.organization === 'string' ? row.organization : row.organization?.name || '-' }}</td>
                <td class="py-3 px-6 font-medium">{{ row.agent || '-' }}</td>
                <td class="py-3 px-6 text-right font-semibold text-blue-600 dark:text-blue-400">
                  {{ formatTimeUnit(row.time_unit) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- By Customer Table -->
          <table v-else-if="activeLogCategory === 'by_customer'" class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th class="py-3 px-6">{{ __('Customer') }}</th>
                <th class="py-3 px-6">{{ __('Organization') }}</th>
                <th class="py-3 px-6 text-right">{{ __('Time Units') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <tr v-for="(row, rIdx) in logsData" :key="rIdx" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td class="py-3 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  {{ typeof row.customer === 'string' ? row.customer : row.customer?.fullname || row.customer?.email || '-' }}
                </td>
                <td class="py-3 px-6 text-slate-500">
                  {{ typeof row.organization === 'string' ? row.organization : row.organization?.name || '-' }}
                </td>
                <td class="py-3 px-6 text-right font-semibold text-blue-600 dark:text-blue-400">
                  {{ formatTimeUnit(row.time_unit) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- By Organization Table -->
          <table v-else-if="activeLogCategory === 'by_organization'" class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th class="py-3 px-6">{{ __('Organization') }}</th>
                <th class="py-3 px-6 text-right">{{ __('Time Units') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <tr v-for="(row, rIdx) in logsData" :key="rIdx" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td class="py-3 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  {{ typeof row.organization === 'string' ? row.organization : row.organization?.name || '-' }}
                </td>
                <td class="py-3 px-6 text-right font-semibold text-blue-600 dark:text-blue-400">
                  {{ formatTimeUnit(row.time_unit) }}
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>

    </div>
  </LayoutContent>

  <!-- Activity Type Slide-over Drawer -->
  <Teleport to="body">
    <div
      v-if="showTypeDrawer"
      class="fixed inset-0 z-50 flex justify-end"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close drawer')"
        @click="showTypeDrawer = false"
      ></button>

      <div
        class="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10"
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="card-list" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ typeDrawerTitle }}</h2>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            :title="__('Close')"
            @click="showTypeDrawer = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Name -->
          <div>
            <label for="activity-type-name" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="activity-type-name"
              v-model="typeFormState.name"
              type="text"
              maxlength="100"
              :placeholder="__('e.g. Development, Consultation')"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Note -->
          <div>
            <label for="activity-type-note" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Note') }}
            </label>
            <textarea
              id="activity-type-note"
              v-model="typeFormState.note"
              rows="3"
              maxlength="250"
              :placeholder="__('Optional description for this activity type')"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>

          <!-- Default Checkbox -->
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                v-model="typeFormState.isDefault"
                type="checkbox"
                class="rounded text-blue-600 focus:ring-0"
              />
              <span>{{ __('Set as default activity type') }}</span>
            </label>
          </div>

          <!-- Active Toggle -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Active') }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Enabled for selection by agents.') }}</p>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="typeFormState.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
              @click="typeFormState.active = !typeFormState.active"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="typeFormState.active ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
              ></span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            @click="showTypeDrawer = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            :disabled="typeSubmitting"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-24 disabled:opacity-50"
            @click="saveActivityType"
          >
            <span v-if="typeSubmitting">{{ __('Saving...') }}</span>
            <span v-else>{{ typeFormState.id ? __('Save Changes') : __('Create Type') }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
