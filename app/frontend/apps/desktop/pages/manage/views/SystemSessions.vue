<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface UserAsset {
  id: number
  firstname?: string
  lastname?: string
  email?: string
  login?: string
}

interface SessionRecord {
  id: number | string
  created_at: string
  updated_at: string
  data?: {
    user_id?: number
    user_agent?: string
    remote_ip?: string
    geo?: {
      country_name?: string
      city_name?: string
    }
  }
}

interface SessionsApiResponse {
  sessions: SessionRecord[]
  assets?: {
    User?: Record<string, UserAsset>
  }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Sessions') },
]

const isLoading = ref(true)
const isRefreshing = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const searchQuery = ref('')

const sessions = ref<SessionRecord[]>([])
const userAssets = ref<Record<string, UserAsset>>({})

// Terminate modal
const terminateModal = ref<{
  isOpen: boolean
  session: SessionRecord | null
  isTerminating: boolean
}>({
  isOpen: false,
  session: null,
  isTerminating: false,
})

let pollTimer: ReturnType<typeof setInterval> | null = null

const fetchSessions = async (showLoadingIndicator = false) => {
  if (showLoadingIndicator) isLoading.value = true
  isRefreshing.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/sessions', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data: SessionsApiResponse = await res.json()

    sessions.value = Array.isArray(data.sessions) ? data.sessions : []
    userAssets.value = data.assets?.User || {}
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to load active sessions.')
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

onMounted(() => {
  void fetchSessions(true)
  pollTimer = setInterval(() => {
    void fetchSessions(false)
  }, 45000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

const getUser = (session: SessionRecord): UserAsset | null => {
  const userId = session.data?.user_id
  if (!userId) return null
  return userAssets.value[String(userId)] || null
}

const getUserDisplayName = (session: SessionRecord): string => {
  const user = getUser(session)
  if (!user) return __('Unknown User')
  const name = [user.firstname, user.lastname].filter(Boolean).join(' ')
  return name || user.email || user.login || `User #${user.id}`
}

const getUserEmail = (session: SessionRecord): string => {
  const user = getUser(session)
  return user?.email || user?.login || ''
}

const getLocationString = (session: SessionRecord): string => {
  const geo = session.data?.geo
  const ip = session.data?.remote_ip || ''
  if (geo?.country_name) {
    return geo.city_name ? `${geo.city_name}, ${geo.country_name}` : geo.country_name
  }
  return ip || __('Unknown Location')
}

const formatRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSec < 60) return __('just now')
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return __('%s min ago', diffMin)
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return __('%s hr ago', diffHrs)
    const diffDays = Math.floor(diffHrs / 24)
    return __('%s day(s) ago', diffDays)
  } catch {
    return dateStr
  }
}

const filteredSessions = computed(() => {
  if (!searchQuery.value.trim()) return sessions.value
  const q = searchQuery.value.toLowerCase()
  return sessions.value.filter((s) => {
    const userName = getUserDisplayName(s).toLowerCase()
    const userEmail = getUserEmail(s).toLowerCase()
    const ip = (s.data?.remote_ip || '').toLowerCase()
    const ua = (s.data?.user_agent || '').toLowerCase()
    const loc = getLocationString(s).toLowerCase()
    return (
      userName.includes(q) ||
      userEmail.includes(q) ||
      ip.includes(q) ||
      ua.includes(q) ||
      loc.includes(q)
    )
  })
})

const uniqueUsersCount = computed(() => {
  const userIds = new Set(sessions.value.map((s) => s.data?.user_id).filter(Boolean))
  return userIds.size
})

const confirmTerminateSession = (s: SessionRecord) => {
  terminateModal.value = {
    isOpen: true,
    session: s,
    isTerminating: false,
  }
}

const executeTerminateSession = async () => {
  const { session } = terminateModal.value
  if (!session) return
  terminateModal.value.isTerminating = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/sessions/${session.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    terminateModal.value.isOpen = false
    successMessage.value = __('Session has been terminated.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchSessions(false)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to terminate session.')
  } finally {
    terminateModal.value.isTerminating = false
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
                  <CommonIcon name="clock-history" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Active User Sessions') }}
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
                  'Inspect logged-in users, device platforms, client IP locations, and terminate unauthorized sessions.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              :disabled="isRefreshing"
              :aria-label="__('Refresh Sessions')"
              @click="fetchSessions(false)"
            >
              <CommonIcon
                name="refresh"
                class="h-4 w-4"
                :class="{ 'animate-spin': isRefreshing }"
              />
              {{ __('Refresh') }}
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
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
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

      <!-- Overview Stats Cards -->
      <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span
            class="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
          >
            {{ __('Total Active Sessions') }}
          </span>
          <p class="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {{ sessions.length }}
          </p>
        </div>

        <div
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span
            class="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
          >
            {{ __('Logged In Users') }}
          </span>
          <p class="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {{ uniqueUsersCount }}
          </p>
        </div>
      </div>

      <!-- Search filter -->
      <div
        class="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="relative w-full max-w-sm">
          <div class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
            <CommonIcon name="search" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            id="search-sessions-input"
            v-model="searchQuery"
            type="search"
            class="block w-full rounded-xl border border-slate-300 bg-slate-50/60 py-2 ps-9 pe-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            :placeholder="__('Filter by user, IP address, location, browser...')"
            :aria-label="__('Filter sessions')"
          />
        </div>
      </div>

      <!-- Sessions Table -->
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-12 text-center">
          <CommonIcon name="loading" class="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ __('Loading active sessions...') }}
          </p>
        </div>

        <div v-else-if="filteredSessions.length === 0" class="p-12 text-center">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          >
            <CommonIcon name="users" class="h-6 w-6" />
          </div>
          <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
            {{ __('No active sessions found') }}
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{
              searchQuery
                ? __('No sessions matched your filter criteria.')
                : __('There are currently no active user sessions recorded.')
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
                  {{ __('User') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Browser & Platform') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Location & IP') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Session Age') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Last Activity') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-end">
                  {{ __('Action') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr
                v-for="session in filteredSessions"
                :key="session.id"
                class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <!-- User -->
                <td class="px-6 py-4">
                  <div class="font-bold text-slate-900 dark:text-white">
                    {{ getUserDisplayName(session) }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {{ getUserEmail(session) }}
                  </div>
                </td>

                <!-- Browser -->
                <td class="max-w-xs px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                  <div class="truncate" :title="session.data?.user_agent || __('Unknown Agent')">
                    {{ session.data?.user_agent || '—' }}
                  </div>
                </td>

                <!-- Location & IP -->
                <td class="px-6 py-4 text-xs whitespace-nowrap">
                  <div class="font-medium text-slate-900 dark:text-white">
                    {{ getLocationString(session) }}
                  </div>
                  <div class="text-2xs font-mono text-slate-400">
                    {{ session.data?.remote_ip || '—' }}
                  </div>
                </td>

                <!-- Created At (Age) -->
                <td class="px-6 py-4 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {{ formatRelativeTime(session.created_at) }}
                </td>

                <!-- Updated At -->
                <td class="px-6 py-4 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {{ formatRelativeTime(session.updated_at) }}
                </td>

                <!-- Revoke Action -->
                <td class="px-6 py-4 text-end whitespace-nowrap">
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    :title="__('Terminate Session')"
                    :aria-label="__('Terminate session for %s', getUserDisplayName(session))"
                    @click="confirmTerminateSession(session)"
                  >
                    <CommonIcon name="trash" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Terminate Confirmation Modal -->
      <div
        v-if="terminateModal.isOpen && terminateModal.session"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Terminate Session Confirmation')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              <CommonIcon name="trash" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Terminate Active Session?') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'The user "%s" will be disconnected immediately and required to sign in again.',
                    getUserDisplayName(terminateModal.session),
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="terminateModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
              :disabled="terminateModal.isTerminating"
              :aria-label="__('Terminate Now')"
              @click="executeTerminateSession"
            >
              <CommonIcon
                v-if="terminateModal.isTerminating"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Terminate Now') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
