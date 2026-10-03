<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface GroupItem {
  id: number
  name: string
  name_last?: string
  parent_id?: number | null
  assignment_timeout?: number | null
  follow_up_possible?: string
  reopen_time_in_days?: number | null
  follow_up_assignment?: boolean
  email_address_id?: number | null
  signature_id?: number | null
  shared_drafts?: boolean
  summary_generation?: string
  note?: string
  active: boolean
  updated_at?: string
}

interface EmailAddressItem {
  id: number
  name?: string
  email: string
  active?: boolean
}

interface SignatureItem {
  id: number
  name: string
  body?: string
  active?: boolean
}

const router = useRouter()
const groups = ref<GroupItem[]>([])
const emailAddresses = ref<EmailAddressItem[]>([])
const signatures = ref<SignatureItem[]>([])
const loading = ref(true)
const searchQuery = ref('')
const activeActionMenuGroupId = ref<number | null>(null)

// Drawer state
const showDrawer = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const drawerGroupId = ref<number | null>(null)
const submitting = ref(false)

const form = ref({
  name_last: '',
  parent_id: '' as string | number,
  assignment_timeout: '' as string | number,
  follow_up_possible: 'yes',
  reopen_time_in_days: '' as string | number,
  follow_up_assignment: true,
  email_address_id: '' as string | number,
  signature_id: '' as string | number,
  shared_drafts: true,
  summary_generation: 'global_default',
  note: '',
  active: true,
})

// Breadcrumb navigation
const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Groups') }
]

// Toggle actions menu dropdown
const toggleActionMenu = (groupId: number, event: Event) => {
  event.stopPropagation()
  if (activeActionMenuGroupId.value === groupId) {
    activeActionMenuGroupId.value = null
  } else {
    activeActionMenuGroupId.value = groupId
  }
}

// Close menus when clicking outside
const closeActionMenu = () => {
  activeActionMenuGroupId.value = null
}

// Fetch all groups, email addresses, and signatures
const fetchData = async () => {
  loading.value = true
  try {
    const [groupsRes, emailsRes, sigsRes] = await Promise.all([
      fetch('/api/v1/groups', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }),
      fetch('/api/v1/email_addresses', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }),
      fetch('/api/v1/signatures', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
    ])

    if (groupsRes.ok) {
      const data = await groupsRes.json()
      groups.value = Array.isArray(data)
        ? (data as GroupItem[]).sort((a: GroupItem, b: GroupItem) => a.name.localeCompare(b.name))
        : []
    }

    if (emailsRes.ok) {
      const data = await emailsRes.json()
      emailAddresses.value = Array.isArray(data) ? (data as EmailAddressItem[]) : []
    }

    if (sigsRes.ok) {
      const data = await sigsRes.json()
      signatures.value = Array.isArray(data) ? (data as SignatureItem[]) : []
    }
  } catch (e) {
    console.error('Failed to fetch groups data:', e)
  } finally {
    loading.value = false
  }
}

// Lookup maps
const emailAddressMap = computed(() => {
  const map: Record<number, EmailAddressItem> = {}
  for (const ea of emailAddresses.value) {
    map[ea.id] = ea
  }
  return map
})

const signatureMap = computed(() => {
  const map: Record<number, SignatureItem> = {}
  for (const sig of signatures.value) {
    map[sig.id] = sig
  }
  return map
})

// Check if currently selected signature is inactive
const isSelectedSignatureInactive = computed(() => {
  if (!form.value.signature_id) return false
  const sig = signatureMap.value[Number(form.value.signature_id)]
  return sig ? sig.active === false : false
})

// Filter groups client-side
const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return groups.value

  return groups.value.filter((group) => {
    const emailInfo = emailAddressMap.value[group.email_address_id || 0]
    const emailStr = emailInfo ? `${emailInfo.name || ''} ${emailInfo.email}`.toLowerCase() : ''
    const sigInfo = signatureMap.value[group.signature_id || 0]
    const sigStr = sigInfo ? sigInfo.name.toLowerCase() : ''

    return (
      group.name.toLowerCase().includes(query) ||
      (group.note && group.note.toLowerCase().includes(query)) ||
      emailStr.includes(query) ||
      sigStr.includes(query)
    )
  })
})

