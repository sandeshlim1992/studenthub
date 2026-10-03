<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApolloClient } from '@vue/apollo-composable'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { useUserEdit } from '#desktop/entities/user/composables/useUserEdit.ts'
import { useUserCreate } from '#desktop/entities/user/composables/useUserCreate.ts'
import { UserDocument } from '#shared/entities/user/graphql/queries/user.api.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
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
  login_failed?: number
  preferences?: {
    two_factor_authentication?: {
      default?: string
    }
  }
}

interface RoleItem {
  id: number
  name: string
  active: boolean
}

interface TwoFactorMethodItem {
  method: string
  label?: string
}

const router = useRouter()
const users = ref<UserItem[]>([])
const roles = ref<RoleItem[]>([])
const totalCount = ref(0)
const loading = ref(true)

const { openUserEditFlyout } = useUserEdit()
const { openUserCreateFlyout } = useUserCreate()

const searchQuery = ref('')
const selectedRoleIds = ref<number[]>([])
const currentPage = ref(1)
const perPage = ref(50)

// Sorting state
const sortBy = ref('login')
const orderBy = ref<'asc' | 'desc'>('asc')

const activeActionMenuUserId = ref<number | null>(null)

// Application store & Apollo client
const application = useApplicationStore()
const apolloClient = useApolloClient()

// Two-factor authentication modal state
const showTwoFactorModal = ref(false)
const twoFactorUser = ref<UserItem | null>(null)
const twoFactorLoading = ref(false)
const twoFactorMethods = ref<TwoFactorMethodItem[]>([])
const twoFactorError = ref('')

// Import modal state
const showImportModal = ref(false)
const importStage = ref<'input' | 'preview' | 'complete'>('input')
const importFile = ref<File | null>(null)
const importContent = ref('')
const importColSep = ref(',')
const importDeleteOption = ref(false)
const importLoading = ref(false)
interface UserImportStats {
  created?: number
  updated?: number
  deleted?: number
  skipped?: number
  total?: number
}
interface UserImportResult {
  result?: string
  stats?: UserImportStats
  [key: string]: unknown
}
const importResult = ref<UserImportResult | null>(null)
const importError = ref('')

// Breadcrumb navigation
const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Users') }
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

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

// Check if user account is locked due to too many failed attempts
const isUserLocked = (user: UserItem) => {
  const threshold = parseInt(String(application.config?.password_max_login_failed ?? 5), 10) || 5
  return (user.login_failed ?? 0) >= threshold
}

