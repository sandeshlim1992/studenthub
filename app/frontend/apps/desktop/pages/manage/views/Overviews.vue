<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface OverviewItem {
  id: number
  name: string
  link: string
  roles: string[]
  role_ids: number[]
  users: string[]
  user_ids: number[]
  active: boolean
  prio: number
  organization_shared: boolean
  out_of_office: boolean
  group_by?: string
  group_direction?: string
  order?: { by: string; direction: string }
  view?: { s: string[] }
  condition?: Record<string, { operator: string; value?: string[]; pre_condition?: string }>
}

interface PreviewTicket {
  id: number
  number: string
  title: string
  state: string
  created_at: string
}

const TICKET_ATTRIBUTES = [
  { value: 'number', label: 'Number' },
  { value: 'title', label: 'Title' },
  { value: 'customer', label: 'Customer' },
  { value: 'organization', label: 'Organization' },
  { value: 'group', label: 'Group' },
  { value: 'owner', label: 'Owner' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'created_at', label: 'Created at' },
  { value: 'updated_at', label: 'Updated at' },
]

const TICKET_SORT_ATTRIBUTES = [
  { value: 'number', label: 'Number' },
  { value: 'title', label: 'Title' },
  { value: 'customer', label: 'Customer' },
  { value: 'organization', label: 'Organization' },
  { value: 'group', label: 'Group' },
  { value: 'owner', label: 'Owner' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'created_at', label: 'Created at' },
  { value: 'updated_at', label: 'Updated at' },
]

const router = useRouter()
const overviews = ref<OverviewItem[]>([])
const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuOverviewId = ref<number | null>(null)

const rolesList = ref<{ id: number; name: string }[]>([])
const groupsList = ref<{ id: number; name: string }[]>([])
const usersList = ref<{ id: number; fullname: string; login: string }[]>([])
const ticketStatesList = ref<{ id: number; name: string }[]>([])
const ticketPrioritiesList = ref<{ id: number; name: string }[]>([])

const userSearchQuery = ref('')
const filteredUsers = computed(() => {
  const q = userSearchQuery.value.trim().toLowerCase()
  if (!q) return usersList.value.slice(0, 50)
  return usersList.value.filter((u) =>
    u.fullname?.toLowerCase().includes(q) || u.login?.toLowerCase().includes(q)
  ).slice(0, 50)
})

const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