// Format timeout value
const formatTimeout = (timeout: number | null | undefined) => {
  if (!timeout) return __('none')
  return `${timeout} ${__('minutes')}`
}

// Format follow up display
const formatFollowUp = (group: GroupItem) => {
  if (!group.follow_up_possible || group.follow_up_possible === 'yes') {
    return __('yes')
  }
  if (group.follow_up_possible === 'new_ticket') {
    return __('New Ticket')
  }
  if (group.follow_up_possible === 'new_ticket_after_certain_time') {
    const days = group.reopen_time_in_days || 0
    return `${__('New Ticket')} (${days}d)`
  }
  return group.follow_up_possible
}

// Calculate group nesting depth
const getGroupDepth = (name: string) => (name ? name.split('::').length - 1 : 0)

// Parent group options (excluding current group, its descendants, and depth >= 9)
const parentGroupOptions = computed(() => {
  return groups.value.filter((g) => {
    if (getGroupDepth(g.name) >= 9) return false

    if (drawerMode.value === 'create' || !drawerGroupId.value) return true

    const currentGroup = groups.value.find((item) => item.id === drawerGroupId.value)
    if (!currentGroup) return true

    return g.id !== currentGroup.id && !g.name.startsWith(currentGroup.name + '::')
  })
})

// Open drawer for group creation
const handleNewGroup = () => {
  drawerMode.value = 'create'
  drawerGroupId.value = null
  form.value = {
    name_last: '',
    parent_id: '',
    assignment_timeout: '',
    follow_up_possible: 'yes',
    reopen_time_in_days: '',
    follow_up_assignment: true,
    email_address_id: '',
    signature_id: '',
    shared_drafts: true,
    summary_generation: 'global_default',
    note: '',
    active: true,
  }
  showDrawer.value = true
}

// Clone an existing group
const handleCloneGroup = async (group: GroupItem) => {
  activeActionMenuGroupId.value = null
  drawerMode.value = 'create'
  drawerGroupId.value = null

  const baseLastName = group.name_last || group.name.split('::').pop() || ''
  form.value = {
    name_last: `${__('Clone')}: ${baseLastName}`,
    parent_id: group.parent_id || '',
    assignment_timeout: group.assignment_timeout || '',
    follow_up_possible: group.follow_up_possible || 'yes',
    reopen_time_in_days: group.reopen_time_in_days || '',
    follow_up_assignment: group.follow_up_assignment ?? true,
    email_address_id: group.email_address_id || '',
    signature_id: group.signature_id || '',
    shared_drafts: group.shared_drafts ?? true,
    summary_generation: group.summary_generation || 'global_default',
    note: group.note || '',
    active: group.active ?? true,
  }
  showDrawer.value = true

  // Hydrate full source details
  try {
    const res = await fetch(`/api/v1/groups/${group.id}`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const fullGroup: GroupItem = await res.json()
      const hydratedName = fullGroup.name_last || fullGroup.name.split('::').pop() || ''
      form.value = {
        name_last: `${__('Clone')}: ${hydratedName}`,
        parent_id: fullGroup.parent_id || '',
        assignment_timeout: fullGroup.assignment_timeout || '',
        follow_up_possible: fullGroup.follow_up_possible || 'yes',
        reopen_time_in_days: fullGroup.reopen_time_in_days || '',
        follow_up_assignment: fullGroup.follow_up_assignment ?? true,
        email_address_id: fullGroup.email_address_id || '',
        signature_id: fullGroup.signature_id || '',
        shared_drafts: fullGroup.shared_drafts ?? true,
        summary_generation: fullGroup.summary_generation || 'global_default',
        note: fullGroup.note || '',
        active: fullGroup.active ?? true,
      }
    }
  } catch (e) {
    console.error('Failed to hydrate cloned group:', e)
  }
}

