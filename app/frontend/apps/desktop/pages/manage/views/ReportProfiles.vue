<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ReportProfileItem {
  id: number
  name: string
  active: boolean
  role_ids: number[]
  condition?: Record<string, { operator: string; value?: string[]; pre_condition?: string }>
  created_at?: string
  updated_at?: string
}

interface RoleItem {
  id: number
  name: string
}

interface MetaItem {
  id: number
  name: string
}

interface UserItem {
  id: number
  fullname: string
  login: string
}

interface PreviewTicket {
  id: number
  number: string
  title: string
  state: string
  created_at: string
}

interface ConditionRow {
  field: string
  operator: string
  values: string[]
  pre_condition?: string
}

const router = useRouter()
const profiles = ref<ReportProfileItem[]>([])
const rolesList = ref<RoleItem[]>([])
const groupsList = ref<MetaItem[]>([])
const ticketStatesList = ref<MetaItem[]>([])
const ticketPrioritiesList = ref<MetaItem[]>([])
const usersList = ref<UserItem[]>([])

const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuId = ref<number | null>(null)

// Drawer / Form state
const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

// Preview state
const previewLoading = ref(false)
const previewTickets = ref<PreviewTicket[]>([])
const previewTotal = ref(0)
const previewError = ref('')

const defaultFormState = () => ({
  id: null as number | null,
  name: '',
  active: true,
  role_ids: [] as number[],
  conditions: [] as ConditionRow[],
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Report Profiles') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const getRoleName = (roleId: number) => {
  const role = rolesList.value.find((r) => r.id === roleId)
  return role ? role.name : `#${roleId}`
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

const buildConditionPayload = () => {
  const payload: Record<string, { operator: string; value?: string[]; pre_condition?: string }> = {}
  for (const cond of formState.value.conditions) {
    let key = ''
    if (cond.field === 'state') key = 'ticket.state_id'
    else if (cond.field === 'priority') key = 'ticket.priority_id'
    else if (cond.field === 'group') key = 'ticket.group_id'
    else if (cond.field === 'owner') key = 'ticket.owner_id'
    else if (cond.field === 'customer') key = 'ticket.customer_id'
    else if (cond.field === 'organization') key = 'ticket.organization_id'

    if (key) {
      if (cond.pre_condition) {
        payload[key] = { operator: cond.operator, pre_condition: cond.pre_condition }
      } else if (cond.values && cond.values.length > 0) {
        payload[key] = { operator: cond.operator, value: cond.values }
      }
    }
  }
  return payload
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
      const obj = rawVal as { operator?: string; value?: unknown; pre_condition?: string }
      operator = obj.operator || 'is'
      pre_condition = obj.pre_condition
      if (Array.isArray(obj.value)) {
        values = obj.value.map(String)
      } else if (obj.value !== undefined && obj.value !== null) {
        values = [String(obj.value)]
      }
    }

    rows.push({ field, operator, values, pre_condition })
  }
  return rows
}

const getConditionSummary = (profile: ReportProfileItem) => {
  if (!profile.condition || Object.keys(profile.condition).length === 0) {
    return []
  }
  const summaries: { field: string; operator: string; values: string[] }[] = []
  for (const [key, cond] of Object.entries(profile.condition)) {
    let field = ''
    let valueNames: string[] = []

    if (key === 'ticket.state_id') {
      field = __('State')
      const ids = Array.isArray(cond.value) ? cond.value : cond.value ? [cond.value] : []
      valueNames = ids.map((id) => ticketStatesList.value.find((s) => String(s.id) === String(id))?.name || `#${id}`)
    } else if (key === 'ticket.priority_id') {
      field = __('Priority')
      const ids = Array.isArray(cond.value) ? cond.value : cond.value ? [cond.value] : []
      valueNames = ids.map((id) => ticketPrioritiesList.value.find((p) => String(p.id) === String(id))?.name || `#${id}`)
    } else if (key === 'ticket.group_id') {
      field = __('Group')
      const ids = Array.isArray(cond.value) ? cond.value : cond.value ? [cond.value] : []
      valueNames = ids.map((id) => groupsList.value.find((g) => String(g.id) === String(id))?.name || `#${id}`)
    } else if (key === 'ticket.owner_id') {
      field = __('Owner')
      if (cond.pre_condition === 'current_user.id') {
        valueNames = [__('Current User')]
      } else {
        const ids = Array.isArray(cond.value) ? cond.value : cond.value ? [cond.value] : []
        valueNames = ids.map((id) => usersList.value.find((u) => String(u.id) === String(id))?.fullname || `#${id}`)
      }
    } else if (key === 'ticket.customer_id') {
      field = __('Customer')
      if (cond.pre_condition === 'current_user.id') {
        valueNames = [__('Current User')]
      }
    } else if (key === 'ticket.organization_id') {
      field = __('Organization')
      if (cond.pre_condition === 'current_user.organization_id') {
        valueNames = [__("Current User's Organization")]
      }
    } else {
      field = key.replace('ticket.', '')
      valueNames = Array.isArray(cond.value) ? cond.value.map(String) : cond.value ? [String(cond.value)] : []
    }

    summaries.push({
      field,
      operator: cond.operator || 'is',
      values: valueNames.filter(Boolean),
    })
  }
  return summaries
}

