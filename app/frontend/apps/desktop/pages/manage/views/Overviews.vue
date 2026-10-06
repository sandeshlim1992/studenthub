<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface OverviewItem {
  id: number
  name: string
  link: string
  roles?: string[]
  role_ids: number[]
  users?: string[]
  user_ids: number[]
  active: boolean
  prio: number
  organization_shared: boolean
  out_of_office: boolean
  group_by?: string
  group_direction?: string
  order?: { by: string; direction: string }
  view?: { s: string[] }
  condition?: Record<string, { operator?: string; value?: string[] | string; pre_condition?: string; range?: string; value_completion?: string }>
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
  text_value?: string
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
  { value: 'escalation_at', label: __('First response escalation') },
  { value: 'close_escalation_at', label: __('Close escalation') },
  { value: 'pending_time', label: __('Pending till') },
  { value: 'tags', label: 'Tags' },
  { value: 'campus', label: 'Campus' },
  { value: 'created_at', label: __('Created at') },
  { value: 'updated_at', label: __('Updated at') },
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
  { value: 'escalation_at', label: __('First response escalation') },
  { value: 'close_escalation_at', label: __('Close escalation') },
  { value: 'pending_time', label: __('Pending till') },
  { value: 'created_at', label: __('Created at') },
  { value: 'updated_at', label: __('Updated at') },
]

const GROUP_BY_ATTRIBUTES = [
  { value: '', label: '-' },
  { value: 'customer', label: 'Customer' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'group', label: 'Group' },
  { value: 'owner', label: 'Owner' },
  { value: 'organization', label: 'Organization' },
  { value: 'campus', label: 'Campus' },
  { value: 'itil_type', label: __('ITIL Type') },
]

const router = useRouter()
const overviews = ref<OverviewItem[]>([])
const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuOverviewId = ref<number | null>(null)
const actionMenuPosition = ref({ top: 0, right: 0 })
const actionError = ref('')
const togglingIds = ref<Record<number, boolean>>({})

// Views Student Hub manages, so their toggle, order and delete are locked here: the Teams views
// follow the groups (Studenthub::TicketViews::Teams), the Institutions views the organisations
// (Studenthub::TicketViews::Institutions), the approval views the Ticket Approvals switch
// (Studenthub::TicketApproval::Setup.sync_overviews). The sync undoes changes.
const TEAM_LINK_PREFIX = 'studenthub_team_'
const INSTITUTION_LINK_PREFIX = 'studenthub_institution_'
const APPROVAL_LINKS = new Set(['awaiting_my_approval', 'sent_for_approval'])
const managedKind = (overview: OverviewItem): 'team' | 'institution' | 'approval' | null => {
  if (overview.link?.startsWith(TEAM_LINK_PREFIX)) return 'team'
  if (overview.link?.startsWith(INSTITUTION_LINK_PREFIX)) return 'institution'
  if (overview.link && APPROVAL_LINKS.has(overview.link)) return 'approval'
  return null
}
const isManaged = (overview: OverviewItem) => managedKind(overview) !== null

const managedOrderTitle = (overview: OverviewItem) => {
  if (managedKind(overview) === 'team') return __('Teams views follow the groups and are sorted by name.')
  if (managedKind(overview) === 'institution') return __('Site views follow the organizations and are sorted by name.')
  return __('Approval views are always listed first, under Approval needed.')
}

const managedBadgeTitle = (overview: OverviewItem) => {
  if (managedKind(overview) === 'team') return __('Kept in step with the groups: switch off or remove the group to remove this view.')
  if (managedKind(overview) === 'institution') return __('Kept in step with the organizations: switch off or remove the organization to remove this view.')
  return __('Kept in step with Ticket Approvals: on for managers and agents while it is on, hidden while it is off.')
}

const managedSwitchTitle = (overview: OverviewItem) => {
  if (managedKind(overview) === 'team') return __('Teams views are always on. Switch off the group instead.')
  if (managedKind(overview) === 'institution') return __('Site views are always on. Switch off the organization instead.')
  return overview.active
    ? __('On while Ticket Approvals is on.')
    : __('Off while Ticket Approvals is off.')
}

// Drag and drop state
const draggedOverviewId = ref<number | null>(null)
const dragOverId = ref<number | null>(null)

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

// Preserved conditions that aren't represented in standard editor rows
const rawExtraConditions = ref<Record<string, unknown>>({})

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
  conditions: [] as ConditionRow[]
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Overviews') }
]

// The menu is drawn over the page (Teleport), so the table box can't cut it off.
const toggleActionMenu = (overviewId: number, event: Event) => {
  event.stopPropagation()
  if (activeActionMenuOverviewId.value === overviewId) {
    activeActionMenuOverviewId.value = null
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  actionMenuPosition.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right }
  activeActionMenuOverviewId.value = overviewId
}