// Open drawer for group editing
const handleEditGroup = async (group: GroupItem) => {
  activeActionMenuGroupId.value = null
  drawerMode.value = 'edit'
  drawerGroupId.value = group.id

  form.value = {
    name_last: group.name_last || group.name.split('::').pop() || '',
    parent_id: group.parent_id || '',
    assignment_timeout: group.assignment_timeout || '',
    follow_up_possible: group.follow_up_possible || 'yes',
    reopen_time_in_days: group.reopen_time_in_days || '',
    follow_up_assignment: group.follow_up_assignment ?? true,
    email_address_id: group.email_address_id || '',
    signature_id: group.signature_id || '',
    shared_drafts: group.shared_drafts ?? true,
    summary_generation: group.summary_generation || 'global_default',
    note: group.note || '',
    active: group.active ?? true,
  }
  showDrawer.value = true

  // Hydrate with full backend record to ensure relations and all attributes are complete
  try {
    const res = await fetch(`/api/v1/groups/${group.id}`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const fullGroup: GroupItem = await res.json()
      if (drawerGroupId.value === group.id) {
        form.value = {
          name_last: fullGroup.name_last || fullGroup.name.split('::').pop() || '',
          parent_id: fullGroup.parent_id || '',
          assignment_timeout: fullGroup.assignment_timeout || '',
          follow_up_possible: fullGroup.follow_up_possible || 'yes',
          reopen_time_in_days: fullGroup.reopen_time_in_days || '',
          follow_up_assignment: fullGroup.follow_up_assignment ?? true,
          email_address_id: fullGroup.email_address_id || '',
          signature_id: fullGroup.signature_id || '',
          shared_drafts: fullGroup.shared_drafts ?? true,
          summary_generation: fullGroup.summary_generation || 'global_default',
          note: fullGroup.note || '',
          active: fullGroup.active ?? true,
        }
      }
    }
  } catch (e) {
    console.error('Failed to hydrate group details:', e)
  }
}

const closeDrawer = () => {
  showDrawer.value = false
}

// Save group (Create or Update)
const saveGroup = async () => {
  if (!form.value.name_last.trim()) {
    alert(__('Please enter a group name.'))
    return
  }

  if (form.value.follow_up_possible === 'new_ticket_after_certain_time' && !form.value.reopen_time_in_days) {
    alert(__('Please specify reopening time in days.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name_last: form.value.name_last.trim(),
      parent_id: form.value.parent_id ? Number(form.value.parent_id) : null,
      assignment_timeout: form.value.assignment_timeout ? Number(form.value.assignment_timeout) : null,
      follow_up_possible: form.value.follow_up_possible,
      reopen_time_in_days: form.value.follow_up_possible === 'new_ticket_after_certain_time' && form.value.reopen_time_in_days
        ? Number(form.value.reopen_time_in_days)
        : null,
      follow_up_assignment: Boolean(form.value.follow_up_assignment),
      email_address_id: form.value.email_address_id ? Number(form.value.email_address_id) : null,
      signature_id: form.value.signature_id ? Number(form.value.signature_id) : null,
      shared_drafts: Boolean(form.value.shared_drafts),
      summary_generation: form.value.summary_generation || 'global_default',
      note: form.value.note.trim(),
      active: form.value.active
    }

    const isEdit = drawerMode.value === 'edit'
    const url = isEdit ? `/api/v1/groups/${drawerGroupId.value}` : '/api/v1/groups'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      showDrawer.value = false
      fetchData()
    } else {
      const data = await res.json()
      alert(data.error_human || data.error || __('Failed to save group.'))
    }
  } catch (e) {
    console.error('Failed to save group:', e)
  } finally {
    submitting.value = false
  }
}