const fetchPreview = async () => {
  if (formState.value.conditions.length === 0) {
    previewTickets.value = []
    previewTotal.value = 0
    previewError.value = ''
    return
  }
  previewLoading.value = true
  previewError.value = ''
  try {
    const res = await fetch('/api/v1/tickets/selector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ condition: buildConditionPayload() }),
    })
    if (res.ok) {
      const data = await res.json()
      previewTotal.value = data.object_count ?? 0
      const ticketAssets: Record<string, Record<string, unknown>> = data.assets?.Ticket ?? {}
      const stateAssets: Record<string, Record<string, string>> = data.assets?.TicketState ?? {}
      const ticketIds: number[] = Array.isArray(data.object_ids) ? data.object_ids : []
      previewTickets.value = ticketIds.slice(0, 6).map((id) => {
        const t = ticketAssets[String(id)] ?? {}
        const stateId = String(t.state_id ?? '')
        const stateName = stateAssets[stateId]?.name ?? ticketStatesList.value.find((s) => s.id === Number(stateId))?.name ?? ''
        return {
          id: Number(id),
          number: String(t.number ?? ''),
          title: String(t.title ?? ''),
          state: stateName,
          created_at: String(t.created_at ?? ''),
        }
      })
    } else {
      previewError.value = __('Could not load preview.')
    }
  } catch {
    previewError.value = __('Could not load preview.')
  } finally {
    previewLoading.value = false
  }
}

const fetchProfiles = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/report_profiles?expand=true', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        profiles.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else if (data && Array.isArray(data.records)) {
        profiles.value = data.records.sort((a: ReportProfileItem, b: ReportProfileItem) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage report profiles.')
    } else {
      errorText.value = `Failed to load report profiles (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch report profiles:', e)
    errorText.value = __('Error fetching report profiles. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchMetadata = async () => {
  try {
    const [rolesRes, groupsRes, statesRes, prioritiesRes, usersRes] = await Promise.all([
      fetch('/api/v1/roles', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_states', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_priorities', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/users?per_page=500', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])
    if (rolesRes.ok) rolesList.value = await rolesRes.json()
    if (groupsRes.ok) groupsList.value = await groupsRes.json()
    if (statesRes.ok) ticketStatesList.value = await statesRes.json()
    if (prioritiesRes.ok) ticketPrioritiesList.value = await prioritiesRes.json()
    if (usersRes.ok) usersList.value = await usersRes.json()
  } catch (e) {
    console.error('Failed to fetch metadata:', e)
  }
}

const filteredProfiles = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return profiles.value
  return profiles.value.filter((p) => {
    if (p.name.toLowerCase().includes(query)) return true
    if (p.role_ids && p.role_ids.some((rId) => getRoleName(rId).toLowerCase().includes(query))) return true
    return false
  })
})

const handleNewProfile = () => {
  formState.value = defaultFormState()
  formState.value.role_ids = rolesList.value.filter((r) => r.name === 'Admin' || r.name === 'Agent').map((r) => r.id)
  previewTickets.value = []
  previewTotal.value = 0
  previewError.value = ''
  drawerTitle.value = __('New Report Profile')
  showDrawer.value = true
}

const handleEditProfile = (profile: ReportProfileItem) => {
  formState.value = {
    id: profile.id,
    name: profile.name || '',
    active: profile.active ?? true,
    role_ids: [...(profile.role_ids || [])],
    conditions: parseConditionToRows(profile.condition as Record<string, unknown>),
  }
  drawerTitle.value = __('Edit Report Profile')
  showDrawer.value = true
  fetchPreview()
}

const handleCloneProfile = (profile: ReportProfileItem) => {
  formState.value = {
    id: null,
    name: `${__('Copy of')} ${profile.name}`,
    active: profile.active ?? true,
    role_ids: [...(profile.role_ids || [])],
    conditions: parseConditionToRows(profile.condition as Record<string, unknown>),
  }
  drawerTitle.value = __('Clone Report Profile')
  showDrawer.value = true
  fetchPreview()
}

const saveProfile = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name.trim(),
      active: formState.value.active,
      role_ids: formState.value.role_ids,
      condition: buildConditionPayload(),
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/report_profiles/${formState.value.id}` : '/api/v1/report_profiles'
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
      fetchProfiles()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save report profile.'))
    }
  } catch (e) {
    console.error('Failed to save report profile:', e)
    alert(__('An error occurred while saving.'))
  } finally {
    submitting.value = false
  }
}