const previewLoading = ref(false)
const previewTickets = ref<PreviewTicket[]>([])
const previewTotal = ref(0)
const previewError = ref('')

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const defaultFormState = () => ({
  id: null as number | null,
  name: '',
  active: true,
  prio: 1000,
  organization_shared: false,
  out_of_office: false,
  group_by: '',
  group_direction: 'DESC',
  order_by: 'created_at',
  order_direction: 'DESC',
  role_ids: [] as number[],
  user_ids: [] as number[],
  view_s: ['number', 'title', 'customer', 'owner', 'state', 'created_at'] as string[],
  conditions: [] as { field: string; operator: string; values: string[]; pre_condition?: string }[]
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Overviews') }
]

const toggleActionMenu = (overviewId: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuOverviewId.value = activeActionMenuOverviewId.value === overviewId ? null : overviewId
}

const closeActionMenu = () => { activeActionMenuOverviewId.value = null }

const buildConditionPayload = () => {
  const payload: Record<string, { operator: string; value: string[]; pre_condition?: string }> = {}
  for (const cond of formState.value.conditions) {
    let key = ''
    if (cond.field === 'state') key = 'ticket.state_id'
    else if (cond.field === 'priority') key = 'ticket.priority_id'
    else if (cond.field === 'group') key = 'ticket.group_id'
    else if (cond.field === 'owner') key = 'ticket.owner_id'
    else if (cond.field === 'customer') key = 'ticket.customer_id'
    else if (cond.field === 'organization') key = 'ticket.organization_id'
    if (key) {
      payload[key] = { operator: cond.operator, value: cond.values }
      if (cond.pre_condition) payload[key].pre_condition = cond.pre_condition
    }
  }
  return payload
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
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() },
      body: JSON.stringify({ condition: buildConditionPayload() })
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
        const stateName = stateAssets[stateId]?.name ?? ticketStatesList.value.find(s => s.id === Number(stateId))?.name ?? ''
        return {
          id: Number(id),
          number: String(t.number ?? ''),
          title: String(t.title ?? ''),
          state: stateName,
          created_at: String(t.created_at ?? '')
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

const fetchOverviews = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/overviews?expand=true', {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        overviews.value = data.sort((a, b) => a.prio - b.prio)
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage overviews.')
    } else {
      errorText.value = `Failed to load overviews (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch overviews:', e)
    errorText.value = __('Error fetching overviews. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchMetadata = async () => {
  try {
    const [rolesRes, groupsRes, statesRes, prioritiesRes, usersRes] = await Promise.all([
      fetch('/api/v1/roles', { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_states', { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_priorities', { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/users?per_page=500', { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
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

const filteredOverviews = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return overviews.value
  return overviews.value.filter(o => o.name.toLowerCase().includes(query))
})

const handleNewOverview = () => {
  formState.value = defaultFormState()
  formState.value.role_ids = rolesList.value.filter(r => r.name === 'Agent').map(r => r.id)
  formState.value.conditions = [{ field: 'state', operator: 'is', values: [] }]
  previewTickets.value = []
  previewTotal.value = 0
  previewError.value = ''
  drawerTitle.value = __('New Overview')
  showDrawer.value = true
}

const handleEditOverview = (overview: OverviewItem) => {
  const fs = defaultFormState()
  fs.id = overview.id
  fs.name = overview.name
  fs.active = overview.active
  fs.prio = overview.prio || 1000
  fs.organization_shared = overview.organization_shared || false
  fs.out_of_office = overview.out_of_office || false
  fs.group_by = overview.group_by || ''
  fs.group_direction = overview.group_direction || 'DESC'
  fs.order_by = overview.order?.by || 'created_at'
  fs.order_direction = overview.order?.direction || 'DESC'
  fs.role_ids = [...(overview.role_ids || [])]
  fs.user_ids = [...(overview.user_ids || [])]
  fs.view_s = [...(overview.view?.s || ['number', 'title', 'customer', 'owner', 'state', 'created_at'])]

  const parsedConditions: { field: string; operator: string; values: string[]; pre_condition?: string }[] = []
  if (overview.condition) {
    for (const [key, cond] of Object.entries(overview.condition)) {
      let field = ''
      if (key === 'ticket.state_id') field = 'state'
      else if (key === 'ticket.priority_id') field = 'priority'
      else if (key === 'ticket.group_id') field = 'group'
      else if (key === 'ticket.owner_id') field = 'owner'
      else if (key === 'ticket.customer_id') field = 'customer'
      else if (key === 'ticket.organization_id') field = 'organization'
      if (field) {
        parsedConditions.push({
          field,
          operator: cond.operator || 'is',
          values: Array.isArray(cond.value) ? cond.value.map(String) : [],
          pre_condition: cond.pre_condition
        })
      }
    }
  }
  fs.conditions = parsedConditions
  formState.value = fs
  drawerTitle.value = __('Edit Overview')
  showDrawer.value = true
  fetchPreview()
}

const saveOverview = async () => {
  if (!formState.value.name.trim()) { alert(__('Name is required.')); return }
  if (formState.value.role_ids.length === 0) { alert(__('Please select at least one role.')); return }
  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      active: formState.value.active,
      prio: formState.value.prio,
      organization_shared: formState.value.organization_shared,
      out_of_office: formState.value.out_of_office,
      group_by: formState.value.group_by,
      group_direction: formState.value.group_direction,
      order: { by: formState.value.order_by, direction: formState.value.order_direction },
      condition: buildConditionPayload(),
      role_ids: formState.value.role_ids,
      user_ids: formState.value.user_ids.length > 0 ? formState.value.user_ids : null,
      view: { s: formState.value.view_s }
    }
    const isEdit = formState.value.id !== null
    const res = await fetch(isEdit ? `/api/v1/overviews/${formState.value.id}` : '/api/v1/overviews', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() },
      body: JSON.stringify(payload)
    })
    if (res.ok) { showDrawer.value = false; fetchOverviews() }
    else { const d = await res.json(); alert(d.error || __('Failed to save overview.')) }
  } catch (e) {
    console.error('Failed to save overview:', e)
  } finally {
    submitting.value = false
  }
}

const movePriority = async (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= overviews.value.length) return
  const list = [...overviews.value]
  const temp = list[index]; list[index] = list[newIndex]; list[newIndex] = temp
  const prios = list.map((item, idx) => [item.id, idx + 1])
  try {
    const res = await fetch('/api/v1/overviews_prio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() },
      body: JSON.stringify({ prios })
    })
    if (res.ok) fetchOverviews()
  } catch (e) { console.error('Failed to swap priorities:', e) }
}

const handleDeleteOverview = async (overviewId: number, name: string) => {
  if (!confirm(`Are you sure you want to delete overview "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/overviews/${overviewId}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() }
    })
    if (res.ok) fetchOverviews()
    else { const d = await res.json(); alert(d.error || __('Failed to delete overview.')) }
  } catch (e) { console.error('Failed to delete overview:', e) }
}