// Delete group
const handleDeleteGroup = async (groupId: number, name: string) => {
  if (!confirm(__('Are you sure you want to delete group %s?').replace('%s', name))) {
    return
  }
  try {
    const res = await fetch(`/api/v1/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      }
    })
    if (res.ok) {
      fetchData()
    } else {
      const data = await res.json()
      alert(data.error_human || data.error || __('Failed to delete group.'))
    }
  } catch (e) {
    console.error('Failed to delete group:', e)
  }
}

onMounted(() => {
  fetchData()
  window.addEventListener('click', closeActionMenu)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 relative" @click="closeActionMenu">
      
      <!-- Top header area -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <button
            @click="router.push('/manage')"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            {{ __('Groups') }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <div>
          <button
            @click="handleNewGroup"
            class="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
          >
            {{ __('New Group') }}
          </button>
        </div>
      </div>

      <!-- Search Box -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for groups')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-[#94a3b8] placeholder:text-slate-400 dark:placeholder:text-[#475569] text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e2d45] transition-all duration-150"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#475569]">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table Section -->
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 first:rounded-tl-2xl">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Email') }}</th>
              <th class="py-4 px-6">{{ __('Signature') }}</th>
              <th class="py-4 px-6">{{ __('Assignment Timeout') }}</th>
              <th class="py-4 px-6">{{ __('Follow-up Possible') }}</th>
              <th class="py-4 px-6">{{ __('Note') }}</th>
              <th class="py-4 px-6 text-center">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16 last:rounded-tr-2xl"></th>
            </tr>
          </thead>
          
          <tbody v-if="loading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 4" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-right"></td>
            </tr>
          </tbody>

          <tbody v-else-if="filteredGroups.length === 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td colspan="8" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
                  <CommonIcon name="people-fill" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No groups found') }}</h3>
                <p class="text-xs">{{ __('No groups matched the selected criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="group in filteredGroups"
              :key="group.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
              @click="handleEditGroup(group)"
            >
              <!-- Group Name with Hierarchy -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span v-if="group.name.includes('::')" class="text-xs text-slate-400 dark:text-slate-500 font-normal">
                    {{ group.name.split('::').slice(0, -1).join(' › ') }} ›
                  </span>
                  <span>{{ group.name_last || group.name.split('::').pop() }}</span>
                </div>
              </td>
              <!-- Sending Email Address -->
              <td class="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                <span v-if="group.email_address_id && emailAddressMap[group.email_address_id]">
                  {{ emailAddressMap[group.email_address_id].email }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <!-- Signature -->
              <td class="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                <span v-if="group.signature_id && signatureMap[group.signature_id]">
                  {{ signatureMap[group.signature_id].name }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <!-- Assignment Timeout -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                {{ formatTimeout(group.assignment_timeout) }}
              </td>
              <!-- Follow-up Possible -->
              <td class="py-4 px-6 text-sm">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  {{ formatFollowUp(group) }}
                </span>
              </td>
              <!-- Note -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                {{ group.note || '-' }}
              </td>
              <!-- Active Status -->
              <td class="py-4 px-6 text-center">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full"
                  :class="group.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon v-if="group.active" name="check2" class="w-3.5 h-3.5" />
                  <span v-else class="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"></span>
                </span>
              </td>
              <!-- Actions Dropdown -->
              <td class="py-4 px-6 text-right relative">
                <button
                  @click="toggleActionMenu(group.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                
                <!-- Action Dropdown Card -->
                <div
                  v-if="activeActionMenuGroupId === group.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="handleEditGroup(group)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Edit') }}
                    </button>
                    <button
                      @click="handleCloneGroup(group)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteGroup(group.id, group.name)"
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

  <!-- Slide-over Drawer / Flyout for Create and Edit Group -->
  <Teleport to="body">
      <div
        v-if="showDrawer"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity z-50 flex justify-end"
        @click="closeDrawer"
      >
        <div
          class="w-full max-w-lg bg-white dark:bg-[#0f172a] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between"
          @click.stop
        >
          <!-- Drawer Header -->
          <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ drawerMode === 'create' ? __('New Group') : __('Edit Group') }}
            </h3>
            <button
              @click="closeDrawer"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <CommonIcon name="x-lg" class="w-5 h-5" />
            </button>
          </div>

          <!-- Drawer Body -->
          <div class="p-6 overflow-y-auto flex-1 space-y-5 text-left">
            <!-- Group Name -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Name') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name_last"
                type="text"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
                placeholder="Support"
              />
            </div>

            <!-- Parent Group -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Parent Group') }}
              </label>
              <select
                v-model="form.parent_id"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value="">- {{ __('none') }} -</option>
                <option v-for="g in parentGroupOptions" :key="g.id" :value="g.id">
                  {{ g.name.split('::').join(' › ') }}
                </option>
              </select>
            </div>

            <!-- Sending Email Address -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Sending Email Address') }}
              </label>
              <select
                v-model="form.email_address_id"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value="">- {{ __('none') }} -</option>
                <option v-for="ea in emailAddresses" :key="ea.id" :value="ea.id">
                  {{ ea.name ? `${ea.name} <${ea.email}>` : ea.email }}
                </option>
              </select>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('Default email address used for ticket correspondence from this group.') }}
              </p>
            </div>

            <!-- Signature -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Signature') }}
              </label>
              <select
                v-model="form.signature_id"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value="">- {{ __('none') }} -</option>
                <option v-for="sig in signatures" :key="sig.id" :value="sig.id">
                  {{ sig.name }}{{ sig.active === false ? ` (${__('inactive')})` : '' }}
                </option>
              </select>

              <!-- Inactive Signature Warning Alert -->
              <div v-if="isSelectedSignatureInactive" class="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <CommonIcon name="exclamation-triangle" class="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{{ __('This signature is inactive, it won\'t be included in the reply.') }}</span>
              </div>
            </div>

            <!-- Assignment Timeout -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Assignment Timeout') }} ({{ __('minutes') }})
              </label>
              <input
                v-model="form.assignment_timeout"
                type="number"
                min="0"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              />
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('Assignment timeout in minutes if assigned agent is not working on it. Ticket will be shown as unassigned.') }}
              </p>
            </div>

            <!-- Follow-up Possible -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Follow-up Possible') }}
              </label>
              <select
                v-model="form.follow_up_possible"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value="yes">{{ __('yes') }}</option>
                <option value="new_ticket">{{ __('do not reopen ticket but create new ticket') }}</option>
                <option value="new_ticket_after_certain_time">{{ __('do not reopen ticket after certain time but create new ticket') }}</option>
              </select>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('Follow-up for closed ticket possible or not.') }}
              </p>
            </div>

            <!-- Reopening Time in Days (conditional) -->
            <div v-if="form.follow_up_possible === 'new_ticket_after_certain_time'">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Reopening time in days') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.reopen_time_in_days"
                type="number"
                min="1"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              />
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('Number of days after which follow-up creates a new ticket.') }}
              </p>
            </div>

            <!-- Summary Generation -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Summary Generation') }}
              </label>
              <select
                v-model="form.summary_generation"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value="global_default">{{ __('Global Default') }}</option>
                <option value="enabled">{{ __('Enabled') }}</option>
                <option value="disabled">{{ __('Disabled') }}</option>
              </select>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('AI summary generation behavior for tickets in this group.') }}
              </p>
            </div>

            <!-- Note -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Note') }}
              </label>
              <textarea
                v-model="form.note"
                rows="3"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              ></textarea>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {{ __('Notes are visible to agents only, never to customers.') }}
              </p>
            </div>

            <!-- Toggles Section -->
            <div class="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <!-- Assign follow-up to last agent -->
              <div class="flex items-start gap-3">
                <input
                  v-model="form.follow_up_assignment"
                  type="checkbox"
                  id="group-follow-up-assignment"
                  class="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                />
                <div>
                  <label for="group-follow-up-assignment" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    {{ __('Assign follow-ups') }}
                  </label>
                  <p class="text-xs text-slate-400 dark:text-slate-500">
                    {{ __('Assign follow-up to latest agent again.') }}
                  </p>
                </div>
              </div>

              <!-- Shared drafts -->
              <div class="flex items-start gap-3">
                <input
                  v-model="form.shared_drafts"
                  type="checkbox"
                  id="group-shared-drafts"
                  class="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                />
                <div>
                  <label for="group-shared-drafts" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    {{ __('Shared Drafts') }}
                  </label>
                  <p class="text-xs text-slate-400 dark:text-slate-500">
                    {{ __('Ticket drafts are shared among group agents.') }}
                  </p>
                </div>
              </div>

              <!-- Active status -->
              <div class="flex items-center gap-3">
                <input
                  v-model="form.active"
                  type="checkbox"
                  id="group-active"
                  class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                />
                <label for="group-active" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  {{ __('Active') }}
                </label>
              </div>
            </div>

          </div>

          <!-- Drawer Footer -->
          <div class="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
            <button
              @click="closeDrawer"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {{ __('Cancel') }}
            </button>
            <button
              @click="saveGroup"
              :disabled="submitting"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting">{{ __('Saving...') }}</span>
              <span v-else>{{ __('Save') }}</span>
            </button>
          </div>
        </div>
      </div>
  </Teleport>
</template>