const toggleActiveState = async (profile: ReportProfileItem) => {
  try {
    const res = await fetch(`/api/v1/report_profiles/${profile.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !profile.active }),
    })
    if (res.ok) {
      profile.active = !profile.active
    } else {
      fetchProfiles()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

const handleDeleteProfile = async (profileId: number, name: string) => {
  if (!confirm(`${__('Are you sure you want to delete report profile')} "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/report_profiles/${profileId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchProfiles()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete report profile.'))
    }
  } catch (e) {
    console.error('Failed to delete report profile:', e)
  }
}

const selectAllRoles = () => {
  formState.value.role_ids = rolesList.value.map((r) => r.id)
}

const deselectAllRoles = () => {
  formState.value.role_ids = []
}

onMounted(() => {
  fetchProfiles()
  fetchMetadata()
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
            :title="__('Back to Administration')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CommonIcon name="calendar-range" class="w-6 h-6 text-blue-500" />
              {{ __('Report Profiles') }}
              <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
            </h1>
          </div>
        </div>
        <button
          @click="handleNewProfile"
          class="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          <CommonIcon name="plus" class="w-4 h-4" />
          {{ __('New Profile') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for report profiles...')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table Container -->
      <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 w-1/4">{{ __('Name') }}</th>
              <th class="py-4 px-6 w-1/3">{{ __('Filter') }}</th>
              <th class="py-4 px-6">{{ __('Access Roles') }}</th>
              <th class="py-4 px-6 text-center w-24">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-32">{{ __('Updated') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 4" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-right"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 ml-auto"></div></td>
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
          <tbody v-else-if="filteredProfiles.length === 0">
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="calendar-range" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No report profiles found') }}</h3>
                <p class="text-xs">{{ __('No report profiles match the selected search query.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data Rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="profile in filteredProfiles"
              :key="profile.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
              @click="handleEditProfile(profile)"
            >
              <!-- Name -->
              <td class="py-4 px-6">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {{ profile.name }}
                  </span>
                  <span v-if="profile.name === '-all-'" class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {{ __('system') }}
                  </span>
                </div>
              </td>

              <!-- Condition / Filter Summary -->
              <td class="py-4 px-6">
                <div v-if="getConditionSummary(profile).length === 0">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    {{ __('All tickets') }}
                  </span>
                </div>
                <div v-else class="flex flex-wrap gap-1.5 max-w-lg">
                  <span
                    v-for="(summary, sIdx) in getConditionSummary(profile)"
                    :key="sIdx"
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <span class="font-medium text-slate-500 dark:text-slate-400">{{ summary.field }}:</span>
                    <span v-if="summary.operator !== 'is'" class="text-slate-400 italic text-[11px]">{{ summary.operator }}</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ summary.values.join(', ') }}</span>
                  </span>
                </div>
              </td>

              <!-- Access Roles -->
              <td class="py-4 px-6">
                <div v-if="profile.role_ids && profile.role_ids.length > 0" class="flex flex-wrap gap-1">
                  <span
                    v-for="roleId in profile.role_ids"
                    :key="roleId"
                    class="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded text-xs font-medium"
                  >
                    {{ getRoleName(roleId) }}
                  </span>
                </div>
                <span v-else class="text-xs text-slate-400 italic">
                  {{ __('All roles') }}
                </span>
              </td>

              <!-- Active Status -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(profile)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="profile.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 hover:bg-slate-200'"
                  :title="profile.active ? __('Active (click to deactivate)') : __('Inactive (click to activate)')"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>

              <!-- Updated -->
              <td class="py-4 px-6 text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {{ formatDate(profile.updated_at) }}
              </td>

              <!-- Actions 3-dots -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(profile.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>

                <!-- Action Menu Dropdown -->
                <div
                  v-if="activeActionMenuId === profile.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="() => { closeActionMenu(); handleEditProfile(profile) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Edit') }}
                    </button>
                    <button
                      @click="() => { closeActionMenu(); handleCloneProfile(profile) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="() => { closeActionMenu(); handleDeleteProfile(profile.id, profile.name) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <CommonIcon name="trash3" class="w-3.5 h-3.5 mr-2.5 text-red-400" />
                      {{ __('Delete') }}
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

  <!-- Slide-over Drawer for Create / Edit -->
  <Teleport to="body">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end"
      @click="showDrawer = false"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        @click.stop
      >
        <!-- Drawer Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="calendar-range" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button
            @click="showDrawer = false"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">

          <!-- Name Field -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="100"
              :placeholder="__('Profile name (e.g., 1st Level Support)')"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <!-- Active Toggle -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Active') }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if this report profile is available for analytics.') }}</p>
            </div>
            <button
              @click="formState.active = !formState.active"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="formState.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="formState.active ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>

          <!-- Roles Multi-select -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {{ __('Available for the following roles') }}
              </label>
              <div class="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  @click="selectAllRoles"
                  class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {{ __('Select all') }}
                </button>
                <span class="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  @click="deselectAllRoles"
                  class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  {{ __('Deselect all') }}
                </button>
              </div>
            </div>
            <p class="text-xs text-slate-400 mb-2.5">
              {{ __('If no roles are selected, this profile will be accessible to all roles with reporting permissions.') }}
            </p>
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label
                v-for="role in rolesList"
                :key="role.id"
                class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                :class="formState.role_ids.includes(role.id) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20 font-medium' : 'border-slate-200 dark:border-slate-700'"
              >
                <input
                  type="checkbox"
                  :value="role.id"
                  v-model="formState.role_ids"
                  class="rounded text-blue-600 focus:ring-0"
                />
                <span class="text-slate-700 dark:text-slate-200">{{ role.name }}</span>
              </label>
            </div>
          </div>

          <!-- Conditions / Filter Builder -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {{ __('Filter / Conditions') }}
              </label>
              <button
                type="button"
                @click="formState.conditions.push({ field: 'state', operator: 'is', values: [] })"
                class="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <CommonIcon name="plus" class="w-3.5 h-3.5" />
                {{ __('Add Condition') }}
              </button>
            </div>
            <p class="text-xs text-slate-400 mb-3">
              {{ __('Filter which tickets are included in reports when this profile is active. If empty, all tickets are included.') }}
            </p>

            <div v-if="formState.conditions.length === 0" class="p-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center bg-slate-50 dark:bg-slate-800/30">
              <p class="text-xs text-slate-500 mb-2">{{ __('No conditions defined. All tickets will be included in the report.') }}</p>
              <button
                type="button"
                @click="formState.conditions.push({ field: 'state', operator: 'is', values: [] })"
                class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
              >
                <CommonIcon name="plus" class="w-3.5 h-3.5 text-blue-500" />
                {{ __('Add First Condition') }}
              </button>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(cond, idx) in formState.conditions"
                :key="idx"
                class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl relative"
              >
                <button
                  @click="formState.conditions.splice(idx, 1)"
                  class="absolute top-3 right-3 text-slate-400 hover:text-red-500 cursor-pointer"
                  :title="__('Remove Condition')"
                >
                  <CommonIcon name="trash3" class="w-4 h-4" />
                </button>

                <div class="grid grid-cols-2 gap-3 mb-3 pr-8">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Field') }}</label>
                    <select
                      v-model="cond.field"
                      @change="() => { cond.values = []; delete cond.pre_condition }"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Operator') }}</label>
                    <select
                      v-model="cond.operator"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="is">{{ __('is') }}</option>
                      <option value="is not">{{ __('is not') }}</option>
                    </select>
                  </div>
                </div>

                <!-- Values based on Field -->
                <div>
                  <label class="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">{{ __('Value') }}</label>

                  <!-- State -->
                  <div v-if="cond.field === 'state'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="state in ticketStatesList"
                      :key="state.id"
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.values.includes(String(state.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="checkbox"
                        :value="String(state.id)"
                        v-model="cond.values"
                        class="rounded text-blue-600 focus:ring-0"
                      />
                      <span>{{ state.name }}</span>
                    </label>
                  </div>

                  <!-- Priority -->
                  <div v-else-if="cond.field === 'priority'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="prio in ticketPrioritiesList"
                      :key="prio.id"
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.values.includes(String(prio.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="checkbox"
                        :value="String(prio.id)"
                        v-model="cond.values"
                        class="rounded text-blue-600 focus:ring-0"
                      />
                      <span>{{ prio.name }}</span>
                    </label>
                  </div>

                  <!-- Group -->
                  <div v-else-if="cond.field === 'group'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="grp in groupsList"
                      :key="grp.id"
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.values.includes(String(grp.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="checkbox"
                        :value="String(grp.id)"
                        v-model="cond.values"
                        class="rounded text-blue-600 focus:ring-0"
                      />
                      <span>{{ grp.name }}</span>
                    </label>
                  </div>

                  <!-- Owner -->
                  <div v-else-if="cond.field === 'owner'" class="space-y-2">
                    <label
                      class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :checked="cond.pre_condition === 'current_user.id'"
                        @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }"
                        class="text-blue-600 focus:ring-0"
                      />
                      <span>{{ __('Current User') }}</span>
                    </label>
                    <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                      <label
                        v-for="user in usersList.slice(0, 30)"
                        :key="user.id"
                        class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                        :class="cond.values.includes(String(user.id)) ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'"
                      >
                        <input
                          type="checkbox"
                          :value="String(user.id)"
                          v-model="cond.values"
                          @change="() => { if (cond.values.length > 0) delete cond.pre_condition }"
                          class="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{{ user.fullname || user.login }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Customer -->
                  <div v-else-if="cond.field === 'customer'">
                    <label
                      class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :checked="cond.pre_condition === 'current_user.id'"
                        @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }"
                        class="text-blue-600 focus:ring-0"
                      />
                      <span>{{ __('Current User') }}</span>
                    </label>
                  </div>

                  <!-- Organization -->
                  <div v-else-if="cond.field === 'organization'">
                    <label
                      class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="cond.pre_condition === 'current_user.organization_id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 font-medium' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :checked="cond.pre_condition === 'current_user.organization_id'"
                        @change="() => { cond.pre_condition = 'current_user.organization_id'; cond.values = [] }"
                        class="text-blue-600 focus:ring-0"
                      />
                      <span>{{ __("Current User's Organization") }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview Matching Tickets -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {{ __('Preview') }}
              </label>
              <button
                type="button"
                @click="fetchPreview"
                class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <CommonIcon name="arrow-clockwise" class="w-3 h-3" />
                {{ __('Refresh Preview') }}
              </button>
            </div>

            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div v-if="previewLoading" class="py-8 flex items-center justify-center gap-2">
                <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span class="text-xs text-slate-500">{{ __('Loading preview...') }}</span>
              </div>
              <div v-else-if="previewError" class="py-6 text-center text-xs text-red-500 px-4">
                {{ previewError }}
              </div>
              <div v-else-if="formState.conditions.length === 0" class="py-6 text-center text-xs text-slate-400 dark:text-slate-500 px-4">
                {{ __('Add conditions above and click Refresh to preview matching tickets.') }}
              </div>
              <div v-else>
                <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {{ previewTotal }} {{ __('matching ticket(s) found') }}
                  </span>
                  <span v-if="previewTickets.length > 0" class="text-[10px] text-slate-400">
                    {{ __('(showing first 6)') }}
                  </span>
                </div>
                <div v-if="previewTickets.length === 0" class="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  {{ __('No matching tickets found for this condition.') }}
                </div>
                <table v-else class="w-full text-left">
                  <thead>
                    <tr class="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20">
                      <th class="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase">#</th>
                      <th class="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase">{{ __('Title') }}</th>
                      <th class="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase">{{ __('State') }}</th>
                      <th class="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase">{{ __('Created') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="ticket in previewTickets" :key="ticket.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td class="px-4 py-2 text-xs font-mono text-blue-500 dark:text-blue-400">{{ ticket.number }}</td>
                      <td class="px-4 py-2 text-xs text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{{ ticket.title }}</td>
                      <td class="px-4 py-2 text-xs">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {{ ticket.state }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">
                        {{ formatDate(ticket.created_at) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        <!-- Drawer Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            @click="showDrawer = false"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            @click="saveProfile"
            :disabled="submitting"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-24 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ formState.id ? __('Save Changes') : __('Create Profile') }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
