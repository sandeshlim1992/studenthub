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
  state_current?: {
    value?: unknown
  }
  state_initial?: {
    value?: unknown
  }
  options?: {
    form?: Array<{
      display?: string
      null?: boolean
      name?: string
      tag?: string
      options?: Record<string, string>
    }>
  }
  preferences?: Record<string, unknown>
}

interface GroupRecord {
  id: number
  name: string
  active: boolean
  note?: string
}

const router = useRouter()

// State
const isLoading = ref(true)
const isSaving = ref(false)
const isResetting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const settingsMap = ref<Record<string, SettingRecord>>({})
const groups = ref<GroupRecord[]>([])
const groupSearch = ref('')

// Form state
const customerTicketCreate = ref(true)
const selectedGroupIds = ref<number[]>([])
const ticketSecondaryAction = ref('stayOnTab')

// Initial snapshot for change detection
const initialTicketCreate = ref(true)
const initialGroupIds = ref<number[]>([])
const initialSecondaryAction = ref('stayOnTab')

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Web') },
]

const tabActionOptions = [
  {
    key: 'stayOnTab',
    title: __('Stay on tab'),
    badge: __('Default'),
    description: __('Keep current ticket tab open and active after performing an update or action.'),
    icon: 'window',
  },
  {
    key: 'closeTab',
    title: __('Close tab'),
    badge: __('Immediate'),
    description: __('Automatically close the ticket tab immediately after performing any ticket action.'),
    icon: 'x-circle',
  },
  {
    key: 'closeTabOnTicketClose',
    title: __('Close tab on ticket close'),
    badge: __('State-based'),
    description: __('Close the ticket tab only when the ticket is set to a closed state; otherwise keep it open.'),
    icon: 'check2-circle',
  },
  {
    key: 'closeNextInOverview',
    title: __('Next in overview'),
    badge: __('Workflow'),
    description: __('Close current ticket tab and automatically navigate to the next ticket from the overview list.'),
    icon: 'arrow-right-circle',
  },
]

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const hasUnsavedChanges = computed(() => {
  if (customerTicketCreate.value !== initialTicketCreate.value) return true
  if (ticketSecondaryAction.value !== initialSecondaryAction.value) return true

  const sortedCurrent = [...selectedGroupIds.value].sort((a, b) => a - b)
  const sortedInitial = [...initialGroupIds.value].sort((a, b) => a - b)
  if (sortedCurrent.length !== sortedInitial.length) return true
  return sortedCurrent.some((val, idx) => val !== sortedInitial[idx])
})

const filteredGroups = computed(() => {
  const query = groupSearch.value.trim().toLowerCase()
  if (!query) return groups.value
  return groups.value.filter((g) => g.name.toLowerCase().includes(query))
})

const isGroupSelected = (groupId: number) => {
  return selectedGroupIds.value.includes(groupId)
}

const toggleGroup = (groupId: number) => {
  if (isGroupSelected(groupId)) {
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => id !== groupId)
  } else {
    selectedGroupIds.value = [...selectedGroupIds.value, groupId]
  }
}

const selectAllGroups = () => {
  selectedGroupIds.value = groups.value.filter((g) => g.active).map((g) => g.id)
}

const clearGroupSelection = () => {
  selectedGroupIds.value = []
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => {
    successMessage.value = ''
  }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  successMessage.value = ''
}

const fetchData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [settingsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/settings', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/groups', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (settingsRes.ok) {
      const data: SettingRecord[] = await settingsRes.json()
      const map: Record<string, SettingRecord> = {}
      for (const s of data) {
        map[s.name] = s
      }
      settingsMap.value = map

      // Extract values
      const createVal = map['customer_ticket_create']?.state_current?.value
      customerTicketCreate.value = createVal !== undefined ? Boolean(createVal) : true
      initialTicketCreate.value = customerTicketCreate.value

      const rawGroupIds = map['customer_ticket_create_group_ids']?.state_current?.value
      let groupIdsArr: number[] = []
      if (Array.isArray(rawGroupIds)) {
        groupIdsArr = rawGroupIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
      }
      selectedGroupIds.value = groupIdsArr
      initialGroupIds.value = [...groupIdsArr]

      const secAction = map['ticket_secondary_action']?.state_current?.value
      ticketSecondaryAction.value = typeof secAction === 'string' && secAction ? secAction : 'stayOnTab'
      initialSecondaryAction.value = ticketSecondaryAction.value
    } else {
      showError(__('Failed to load web channel settings.'))
    }

    if (groupsRes.ok) {
      const gData: GroupRecord[] = await groupsRes.json()
      groups.value = gData
    }
  } catch (e) {
    showError(__('An unexpected error occurred while loading settings.'))
    console.error('Failed to load ChannelWeb settings:', e)
  } finally {
    isLoading.value = false
  }
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

