<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { initializeBetaUi } from '#desktop/components/BetaUi/composables/useBetaUi.ts'
import { useUserEdit } from '#desktop/entities/user/composables/useUserEdit.ts'
import { useUserCreate } from '#desktop/entities/user/composables/useUserCreate.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

interface UserItem {
  id: number
  login: string
  firstname: string
  lastname: string
  organization?: string
  organization_id?: number | null
  organizations?: string[]
  roles?: string[]
  active: boolean
}

interface RoleItem {
  id: number
  name: string
  active: boolean
}

const router = useRouter()
const users = ref<UserItem[]>([])
const roles = ref<RoleItem[]>([])
const totalCount = ref(0)
const loading = ref(true)

const { openUserEditFlyout } = useUserEdit()
const { openUserCreateFlyout } = useUserCreate()

const searchQuery = ref('')
const selectedRoleId = ref<number | null>(null)
const currentPage = ref(1)
const perPage = ref(50)

const activeActionMenuUserId = ref<number | null>(null)

// Breadcrumb navigation
const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Users') }
]

// Toggle actions menu dropdown
const toggleActionMenu = (userId: number, event: Event) => {
  event.stopPropagation()
  if (activeActionMenuUserId.value === userId) {
    activeActionMenuUserId.value = null
  } else {
    activeActionMenuUserId.value = userId
  }
}

// Close menus when clicking outside
const closeActionMenu = () => {
  activeActionMenuUserId.value = null
}

// Fetch active roles
const fetchRoles = async () => {
  try {
    const res = await fetch('/api/v1/roles', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const data = await res.json()
      roles.value = Array.isArray(data)
        ? (data as RoleItem[]).filter((role: RoleItem) => role.active).sort((a: RoleItem, b: RoleItem) => a.name.localeCompare(b.name))
        : []
    }
  } catch (e) {
    console.error('Failed to fetch roles:', e)
  }
}

// Fetch users with filters, search, and pagination
const fetchUsers = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * perPage.value
    let url = `/api/v1/users/search?expand=true&with_total_count=true&limit=${perPage.value}&offset=${offset}`
    
    // Add query parameter (wildcard search if empty)
    const term = searchQuery.value.trim()
    url += `&query=${encodeURIComponent(term || '*')}`

    // Add role filtering
    if (selectedRoleId.value !== null) {
      url += `&role_ids[]=${selectedRoleId.value}`
    }

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (res.ok) {
      const data = await res.json()
      users.value = Array.isArray(data.records) ? data.records : []
      totalCount.value = typeof data.total_count === 'number' ? data.total_count : 0
    }
  } catch (e) {
    console.error('Failed to fetch users:', e)
  } finally {
    loading.value = false
  }
}

// Reset page and reload users on filter/search change
watch([searchQuery, selectedRoleId], () => {
  currentPage.value = 1
  fetchUsers()
})

// Reload users on page change
watch(currentPage, () => {
  fetchUsers()
})

// Trigger legacy import redirection
const handleImport = () => {
  const { clearSwitchAndRedirect } = initializeBetaUi()
  clearSwitchAndRedirect('/#manage/users/import')
}

// Trigger native new user creation flyout
const handleNewUser = () => {
  openUserCreateFlyout({
    onSuccess: () => {
      fetchUsers()
    }
  })
}

// Trigger native edit user flyout
const handleEditUser = (user: UserItem) => {
  const editableUser = {
    ...user,
    id: convertToGraphQLId('User', user.id),
    organization: user.organization_id ? { internalId: user.organization_id } : null
  }
  openUserEditFlyout(editableUser, {
    onSuccess: () => {
      fetchUsers()
    }
  })
}

// View from user's perspective (perspective switcher)
const handleSwitchToUser = async (userId: number) => {
  try {
    const res = await fetch(`/api/v1/sessions/switch/${userId}`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.location) {
        window.location.href = data.location
      }
    }
  } catch (e) {
    console.error('Failed to switch user perspective:', e)
  }
}

// Delete user account
const handleDeleteUser = async (userId: number, login: string) => {
  if (!confirm(__('Are you sure you want to delete user %s?').replace('%s', login))) {
    return
  }
  try {
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      }
    })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete user.'))
    }
  } catch (e) {
    console.error('Failed to delete user:', e)
  }
}

// Compute total pages
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / perPage.value)))

// Pagination list generation (e.g. 1 2 3 ... 31)
const paginationPages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages: (number | string)[] = []
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) {
      pages.push('...')
    }
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (current < total - 2) {
      pages.push('...')
    }
    pages.push(total)
  }
  return pages
})

