<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface OrganizationItem {
  id: number
  name: string
  shared: boolean
  domain?: string
  domain_assignment?: boolean
  vip?: boolean
  active: boolean
  note?: string
  updated_at?: string
  created_at?: string
}

const router = useRouter()
const organizations = ref<OrganizationItem[]>([])
const totalCount = ref(0)
const loading = ref(true)

const searchQuery = ref('')
const currentPage = ref(1)
const perPage = ref(50)

const activeActionMenuOrgId = ref<number | null>(null)

// Drawer state
const showDrawer = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const drawerOrgId = ref<number | null>(null)
const submitting = ref(false)

const form = ref({
  name: '',
  shared: true,
  domain: '',
  domain_assignment: false,
  vip: false,
  active: true,
  note: ''
})

// CSV Import Modal State
const showImportModal = ref(false)
const importStage = ref<'input' | 'preview' | 'complete'>('input')
const importContent = ref('')
const importFile = ref<File | null>(null)
const importColSep = ref(',')
const importDeleteOption = ref(false)
const importLoading = ref(false)
const importError = ref('')
const importResult = ref<{
  result?: string
  stats?: {
    created?: number
    updated?: number
    deleted?: number
    total?: number
  }
} | null>(null)

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

// Breadcrumb navigation
const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Organizations') }
]

// Toggle actions menu dropdown
const toggleActionMenu = (orgId: number, event: Event) => {
  event.stopPropagation()
  if (activeActionMenuOrgId.value === orgId) {
    activeActionMenuOrgId.value = null
  } else {
    activeActionMenuOrgId.value = orgId
  }
}

// Close menus when clicking outside
const closeActionMenu = () => {
  activeActionMenuOrgId.value = null
}

// Fetch organizations with search and pagination
const fetchOrganizations = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * perPage.value
    let url = `/api/v1/organizations/search?with_total_count=true&limit=${perPage.value}&offset=${offset}`
    
    const term = searchQuery.value.trim()
    url += `&query=${encodeURIComponent(term || '*')}`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (res.ok) {
      const data = await res.json()
      organizations.value = Array.isArray(data.records) ? data.records : []
      totalCount.value = typeof data.total_count === 'number' ? data.total_count : 0
    }
  } catch (e) {
    console.error('Failed to fetch organizations:', e)
  } finally {
    loading.value = false
  }
}

// Reset page and reload on search change
watch(searchQuery, () => {
  currentPage.value = 1
  fetchOrganizations()
})

// Reload on page change
watch(currentPage, () => {
  fetchOrganizations()
})

