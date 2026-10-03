<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface UserAsset {
  id: number
  firstname?: string
  lastname?: string
  email?: string
  login?: string
  organization_id?: number
}

interface DataPrivacyTaskRecord {
  id: number
  deletable_id: number
  state: 'in_process' | 'completed' | 'failed'
  preferences?: {
    delete_organization?: boolean
    ticket_ids?: number[]
    error?: string
  }
  created_at: string
  updated_at: string
}

interface TaskByStateResponse {
  record_ids: {
    in_process: number[]
    completed: number[]
    failed: number[]
  }
  assets?: {
    User?: Record<string, UserAsset>
    DataPrivacyTask?: Record<string, DataPrivacyTaskRecord>
  }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Data Privacy') },
]

const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const activeTab = ref<'all' | 'in_process' | 'completed' | 'failed'>('all')

const allTasks = ref<DataPrivacyTaskRecord[]>([])
const userAssets = ref<Record<string, UserAsset>>({})
const expandedTaskIds = ref<Record<number, boolean>>({})

// New Deletion Task Modal
const newModal = ref<{
  isOpen: boolean
  userSearchQuery: string
  isSearchingUsers: boolean
  searchedUsers: UserAsset[]
  selectedUser: UserAsset | null
  isAssessingImpact: boolean
  customerTicketCount: number
  ownerTicketCount: number
  isSoleMember: boolean
  deleteOrganization: boolean
  confirmationText: string
  isSubmitting: boolean
}>({
  isOpen: false,
  userSearchQuery: '',
  isSearchingUsers: false,
  searchedUsers: [],
  selectedUser: null,
  isAssessingImpact: false,
  customerTicketCount: 0,
  ownerTicketCount: 0,
  isSoleMember: false,
  deleteOrganization: false,
  confirmationText: '',
  isSubmitting: false,
})

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const fetchTasks = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/data_privacy_tasks/by_state', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data: TaskByStateResponse = await res.json()

    userAssets.value = data.assets?.User || {}

    const taskMap = data.assets?.DataPrivacyTask || {}
    const inProcess = (data.record_ids.in_process || [])
      .map((id) => taskMap[String(id)])
      .filter(Boolean)
    const completed = (data.record_ids.completed || [])
      .map((id) => taskMap[String(id)])
      .filter(Boolean)
    const failed = (data.record_ids.failed || []).map((id) => taskMap[String(id)]).filter(Boolean)

    allTasks.value = [...inProcess, ...completed, ...failed]
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to load data privacy tasks.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchTasks()
})

const inProcessTasks = computed(() => allTasks.value.filter((t) => t.state === 'in_process'))
const completedTasks = computed(() => allTasks.value.filter((t) => t.state === 'completed'))
const failedTasks = computed(() => allTasks.value.filter((t) => t.state === 'failed'))

const filteredTasks = computed(() => {
  if (activeTab.value === 'in_process') return inProcessTasks.value
  if (activeTab.value === 'completed') return completedTasks.value
  if (activeTab.value === 'failed') return failedTasks.value
  return allTasks.value
})

const getUserDisplayName = (userId: number): string => {
  const user = userAssets.value[String(userId)]
  if (!user) return `User #${userId}`
  const name = [user.firstname, user.lastname].filter(Boolean).join(' ')
  return name ? `${name} (${user.email || user.login})` : user.email || `User #${userId}`
}

const toggleTaskExpand = (taskId: number) => {
  expandedTaskIds.value[taskId] = !expandedTaskIds.value[taskId]
}

const openNewTaskModal = () => {
  newModal.value = {
    isOpen: true,
    userSearchQuery: '',
    isSearchingUsers: false,
    searchedUsers: [],
    selectedUser: null,
    isAssessingImpact: false,
    customerTicketCount: 0,
    ownerTicketCount: 0,
    isSoleMember: false,
    deleteOrganization: false,
    confirmationText: '',
    isSubmitting: false,
  }
}