// The overview open in the drawer is managed by Student Hub
const editingOverview = computed(() =>
  formState.value.id === null ? undefined : overviews.value.find((o) => o.id === formState.value.id)
)
const editingManaged = computed(() => editingOverview.value !== undefined && isManaged(editingOverview.value))
const managedDrawerNote = computed(() => {
  const kind = editingOverview.value ? managedKind(editingOverview.value) : null
  if (kind === 'approval') return __('Approval views are kept in step with Ticket Approvals: name, roles, conditions and on/off are set automatically.')
  if (kind === 'institution') return __('Site views are kept in step with the organizations: name, roles, conditions, on/off and position are set automatically.')
  return __('Teams views are kept in step with the groups: name, roles, conditions, on/off and position are set automatically.')
})

const actionMenuOverview = computed(() =>
  overviews.value.find((o) => o.id === activeActionMenuOverviewId.value) ?? null
)

const closeActionMenu = () => { activeActionMenuOverviewId.value = null }

// Role name lookup map
const rolesMap = computed(() => {
  const map: Record<number, string> = {}
  for (const r of rolesList.value) {
    map[r.id] = r.name
  }
  return map
})

// Build condition payload preserving all standard, specialized, and raw extra conditions
const buildConditionPayload = () => {
  const payload: Record<string, unknown> = { ...rawExtraConditions.value }

  for (const cond of formState.value.conditions) {
    let key = ''
    if (cond.field === 'state') key = 'ticket.state_id'
    else if (cond.field === 'priority') key = 'ticket.priority_id'
    else if (cond.field === 'group') key = 'ticket.group_id'
    else if (cond.field === 'owner') key = 'ticket.owner_id'
    else if (cond.field === 'customer') key = 'ticket.customer_id'
    else if (cond.field === 'organization') key = 'ticket.organization_id'
    else if (cond.field === 'tags') key = 'ticket.tags'
    else if (cond.field === 'mention_user_ids') key = 'ticket.mention_user_ids'
    else if (cond.field === 'out_of_office_replacement_id') key = 'ticket.out_of_office_replacement_id'
    else if (cond.field) key = cond.field.startsWith('ticket.') ? cond.field : `ticket.${cond.field}`

    if (!key) continue

    if (key === 'ticket.tags') {
      payload[key] = {
        operator: cond.operator || 'contains one',
        value: cond.text_value || ''
      }
    } else if (cond.pre_condition) {
      payload[key] = {
        operator: cond.operator || 'is',
        pre_condition: cond.pre_condition,
        value: [],
        value_completion: ''
      }
    } else {
      payload[key] = {
        operator: cond.operator || 'is',
        value: cond.values || []
      }
    }
  }

  return payload
}

// Live ticket preview
const fetchPreview = async () => {
  if (formState.value.conditions.length === 0 && Object.keys(rawExtraConditions.value).length === 0) {
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
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      },
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

// Fetch all overviews
// silent: refresh after a change without blanking the table
const fetchOverviews = async (silent = false) => {
  if (!silent) isLoading.value = true
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

// Fetch metadata
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

// Filtered list by search
const filteredOverviews = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return overviews.value
  return overviews.value.filter(o =>
    o.name.toLowerCase().includes(query) ||
    (o.link && o.link.toLowerCase().includes(query))
  )
})

// Create Overview handler
const handleNewOverview = () => {
  formState.value = defaultFormState()
  formState.value.role_ids = rolesList.value.filter(r => r.name === 'Agent').map(r => r.id)
  formState.value.conditions = [{ field: 'state', operator: 'is', values: [] }]
  rawExtraConditions.value = {}
  previewTickets.value = []
  previewTotal.value = 0
  previewError.value = ''
  drawerTitle.value = __('New Overview')
  showDrawer.value = true
}