const toggleActiveState = async (overview: OverviewItem) => {
  try {
    const res = await fetch(`/api/v1/overviews/${overview.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': getCsrf() },
      body: JSON.stringify({ active: !overview.active })
    })
    if (res.ok) fetchOverviews()
  } catch (e) { console.error('Failed to update active state:', e) }
}

onMounted(() => {
  fetchOverviews()
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
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Overviews') }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewOverview"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New Overview') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for overviews')"
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
              <th class="py-4 px-6 text-center w-24">{{ __('Order') }}</th>
              <th class="py-4 px-6">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Link') }}</th>
              <th class="py-4 px-6">{{ __('Access Roles') }}</th>
              <th class="py-4 px-6">{{ __('Group By') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="7" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredOverviews.length === 0">
            <tr>
              <td colspan="7" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="card-list" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No overviews found') }}</h3>
                <p class="text-xs">{{ __('No overviews matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="(overview, index) in filteredOverviews"
              :key="overview.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditOverview(overview)"
            >
              <!-- Order -->
              <td class="py-3 px-6 text-center" @click.stop>
                <div class="flex items-center justify-center gap-1">
                  <button @click="movePriority(index, 'up')" :disabled="index === 0" class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                    <CommonIcon name="chevron-up" class="w-3.5 h-3.5" />
                  </button>
                  <button @click="movePriority(index, 'down')" :disabled="index === overviews.length - 1" class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                    <CommonIcon name="chevron-down" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">{{ overview.name }}</td>
              <!-- Link -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">
                {{ overview.link || '-' }}
              </td>
              <!-- Roles -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                <span v-if="overview.roles && overview.roles.length > 0" class="flex flex-wrap gap-1">
                  <span v-for="role in overview.roles" :key="role" class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs">{{ role }}</span>
                </span>
                <span v-else>-</span>
              </td>
              <!-- Group By -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 capitalize">{{ overview.group_by || '-' }}</td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(overview)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="overview.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button @click="toggleActionMenu(overview.id, $event)" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuOverviewId === overview.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button @click="handleEditOverview(overview)" class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button @click="handleDeleteOverview(overview.id, overview.name)" class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
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
    <div v-if="showDrawer" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end" @click="showDrawer = false">
      <div class="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col" @click.stop>

        <!-- Drawer Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="card-list" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button @click="showDrawer = false" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Name') }} <span class="text-red-500">*</span></label>
            <input v-model="formState.name" type="text" :placeholder="__('Overview name')" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>

          <!-- Roles -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Available for the following roles') }} <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label
                v-for="role in rolesList" :key="role.id"
                class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                :class="formState.role_ids.includes(role.id) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'"
              >
                <input type="checkbox" :value="role.id" v-model="formState.role_ids" class="rounded text-blue-600" />
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ role.name }}</span>
              </label>
            </div>
          </div>

          <!-- Restrict to Users -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Restrict to only the following users') }}</label>
            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div class="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <input v-model="userSearchQuery" type="text" :placeholder="__('Search users...')" class="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div class="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                <label
                  v-for="user in filteredUsers" :key="user.id"
                  class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  :class="formState.user_ids.includes(user.id) ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:bg-transparent'"
                >
                  <input type="checkbox" :value="user.id" v-model="formState.user_ids" class="rounded text-blue-600" />
                  <span class="text-slate-700 dark:text-slate-200">{{ user.fullname || user.login }}</span>
                  <span class="text-slate-400 dark:text-slate-500 ml-auto text-[10px]">{{ user.login }}</span>
                </label>
                <div v-if="filteredUsers.length === 0" class="px-3 py-4 text-xs text-slate-400 text-center bg-white dark:bg-transparent">{{ __('No users found') }}</div>
              </div>
              <div v-if="formState.user_ids.length > 0" class="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 border-t border-slate-200 dark:border-slate-700 text-xs text-blue-600 dark:text-blue-400 font-medium">
                {{ formState.user_ids.length }} {{ __('user(s) selected') }}
              </div>
            </div>
          </div>

          <!-- Organization Shared -->
          <div class="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{{ __('Only available for users with shared organizations') }}</h3>
            <div class="flex items-center gap-3 shrink-0">
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input type="radio" :value="true" v-model="formState.organization_shared" class="text-blue-600" />{{ __('yes') }}</label>
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input type="radio" :value="false" v-model="formState.organization_shared" class="text-blue-600" />{{ __('no') }}</label>
            </div>
          </div>

          <!-- Out of Office -->
          <div class="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{{ __('Only available for users which are absence replacements for other users.') }}</h3>
            <div class="flex items-center gap-3 shrink-0">
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input type="radio" :value="true" v-model="formState.out_of_office" class="text-blue-600" />{{ __('yes') }}</label>
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input type="radio" :value="false" v-model="formState.out_of_office" class="text-blue-600" />{{ __('no') }}</label>
            </div>
          </div>

          <!-- Conditions -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Conditions for shown tickets') }} <span class="text-red-500">*</span></label>
            <div class="space-y-3">
              <div v-for="(cond, idx) in formState.conditions" :key="idx" class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl relative">
                <button @click="formState.conditions.splice(idx, 1)" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 cursor-pointer">
                  <CommonIcon name="trash3" class="w-4 h-4" />
                </button>
                <div class="grid grid-cols-2 gap-3 mb-3 pr-8">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Field') }}</label>
                    <select v-model="cond.field" @change="cond.values = []; delete cond.pre_condition" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
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
                    <select v-model="cond.operator" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                      <option value="is">{{ __('is') }}</option>
                      <option value="is not">{{ __('is not') }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">{{ __('Value') }}</label>
                  <div v-if="cond.field === 'state'" class="flex flex-wrap gap-1.5">
                    <label v-for="state in ticketStatesList" :key="state.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(state.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="checkbox" :value="String(state.id)" v-model="cond.values" class="rounded text-blue-600" /><span>{{ state.name }}</span>
                    </label>
                  </div>
                  <div v-else-if="cond.field === 'priority'" class="flex flex-wrap gap-1.5">
                    <label v-for="prio in ticketPrioritiesList" :key="prio.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(prio.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="checkbox" :value="String(prio.id)" v-model="cond.values" class="rounded text-blue-600" /><span>{{ prio.name }}</span>
                    </label>
                  </div>
                  <div v-else-if="cond.field === 'group'" class="flex flex-wrap gap-1.5">
                    <label v-for="grp in groupsList" :key="grp.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(grp.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="checkbox" :value="String(grp.id)" v-model="cond.values" class="rounded text-blue-600" /><span>{{ grp.name }}</span>
                    </label>
                  </div>
                  <div v-else-if="cond.field === 'owner'" class="space-y-2">
                    <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="radio" :checked="cond.pre_condition === 'current_user.id'" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" class="text-blue-600" />
                      <span>{{ __('Current User') }}</span>
                    </label>
                    <div class="flex flex-wrap gap-1.5">
                      <label v-for="user in usersList.slice(0, 30)" :key="user.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(user.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                        <input type="checkbox" :value="String(user.id)" v-model="cond.values" @change="() => { if (cond.values.length > 0) delete cond.pre_condition }" class="rounded text-blue-600" />
                        <span>{{ user.fullname || user.login }}</span>
                      </label>
                    </div>
                  </div>
                  <div v-else-if="cond.field === 'customer'">
                    <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="radio" :checked="cond.pre_condition === 'current_user.id'" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" class="text-blue-600" />
                      <span>{{ __('Current User') }}</span>
                    </label>
                  </div>
                  <div v-else-if="cond.field === 'organization'">
                    <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.organization_id' ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input type="radio" :checked="cond.pre_condition === 'current_user.organization_id'" @change="() => { cond.pre_condition = 'current_user.organization_id'; cond.values = [] }" class="text-blue-600" />
                      <span>{{ __("Current User's Organization") }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <button @click="formState.conditions.push({ field: 'state', operator: 'is', values: [] })" class="w-full px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1">
                <CommonIcon name="plus" class="w-3.5 h-3.5" />{{ __('Add Condition') }}
              </button>
            </div>
          </div>

          <!-- Preview -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{{ __('Preview') }}</label>
              <button @click="fetchPreview" class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
                <CommonIcon name="arrow-clockwise" class="w-3 h-3" />{{ __('Refresh') }}
              </button>
            </div>
            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div v-if="previewLoading" class="py-8 flex items-center justify-center gap-2">
                <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span class="text-xs text-slate-500">{{ __('Loading preview...') }}</span>
              </div>
              <div v-else-if="previewError" class="py-6 text-center text-xs text-red-500 px-4">{{ previewError }}</div>
              <div v-else-if="formState.conditions.length === 0" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500">{{ __('Add conditions above to see a preview of matching tickets.') }}</div>
              <div v-else>
                <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">{{ previewTotal }} {{ __('matching ticket(s) found') }}</span>
                  <span v-if="previewTickets.length > 0" class="text-[10px] text-slate-400">{{ __('(showing first 6)') }}</span>
                </div>
                <div v-if="previewTickets.length === 0" class="py-6 text-center text-xs text-slate-400 dark:text-slate-500">{{ __('No matching tickets found.') }}</div>
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
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{{ ticket.state }}</span>
                      </td>
                      <td class="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">{{ ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Attributes -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Attributes') }} <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label v-for="attr in TICKET_ATTRIBUTES" :key="attr.value" class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors" :class="formState.view_s.includes(attr.value) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                <input type="checkbox" :value="attr.value" v-model="formState.view_s" class="rounded text-blue-600 shrink-0" />
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ __(attr.label) }}</span>
              </label>
            </div>
          </div>

          <!-- Sorting By -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Sorting by') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.order_by" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option v-for="attr in TICKET_SORT_ATTRIBUTES" :key="attr.value" :value="attr.value">{{ __(attr.label) }}</option>
            </select>
          </div>

          <!-- Sorting Order -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Sorting order') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.order_direction" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="ASC">{{ __('ascending') }}</option>
              <option value="DESC">{{ __('descending') }}</option>
            </select>
          </div>

          <!-- Grouping By -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Grouping by') }}</label>
            <select v-model="formState.group_by" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="">-</option>
              <option value="customer">{{ __('Customer') }}</option>
              <option value="state">{{ __('State') }}</option>
              <option value="priority">{{ __('Priority') }}</option>
              <option value="group">{{ __('Group') }}</option>
              <option value="owner">{{ __('Owner') }}</option>
            </select>
          </div>

          <!-- Grouping Order -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Grouping order') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.group_direction" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="ASC">{{ __('ascending') }}</option>
              <option value="DESC">{{ __('descending') }}</option>
            </select>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Active') }} <span class="text-red-500">*</span></h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the overview is enabled for authorized users.') }}</p>
            </div>
            <button @click="formState.active = !formState.active" class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none" :class="formState.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'">
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200" :class="formState.active ? 'translate-x-5' : 'translate-x-0'"></span>
            </button>
          </div>

          <!-- Position -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Position') }}</label>
            <input v-model.number="formState.prio" type="number" min="1" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>

        </div>

        <!-- Drawer Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button @click="showDrawer = false" class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer">{{ __('Cancel') }}</button>
          <button @click="saveOverview" :disabled="submitting" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed">
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save') }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