// Toggle role filter
const toggleRoleFilter = (roleId: number | null) => {
  if (roleId === null) {
    selectedRoleIds.value = []
  } else {
    const idx = selectedRoleIds.value.indexOf(roleId)
    if (idx > -1) {
      selectedRoleIds.value.splice(idx, 1)
    } else {
      selectedRoleIds.value.push(roleId)
    }
  }
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

// Fetch users with filters, search, sorting, and pagination
const fetchUsers = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * perPage.value
    let url = `/api/v1/users/search?expand=true&with_total_count=true&limit=${perPage.value}&offset=${offset}`
    
    // Sort parameters
    url += `&sort_by=${encodeURIComponent(sortBy.value)}&order_by=${encodeURIComponent(orderBy.value)}`

    // Search query parameter (wildcard search if empty)
    const term = searchQuery.value.trim()
    url += `&query=${encodeURIComponent(term || '*')}`

    // Multi-role filtering
    for (const rId of selectedRoleIds.value) {
      url += `&role_ids[]=${rId}`
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

// Handle column sorting
const handleSort = (column: string) => {
  if (sortBy.value === column) {
    orderBy.value = orderBy.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    orderBy.value = 'asc'
  }
  currentPage.value = 1
  fetchUsers()
}

// Reset page and reload users on filter/search change
watch([searchQuery, selectedRoleIds], () => {
  currentPage.value = 1
  fetchUsers()
}, { deep: true })

// Reload users on page change
watch(currentPage, () => {
  fetchUsers()
})

// Trigger native new user creation flyout
const handleNewUser = () => {
  openUserCreateFlyout({
    onSuccess: () => {
      fetchUsers()
    }
  })
}

// Trigger native edit user flyout
const handleEditUser = async (user: UserItem) => {
  try {
    const result = await apolloClient.client.query({
      query: UserDocument,
      variables: { userId: convertToGraphQLId('User', user.id) },
      fetchPolicy: 'network-only',
    })
    if (result.data?.user) {
      openUserEditFlyout(result.data.user, {
        onSuccess: () => {
          fetchUsers()
        },
      })
      return
    }
  } catch (e) {
    console.warn('Could not query full GraphQL user, falling back to REST show:', e)
  }

  // Fallback to REST record
  try {
    const res = await fetch(`/api/v1/users/${user.id}?full=true`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const restUser = await res.json()
      const editableUser = {
        ...restUser,
        id: convertToGraphQLId('User', user.id),
        organization: restUser.organization_id ? { internalId: restUser.organization_id } : null,
      }
      openUserEditFlyout(editableUser, {
        onSuccess: () => {
          fetchUsers()
        },
      })
      return
    }
  } catch (e) {
    console.error('Failed to load user:', e)
  }

  // Fallback to table item
  const fallbackUser = {
    ...user,
    id: convertToGraphQLId('User', user.id),
    organization: user.organization_id ? { internalId: user.organization_id } : null,
  }
  openUserEditFlyout(fallbackUser, {
    onSuccess: () => {
      fetchUsers()
    },
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
      window.location.href = data.location || '/'
    }
  } catch (e) {
    console.error('Failed to switch user perspective:', e)
  }
}

// Unlock locked user
const handleUnlockUser = async (user: UserItem) => {
  closeActionMenu()
  try {
    const res = await fetch(`/api/v1/users/unlock/${user.id}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      }
    })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to unlock user.'))
    }
  } catch (e) {
    console.error('Failed to unlock user:', e)
  }
}

// Delete user account
const handleDeleteUser = async (userId: number, login: string) => {
  closeActionMenu()
  if (!confirm(__('Are you sure you want to delete user %s?').replace('%s', login))) {
    return
  }
  try {
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      }
    })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      if (confirm((data.error || __('Failed to delete user.')) + '\n\n' + __('Would you like to open Data Privacy deletion to safely process this user?'))) {
        router.push(`/manage/system/data_privacy?userId=${userId}`)
      }
    }
  } catch (e) {
    console.error('Failed to delete user:', e)
  }
}

// Two-Factor Authentication Management
const openTwoFactorModal = async (user: UserItem) => {
  closeActionMenu()
  twoFactorUser.value = user
  showTwoFactorModal.value = true
  twoFactorLoading.value = true
  twoFactorError.value = ''
  twoFactorMethods.value = []

  try {
    const res = await fetch(`/api/v1/users/${user.id}/admin_two_factor/enabled_authentication_methods`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const data = await res.json()
      twoFactorMethods.value = Array.isArray(data) ? data : []
    } else {
      const data = await res.json()
      twoFactorError.value = data.error || __('Could not load two-factor authentication configuration.')
    }
  } catch (e) {
    console.error('Failed to fetch two factor methods:', e)
    twoFactorError.value = __('Could not load two-factor authentication configuration.')
  } finally {
    twoFactorLoading.value = false
  }
}

const removeTwoFactorMethod = async (method: string) => {
  if (!twoFactorUser.value) return
  if (!confirm(__('Are you sure you want to remove the two-factor authentication method "%s"?').replace('%s', method))) {
    return
  }
  twoFactorLoading.value = true
  try {
    const res = await fetch(`/api/v1/users/${twoFactorUser.value.id}/admin_two_factor/remove_authentication_method`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      },
      body: JSON.stringify({ method })
    })
    if (res.ok) {
      openTwoFactorModal(twoFactorUser.value)
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error || __('Could not remove two-factor authentication method.'))
    }
  } catch (e) {
    console.error('Failed to remove two factor method:', e)
  } finally {
    twoFactorLoading.value = false
  }
}

const removeAllTwoFactorMethods = async () => {
  if (!twoFactorUser.value) return
  if (!confirm(__('Are you sure? The user will have to reconfigure all two-factor authentication methods.'))) {
    return
  }
  twoFactorLoading.value = true
  try {
    const res = await fetch(`/api/v1/users/${twoFactorUser.value.id}/admin_two_factor/remove_all_authentication_methods`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      }
    })
    if (res.ok) {
      showTwoFactorModal.value = false
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error || __('Could not remove all two-factor authentication methods.'))
    }
  } catch (e) {
    console.error('Failed to remove all two factor methods:', e)
  } finally {
    twoFactorLoading.value = false
  }
}

// CSV Import Modal Handlers
const openImportModal = () => {
  showImportModal.value = true
  importStage.value = 'input'
  importContent.value = ''
  importFile.value = null
  importResult.value = null
  importError.value = ''
  importDeleteOption.value = false
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    importFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      importContent.value = (e.target?.result as string) || ''
    }
    reader.readAsText(file)
  }
}

const downloadExampleCsv = () => {
  window.location.href = '/api/v1/users/import_example'
}

const runImport = async (dryRun: boolean) => {
  if (!importContent.value.trim()) {
    importError.value = __('Please select a file or paste CSV data.')
    return
  }
  importLoading.value = true
  importError.value = ''

  try {
    const formData = new FormData()
    formData.append('data', importContent.value)
    formData.append('col_sep', importColSep.value)
    if (dryRun) {
      formData.append('try', 'true')
    }
    if (importDeleteOption.value) {
      formData.append('delete', 'true')
    }

    const res = await fetch(`/api/v1/users/import${dryRun ? '?try=true' : ''}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: formData,
    })

    const data = await res.json()
    if (res.ok) {
      importResult.value = data
      if (dryRun) {
        importStage.value = 'preview'
      } else {
        importStage.value = 'complete'
        fetchUsers()
      }
    } else {
      importError.value = data.error_human || data.error || __('Import failed.')
    }
  } catch (e: unknown) {
    console.error('Import error:', e)
    importError.value = e instanceof Error ? e.message : __('An error occurred during import.')
  } finally {
    importLoading.value = false
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
            @click="openImportModal"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
          >
            {{ __('Import') }}
          </button>
          <button
            @click="handleNewUser"
            class="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
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

      <!-- Roles Filters Row (Supports Multi-Selection) -->
      <div class="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <span class="text-slate-500 dark:text-slate-400 font-semibold mr-1">{{ __('Roles:') }}</span>
        
        <button
          @click="toggleRoleFilter(null)"
          class="px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium"
          :class="selectedRoleIds.length === 0
            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
        >
          {{ __('All') }}
        </button>

        <button
          v-for="role in roles"
          :key="role.id"
          @click="toggleRoleFilter(role.id)"
          class="px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium"
          :class="selectedRoleIds.includes(role.id)
            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
        >
          {{ role.name }}
        </button>
      </div>

      <!-- Table Section with Click-to-Sort Headers -->
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs mb-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
              <!-- Login / Username Header -->
              <th
                @click="handleSort('login')"
                class="py-4 px-6 first:rounded-tl-2xl cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                  <span>{{ __('Login') }}</span>
                  <span v-if="sortBy === 'login'" class="text-blue-500">
                    {{ orderBy === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>
              
              <!-- First Name Header -->
              <th
                @click="handleSort('firstname')"
                class="py-4 px-6 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                  <span>{{ __('First Name') }}</span>
                  <span v-if="sortBy === 'firstname'" class="text-blue-500">
                    {{ orderBy === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>

              <!-- Last Name Header -->
              <th
                @click="handleSort('lastname')"
                class="py-4 px-6 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                  <span>{{ __('Last Name') }}</span>
                  <span v-if="sortBy === 'lastname'" class="text-blue-500">
                    {{ orderBy === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>

              <!-- Organization Header -->
              <th
                @click="handleSort('organization')"
                class="py-4 px-6 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                  <span>{{ __('Organization') }}</span>
                  <span v-if="sortBy === 'organization'" class="text-blue-500">
                    {{ orderBy === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>

              <!-- Secondary Organizations Header -->
              <th class="py-4 px-6">{{ __('Secondary Organizations') }}</th>

              <!-- Active Status Header -->
              <th
                @click="handleSort('active')"
                class="py-4 px-6 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <div class="flex items-center justify-center gap-1.5">
                  <span>{{ __('Active') }}</span>
                  <span v-if="sortBy === 'active'" class="text-blue-500">
                    {{ orderBy === 'asc' ? '▲' : '▼' }}
                  </span>
                </div>
              </th>
              
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
              <!-- Login / Email with Locked Indicator -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center">
                <span>{{ user.login }}</span>
                <span
                  v-if="isUserLocked(user)"
                  class="inline-flex items-center text-amber-500 ml-2"
                  :title="__('This user is currently blocked because of too many failed login attempts')"
                >
                  <CommonIcon name="lock" class="w-3.5 h-3.5 text-amber-500" />
                </span>
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
                  class="absolute right-6 mt-1 w-64 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <!-- Perspective Switcher -->
                    <button
                      v-if="user.active"
                      @click="handleSwitchToUser(user.id)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <CommonIcon name="magic" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('View from user\'s perspective') }}
                    </button>

                    <!-- Edit User -->
                    <button
                      @click="handleEditUser(user)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Edit') }}
                    </button>

                    <!-- Manage 2FA (if enabled) -->
                    <button
                      v-if="user.preferences?.two_factor_authentication?.default"
                      @click="openTwoFactorModal(user)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <CommonIcon name="key" class="w-3.5 h-3.5 mr-2.5 text-indigo-400" />
                      {{ __('Manage Two-Factor Authentication') }}
                    </button>

                    <!-- Unlock User (if locked) -->
                    <button
                      v-if="isUserLocked(user)"
                      @click="handleUnlockUser(user)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                    >
                      <CommonIcon name="unlock" class="w-3.5 h-3.5 mr-2.5 text-amber-500" />
                      {{ __('Unlock') }}
                    </button>

                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>

                    <!-- Delete User -->
                    <button
                      @click="handleDeleteUser(user.id, user.login)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
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

      <!-- Manage Two-Factor Authentication Modal -->
      <div
        v-if="showTwoFactorModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        @click.self="showTwoFactorModal = false"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 overflow-hidden">
          <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CommonIcon name="key" class="w-5 h-5 text-indigo-500" />
              {{ __('Manage Two-Factor Authentication') }}
            </h3>
            <button
              @click="showTwoFactorModal = false"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              ✕
            </button>
          </div>

          <div class="py-4">
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {{ __('Manage configured two-factor authentication methods for %s:').replace('%s', twoFactorUser?.login || '') }}
            </p>

            <div v-if="twoFactorLoading" class="py-8 text-center text-sm text-slate-400 animate-pulse">
              {{ __('Loading methods...') }}
            </div>

            <div v-else-if="twoFactorError" class="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs mb-4">
              {{ twoFactorError }}
            </div>

            <div v-else-if="twoFactorMethods.length === 0" class="py-6 text-center text-slate-400 text-xs">
              {{ __('No active two-factor authentication methods found for this user.') }}
            </div>

            <div v-else class="space-y-2 mb-6">
              <div
                v-for="item in twoFactorMethods"
                :key="item.method"
                class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span class="font-medium text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                    {{ item.label || item.method }}
                  </span>
                </div>
                <button
                  @click="removeTwoFactorMethod(item.method)"
                  class="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                >
                  {{ __('Remove') }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              v-if="twoFactorMethods.length > 0"
              @click="removeAllTwoFactorMethods"
              class="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg font-medium transition-colors cursor-pointer"
            >
              {{ __('Remove All Methods') }}
            </button>
            <div class="flex items-center gap-2 ml-auto">
              <button
                @click="showTwoFactorModal = false"
                class="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ __('Close') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Native CSV Import Modal (2-Stage Workflow matching legacy App.Import & App.ImportTryResult) -->
      <div
        v-if="showImportModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        @click.self="showImportModal = false"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 overflow-hidden">
          <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CommonIcon name="arrow-down-up" class="w-5 h-5 text-blue-500" />
              {{ __('Import Users (CSV)') }}
            </h3>
            <button
              @click="showImportModal = false"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              ✕
            </button>
          </div>

          <!-- Stage 1: Input & Configuration -->
          <div v-if="importStage === 'input'" class="py-4 space-y-4">
            <!-- Download Example CSV -->
            <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <div class="font-medium text-slate-800 dark:text-slate-200 mb-0.5">{{ __('CSV Format Example') }}</div>
                <div class="text-slate-400">{{ __('Download an example CSV file to see supported headers.') }}</div>
              </div>
              <button
                @click="downloadExampleCsv"
                class="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              >
                {{ __('Download Example') }}
              </button>
            </div>

            <!-- Upload File Input -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {{ __('Select CSV file') }}
              </label>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                @change="handleFileUpload"
                class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            <!-- Column Separator -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {{ __('Column Separator') }}
              </label>
              <select
                v-model="importColSep"
                class="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              >
                <option value=",">{{ __('Comma (,)') }}</option>
                <option value=";">{{ __('Semicolon (;)') }}</option>
                <option value="	">{{ __('Tab') }}</option>
              </select>
            </div>

            <!-- Paste CSV Raw Content -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {{ __('Paste in CSV data') }}
              </label>
              <textarea
                v-model="importContent"
                rows="5"
                placeholder="login,firstname,lastname,email..."
                class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              ></textarea>
            </div>

            <!-- Delete Option Checkbox -->
            <div class="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="delete-existing-records"
                v-model="importDeleteOption"
                class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label for="delete-existing-records" class="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                {{ __('Delete all existing records first (excluding system users)') }}
              </label>
            </div>

            <!-- Error Feedback -->
            <div v-if="importError" class="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs">
              {{ importError }}
            </div>
          </div>

          <!-- Stage 2: Test Run (Dry Run) Preview -->
          <div v-else-if="importStage === 'preview'" class="py-5 space-y-4">
            <div class="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-xl text-xs text-slate-700 dark:text-slate-200 space-y-2">
              <div class="font-semibold text-sm text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <CommonIcon name="check-circle" class="w-4 h-4 text-emerald-500" />
                {{ __('The test run was successful.') }}
              </div>
              <p class="text-slate-600 dark:text-slate-300">
                {{ __('The following changes will be made:') }}
              </p>
              <ul class="list-disc list-inside space-y-1 pl-1 font-medium">
                <li v-if="importResult?.stats?.created !== undefined" class="text-emerald-700 dark:text-emerald-400">
                  {{ __('%s object(s) will be created.').replace('%s', String(importResult.stats.created)) }}
                </li>
                <li v-if="importResult?.stats?.updated !== undefined" class="text-blue-700 dark:text-blue-400">
                  {{ __('%s object(s) will be updated.').replace('%s', String(importResult.stats.updated)) }}
                </li>
                <li v-if="importResult?.stats?.deleted !== undefined" class="text-red-700 dark:text-red-400">
                  {{ __('%s object(s) will be deleted.').replace('%s', String(importResult.stats.deleted)) }}
                </li>
                <li v-if="importResult?.stats?.total !== undefined" class="text-slate-600 dark:text-slate-400">
                  {{ __('Total processed rows: %s').replace('%s', String(importResult.stats.total)) }}
                </li>
              </ul>
            </div>

            <!-- Error Feedback if any -->
            <div v-if="importError" class="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs">
              {{ importError }}
            </div>
          </div>

          <!-- Stage 3: Real Import Complete Summary -->
          <div v-else-if="importStage === 'complete'" class="py-5 space-y-4">
            <div class="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl text-xs text-slate-700 dark:text-slate-200 space-y-2">
              <div class="font-semibold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CommonIcon name="check-circle" class="w-4 h-4 text-emerald-600" />
                {{ __('The import was successful.') }}
              </div>
              <p class="text-slate-600 dark:text-slate-300">
                {{ __('The following changes have been made:') }}
              </p>
              <ul class="list-disc list-inside space-y-1 pl-1 font-medium">
                <li v-if="importResult?.stats?.created !== undefined" class="text-emerald-700 dark:text-emerald-400">
                  {{ __('%s object(s) have been created.').replace('%s', String(importResult.stats.created)) }}
                </li>
                <li v-if="importResult?.stats?.updated !== undefined" class="text-blue-700 dark:text-blue-400">
                  {{ __('%s object(s) have been updated.').replace('%s', String(importResult.stats.updated)) }}
                </li>
                <li v-if="importResult?.stats?.deleted !== undefined" class="text-red-700 dark:text-red-400">
                  {{ __('%s object(s) were deleted.').replace('%s', String(importResult.stats.deleted)) }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <!-- Stage 1 Actions -->
            <template v-if="importStage === 'input'">
              <button
                @click="showImportModal = false"
                class="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ __('Cancel') }}
              </button>
              <button
                @click="runImport(true)"
                :disabled="importLoading"
                class="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                {{ importLoading ? __('Testing...') : __('Test Import (Dry Run)') }}
              </button>
              <button
                @click="runImport(false)"
                :disabled="importLoading"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                {{ importLoading ? __('Importing...') : __('Start Import') }}
              </button>
            </template>

            <!-- Stage 2 Actions -->
            <template v-else-if="importStage === 'preview'">
              <button
                @click="importStage = 'input'"
                class="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ __('Back') }}
              </button>
              <button
                @click="runImport(false)"
                :disabled="importLoading"
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                {{ importLoading ? __('Importing...') : __('Yes, start real import.') }}
              </button>
            </template>

            <!-- Stage 3 Actions -->
            <template v-else-if="importStage === 'complete'">
              <button
                @click="showImportModal = false"
                class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                {{ __('Close') }}
              </button>
            </template>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