// Populate conditions from overview record into form state
const populateConditionsFromOverview = (overview: OverviewItem, fs: ReturnType<typeof defaultFormState>) => {
  const parsedConditions: ConditionRow[] = []
  const extra: Record<string, unknown> = {}

  if (overview.condition) {
    for (const [key, cond] of Object.entries(overview.condition)) {
      if (key === 'ticket.state_id') {
        parsedConditions.push({
          field: 'state',
          operator: cond.operator || 'is',
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.priority_id') {
        parsedConditions.push({
          field: 'priority',
          operator: cond.operator || 'is',
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.group_id') {
        parsedConditions.push({
          field: 'group',
          operator: cond.operator || 'is',
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.owner_id') {
        parsedConditions.push({
          field: 'owner',
          operator: cond.operator || 'is',
          pre_condition: cond.pre_condition,
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.customer_id') {
        parsedConditions.push({
          field: 'customer',
          operator: cond.operator || 'is',
          pre_condition: cond.pre_condition,
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.organization_id') {
        parsedConditions.push({
          field: 'organization',
          operator: cond.operator || 'is',
          pre_condition: cond.pre_condition,
          values: Array.isArray(cond.value) ? cond.value.map(String) : []
        })
      } else if (key === 'ticket.tags') {
        parsedConditions.push({
          field: 'tags',
          operator: cond.operator || 'contains one',
          values: [],
          text_value: typeof cond.value === 'string' ? cond.value : Array.isArray(cond.value) ? cond.value.join(', ') : ''
        })
      } else if (key === 'ticket.mention_user_ids') {
        parsedConditions.push({
          field: 'mention_user_ids',
          operator: cond.operator || 'is',
          pre_condition: 'current_user.id',
          values: []
        })
      } else if (key === 'ticket.out_of_office_replacement_id') {
        parsedConditions.push({
          field: 'out_of_office_replacement_id',
          operator: cond.operator || 'is',
          pre_condition: 'current_user.id',
          values: []
        })
      } else {
        // Preserve unedited conditions (e.g. pending_time, escalation_at, campus, etc.)
        extra[key] = cond
      }
    }
  }

  fs.conditions = parsedConditions
  rawExtraConditions.value = extra
}

// Clone Overview handler
const handleCloneOverview = (overview: OverviewItem) => {
  activeActionMenuOverviewId.value = null
  const fs = defaultFormState()
  fs.id = null
  fs.name = `${__('Clone')}: ${overview.name}`
  fs.active = overview.active
  fs.prio = (overviews.value.length + 1) * 10
  fs.organization_shared = overview.organization_shared || false
  fs.out_of_office = overview.out_of_office || false
  fs.group_by = overview.group_by || ''
  fs.group_direction = overview.group_direction || 'DESC'
  fs.order_by = overview.order?.by || 'created_at'
  fs.order_direction = overview.order?.direction || 'DESC'
  fs.role_ids = [...(overview.role_ids || [])]
  fs.user_ids = [...(overview.user_ids || [])]
  fs.view_s = [...(overview.view?.s || ['number', 'title', 'customer', 'owner', 'state', 'created_at'])]

  populateConditionsFromOverview(overview, fs)
  formState.value = fs
  drawerTitle.value = __('New Overview')
  showDrawer.value = true
  fetchPreview()
}

// Edit Overview handler
const handleEditOverview = (overview: OverviewItem) => {
  activeActionMenuOverviewId.value = null
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

  populateConditionsFromOverview(overview, fs)
  formState.value = fs
  drawerTitle.value = __('Edit Overview')
  showDrawer.value = true
  fetchPreview()
}

// Navigate to view tickets for this overview
const handleViewOverview = (overview: OverviewItem) => {
  activeActionMenuOverviewId.value = null
  if (overview.link) {
    router.push(`/desktop/ticket/view/${overview.link}`)
  }
}

// Save overview
const saveOverview = async () => {
  if (!formState.value.name.trim()) { alert(__('Name is required.')); return }
  if (formState.value.role_ids.length === 0) { alert(__('Please select at least one role.')); return }
  submitting.value = true
  try {
    const payload = {
      name: formState.value.name.trim(),
      active: formState.value.active,
      prio: formState.value.prio,
      organization_shared: formState.value.organization_shared,
      out_of_office: formState.value.out_of_office,
      group_by: formState.value.group_by || null,
      group_direction: formState.value.group_direction || 'DESC',
      order: { by: formState.value.order_by, direction: formState.value.order_direction },
      condition: buildConditionPayload(),
      role_ids: formState.value.role_ids,
      user_ids: formState.value.user_ids.length > 0 ? formState.value.user_ids : null,
      view: { s: formState.value.view_s }
    }
    const isEdit = formState.value.id !== null
    const res = await fetch(isEdit ? `/api/v1/overviews/${formState.value.id}` : '/api/v1/overviews', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      showDrawer.value = false
      fetchOverviews(true)
    } else {
      const d = await res.json()
      alert(d.error_human || d.error || __('Failed to save overview.'))
    }
  } catch (e) {
    console.error('Failed to save overview:', e)
  } finally {
    submitting.value = false
  }
}

// Reordering: not while searching (the rows shown aren't the whole list), and only among the
// rows that aren't managed. They swap their existing order numbers, so the Teams (5000+) and
// institution (9000+) numbers stay where they are.
const canReorder = computed(() => !searchQuery.value.trim())

const reorderableIds = computed(() => overviews.value.filter((o) => !isManaged(o)).map((o) => o.id))

const canMove = (overview: OverviewItem, direction: 'up' | 'down') => {
  const ids = reorderableIds.value
  const pos = ids.indexOf(overview.id)
  return pos !== -1 && (direction === 'up' ? pos > 0 : pos < ids.length - 1)
}

const postHeaders = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-CSRF-Token': getCsrf()
})

const saveOrder = async (orderedIds: number[]) => {
  const byId = new Map(overviews.value.map((o) => [o.id, o]))
  const prios = orderedIds.map((id) => byId.get(id)?.prio ?? 0).sort((a, b) => a - b)
  // Overviews sharing a number would not move, so make each one higher than the last.
  for (let i = 1; i < prios.length; i++) {
    if (prios[i] <= prios[i - 1]) prios[i] = prios[i - 1] + 1
  }
  const changed = orderedIds
    .map((id, idx): [number, number] => [id, prios[idx]])
    .filter(([id, prio]) => byId.get(id)?.prio !== prio)
  if (changed.length === 0) return

  const setPrios = (prioById: Map<number, number>) => {
    overviews.value.forEach((o) => {
      const prio = prioById.get(o.id)
      if (prio !== undefined) o.prio = prio
    })
    overviews.value.sort((a, b) => a.prio - b.prio)
  }
  const previousPrios = new Map(changed.map(([id]): [number, number] => [id, byId.get(id)?.prio ?? 0]))
  setPrios(new Map(changed))
  actionError.value = ''

  try {
    const res = await fetch('/api/v1/overviews_prio', {
      method: 'POST',
      headers: postHeaders(),
      body: JSON.stringify({ prios: changed })
    })
    if (!res.ok) throw new Error(`Status ${res.status}`)
    fetchOverviews(true)
  } catch (e) {
    console.error('Failed to save overview order:', e)
    setPrios(previousPrios)
    actionError.value = __('The new order could not be saved.')
  }
}

const moveOverview = (fromId: number, toId: number) => {
  const ids = [...reorderableIds.value]
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from === -1 || to === -1 || from === to) return
  ids.splice(to, 0, ...ids.splice(from, 1))
  saveOrder(ids)
}

// Drag & drop
const onDragStart = (event: DragEvent, overview: OverviewItem) => {
  draggedOverviewId.value = overview.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(overview.id))
  }
}

const onDragOver = (event: DragEvent, overview: OverviewItem) => {
  if (draggedOverviewId.value === null || isManaged(overview)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverId.value = overview.id
}

const onDragEnd = () => {
  draggedOverviewId.value = null
  dragOverId.value = null
}

const onDrop = (event: DragEvent, overview: OverviewItem) => {
  event.preventDefault()
  const fromId = draggedOverviewId.value
  onDragEnd()
  if (fromId !== null) moveOverview(fromId, overview.id)
}

// Arrow buttons: swap with the next movable overview above or below
const movePriority = (overview: OverviewItem, direction: 'up' | 'down') => {
  const ids = reorderableIds.value
  const pos = ids.indexOf(overview.id)
  const target = ids[direction === 'up' ? pos - 1 : pos + 1]
  if (pos !== -1 && target !== undefined) moveOverview(overview.id, target)
}

// Delete overview
const handleDeleteOverview = async (overviewId: number, name: string) => {
  activeActionMenuOverviewId.value = null
  if (!confirm(`Are you sure you want to delete overview "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/overviews/${overviewId}`, {
      method: 'DELETE',
      headers: postHeaders()
    })
    if (res.ok) fetchOverviews(true)
    else { const d = await res.json(); alert(d.error || __('Failed to delete overview.')) }
  } catch (e) {
    console.error('Failed to delete overview:', e)
  }
}

// Toggle active state: switches at once, goes back if the save fails
const toggleActiveState = async (overview: OverviewItem) => {
  if (isManaged(overview) || togglingIds.value[overview.id]) return
  const active = !overview.active
  const setActive = (value: boolean) => {
    const row = overviews.value.find((o) => o.id === overview.id)
    if (row) row.active = value
  }

  togglingIds.value = { ...togglingIds.value, [overview.id]: true }
  actionError.value = ''
  setActive(active)
  try {
    const res = await fetch(`/api/v1/overviews/${overview.id}`, {
      method: 'PUT',
      headers: postHeaders(),
      body: JSON.stringify({ active })
    })
    if (!res.ok) throw new Error(`Status ${res.status}`)
  } catch (e) {
    console.error('Failed to update active state:', e)
    setActive(!active)
    actionError.value = __('"%s" could not be switched on or off.').replace('%s', overview.name)
  } finally {
    const rest = { ...togglingIds.value }
    delete rest[overview.id]
    togglingIds.value = rest
  }
}

const closeActionMenuOnScroll = () => { activeActionMenuOverviewId.value = null }

onMounted(() => {
  fetchOverviews()
  fetchMetadata()
  window.addEventListener('click', closeActionMenu)
  window.addEventListener('scroll', closeActionMenuOnScroll, true)
  window.addEventListener('resize', closeActionMenuOnScroll)
})

onUnmounted(() => {
  window.removeEventListener('click', closeActionMenu)
  window.removeEventListener('scroll', closeActionMenuOnScroll, true)
  window.removeEventListener('resize', closeActionMenuOnScroll)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100" @click="closeActionMenu">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <button
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Overviews') }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400 rtl:mr-1 ltr:ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2"
          @click="handleNewOverview"
        >
          <CommonIcon name="plus" class="w-4 h-4" />
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
            class="w-full py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all rtl:pr-10 ltr:pl-10 rtl:pl-4 ltr:pr-4"
          />
          <div class="absolute top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3.5 ltr:left-3.5">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Error from a toggle or reorder -->
      <div v-if="actionError" class="mb-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
        <CommonIcon name="exclamation-triangle" class="w-4 h-4 shrink-0" />
        <span class="flex-1">{{ actionError }}</span>
        <button class="p-1 rounded cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30" :title="__('Dismiss')" @click="actionError = ''">
          <CommonIcon name="x-lg" class="w-3 h-3" />
        </button>
      </div>

      <!-- Table Section -->
      <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs mb-6 overflow-x-auto">
        <table class="w-full min-w-[56rem] text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 text-center w-28">{{ __('Order') }}</th>
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
              <td class="py-4 px-6 text-center"><div class="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-9 mx-auto"></div></td>
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

          <!-- Data rows with Drag & Drop -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="overview in filteredOverviews"
              :key="overview.id"
              :draggable="canReorder && !isManaged(overview)"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              :class="{
                'opacity-40 bg-slate-100 dark:bg-slate-800': draggedOverviewId === overview.id,
                'border-t-2 border-blue-500': dragOverId === overview.id && draggedOverviewId !== overview.id,
                'opacity-60': !overview.active
              }"
              @dragstart="onDragStart($event, overview)"
              @dragover="onDragOver($event, overview)"
              @drop="onDrop($event, overview)"
              @dragend="onDragEnd"
              @click="handleEditOverview(overview)"
            >
              <!-- Order & Drag Handle -->
              <td class="py-3 px-6 text-center" @click.stop>
                <div v-if="isManaged(overview)" class="flex items-center justify-center text-slate-300 dark:text-slate-600" :title="managedOrderTitle(overview)">
                  <CommonIcon name="lock" class="w-3.5 h-3.5" />
                </div>
                <div v-else-if="canReorder" class="flex items-center justify-center gap-1.5">
                  <span class="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1" :title="__('Drag to reorder')">
                    <CommonIcon name="three-dots-vertical" class="w-3.5 h-3.5 inline rtl:-ml-1 ltr:-mr-1" />
                    <CommonIcon name="three-dots-vertical" class="w-3.5 h-3.5 inline" />
                  </span>
                  <div class="flex items-center gap-0.5">
                    <button
                      :disabled="!canMove(overview, 'up')"
                      class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      :title="__('Move up')"
                      @click="movePriority(overview, 'up')"
                    >
                      <CommonIcon name="chevron-up" class="w-3 h-3" />
                    </button>
                    <button
                      :disabled="!canMove(overview, 'down')"
                      class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      :title="__('Move down')"
                      @click="movePriority(overview, 'down')"
                    >
                      <CommonIcon name="chevron-down" class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <span v-else class="text-xs text-slate-400" :title="__('Clear the search to reorder')">{{ overview.prio }}</span>
              </td>
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                <div class="flex items-center gap-2">
                  <span>{{ overview.name }}</span>
                  <span
                    v-if="isManaged(overview)"
                    class="shrink-0 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"
                    :title="managedBadgeTitle(overview)"
                  >{{ __('Managed automatically') }}</span>
                </div>
              </td>
              <!-- Link -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span class="block max-w-60 truncate" :title="overview.link">{{ overview.link || '-' }}</span>
              </td>
              <!-- Access Roles -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                <span v-if="overview.role_ids && overview.role_ids.length > 0" class="flex flex-wrap gap-1">
                  <span
                    v-for="rId in overview.role_ids"
                    :key="rId"
                    class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs whitespace-nowrap"
                  >
                    {{ rolesMap[rId] || (overview.roles ? overview.roles[overview.role_ids.indexOf(rId)] : `#${rId}`) }}
                  </span>
                </span>
                <span v-else>-</span>
              </td>
              <!-- Group By -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 capitalize">
                {{ overview.group_by ? __(overview.group_by) : '-' }}
              </td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="overview.active"
                  :aria-label="__('Switch %s on or off').replace('%s', overview.name)"
                  :title="isManaged(overview) ? managedSwitchTitle(overview) : (overview.active ? __('Active') : __('Inactive'))"
                  :disabled="isManaged(overview) || togglingIds[overview.id]"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 align-middle"
                  :class="overview.active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'"
                  @click="toggleActiveState(overview)"
                >
                  <span
                    class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
                    :class="overview.active ? 'ltr:translate-x-4 rtl:-translate-x-4' : 'rtl:-translate-x-0 ltr:translate-x-0'"
                  />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right" @click.stop>
                <button
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  :aria-label="__('Actions')"
                  @click="toggleActionMenu(overview.id, $event)"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Row actions, drawn over the page so the table box doesn't cut them off -->
      <Teleport to="body">
        <div
          v-if="actionMenuOverview"
          class="fixed w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-40 overflow-hidden text-left"
          :style="{ top: `${actionMenuPosition.top}px`, right: `${actionMenuPosition.right}px` }"
          @click.stop
        >
          <div class="py-1.5">
            <button
              class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              @click="handleEditOverview(actionMenuOverview)"
            >
              <CommonIcon name="pencil" class="w-3.5 h-3.5 text-slate-400 rtl:ml-2.5 ltr:mr-2.5" />
              {{ __('Edit') }}
            </button>
            <button
              class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              @click="handleCloneOverview(actionMenuOverview)"
            >
              <CommonIcon name="copy" class="w-3.5 h-3.5 text-slate-400 rtl:ml-2.5 ltr:mr-2.5" />
              {{ __('Clone') }}
            </button>
            <button
              v-if="actionMenuOverview.link"
              class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              @click="handleViewOverview(actionMenuOverview)"
            >
              <CommonIcon name="card-list" class="w-3.5 h-3.5 text-slate-400 rtl:ml-2.5 ltr:mr-2.5" />
              {{ __('View Tickets') }}
            </button>
            <template v-if="!isManaged(actionMenuOverview)">
              <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <button
                class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                @click="handleDeleteOverview(actionMenuOverview.id, actionMenuOverview.name)"
              >
                <CommonIcon name="trash3" class="w-3.5 h-3.5 text-red-400 rtl:ml-2.5 ltr:mr-2.5" />
                {{ __('Delete') }}
              </button>
            </template>
          </div>
        </div>
      </Teleport>

    </div>
  </LayoutContent>

  <!-- Slide-Over Drawer for Overview Configuration -->
  <Teleport to="body">
    <div v-if="showDrawer" class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end" @click="showDrawer = false">
      <div class="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col" @click.stop>

        <!-- Drawer Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="card-list" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="showDrawer = false">
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Name') }} <span class="text-red-500">*</span></label>
            <input v-model="formState.name" type="text" :placeholder="__('Overview name')" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500" />
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
                <input v-model="formState.role_ids" type="checkbox" :value="role.id" class="rounded text-blue-600" />
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ role.name }}</span>
              </label>
            </div>
          </div>

          <!-- Restrict to Users -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Restrict to only the following users') }}</label>
            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div class="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <input v-model="userSearchQuery" type="text" :placeholder="__('Search users...')" class="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-blue-500" />
              </div>
              <div class="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                <label
                  v-for="user in filteredUsers" :key="user.id"
                  class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  :class="formState.user_ids.includes(user.id) ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:bg-transparent'"
                >
                  <input v-model="formState.user_ids" type="checkbox" :value="user.id" class="rounded text-blue-600" />
                  <span class="text-slate-700 dark:text-slate-200">{{ user.fullname || user.login }}</span>
                  <span class="text-slate-400 dark:text-slate-500 text-[10px] rtl:mr-auto ltr:ml-auto">{{ user.login }}</span>
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
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input v-model="formState.organization_shared" type="radio" :value="true" class="text-blue-600" />{{ __('yes') }}</label>
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input v-model="formState.organization_shared" type="radio" :value="false" class="text-blue-600" />{{ __('no') }}</label>
            </div>
          </div>

          <!-- Out of Office -->
          <div class="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{{ __('Only available for users which are absence replacements for other users.') }}</h3>
            <div class="flex items-center gap-3 shrink-0">
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input v-model="formState.out_of_office" type="radio" :value="true" class="text-blue-600" />{{ __('yes') }}</label>
              <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"><input v-model="formState.out_of_office" type="radio" :value="false" class="text-blue-600" />{{ __('no') }}</label>
            </div>
          </div>

          <!-- Conditions -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{{ __('Conditions for shown tickets') }} <span class="text-red-500">*</span></label>
              <span v-if="Object.keys(rawExtraConditions).length > 0" class="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                {{ Object.keys(rawExtraConditions).length }} {{ __('system condition(s) preserved') }}
              </span>
            </div>
            <div class="space-y-3">
              <div v-for="(cond, idx) in formState.conditions" :key="idx" class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl relative">
                <button class="absolute top-3 text-slate-400 hover:text-red-500 cursor-pointer rtl:left-3 ltr:right-3" @click="formState.conditions.splice(idx, 1)">
                  <CommonIcon name="trash3" class="w-4 h-4" />
                </button>
                <div class="grid grid-cols-2 gap-3 mb-3 rtl:pl-8 ltr:pr-8">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Field') }}</label>
                    <select v-model="cond.field" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500" @change="cond.values = []; delete cond.pre_condition; cond.text_value = ''">
                      <option value="state">{{ __('State') }}</option>
                      <option value="priority">{{ __('Priority') }}</option>
                      <option value="group">{{ __('Group') }}</option>
                      <option value="owner">{{ __('Owner') }}</option>
                      <option value="customer">{{ __('Customer') }}</option>
                      <option value="organization">{{ __('Organization') }}</option>
                      <option value="tags">{{ __('Tags') }}</option>
                      <option value="mention_user_ids">{{ __('Subscribed Tickets') }}</option>
                      <option value="out_of_office_replacement_id">{{ __('Absence Replacement') }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Operator') }}</label>
                    <select v-if="cond.field === 'tags'" v-model="cond.operator" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
                      <option value="contains one">{{ __('contains one') }}</option>
                      <option value="contains all">{{ __('contains all') }}</option>
                      <option value="contains one not">{{ __('contains one not') }}</option>
                      <option value="contains all not">{{ __('contains all not') }}</option>
                    </select>
                    <select v-else v-model="cond.operator" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
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
                    <label v-for="state in ticketStatesList" :key="state.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(state.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input v-model="cond.values" type="checkbox" :value="String(state.id)" class="rounded text-blue-600" /><span>{{ state.name }}</span>
                    </label>
                  </div>

                  <!-- Priority -->
                  <div v-else-if="cond.field === 'priority'" class="flex flex-wrap gap-1.5">
                    <label v-for="prio in ticketPrioritiesList" :key="prio.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(prio.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input v-model="cond.values" type="checkbox" :value="String(prio.id)" class="rounded text-blue-600" /><span>{{ prio.name }}</span>
                    </label>
                  </div>

                  <!-- Group -->
                  <div v-else-if="cond.field === 'group'" class="flex flex-wrap gap-1.5">
                    <label v-for="grp in groupsList" :key="grp.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(grp.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                      <input v-model="cond.values" type="checkbox" :value="String(grp.id)" class="rounded text-blue-600" /><span>{{ grp.name }}</span>
                    </label>
                  </div>

                  <!-- Owner (Current User, Unassigned / not_set, or Specific Agents) -->
                  <div v-else-if="cond.field === 'owner'" class="space-y-2">
                    <div class="flex items-center gap-4">
                      <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                        <input type="radio" :checked="cond.pre_condition === 'current_user.id'" class="text-blue-600" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" />
                        <span>{{ __('Current User') }}</span>
                      </label>
                      <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'not_set' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                        <input type="radio" :checked="cond.pre_condition === 'not_set'" class="text-blue-600" @change="() => { cond.pre_condition = 'not_set'; cond.values = [] }" />
                        <span>{{ __('Unassigned (Not Set)') }}</span>
                      </label>
                    </div>
                    <div class="flex flex-wrap gap-1.5 pt-1">
                      <label v-for="user in usersList.slice(0, 30)" :key="user.id" class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.values.includes(String(user.id)) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'">
                        <input v-model="cond.values" type="checkbox" :value="String(user.id)" class="rounded text-blue-600" @change="() => { if (cond.values.length > 0) delete cond.pre_condition }" />
                        <span>{{ user.fullname || user.login }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Customer -->
                  <div v-else-if="cond.field === 'customer'">
                    <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                      <input type="radio" :checked="cond.pre_condition === 'current_user.id'" class="text-blue-600" @change="() => { cond.pre_condition = 'current_user.id'; cond.values = [] }" />
                      <span>{{ __('Current User') }}</span>
                    </label>
                  </div>

                  <!-- Organization -->
                  <div v-else-if="cond.field === 'organization'">
                    <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer" :class="cond.pre_condition === 'current_user.organization_id' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                      <input type="radio" :checked="cond.pre_condition === 'current_user.organization_id'" class="text-blue-600" @change="() => { cond.pre_condition = 'current_user.organization_id'; cond.values = [] }" />
                      <span>{{ __("Current User's Organization") }}</span>
                    </label>
                  </div>

                  <!-- Tags -->
                  <div v-else-if="cond.field === 'tags'">
                    <input
                      v-model="cond.text_value"
                      type="text"
                      :placeholder="__('Tag name or comma-separated tags (e.g. spam, urgent)')"
                      class="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>

                  <!-- Subscribed Tickets -->
                  <div v-else-if="cond.field === 'mention_user_ids'" class="p-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    {{ __('Filters tickets where current user is subscribed / mentioned.') }}
                  </div>

                  <!-- Absence Replacement -->
                  <div v-else-if="cond.field === 'out_of_office_replacement_id'" class="p-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    {{ __('Filters tickets for which the current user is active absence replacement.') }}
                  </div>
                </div>
              </div>

              <button class="w-full px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1" @click="formState.conditions.push({ field: 'state', operator: 'is', values: [] })">
                <CommonIcon name="plus" class="w-3.5 h-3.5" />{{ __('Add Condition') }}
              </button>
            </div>
          </div>

          <!-- Preview -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{{ __('Preview') }}</label>
              <button class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer" @click="fetchPreview">
                <CommonIcon name="arrow-clockwise" class="w-3 h-3" />{{ __('Refresh') }}
              </button>
            </div>
            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div v-if="previewLoading" class="py-8 flex items-center justify-center gap-2">
                <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span class="text-xs text-slate-500">{{ __('Loading preview...') }}</span>
              </div>
              <div v-else-if="previewError" class="py-6 text-center text-xs text-red-500 px-4">{{ previewError }}</div>
              <div v-else-if="formState.conditions.length === 0 && Object.keys(rawExtraConditions).length === 0" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500">{{ __('Add conditions above to see a preview of matching tickets.') }}</div>
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

          <!-- Attributes (view.s) -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{{ __('Attributes') }} <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label v-for="attr in TICKET_ATTRIBUTES" :key="attr.value" class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors" :class="formState.view_s.includes(attr.value) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'">
                <input v-model="formState.view_s" type="checkbox" :value="attr.value" class="rounded text-blue-600 shrink-0" />
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ __(attr.label) }}</span>
              </label>
            </div>
          </div>

          <!-- Sorting By -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Sorting by') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.order_by" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
              <option v-for="attr in TICKET_SORT_ATTRIBUTES" :key="attr.value" :value="attr.value">{{ __(attr.label) }}</option>
            </select>
          </div>

          <!-- Sorting Order -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Sorting order') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.order_direction" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
              <option value="ASC">{{ __('ascending') }}</option>
              <option value="DESC">{{ __('descending') }}</option>
            </select>
          </div>

          <!-- Grouping By -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Grouping by') }}</label>
            <select v-model="formState.group_by" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
              <option v-for="grp in GROUP_BY_ATTRIBUTES" :key="grp.value" :value="grp.value">{{ __(grp.label) }}</option>
            </select>
          </div>

          <!-- Grouping Order -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Grouping order') }} <span class="text-red-500">*</span></label>
            <select v-model="formState.group_direction" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500">
              <option value="ASC">{{ __('ascending') }}</option>
              <option value="DESC">{{ __('descending') }}</option>
            </select>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Active') }} <span class="text-red-500">*</span></h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the overview is enabled for authorized users.') }}</p>
              <p v-if="editingManaged" class="text-xs text-blue-600 dark:text-blue-400 mt-1">{{ managedDrawerNote }}</p>
            </div>
            <button type="button" role="switch" :aria-checked="formState.active" :disabled="editingManaged" class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50" :class="formState.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'" @click="formState.active = !formState.active">
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200" :class="formState.active ? 'rtl:-translate-x-5 ltr:translate-x-5' : 'rtl:-translate-x-0 ltr:translate-x-0'"></span>
            </button>
          </div>

          <!-- Position -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{{ __('Position') }}</label>
            <input v-model.number="formState.prio" type="number" min="1" :disabled="editingManaged" class="disabled:opacity-50 disabled:cursor-not-allowed w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500" />
          </div>

        </div>

        <!-- Drawer Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer" @click="showDrawer = false">{{ __('Cancel') }}</button>
          <button :disabled="submitting" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed" @click="saveOverview">
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save') }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