onMounted(() => {
  fetchRoles()
  fetchUsers()
  window.addEventListener('click', closeActionMenu)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100" @click="closeActionMenu">
      
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
            {{ __('Users') }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <div class="flex gap-3">
          <button
            @click="handleImport"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            {{ __('Import') }}
          </button>
          <button
            @click="handleNewUser"
            class="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
          >
            {{ __('New User') }}
          </button>
        </div>
      </div>

      <!-- Search Box -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for users')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-[#94a3b8] placeholder:text-slate-400 dark:placeholder:text-[#475569] text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e2d45] transition-all duration-150"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#475569]">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Roles Filters Row -->
      <div class="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <span class="text-slate-500 dark:text-slate-400 font-semibold mr-1">{{ __('Roles:') }}</span>
        
        <button
          @click="selectedRoleId = null"
          class="px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium"
          :class="selectedRoleId === null
            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
        >
          {{ __('All') }}
        </button>

        <button
          v-for="role in roles"
          :key="role.id"
          @click="selectedRoleId = role.id"
          class="px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium"
          :class="selectedRoleId === role.id
            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
        >
          {{ role.name }}
        </button>
      </div>

      <!-- Table Section -->
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs mb-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 first:rounded-tl-2xl">{{ __('Login') }}</th>
              <th class="py-4 px-6">{{ __('First Name') }}</th>
              <th class="py-4 px-6">{{ __('Last Name') }}</th>
              <th class="py-4 px-6">{{ __('Organization') }}</th>
              <th class="py-4 px-6">{{ __('Secondary Organizations') }}</th>
              <th class="py-4 px-6 text-center">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16 last:rounded-tr-2xl"></th>
            </tr>
          </thead>
          
          <tbody v-if="loading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-40"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-right"></td>
            </tr>
          </tbody>

          <tbody v-else-if="users.length === 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td colspan="7" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
                  <CommonIcon name="user" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No users found') }}</h3>
                <p class="text-xs">{{ __('No users matched the selected filters.') }}</p>
              </td>
            </tr>
          </tbody>

          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="user in users"
              :key="user.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
              @click="handleEditUser(user)"
            >
              <!-- Login / Email -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ user.login }}
              </td>
              <!-- First Name -->
              <td class="py-4 px-6 text-sm">
                {{ user.firstname || '-' }}
              </td>
              <!-- Last Name -->
              <td class="py-4 px-6 text-sm">
                {{ user.lastname || '-' }}
              </td>
              <!-- Organization -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                {{ user.organization || '-' }}
              </td>
              <!-- Secondary Organizations -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                {{ Array.isArray(user.organizations) && user.organizations.length ? user.organizations.join(', ') : '-' }}
              </td>
              <!-- Active Status -->
              <td class="py-4 px-6 text-center">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full"
                  :class="user.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon v-if="user.active" name="check2" class="w-3.5 h-3.5" />
                  <span v-else class="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"></span>
                </span>
              </td>
              <!-- Actions Dropdown -->
              <td class="py-4 px-6 text-right relative">
                <button
                  @click="toggleActionMenu(user.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                
                <!-- Action Dropdown Card -->
                <div
                  v-if="activeActionMenuUserId === user.id"
                  class="absolute right-6 mt-1 w-56 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      v-if="user.active"
                      @click="handleSwitchToUser(user.id)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="magic" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('View from user\'s perspective') }}
                    </button>
                    <button
                      @click="handleEditUser(user)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Edit') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteUser(user.id, user.login)"
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

      <!-- Pagination Section -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 text-xs mt-8">
        <!-- Prev Button -->
        <button
          @click="currentPage = Math.max(1, currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <CommonIcon name="chevron-left" class="w-3.5 h-3.5" />
        </button>

        <!-- Page numbers -->
        <button
          v-for="page in paginationPages"
          :key="page"
          @click="typeof page === 'number' ? currentPage = page : null"
          :disabled="typeof page !== 'number'"
          class="px-3.5 py-1.5 rounded-lg border font-medium transition-all"
          :class="[
            typeof page !== 'number' ? 'border-transparent text-slate-400 dark:text-slate-600' : 'cursor-pointer',
            currentPage === page
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-semibold'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          ]"
        >
          {{ page }}
        </button>

        <!-- Next Button -->
        <button
          @click="currentPage = Math.min(totalPages, currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <CommonIcon name="chevron-right" class="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  </LayoutContent>
</template>