// Clean domain input
const cleanDomain = () => {
  if (!form.value.domain) return
  form.value.domain = form.value.domain
    .replace(/@/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

// Open drawer for organization creation
const handleNewOrganization = () => {
  drawerMode.value = 'create'
  drawerOrgId.value = null
  form.value = {
    name: '',
    shared: true,
    domain: '',
    domain_assignment: false,
    vip: false,
    active: true,
    note: ''
  }
  showDrawer.value = true
}

// Clone organization
const handleCloneOrganization = async (org: OrganizationItem) => {
  activeActionMenuOrgId.value = null
  drawerMode.value = 'create'
  drawerOrgId.value = null

  form.value = {
    name: `${__('Clone')}: ${org.name}`,
    shared: org.shared ?? true,
    domain: org.domain || '',
    domain_assignment: org.domain_assignment ?? false,
    vip: org.vip ?? false,
    active: org.active ?? true,
    note: org.note || ''
  }
  showDrawer.value = true

  // Hydrate full source details
  try {
    const res = await fetch(`/api/v1/organizations/${org.id}?full=true`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const fullOrg = await res.json()
      form.value = {
        name: `${__('Clone')}: ${fullOrg.name}`,
        shared: fullOrg.shared ?? true,
        domain: fullOrg.domain || '',
        domain_assignment: fullOrg.domain_assignment ?? false,
        vip: fullOrg.vip ?? false,
        active: fullOrg.active ?? true,
        note: fullOrg.note || ''
      }
    }
  } catch (e) {
    console.error('Failed to hydrate cloned organization:', e)
  }
}

// Open drawer for organization editing
const handleEditOrganization = async (org: OrganizationItem) => {
  activeActionMenuOrgId.value = null
  drawerMode.value = 'edit'
  drawerOrgId.value = org.id

  // Fast pre-fill
  form.value = {
    name: org.name,
    shared: org.shared ?? true,
    domain: org.domain || '',
    domain_assignment: org.domain_assignment ?? false,
    vip: org.vip ?? false,
    active: org.active ?? true,
    note: org.note || ''
  }
  showDrawer.value = true

  // Hydrate full backend record
  try {
    const res = await fetch(`/api/v1/organizations/${org.id}?full=true`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (res.ok) {
      const fullOrg = await res.json()
      if (drawerOrgId.value === org.id) {
        form.value = {
          name: fullOrg.name,
          shared: fullOrg.shared ?? true,
          domain: fullOrg.domain || '',
          domain_assignment: fullOrg.domain_assignment ?? false,
          vip: fullOrg.vip ?? false,
          active: fullOrg.active ?? true,
          note: fullOrg.note || ''
        }
      }
    }
  } catch (e) {
    console.error('Failed to hydrate organization details:', e)
  }
}

const closeDrawer = () => {
  showDrawer.value = false
}

// Save organization (Create or Update)
const saveOrganization = async () => {
  cleanDomain()

  if (!form.value.name.trim()) {
    alert(__('Please enter an organization name.'))
    return
  }

  if (form.value.domain_assignment && !form.value.domain.trim()) {
    alert(__('Domain is required when Domain Based Assignment is enabled.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      shared: Boolean(form.value.shared),
      domain: form.value.domain.trim(),
      domain_assignment: Boolean(form.value.domain_assignment),
      vip: Boolean(form.value.vip),
      active: Boolean(form.value.active),
      note: form.value.note.trim()
    }

    const isEdit = drawerMode.value === 'edit'
    const url = isEdit ? `/api/v1/organizations/${drawerOrgId.value}` : '/api/v1/organizations'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
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
      fetchOrganizations()
    } else {
      const data = await res.json()
      alert(data.error_human || data.error || __('Failed to save organization.'))
    }
  } catch (e) {
    console.error('Failed to save organization:', e)
  } finally {
    submitting.value = false
  }
}

// Delete organization
const handleDeleteOrganization = async (orgId: number, name: string) => {
  activeActionMenuOrgId.value = null
  if (!confirm(__('Are you sure you want to delete organization %s?').replace('%s', name))) {
    return
  }
  try {
    const res = await fetch(`/api/v1/organizations/${orgId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf()
      }
    })
    if (res.ok) {
      fetchOrganizations()
    } else {
      const data = await res.json()
      alert(data.error_human || data.error || __('Failed to delete organization.'))
    }
  } catch (e) {
    console.error('Failed to delete organization:', e)
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
  window.location.href = '/api/v1/organizations/import_example'
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

    const res = await fetch(`/api/v1/organizations/import${dryRun ? '?try=true' : ''}`, {
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
        fetchOrganizations()
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
  fetchOrganizations()
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
            {{ __('Organizations') }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="openImportModal"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <CommonIcon name="upload" class="w-4 h-4 text-slate-500" />
            {{ __('Import') }}
          </button>
          <button
            @click="handleNewOrganization"
            class="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2"
          >
            <CommonIcon name="plus" class="w-4 h-4" />
            {{ __('New Organization') }}
          </button>
        </div>
      </div>

      <!-- Search Box -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for organizations')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-[#94a3b8] placeholder:text-slate-400 dark:placeholder:text-[#475569] text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e2d45] transition-all duration-150"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#475569]">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table Section -->
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs mb-6 overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 first:rounded-tl-2xl">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Domain') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Shared') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6">{{ __('Note') }}</th>
              <th class="py-4 px-6 text-right w-16 last:rounded-tr-2xl"></th>
            </tr>
          </thead>
          
          <tbody v-if="loading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div></td>
              <td class="py-4 px-6 text-right"></td>
            </tr>
          </tbody>

          <tbody v-else-if="organizations.length === 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
                  <CommonIcon name="buildings" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No organizations found') }}</h3>
                <p class="text-xs">{{ __('No organizations matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="org in organizations"
              :key="org.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
              @click="handleEditOrganization(org)"
            >
              <!-- Name & VIP -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                <div class="flex items-center gap-2">
                  <span>{{ org.name }}</span>
                  <span
                    v-if="org.vip"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                  >
                    VIP
                  </span>
                </div>
              </td>
              <!-- Domain & Domain-based Assignment -->
              <td class="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                <div v-if="org.domain" class="flex items-center gap-2">
                  <span class="font-mono text-xs">{{ org.domain }}</span>
                  <span
                    v-if="org.domain_assignment"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    :title="__('Domain-based user assignment active')"
                  >
                    {{ __('Auto-Assign') }}
                  </span>
                </div>
                <span v-else class="text-slate-400">-</span>
              </td>
              <!-- Shared -->
              <td class="py-4 px-6 text-center">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full"
                  :class="org.shared ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon v-if="org.shared" name="check2" class="w-3.5 h-3.5" />
                  <span v-else class="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"></span>
                </span>
              </td>
              <!-- Active Status -->
              <td class="py-4 px-6 text-center">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full"
                  :class="org.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon v-if="org.active" name="check2" class="w-3.5 h-3.5" />
                  <span v-else class="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"></span>
                </span>
              </td>
              <!-- Note -->
              <td class="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-sm truncate">
                {{ org.note || '-' }}
              </td>
              <!-- Actions Dropdown -->
              <td class="py-4 px-6 text-right relative">
                <button
                  @click="toggleActionMenu(org.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                
                <!-- Action Dropdown Card -->
                <div
                  v-if="activeActionMenuOrgId === org.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="handleEditOrganization(org)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Edit') }}
                    </button>
                    <button
                      @click="handleCloneOrganization(org)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      {{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteOrganization(org.id, org.name)"
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

  <!-- Slide-over Drawer for Create / Edit Organization -->
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
            {{ drawerMode === 'create' ? __('New Organization') : __('Edit Organization') }}
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
          <!-- Organization Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <!-- Domain -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {{ __('Domain') }}
            </label>
            <input
              v-model="form.domain"
              type="text"
              @blur="cleanDomain"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
              placeholder="example.com"
            />
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {{ __('Email domain without @ (e.g. example.com).') }}
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
              :placeholder="__('Internal notes about this organization...')"
            ></textarea>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {{ __('Notes are visible to agents only, never to customers.') }}
            </p>
          </div>

          <!-- Toggles Section -->
          <div class="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <!-- Shared Organization -->
            <div class="flex items-start gap-3">
              <input
                v-model="form.shared"
                type="checkbox"
                id="org-shared"
                class="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <div>
                <label for="org-shared" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  {{ __('Shared organization') }}
                </label>
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ __("Customers in the organization can view each other's tickets.") }}
                </p>
              </div>
            </div>

            <!-- Domain Based Assignment -->
            <div class="flex items-start gap-3">
              <input
                v-model="form.domain_assignment"
                type="checkbox"
                id="org-domain-assignment"
                class="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <div>
                <label for="org-domain-assignment" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  {{ __('Domain based assignment') }}
                </label>
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ __('Automatically assign new users with matching email domain to this organization.') }}
                </p>
              </div>
            </div>

            <!-- VIP Status -->
            <div class="flex items-start gap-3">
              <input
                v-model="form.vip"
                type="checkbox"
                id="org-vip"
                class="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <div>
                <label for="org-vip" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  {{ __('VIP Organization') }}
                </label>
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ __('Highlights tickets from this organization as VIP.') }}
                </p>
              </div>
            </div>

            <!-- Active Status -->
            <div class="flex items-center gap-3">
              <input
                v-model="form.active"
                type="checkbox"
                id="org-active"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <label for="org-active" class="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
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
            @click="saveOrganization"
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

  <!-- 2-Stage CSV Bulk Import Modal -->
  <Teleport to="body">
    <div
      v-if="showImportModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity z-50 flex items-center justify-center p-4"
      @click="showImportModal = false"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CommonIcon name="upload" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Import Organizations') }}
              </h3>
              <p class="text-xs text-slate-400 dark:text-slate-500">
                {{ __('Upload a CSV file or paste raw content to bulk import organizations.') }}
              </p>
            </div>
          </div>
          <button
            @click="showImportModal = false"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body: Stage 1 - Input -->
        <div v-if="importStage === 'input'" class="p-6 overflow-y-auto space-y-5 text-left">
          <!-- Example File Download Button -->
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
            <div>
              <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ __('Example CSV File') }}</div>
              <div class="text-xs text-slate-400 dark:text-slate-500">{{ __('Download a sample template with expected organization columns.') }}</div>
            </div>
            <button
              @click="downloadExampleCsv"
              class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CommonIcon name="download" class="w-3.5 h-3.5" />
              {{ __('Download') }}
            </button>
          </div>

          <!-- File Upload Picker -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {{ __('Upload CSV File') }}
            </label>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              @change="handleFileUpload"
              class="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300 cursor-pointer"
            />
          </div>

          <!-- Or Raw Paste Area -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {{ __('Or Paste CSV Data') }}
            </label>
            <textarea
              v-model="importContent"
              rows="6"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500 transition-colors"
              placeholder="name,domain,domain_assignment,shared,vip,note&#10;Acme Corp,acme.com,true,true,false,Partner"
            ></textarea>
          </div>

          <!-- Separator & Delete Options -->
          <div class="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {{ __('Separator') }}
              </label>
              <select
                v-model="importColSep"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#2d3f5c] rounded-xl text-xs focus:outline-hidden focus:border-blue-500 transition-colors"
              >
                <option value=",">{{ __('Comma ( , )') }}</option>
                <option value=";">{{ __('Semicolon ( ; )') }}</option>
                <option value="&#9;">{{ __('Tab') }}</option>
              </select>
            </div>
            <div class="flex items-center gap-2 pt-6">
              <input
                v-model="importDeleteOption"
                type="checkbox"
                id="org-import-delete"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <label for="org-import-delete" class="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                {{ __('Delete missing records') }}
              </label>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="importError" class="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
            {{ importError }}
          </div>
        </div>

        <!-- Modal Body: Stage 2 - Dry Run Preview Results -->
        <div v-else-if="importStage === 'preview'" class="p-6 overflow-y-auto space-y-5 text-left">
          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <div class="font-semibold text-sm mb-1">{{ __('The test run was successful!') }}</div>
            <p>{{ __('Review the estimated record modifications before proceeding with permanent changes.') }}</p>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ importResult?.stats?.total ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Total') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-green-600">{{ importResult?.stats?.created ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Create') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-blue-600">{{ importResult?.stats?.updated ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Update') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-red-600">{{ importResult?.stats?.deleted ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Delete') }}</div>
            </div>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ __('Do you really want to import this data permanently into the database?') }}
          </p>
        </div>

        <!-- Modal Body: Stage 3 - Complete Summary -->
        <div v-else-if="importStage === 'complete'" class="p-6 overflow-y-auto space-y-5 text-center">
          <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CommonIcon name="check2" class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-900 dark:text-white">{{ __('Import Completed Successfully') }}</h4>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {{ __('The organization records have been synchronized.') }}
            </p>
          </div>

          <div class="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-slate-900 dark:text-white">{{ importResult?.stats?.total ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Total') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-green-600">{{ importResult?.stats?.created ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Created') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-blue-600">{{ importResult?.stats?.updated ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Updated') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-red-600">{{ importResult?.stats?.deleted ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Deleted') }}</div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
          <template v-if="importStage === 'input'">
            <button
              @click="showImportModal = false"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {{ __('Cancel') }}
            </button>
            <button
              @click="runImport(true)"
              :disabled="importLoading"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CommonIcon v-if="importLoading" name="loading" class="w-4 h-4 animate-spin" />
              <span>{{ importLoading ? __('Testing Import...') : __('Start Test Import') }}</span>
            </button>
          </template>

          <template v-else-if="importStage === 'preview'">
            <button
              @click="importStage = 'input'"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {{ __('Back') }}
            </button>
            <button
              @click="runImport(false)"
              :disabled="importLoading"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CommonIcon v-if="importLoading" name="loading" class="w-4 h-4 animate-spin" />
              <span>{{ importLoading ? __('Importing...') : __('Yes, start real import') }}</span>
            </button>
          </template>

          <template v-else-if="importStage === 'complete'">
            <button
              @click="showImportModal = false"
              class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
            >
              {{ __('Done') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
