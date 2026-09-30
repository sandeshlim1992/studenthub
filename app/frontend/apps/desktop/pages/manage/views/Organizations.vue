<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { useOrganizationEdit } from '#desktop/entities/organization/composables/useOrganizationEdit.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

interface OrganizationItem {
  id: number
  name: string
  shared: boolean
  active: boolean
  note?: string
  domainAssignment?: boolean | null
}

const router = useRouter()
const organizations = ref<OrganizationItem[]>([])
const totalCount = ref(0)
const loading = ref(true)

const searchQuery = ref('')
const currentPage = ref(1)
const perPage = ref(50)

const activeActionMenuOrgId = ref<number | null>(null)

const { openOrganizationEditFlyout } = useOrganizationEdit()

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

// Trigger native edit organization flyout
const handleEditOrganization = (org: OrganizationItem) => {
  const editableOrg = {
    ...org,
    id: convertToGraphQLId('Organization', org.id)
  }
  openOrganizationEditFlyout(editableOrg, {
    onSuccess: () => {
      fetchOrganizations()
    }
  })
}

// Delete organization
const handleDeleteOrganization = async (orgId: number, name: string) => {
  if (!confirm(__('Are you sure you want to delete organization %s?').replace('%s', name))) {
    return
  }
  try {
    const res = await fetch(`/api/v1/organizations/${orgId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      }
    })
    if (res.ok) {
      fetchOrganizations()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete organization.'))
    }
  } catch (e) {
    console.error('Failed to delete organization:', e)
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
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            {{ __('Single-Brand Organization') }}
          </span>
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
      <div class="bg-white dark:bg-[#0f172a]/40 border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-xs mb-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6 first:rounded-tl-2xl">{{ __('Name') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Shared') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6">{{ __('Note') }}</th>
              <th class="py-4 px-6 text-right w-16 last:rounded-tr-2xl"></th>
            </tr>
          </thead>
          
          <tbody v-if="loading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div></td>
              <td class="py-4 px-6 text-right"></td>
            </tr>
          </tbody>

          <tbody v-else-if="organizations.length === 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td colspan="5" class="py-12 text-center text-slate-500 dark:text-slate-400">
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
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ org.name }}
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
</template>