const onUserSearchInput = () => {
  if (userSearchDebounce) clearTimeout(userSearchDebounce)
  const q = newModal.value.userSearchQuery.trim()
  if (!q) {
    newModal.value.searchedUsers = []
    return
  }
  userSearchDebounce = setTimeout(async () => {
    newModal.value.isSearchingUsers = true
    try {
      const res = await fetch(`/api/v1/users/search?query=${encodeURIComponent(q)}&limit=10`, {
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      if (res.ok) {
        const users = await res.json()
        newModal.value.searchedUsers = Array.isArray(users) ? users : []
      }
    } catch {
      newModal.value.searchedUsers = []
    } finally {
      newModal.value.isSearchingUsers = false
    }
  }, 300)
}

const selectUserForDeletion = async (user: UserAsset) => {
  newModal.value.selectedUser = user
  newModal.value.isAssessingImpact = true
  newModal.value.customerTicketCount = 0
  newModal.value.ownerTicketCount = 0
  newModal.value.isSoleMember = false
  newModal.value.deleteOrganization = false

  try {
    // 1. Check customer tickets count
    const condCustomer = {
      condition: {
        'ticket.customer_id': {
          operator: 'is',
          pre_condition: 'specific',
          value: user.id,
        },
      },
    }
    const resCustomer = await fetch('/api/v1/tickets/selector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(condCustomer),
    })
    if (resCustomer.ok) {
      const dataCust = await resCustomer.json()
      newModal.value.customerTicketCount = dataCust.object_count || 0
    }

    // 2. Check owner tickets count
    const condOwner = {
      condition: {
        'ticket.owner_id': {
          operator: 'is',
          pre_condition: 'specific',
          value: user.id,
        },
      },
    }
    const resOwner = await fetch('/api/v1/tickets/selector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(condOwner),
    })
    if (resOwner.ok) {
      const dataOwner = await resOwner.json()
      newModal.value.ownerTicketCount = dataOwner.object_count || 0
    }

    // 3. Check organization sole membership
    if (user.organization_id) {
      const resOrg = await fetch(`/api/v1/organizations/${user.organization_id}`, {
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      if (resOrg.ok) {
        const orgData = await resOrg.json()
        if (orgData.member_ids && orgData.member_ids.length <= 1) {
          newModal.value.isSoleMember = true
          newModal.value.deleteOrganization = true
        }
      }
    }
  } catch {
    // Non-fatal error during preview
  } finally {
    newModal.value.isAssessingImpact = false
  }
}

const submitDeletionTask = async () => {
  const { selectedUser, confirmationText } = newModal.value
  if (!selectedUser) {
    errorMessage.value = __('Please select a user to delete.')
    return
  }
  if (confirmationText.trim().toUpperCase() !== 'DELETE') {
    errorMessage.value = __('Please type DELETE to confirm irreversible user erasure.')
    return
  }

  newModal.value.isSubmitting = true
  errorMessage.value = ''
  try {
    const payload = {
      deletable_id: selectedUser.id,
      preferences: {
        delete_organization: newModal.value.deleteOrganization,
        sure: 'DELETE',
      },
    }

    const res = await fetch('/api/v1/data_privacy_tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${res.status}`)
    }

    newModal.value.isOpen = false
    successMessage.value = __('Data privacy deletion task scheduled successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchTasks()
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to schedule deletion task.')
  } finally {
    newModal.value.isSubmitting = false
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <button
                type="button"
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                :title="__('Back to Administration')"
                :aria-label="__('Back to Administration')"
                @click="router.push('/manage')"
              >
                <CommonIcon name="arrow-left" class="h-4 w-4" />
              </button>
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                >
                  <CommonIcon name="eye-slash" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Data Privacy & GDPR Erasure') }}
                </h1>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ __('System') }}
              </span>
            </div>
            <p class="text-sm text-slate-500 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
              {{
                __(
                  'Execute GDPR compliant "Right to be Forgotten" deletion tasks for users, associated tickets, and related assets.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700"
              :aria-label="__('New Deletion Task')"
              @click="openNewTaskModal"
            >
              <CommonIcon name="trash" class="h-4 w-4" />
              {{ __('New Deletion Task') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        role="status"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span class="flex-1">{{ successMessage }}</span>
        <button
          type="button"
          class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
        role="alert"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span class="flex-1">{{ errorMessage }}</span>
        <button
          type="button"
          class="text-red-600 hover:text-red-800 dark:text-red-400"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <!-- Overview Status Counters -->
      <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <!-- In Process -->
        <button
          type="button"
          class="cursor-pointer rounded-2xl border p-5 text-start shadow-xs transition"
          :class="
            activeTab === 'in_process'
              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-700 dark:bg-blue-950/30'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-[#1e293b] dark:hover:bg-slate-800/50'
          "
          :aria-label="__('Filter by in process tasks')"
          @click="activeTab = activeTab === 'in_process' ? 'all' : 'in_process'"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
            >
              {{ __('In Process') }}
            </span>
            <span
              class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
            >
              {{ inProcessTasks.length }}
            </span>
          </div>
          <p class="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {{ inProcessTasks.length }}
          </p>
        </button>

        <!-- Completed -->
        <button
          type="button"
          class="cursor-pointer rounded-2xl border p-5 text-start shadow-xs transition"
          :class="
            activeTab === 'completed'
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 dark:border-emerald-700 dark:bg-emerald-950/30'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-[#1e293b] dark:hover:bg-slate-800/50'
          "
          :aria-label="__('Filter by completed tasks')"
          @click="activeTab = activeTab === 'completed' ? 'all' : 'completed'"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
            >
              {{ __('Completed') }}
            </span>
            <span
              class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
            >
              {{ completedTasks.length }}
            </span>
          </div>
          <p class="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {{ completedTasks.length }}
          </p>
        </button>

        <!-- Failed -->
        <button
          type="button"
          class="cursor-pointer rounded-2xl border p-5 text-start shadow-xs transition"
          :class="
            activeTab === 'failed'
              ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500/20 dark:border-red-700 dark:bg-red-950/30'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-[#1e293b] dark:hover:bg-slate-800/50'
          "
          :aria-label="__('Filter by failed tasks')"
          @click="activeTab = activeTab === 'failed' ? 'all' : 'failed'"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
            >
              {{ __('Failed') }}
            </span>
            <span
              class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 dark:bg-red-900/60 dark:text-red-300"
            >
              {{ failedTasks.length }}
            </span>
          </div>
          <p class="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {{ failedTasks.length }}
          </p>
        </button>
      </div>

      <!-- Tasks Table -->
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-12 text-center">
          <CommonIcon name="loading" class="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ __('Loading data privacy tasks...') }}
          </p>
        </div>

        <div v-else-if="filteredTasks.length === 0" class="p-12 text-center">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          >
            <CommonIcon name="shield-check" class="h-6 w-6" />
          </div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">
            {{ __('No deletion tasks') }}
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{
              activeTab !== 'all'
                ? __('No tasks found under this category filter.')
                : __('No data privacy deletion tasks have been scheduled.')
            }}
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-start text-sm text-slate-600 dark:text-slate-300">
            <thead
              class="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Task ID') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Target User') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Tickets Affected') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Scheduled At') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Status') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr
                v-for="task in filteredTasks"
                :key="task.id"
                class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <!-- ID -->
                <td class="px-6 py-4 font-mono text-xs whitespace-nowrap text-slate-500">
                  #{{ task.id }}
                </td>

                <!-- Target User -->
                <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  {{ getUserDisplayName(task.deletable_id) }}
                </td>

                <!-- Tickets Affected -->
                <td class="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                  <div
                    v-if="task.preferences?.ticket_ids && task.preferences.ticket_ids.length > 0"
                  >
                    <span class="font-medium text-slate-800 dark:text-slate-200">
                      {{ __('%s ticket(s)', task.preferences.ticket_ids.length) }}
                    </span>
                    <button
                      type="button"
                      class="text-xs text-blue-600 hover:underline ltr:ml-2 rtl:mr-2 dark:text-blue-400"
                      :aria-label="__('Toggle ticket list for task %s', String(task.id))"
                      @click="toggleTaskExpand(task.id)"
                    >
                      {{ expandedTaskIds[task.id] ? __('See less') : __('See more') }}
                    </button>
                    <div
                      v-if="expandedTaskIds[task.id]"
                      class="text-2xs mt-1 font-mono text-slate-500 dark:text-slate-400"
                    >
                      {{ task.preferences.ticket_ids.join(', ') }}
                    </div>
                  </div>
                  <span v-else>—</span>
                </td>

                <!-- Created At -->
                <td class="px-6 py-4 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {{ new Date(task.created_at).toLocaleString() }}
                </td>

                <!-- Status Badge -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase"
                    :class="{
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300':
                        task.state === 'in_process',
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300':
                        task.state === 'completed',
                      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300':
                        task.state === 'failed',
                    }"
                  >
                    {{ task.state }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- New Deletion Task Modal -->
      <div
        v-if="newModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('New Data Privacy Task')"
      >
        <div
          class="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800"
          >
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                {{ __('Schedule User Deletion') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Permanently erase a user and anonymize related records.') }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              :aria-label="__('Close')"
              @click="newModal.isOpen = false"
            >
              <CommonIcon name="close" class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-4 space-y-4">
            <!-- User search -->
            <div>
              <label
                for="privacy-user-search"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Find User') }} *
              </label>
              <div class="relative mt-1">
                <input
                  id="privacy-user-search"
                  v-model="newModal.userSearchQuery"
                  type="search"
                  class="block w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  :placeholder="__('Search by user name, login, or email...')"
                  @input="onUserSearchInput"
                />
                <div
                  v-if="newModal.isSearchingUsers"
                  class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3"
                >
                  <CommonIcon name="loading" class="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>

              <!-- Search suggestions -->
              <div
                v-if="newModal.searchedUsers.length > 0 && !newModal.selectedUser"
                class="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1 text-xs dark:border-slate-700 dark:bg-slate-800/50"
              >
                <button
                  v-for="u in newModal.searchedUsers"
                  :key="u.id"
                  type="button"
                  class="w-full rounded-lg px-2.5 py-1.5 text-start transition hover:bg-red-50 hover:text-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                  :aria-label="__('Select user %s', u.email || String(u.id))"
                  @click="selectUserForDeletion(u)"
                >
                  <span class="font-medium text-slate-800 dark:text-slate-200">
                    {{ [u.firstname, u.lastname].filter(Boolean).join(' ') || u.login }}
                  </span>
                  <span class="text-slate-400 ltr:ml-2 rtl:mr-2">
                    {{ u.email }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Selected user card & Impact Preview -->
            <div
              v-if="newModal.selectedUser"
              class="rounded-xl border border-red-200 bg-red-50/50 p-4 text-xs dark:border-red-900/40 dark:bg-red-950/20"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-red-900 dark:text-red-200">
                    {{
                      [newModal.selectedUser.firstname, newModal.selectedUser.lastname]
                        .filter(Boolean)
                        .join(' ') || newModal.selectedUser.login
                    }}
                  </span>
                  <p class="text-2xs text-red-700 dark:text-red-300">
                    {{ newModal.selectedUser.email }}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-2xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  :aria-label="__('Change user')"
                  @click="newModal.selectedUser = null"
                >
                  {{ __('Change') }}
                </button>
              </div>

              <!-- Impact counts -->
              <div class="mt-3 space-y-1.5 border-t border-red-200 pt-3 dark:border-red-900/50">
                <div class="flex justify-between">
                  <span class="text-slate-600 dark:text-slate-400">
                    {{ __('Tickets as Customer:') }}
                  </span>
                  <span class="font-bold text-red-800 dark:text-red-300">
                    {{ newModal.customerTicketCount }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600 dark:text-slate-400">
                    {{ __('Tickets as Agent/Owner:') }}
                  </span>
                  <span class="font-bold text-red-800 dark:text-red-300">
                    {{ newModal.ownerTicketCount }}
                  </span>
                </div>
              </div>

              <!-- Sole member delete organization option -->
              <div
                v-if="newModal.isSoleMember"
                class="mt-3 flex items-center space-x-2 border-t border-red-200 pt-2 rtl:space-x-reverse dark:border-red-900/50"
              >
                <input
                  id="delete-org-check"
                  v-model="newModal.deleteOrganization"
                  type="checkbox"
                  class="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <label for="delete-org-check" class="text-2xs text-red-800 dark:text-red-300">
                  {{ __('Also delete organization (user is the sole member)?') }}
                </label>
              </div>
            </div>

            <!-- Confirmation typing required -->
            <div v-if="newModal.selectedUser">
              <label
                for="privacy-confirm-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Type "DELETE" to confirm irreversible erasure') }} *
              </label>
              <input
                id="privacy-confirm-input"
                v-model="newModal.confirmationText"
                type="text"
                class="mt-1 block w-full rounded-xl border border-red-300 px-3.5 py-2 font-mono text-xs text-red-900 uppercase focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none dark:border-red-800 dark:bg-slate-900 dark:text-red-200"
                placeholder="DELETE"
                required
              />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Cancel')"
              @click="newModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
              :disabled="
                newModal.isSubmitting ||
                !newModal.selectedUser ||
                newModal.confirmationText.trim().toUpperCase() !== 'DELETE'
              "
              :aria-label="__('Erase User')"
              @click="submitDeletionTask"
            >
              <CommonIcon
                v-if="newModal.isSubmitting"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Erase User') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