const saveSettings = async () => {
  isSaving.value = true
  errorMessage.value = ''
  try {
    const promises: Promise<boolean>[] = []

    if (customerTicketCreate.value !== initialTicketCreate.value) {
      promises.push(updateSettingValue('customer_ticket_create', customerTicketCreate.value))
    }

    const sortedCurrent = [...selectedGroupIds.value].sort((a, b) => a - b)
    const sortedInitial = [...initialGroupIds.value].sort((a, b) => a - b)
    const groupsChanged =
      sortedCurrent.length !== sortedInitial.length ||
      sortedCurrent.some((val, idx) => val !== sortedInitial[idx])

    if (groupsChanged) {
      const payloadValue = selectedGroupIds.value.length > 0 ? selectedGroupIds.value : []
      promises.push(updateSettingValue('customer_ticket_create_group_ids', payloadValue))
    }

    if (ticketSecondaryAction.value !== initialSecondaryAction.value) {
      promises.push(updateSettingValue('ticket_secondary_action', ticketSecondaryAction.value))
    }

    const results = await Promise.all(promises)
    if (results.every((r) => r)) {
      initialTicketCreate.value = customerTicketCreate.value
      initialGroupIds.value = [...selectedGroupIds.value]
      initialSecondaryAction.value = ticketSecondaryAction.value
      showSuccess(__('Web channel settings saved successfully.'))
    } else {
      showError(__('Failed to save some settings. Please verify permissions.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred while saving.'))
    console.error('Failed to save settings:', e)
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (!confirm(__('Are you sure you want to reset Web Channel settings to their default values?'))) {
    return
  }
  isResetting.value = true
  errorMessage.value = ''
  try {
    const settingNames = [
      'customer_ticket_create',
      'customer_ticket_create_group_ids',
      'ticket_secondary_action',
    ]

    const promises = settingNames.map((name) => {
      const s = settingsMap.value[name]
      if (!s) return Promise.resolve(null)
      return fetch(`/api/v1/settings/reset/${s.id}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': getCsrf(),
        },
      })
    })

    await Promise.all(promises)
    await fetchData()
    showSuccess(__('Settings have been reset to default values.'))
  } catch (e) {
    showError(__('Failed to reset settings to defaults.'))
    console.error('Failed to reset settings:', e)
  } finally {
    isResetting.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
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
                <CommonIcon name="globe" class="w-5 h-5" />
              </span>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ __('Web Channel') }}</h1>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {{ __('Channels') }}
            </span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Configure the customer ticket portal behavior, group availability, and ticket tab workflows.') }}
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            :disabled="isLoading || isSaving || isResetting"
            @click="resetSettings"
          >
            <span v-if="isResetting">{{ __('Resetting...') }}</span>
            <span v-else>{{ __('Reset to Defaults') }}</span>
          </button>
          <button
            type="button"
            class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasUnsavedChanges || isLoading || isSaving || isResetting"
            @click="saveSettings"
          >
            <CommonIcon v-if="isSaving" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
            <CommonIcon v-else name="check2" class="w-3.5 h-3.5" />
            <span>{{ isSaving ? __('Saving...') : __('Save Changes') }}</span>
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

      <!-- Unsaved Changes Floating Banner -->
      <div v-if="hasUnsavedChanges && !isLoading" class="mb-6 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <CommonIcon name="info-circle" class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{{ __('You have unsaved changes in Web Channel configuration.') }}</span>
        </div>
        <button
          type="button"
          class="font-semibold text-amber-900 dark:text-amber-200 underline hover:no-underline cursor-pointer"
          @click="saveSettings"
        >
          {{ __('Save now') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-20 text-center text-slate-400">
        <CommonIcon name="arrow-repeat" class="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p class="text-sm font-medium">{{ __('Loading web channel settings...') }}</p>
      </div>

      <!-- Main Content Cards -->
      <div v-else class="space-y-6">

        <!-- ============================================================ -->
        <!-- CARD 1: Customer Ticket Creation                             -->
        <!-- ============================================================ -->
        <div
          id="customer_ticket_create"
          class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs"
        >
          <!-- Legacy automation selector compatibility (hidden) -->
          <select
            name="customer_ticket_create"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            :value="customerTicketCreate"
          >
            <option :value="true">yes</option>
            <option :value="false">no</option>
          </select>

          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="space-y-1 max-w-2xl">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                  {{ __('Enable Ticket Creation') }}
                </h2>
                <span
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="customerTicketCreate ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                >
                  {{ customerTicketCreate ? __('Enabled') : __('Disabled') }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Defines if a customer can create tickets via the web interface.') }}
              </p>
            </div>

            <!-- Master Toggle Button -->
            <button
              type="button"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden"
              :class="customerTicketCreate ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
              :aria-label="__('Toggle customer ticket creation')"
              :aria-pressed="customerTicketCreate"
              @click="customerTicketCreate = !customerTicketCreate"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="customerTicketCreate ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
              ></span>
            </button>
          </div>

          <!-- Status Banner -->
          <div
            class="mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-colors"
            :class="customerTicketCreate
              ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300'
              : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'"
          >
            <CommonIcon
              :name="customerTicketCreate ? 'check-circle' : 'exclamation-circle'"
              class="w-4 h-4 shrink-0 mt-0.5"
            />
            <div>
              <p v-if="customerTicketCreate">
                {{ __('Customers can create new tickets through the web self-service portal. Below you can restrict which groups are visible for ticket submission.') }}
              </p>
              <p v-else>
                {{ __('Customer ticket creation is currently disabled. Customers can log in to check the status of existing tickets, but cannot submit new tickets through the web interface.') }}
              </p>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- CARD 2: Group Selection for Ticket Creation                  -->
        <!-- ============================================================ -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                  {{ __('Group Selection for Ticket Creation') }}
                </h2>
                <span
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="selectedGroupIds.length === 0 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'"
                >
                  {{ selectedGroupIds.length === 0 ? __('All Groups Available') : `${selectedGroupIds.length} ${__('Selected')}` }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Defines groups for which a customer can create tickets via web interface. No selection means all groups are available.') }}
              </p>
            </div>

            <!-- Group Quick Actions -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                @click="selectAllGroups"
              >
                {{ __('Select All') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                @click="clearGroupSelection"
              >
                {{ __('Clear Selection (All Groups)') }}
              </button>
            </div>
          </div>

          <!-- Group Search Filter -->
          <div class="relative max-w-sm mb-4">
            <input
              v-model="groupSearch"
              type="text"
              class="w-full ltr:pl-9 rtl:pr-9 ltr:pr-4 rtl:pl-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              :aria-label="__('Filter groups...')"
              :placeholder="__('Filter groups...')"
            />
            <div class="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <CommonIcon name="search" class="w-3.5 h-3.5" />
            </div>
          </div>

          <!-- Groups Grid -->
          <div v-if="filteredGroups.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <button
              v-for="group in filteredGroups"
              :key="group.id"
              type="button"
              class="flex items-center justify-between p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer"
              :class="isGroupSelected(group.id)
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-xs'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'"
              @click="toggleGroup(group.id)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                  :class="isGroupSelected(group.id)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'"
                >
                  <CommonIcon v-if="isGroupSelected(group.id)" name="check" class="w-3 h-3" />
                </div>
                <div class="min-w-0">
                  <span class="text-xs font-semibold truncate block">{{ group.name }}</span>
                  <span v-if="group.note" class="text-[11px] text-slate-400 truncate block">{{ group.note }}</span>
                </div>
              </div>
              <span
                v-if="!group.active"
                class="px-1.5 py-0.5 rounded-sm text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 shrink-0"
              >
                {{ __('Inactive') }}
              </span>
            </button>
          </div>

          <!-- Empty Search State -->
          <div v-else class="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30">
            <p class="text-xs text-slate-500">{{ __('No groups match your search query.') }}</p>
          </div>

          <!-- Group Helper Information -->
          <p class="mt-4 text-[11px] text-slate-400 flex items-center gap-1.5">
            <CommonIcon name="info-circle" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ __('If no groups are selected, customers are allowed to submit tickets to all active groups.') }}</span>
          </p>
        </div>

        <!-- ============================================================ -->
        <!-- CARD 3: Tab Behaviour After Ticket Action                    -->
        <!-- ============================================================ -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div class="mb-4 space-y-1">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {{ __('Tab Behaviour After Ticket Action') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Defines the tab behaviour after an agent or user performs a ticket action.') }}
            </p>
          </div>

          <!-- Options Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <button
              v-for="opt in tabActionOptions"
              :key="opt.key"
              type="button"
              class="relative p-4 rounded-xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between"
              :class="ticketSecondaryAction === opt.key
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-xs'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600'"
              @click="ticketSecondaryAction = opt.key"
            >
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="p-1.5 rounded-lg"
                      :class="ticketSecondaryAction === opt.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
                    >
                      <CommonIcon :name="opt.icon" class="w-4 h-4" />
                    </span>
                    <span class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ opt.title }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {{ opt.badge }}
                    </span>
                    <div
                      class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                      :class="ticketSecondaryAction === opt.key
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'"
                    >
                      <span v-if="ticketSecondaryAction === opt.key" class="w-1.5 h-1.5 rounded-full bg-white"></span>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ opt.description }}
                </p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  </LayoutContent>
</template>
