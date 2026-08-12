<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface GroupItem {
  id: number
  name: string
  assignment_timeout?: number | null
  follow_up_assignment?: boolean
  follow_up_possible?: string
  note?: string
  active: boolean
  parent_id?: number | null
  name_last?: string
}

const router = useRouter()
const groups = ref<GroupItem[]>([])
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
  note: '',
  active: true
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

// Fetch all groups
const fetchGroups = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/v1/groups', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const data = await res.json()
      groups.value = Array.isArray(data)
        ? (data as GroupItem[]).sort((a: GroupItem, b: GroupItem) => a.name.localeCompare(b.name))
        : []
    }
  } catch (e) {
    console.error('Failed to fetch groups:', e)
  } finally {
    loading.value = false
  }
}

// Filter groups client-side
const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return groups.value

  return groups.value.filter((group) => {
    return (
      group.name.toLowerCase().includes(query) ||
      (group.note && group.note.toLowerCase().includes(query))
    )
  })
})

// Format timeout value
const formatTimeout = (timeout: number | null | undefined) => {
  if (!timeout) return __('none')
  return `${timeout} ${__('minutes')}`
}

// Parent group options (excluding current group and its descendants when editing)
const parentGroupOptions = computed(() => {
  if (drawerMode.value === 'create' || !drawerGroupId.value) return groups.value
  
  const currentGroup = groups.value.find(g => g.id === drawerGroupId.value)
  if (!currentGroup) return groups.value
  
  return groups.value.filter(g => {
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
    note: '',
    active: true
  }
  showDrawer.value = true
}

// Open drawer for group editing
const handleEditGroup = (group: GroupItem) => {
  drawerMode.value = 'edit'
  drawerGroupId.value = group.id
  form.value = {
    name_last: group.name_last || group.name.split('::').pop() || '',
    parent_id: group.parent_id || '',
    assignment_timeout: group.assignment_timeout || '',
    follow_up_possible: group.follow_up_possible || 'yes',
    note: group.note || '',
    active: group.active
  }
  showDrawer.value = true
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

  submitting.value = true
  try {
    const payload = {
      name_last: form.value.name_last.trim(),
      parent_id: form.value.parent_id || null,
      assignment_timeout: form.value.assignment_timeout || null,
      follow_up_possible: form.value.follow_up_possible,
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
      fetchGroups()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save group.'))
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
      fetchGroups()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete group.'))
    }
  } catch (e) {
    console.error('Failed to delete group:', e)
  }
}

onMounted(() => {
  fetchGroups()
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
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 first:rounded-tl-2xl">{{ __('Name') }}</th>
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
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-right"></td>
            </tr>
          </tbody>

          <tbody v-else-if="filteredGroups.length === 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-500 dark:text-slate-400">
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
              <!-- Group Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ group.name }}
              </td>
              <!-- Assignment Timeout -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                {{ formatTimeout(group.assignment_timeout) }}
              </td>
              <!-- Follow-up Possible -->
              <td class="py-4 px-6 text-sm">
                <span class="capitalize">{{ group.follow_up_possible ? __(group.follow_up_possible) : '-' }}</span>
              </td>
              <!-- Note -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-sm truncate">
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
          <div class="p-6 overflow-y-auto flex-1 space-y-6 text-left">
            <!-- Group Name -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Name') }}
              </label>
              <input
                v-model="form.name_last"
                type="text"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
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
                <option v-for="g in parentGroupOptions" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>

            <!-- Assignment Timeout -->
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Assignment Timeout') }} ({{ __('minutes') }})
              </label>
              <input
                v-model="form.assignment_timeout"
                type="number"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              />
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
                <option value="no">{{ __('no') }}</option>
                <option value="new ticket">{{ __('new ticket') }}</option>
              </select>
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
